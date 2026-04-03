from __future__ import annotations

import json
import os
import re
import uuid

try:
    import google.genai as genai
except ImportError:  # pragma: no cover - depends on environment packages
    genai = None


LLM_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
FREE_TIER_MODE = os.getenv("FREE_TIER_MODE", "true").lower() in {"1", "true", "yes", "on"}
MAX_TRANSCRIPT_CHARS = int(os.getenv("GEMINI_MAX_TRANSCRIPT_CHARS", "900" if FREE_TIER_MODE else "2000"))
MAX_OUTPUT_TOKENS = int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "700" if FREE_TIER_MODE else "1200"))
GEN_TEMPERATURE = float(os.getenv("GEMINI_TEMPERATURE", "0.2" if FREE_TIER_MODE else "0.7"))
_gemini_client = None

QUESTION_PROMPT = """You are an educational assessment AI.
Given the following transcript excerpt, generate exactly 5 questions:
- 2 EASY: definition/recall
- 2 MEDIUM: explanation/reasoning
- 1 HARD: application/scenario

Return ONLY valid JSON with top-level key `questions` mapped to an array.
Each item must include:
question_id, question, type, difficulty, options, answer, explanation, concept_tag

Transcript:
{transcript_chunk}
"""

SINGLE_QUESTION_PROMPT = """Generate exactly 1 {difficulty} educational question as JSON.
Return object keys: question_id, question, type, difficulty, options, answer, explanation, concept_tag
Transcript:
{transcript_chunk}
"""


def _trim_transcript(text: str) -> str:
    return text.strip()[:MAX_TRANSCRIPT_CHARS]


def _get_gemini_model():
    """Create a Gemini client lazily and return a model handle if API key exists."""
    global _gemini_client

    if genai is None:
        return None

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=api_key)

    return _gemini_client.models


def _safe_json_loads(content: str) -> dict | list:
    """Parse JSON safely even when model wraps content in extra text/code fences."""
    if not content:
        return {}

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # Try extracting the first JSON object/array from mixed text output.
        match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", content)
        if not match:
            return {}
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            return {}


def _fallback_questions(transcript_chunk: str) -> list[dict]:
    """Deterministic fallback to keep local/dev flow working without OpenAI."""
    seed = transcript_chunk.strip()[:80] or "this topic"
    return [
        {
            "question_id": f"q_{index + 1}",
            "question": f"What best describes {seed}?" if index < 2 else f"Why is '{seed}' important?",
            "type": "mcq",
            "difficulty": "easy" if index < 2 else ("medium" if index < 4 else "hard"),
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "answer": "Option B",
            "explanation": "This fallback answer is used when AI generation is unavailable.",
            "concept_tag": "general",
        }
        for index in range(5)
    ]


def _normalize_question(item: dict) -> dict | None:
    required = {
        "question_id",
        "question",
        "type",
        "difficulty",
        "options",
        "answer",
        "explanation",
        "concept_tag",
    }
    if not required.issubset(set(item.keys())):
        return None
    if item.get("type") not in {"mcq", "short_answer"}:
        return None
    if item.get("difficulty") not in {"easy", "medium", "hard"}:
        return None
    options = item.get("options")
    if not isinstance(options, list):
        return None

    # Normalize minimal fields to consistent types.
    return {
        "question_id": str(item.get("question_id") or str(uuid.uuid4())[:8]),
        "question": str(item.get("question", "")).strip(),
        "type": str(item.get("type")),
        "difficulty": str(item.get("difficulty")),
        "options": [str(opt) for opt in options],
        "answer": str(item.get("answer", "")).strip(),
        "explanation": str(item.get("explanation", "")).strip(),
        "concept_tag": str(item.get("concept_tag", "general")).strip().lower() or "general",
    }


async def generate_questions(transcript_chunk: str) -> list[dict]:
    """Generate 5 questions from a transcript chunk with safe fallback."""
    model = _get_gemini_model()
    if model is None:
        return _fallback_questions(transcript_chunk)

    prompt = QUESTION_PROMPT.format(transcript_chunk=_trim_transcript(transcript_chunk))

    for attempt in range(2):
        try:
            response = model.generate_content(
                model=LLM_MODEL,
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    temperature=GEN_TEMPERATURE,
                    max_output_tokens=MAX_OUTPUT_TOKENS,
                    response_mime_type="application/json",
                ),
            )
            content = getattr(response, "text", "") or "{}"
            payload = _safe_json_loads(content)

            raw_items = payload
            if isinstance(payload, dict):
                raw_items = payload.get("questions", payload.get("items", []))
            if isinstance(raw_items, dict):
                raw_items = [raw_items]
            if not isinstance(raw_items, list):
                raw_items = []

            normalized: list[dict] = []
            for raw in raw_items:
                if isinstance(raw, dict):
                    item = _normalize_question(raw)
                    if item:
                        normalized.append(item)

            if normalized:
                return normalized
        except Exception:
            if attempt == 1:
                break

    return _fallback_questions(transcript_chunk)


async def generate_question_async(transcript_chunk: str, difficulty: str = "medium") -> dict:
    """Generate one question for live WebSocket pipeline."""
    model = _get_gemini_model()
    if model is None:
        return _fallback_questions(transcript_chunk)[0] | {"difficulty": difficulty}

    prompt = SINGLE_QUESTION_PROMPT.format(
        difficulty=difficulty,
        transcript_chunk=_trim_transcript(transcript_chunk),
    )

    try:
        response = model.generate_content(
            model=LLM_MODEL,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                temperature=GEN_TEMPERATURE,
                max_output_tokens=MAX_OUTPUT_TOKENS,
                response_mime_type="application/json",
            ),
        )
        content = getattr(response, "text", "") or "{}"
        parsed = _safe_json_loads(content)
        if not isinstance(parsed, dict):
            parsed = {}

        normalized = _normalize_question(parsed)
        if normalized:
            normalized["difficulty"] = difficulty
            return normalized
    except Exception:
        pass

    return _fallback_questions(transcript_chunk)[0] | {"difficulty": difficulty}
