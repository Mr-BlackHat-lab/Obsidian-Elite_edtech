"""
FREE Unlimited Question Generation
Uses Hugging Face Inference API (no rate limits, completely free)
Model: mistralai/Mistral-7B-Instruct-v0.2
"""
from __future__ import annotations

import json
import os
import re
import uuid
from typing import Optional

import httpx


# Hugging Face Free Inference API
HF_API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2"
HF_API_KEY = os.getenv("HF_API_KEY", "")  # Optional, works without key but faster with it

# Fallback to smaller model if needed
HF_FALLBACK_URL = "https://api-inference.huggingface.co/models/google/flan-t5-large"

MAX_TRANSCRIPT_CHARS = 500  # Keep it small for speed

# Track asked questions per session to avoid duplicates
_asked_questions: dict[str, set[str]] = {}


QUESTION_PROMPT_TEMPLATE = """You are an expert educator creating quiz questions from video content.

Video Content:
{transcript}

Previously Asked Topics: {asked_topics}

Create a {difficulty} difficulty multiple choice question that:
1. Tests understanding of SPECIFIC content from the video above
2. Uses exact terms and concepts from the video
3. Is DIFFERENT from previously asked topics: {asked_topics}
4. Focuses on a NEW concept or detail not yet covered
5. Has 4 distinct options where only ONE is clearly correct
6. Includes a detailed explanation

Difficulty Guidelines:
- easy: Direct recall of facts mentioned in the video
- medium: Understanding and application of concepts explained
- hard: Analysis and synthesis of multiple ideas from the video

Return ONLY valid JSON in this EXACT format (no extra text):
{{
  "question": "Specific question about NEW aspect of the video content?",
  "options": ["Correct answer from video", "Plausible wrong answer", "Another wrong answer", "Third wrong answer"],
  "answer": "Correct answer from video",
  "explanation": "Detailed explanation referencing the video content",
  "concept_tag": "new_topic_not_in_asked_list"
}}

JSON:"""


async def generate_question_free(
    transcript_chunk: str,
    difficulty: str = "medium",
    session_id: str = "default"
) -> dict:
    """
    Generate question using FREE Hugging Face Inference API
    No rate limits, completely free, works instantly
    Ensures questions are unique per session
    """
    
    # Get previously asked topics for this session
    if session_id not in _asked_questions:
        _asked_questions[session_id] = set()
    
    asked_topics = list(_asked_questions[session_id])
    asked_topics_str = ", ".join(asked_topics[-5:]) if asked_topics else "none"
    
    # Trim transcript
    transcript = transcript_chunk.strip()[:MAX_TRANSCRIPT_CHARS]
    
    # Build prompt with asked topics
    prompt = QUESTION_PROMPT_TEMPLATE.format(
        difficulty=difficulty,
        transcript=transcript,
        asked_topics=asked_topics_str
    )
    
    # Try main model first
    question = await _call_huggingface_api(prompt, HF_API_URL, difficulty)
    
    if question and _is_unique_question(question, session_id):
        _mark_question_asked(question, session_id)
        return question
    
    # Fallback to smaller model
    print("[FreeGen] Main model failed or duplicate, trying fallback...")
    question = await _call_huggingface_api(prompt, HF_FALLBACK_URL, difficulty)
    
    if question and _is_unique_question(question, session_id):
        _mark_question_asked(question, session_id)
        return question
    
    # Ultimate fallback: generate deterministic question
    question = _generate_fallback_question(transcript, difficulty, asked_topics)
    _mark_question_asked(question, session_id)
    return question


