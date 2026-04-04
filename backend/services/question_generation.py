from __future__ import annotations

import json
import os
import re
import uuid
from urllib import error, request

FREE_TIER_MODE = os.getenv("FREE_TIER_MODE", "true").lower() in {"1", "true", "yes", "on"}
LLM_MODEL = os.getenv("OPENROUTER_MODEL", os.getenv("GEMINI_MODEL", "openai/gpt-4o-mini"))
MAX_TRANSCRIPT_CHARS = int(
    os.getenv("OPENROUTER_MAX_TRANSCRIPT_CHARS", os.getenv("GEMINI_MAX_TRANSCRIPT_CHARS", "900" if FREE_TIER_MODE else "2000"))
)
MAX_OUTPUT_TOKENS = int(
    os.getenv("OPENROUTER_MAX_OUTPUT_TOKENS", os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "700" if FREE_TIER_MODE else "1200"))
)
GEN_TEMPERATURE = float(
    os.getenv("OPENROUTER_TEMPERATURE", os.getenv("GEMINI_TEMPERATURE", "0.2" if FREE_TIER_MODE else "0.7"))
)
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
REQUEST_TIMEOUT_SECONDS = int(os.getenv("OPENROUTER_TIMEOUT_SECONDS", os.getenv("GEMINI_TIMEOUT_SECONDS", "25")))

QUESTION_PROMPT = """You are an educational assessment AI.
Given the following transcript excerpt, generate exactly 5 questions:
- 2 EASY: definition/recall
- 2 MEDIUM: explanation/reasoning
- 1 HARD: application/scenario

Return ONLY valid JSON with top-level key `questions` mapped to an array.
Each item must include:
question_id, question, type, difficulty, options, answer, explanation, concept_tag

Strict format rules:
- type must always be "mcq"
- options must always contain exactly 4 strings
- answer must be one of: "A", "B", "C", "D"

Transcript:
{transcript_chunk}
"""

SINGLE_QUESTION_PROMPT = """Generate exactly 1 {difficulty} educational question as JSON.
Return object keys: question_id, question, type, difficulty, options, answer, explanation, concept_tag
Strict format rules:
- type must be "mcq"
- options must contain exactly 4 strings
- answer must be one of: "A", "B", "C", "D"
Transcript:
{transcript_chunk}
"""


def _trim_transcript(text: str) -> str:
    return text.strip()[:MAX_TRANSCRIPT_CHARS]


def _get_openrouter_api_key() -> str:
    return os.getenv("OPENROUTER_API_KEY", os.getenv("GEMINI_API_KEY", "")).strip()