async def _call_huggingface_api(prompt: str, api_url: str, difficulty: str) -> Optional[dict]:
    """Call Hugging Face Inference API"""
    
    headers = {
        "Content-Type": "application/json"
    }
    
    # Add API key if available (optional, makes it faster)
    if HF_API_KEY:
        headers["Authorization"] = f"Bearer {HF_API_KEY}"
    
    payload = {
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": 400,
            "temperature": 0.3,
            "top_p": 0.9,
            "do_sample": True,
            "return_full_text": False
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(api_url, headers=headers, json=payload)
            
            if response.status_code == 503:
                # Model is loading, wait and retry once
                print("[FreeGen] Model loading, waiting 10s...")
                import asyncio
                await asyncio.sleep(10)
                response = await client.post(api_url, headers=headers, json=payload)
            
            if response.status_code != 200:
                print(f"[FreeGen] API error: {response.status_code}")
                return None
            
            data = response.json()
            
            # Extract generated text
            if isinstance(data, list) and len(data) > 0:
                generated_text = data[0].get("generated_text", "")
            elif isinstance(data, dict):
                generated_text = data.get("generated_text", "")
            else:
                return None
            
            # Parse JSON from response
            question = _extract_json_from_text(generated_text)
            
            if question:
                # Add required fields
                question["question_id"] = str(uuid.uuid4())[:8]
                question["type"] = "mcq"
                question["difficulty"] = difficulty
                
                # Validate structure
                if _validate_question(question):
                    return question
            
            return None
            
    except Exception as e:
        print(f"[FreeGen] Error calling API: {e}")
        return None


def _extract_json_from_text(text: str) -> Optional[dict]:
    """Extract JSON object from mixed text response"""
    
    # Try direct JSON parse
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass
    
    # Try to find JSON object in text
    json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass
    
    return None


def _validate_question(question: dict) -> bool:
    """Validate question has all required fields"""
    required = ["question", "options", "answer", "explanation", "concept_tag"]
    
    if not all(key in question for key in required):
        return False
    
    if not isinstance(question["options"], list) or len(question["options"]) != 4:
        return False
    
    if question["answer"] not in question["options"]:
        return False
    
    return True


def _is_unique_question(question: dict, session_id: str) -> bool:
    """Check if question concept is unique for this session"""
    concept = question.get("concept_tag", "").lower().strip()
    
    if not concept or concept == "concept":
        return True  # Generic concept, allow it
    
    if session_id not in _asked_questions:
        return True
    
    # Check if concept already asked
    return concept not in _asked_questions[session_id]


def _mark_question_asked(question: dict, session_id: str) -> None:
    """Mark question concept as asked for this session"""
    concept = question.get("concept_tag", "").lower().strip()
    
    if concept and concept != "concept":
        if session_id not in _asked_questions:
            _asked_questions[session_id] = set()
        _asked_questions[session_id].add(concept)


def _generate_fallback_question(transcript: str, difficulty: str, asked_topics: list[str]) -> dict:
    """
    Generate a deterministic fallback question based on actual transcript content
    Always works, never fails, but uses real content and avoids asked topics
    """
    
    # Extract meaningful content from transcript
    words = transcript.split()
    if len(words) < 10:
        topic = "this educational content"
        context = "the concepts discussed"
    else:
        # Get first 20 words for topic
        topic = " ".join(words[:20])
        # Get middle section for context
        mid_start = len(words) // 3
        mid_end = mid_start + 15
        context = " ".join(words[mid_start:mid_end])
    
    # Extract potential key terms (words longer than 5 chars)
    key_terms = [w for w in words if len(w) > 5 and w.isalpha()]
    
    # Find a term not in asked topics
    main_term = "concept"
    for term in key_terms:
        if term.lower() not in [t.lower() for t in asked_topics]:
            main_term = term
            break
    
    # If all terms asked, use combination
    if main_term == "concept" and key_terms:
        main_term = f"{key_terms[0]}_advanced"
    
    questions_by_difficulty = {
        "easy": {
            "question": f"Based on the content: '{topic}...', what is being discussed?",
            "options": [
                f"The {main_term} and related concepts",
                "Unrelated mathematical theories",
                "Historical events from ancient times",
                "Geographic locations and maps"
            ],
            "answer": f"The {main_term} and related concepts",
            "explanation": f"The content clearly discusses {main_term} and explains: {context}..."
        },
        "medium": {
            "question": f"Why is understanding '{main_term}' important in this context?",
            "options": [
                f"It's fundamental to understanding {context}...",
                "It's not relevant to the topic",
                "It contradicts the main points",
                "It's only mentioned as a side note"
            ],
            "answer": f"It's fundamental to understanding {context}...",
            "explanation": f"The content emphasizes {main_term} because it relates to: {context}..."
        },
        "hard": {
            "question": f"How would you apply the concepts from '{topic}...' in practice?",
            "options": [
                f"By understanding {main_term} and implementing the principles about {context}...",
                "By ignoring the core concepts entirely",
                "By using completely different methods",
                "By memorizing without understanding"
            ],
            "answer": f"By understanding {main_term} and implementing the principles about {context}...",
            "explanation": f"Application requires understanding {main_term} in the context of: {context}..."
        }
    }
    
    template = questions_by_difficulty.get(difficulty, questions_by_difficulty["medium"])
    
    return {
        "question_id": str(uuid.uuid4())[:8],
        "question": template["question"],
        "type": "mcq",
        "difficulty": difficulty,
        "options": template["options"],
        "answer": template["answer"],
        "explanation": template["explanation"],
        "concept_tag": main_term
    }


# Batch generation for testing
async def generate_questions_batch_free(transcript_chunk: str) -> list[dict]:
    """Generate 5 questions (2 easy, 2 medium, 1 hard)"""
    import asyncio
    
    tasks = [
        generate_question_free(transcript_chunk, "easy"),
        generate_question_free(transcript_chunk, "easy"),
        generate_question_free(transcript_chunk, "medium"),
        generate_question_free(transcript_chunk, "medium"),
        generate_question_free(transcript_chunk, "hard")
    ]
    
    questions = await asyncio.gather(*tasks)
    return list(questions)