def _call_openrouter(messages: list[dict], max_output_tokens: int) -> str:
    api_key = _get_openrouter_api_key()
    if not api_key:
        return ""

    endpoint = f"{OPENROUTER_BASE_URL.rstrip('/')}/chat/completions"
    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        "temperature": GEN_TEMPERATURE,
        "max_tokens": max_output_tokens,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://localhost"),
        "X-Title": os.getenv("OPENROUTER_APP_NAME", "LearnPulse AI"),
    }

    req = request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
            body = resp.read().decode("utf-8")
    except error.HTTPError as exc:
        try:
            details = exc.read().decode("utf-8")[:400]
        except Exception:
            details = ""
        print(f"[LLM:OPENROUTER] HTTPError status={exc.code} details={details}")
        return ""
    except error.URLError as exc:
        print(f"[LLM:OPENROUTER] URLError reason={exc.reason}")
        return ""
    except (TimeoutError, OSError) as exc:
        print(f"[LLM:OPENROUTER] Request failed: {exc}")
        return ""

    parsed = _safe_json_loads(body)
    if not isinstance(parsed, dict):
        return ""

    choices = parsed.get("choices", [])
    if not isinstance(choices, list) or not choices:
        return ""

    first = choices[0] if isinstance(choices[0], dict) else {}
    message = first.get("message", {}) if isinstance(first, dict) else {}
    content = message.get("content", "") if isinstance(message, dict) else ""
    return str(content)


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
    """Deterministic fallback that still returns usable MCQs when provider calls fail."""
    text = transcript_chunk.strip().lower()
    tokens = []
    for raw in re.findall(r"[a-zA-Z0-9_-]+", text):
        if len(raw) < 4:
            continue
        if raw in {"video", "title", "channel", "topic", "learn", "learning", "question", "questions"}:
            continue
        if raw not in tokens:
            tokens.append(raw)
        if len(tokens) >= 3:
            break

    topic = tokens[0] if tokens else "core concept"
    secondary = tokens[1] if len(tokens) > 1 else "main workflow"
    tertiary = tokens[2] if len(tokens) > 2 else "practical usage"

    return [
        {
            "question_id": "q_fallback_1",
            "question": f"What is the best first step when learning {topic}?",
            "type": "mcq",
            "difficulty": "easy",
            "options": [
                f"Understand the basic definition of {topic}",
                "Memorize random commands without context",
                "Skip fundamentals and start with edge cases",
                "Avoid documentation completely",
            ],
            "answer": "A",
            "explanation": "This fallback answer is used when AI generation is unavailable.",
            "concept_tag": topic,
        },
        {
            "question_id": "q_fallback_2",
            "question": f"Which statement best describes {secondary}?",
            "type": "mcq",
            "difficulty": "easy",
            "options": [
                f"{secondary} is a relevant concept in this topic area",
                f"{secondary} means disabling all features permanently",
                f"{secondary} can never be tested or improved",
                f"{secondary} is unrelated to software systems",
            ],
            "answer": "A",
            "explanation": "This fallback answer is used when AI generation is unavailable.",
            "concept_tag": secondary,
        },
        {
            "question_id": "q_fallback_3",
            "question": f"Why is {tertiary} important in practice?",
            "type": "mcq",
            "difficulty": "medium",
            "options": [
                f"It helps apply {topic} in realistic scenarios",
                "It removes the need for testing and validation",
                "It guarantees zero failures in production",
                "It only matters for unrelated hardware topics",
            ],
            "answer": "A",
            "explanation": "This fallback answer is used when AI generation is unavailable.",
            "concept_tag": tertiary,
        },
        {
            "question_id": "q_fallback_4",
            "question": "What is a good way to verify understanding of a new concept?",
            "type": "mcq",
            "difficulty": "medium",
            "options": [
                "Build a small example and explain each step",
                "Rely only on guesses without checking outcomes",
                "Ignore errors and continue unchanged",
                "Avoid comparing expected vs actual results",
            ],
            "answer": "A",
            "explanation": "This fallback answer is used when AI generation is unavailable.",
            "concept_tag": topic,
        },
        {
            "question_id": "q_fallback_5",
            "question": f"Which approach is most robust when implementing {topic}?",
            "type": "mcq",
            "difficulty": "hard",
            "options": [
                "Use incremental changes with monitoring and rollback plans",
                "Deploy everything at once without validation",
                "Skip observability and post-deploy checks",
                "Assume defaults always fit every environment",
            ],
            "answer": "A",
            "explanation": "This fallback answer is used when AI generation is unavailable.",
            "concept_tag": topic,
        },
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
    if str(item.get("type", "")).strip().lower() != "mcq":
        return None
    difficulty = str(item.get("difficulty", "")).strip().lower()
    if difficulty not in {"easy", "medium", "hard"}:
        return None
    options = item.get("options")
    if not isinstance(options, list):
        return None

    normalized_options = [str(opt).strip() for opt in options if str(opt).strip()]
    if len(normalized_options) < 4:
        return None

    normalized_options = normalized_options[:4]

    answer = str(item.get("answer", "")).strip()
    answer_upper = answer.upper()
    if answer_upper not in {"A", "B", "C", "D"}:
        for idx, option in enumerate(normalized_options):
            if answer.lower() == option.lower():
                answer_upper = ["A", "B", "C", "D"][idx]
                break

    if answer_upper not in {"A", "B", "C", "D"}:
        return None

    # Normalize minimal fields to consistent types.
    return {
        "question_id": str(item.get("question_id") or str(uuid.uuid4())[:8]),
        "question": str(item.get("question", "")).strip(),
        "type": "mcq",
        "difficulty": difficulty,
        "options": normalized_options,
        "answer": answer_upper,
        "explanation": str(item.get("explanation", "")).strip(),
        "concept_tag": str(item.get("concept_tag", "general")).strip().lower() or "general",
    }


async def generate_questions(transcript_chunk: str) -> list[dict]:
    """Generate 5 questions from a transcript chunk with safe fallback."""
    if not _get_openrouter_api_key():
        return _fallback_questions(transcript_chunk)

    prompt = QUESTION_PROMPT.format(transcript_chunk=_trim_transcript(transcript_chunk))
    messages = [
        {"role": "system", "content": "You generate strict JSON outputs for quiz generation."},
        {"role": "user", "content": prompt},
    ]

    for attempt in range(2):
        try:
            content = _call_openrouter(messages, max_output_tokens=MAX_OUTPUT_TOKENS) or "{}"
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
    if not _get_openrouter_api_key():
        return _fallback_questions(transcript_chunk)[0] | {"difficulty": difficulty}

    prompt = SINGLE_QUESTION_PROMPT.format(
        difficulty=difficulty,
        transcript_chunk=_trim_transcript(transcript_chunk),
    )
    messages = [
        {"role": "system", "content": "You generate strict JSON outputs for quiz generation."},
        {"role": "user", "content": prompt},
    ]

    try:
        content = _call_openrouter(messages, max_output_tokens=MAX_OUTPUT_TOKENS) or "{}"
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
