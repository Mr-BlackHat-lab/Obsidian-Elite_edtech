from __future__ import annotations

import json
import os
import re
import uuid
from urllib import error, request

try:
    import spacy
except Exception:  # pragma: no cover - optional dependency at runtime
    spacy = None

FREE_TIER_MODE = os.getenv("FREE_TIER_MODE", "true").lower() in {"1", "true", "yes", "on"}
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
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
GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
REQUEST_TIMEOUT_SECONDS = int(os.getenv("OPENROUTER_TIMEOUT_SECONDS", os.getenv("GEMINI_TIMEOUT_SECONDS", "25")))
_SPACY_NLP = None

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
    return os.getenv("OPENROUTER_API_KEY", "").strip()


def _get_gemini_api_key() -> str:
    return os.getenv("GEMINI_API_KEY", "").strip()


def _get_spacy_nlp():
    global _SPACY_NLP
    if _SPACY_NLP is not None:
        return _SPACY_NLP
    if spacy is None:
        _SPACY_NLP = False
        return None
    try:
        _SPACY_NLP = spacy.load("en_core_web_sm")
    except Exception:
        _SPACY_NLP = False
    return _SPACY_NLP if _SPACY_NLP is not False else None


def _build_prompt_messages(prompt: str) -> list[dict]:
    return [
        {"role": "system", "content": "You generate strict JSON outputs for quiz generation."},
        {"role": "user", "content": prompt},
    ]


def _call_gemini(messages: list[dict], max_output_tokens: int) -> str:
    api_key = _get_gemini_api_key()
    if not api_key:
        return ""

    prompt_text = "\n\n".join(str(msg.get("content", "")) for msg in messages if str(msg.get("content", "")).strip())
    endpoint = f"{GEMINI_BASE_URL.rstrip('/')}/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    payload = {
        "systemInstruction": {
            "parts": [{"text": "You generate strict JSON outputs for quiz generation."}],
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt_text}],
            }
        ],
        "generationConfig": {
            "temperature": GEN_TEMPERATURE,
            "maxOutputTokens": max_output_tokens,
            "responseMimeType": "application/json",
        },
    }

    req = request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
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
        print(f"[LLM:GEMINI] HTTPError status={exc.code} details={details}")
        return ""
    except error.URLError as exc:
        print(f"[LLM:GEMINI] URLError reason={exc.reason}")
        return ""
    except (TimeoutError, OSError) as exc:
        print(f"[LLM:GEMINI] Request failed: {exc}")
        return ""

    parsed = _safe_json_loads(body)
    if not isinstance(parsed, dict):
        return ""

    candidates = parsed.get("candidates", [])
    if not isinstance(candidates, list) or not candidates:
        return ""

    first = candidates[0] if isinstance(candidates[0], dict) else {}
    content = first.get("content", {}) if isinstance(first, dict) else {}
    parts = content.get("parts", []) if isinstance(content, dict) else []
    if not isinstance(parts, list):
        return ""
    texts = []
    for part in parts:
        if isinstance(part, dict) and part.get("text"):
            texts.append(str(part.get("text")))
    return "\n".join(texts)


def _call_openrouter(messages: list[dict], max_output_tokens: int) -> str:
    api_key = _get_openrouter_api_key()
    if not api_key:
        print("[LLM:OPENROUTER] Skipped: OPENROUTER_API_KEY not configured")
        return ""

    endpoint = f"{OPENROUTER_BASE_URL.rstrip('/')}/chat/completions"
    payload = {
        "model": OPENROUTER_MODEL,
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

    print(f"[LLM:OPENROUTER] Attempting model={OPENROUTER_MODEL}")

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
        print("[LLM:OPENROUTER] Empty or invalid JSON response payload")
        return ""

    choices = parsed.get("choices", [])
    if not isinstance(choices, list) or not choices:
        error_obj = parsed.get("error")
        if error_obj:
            print(f"[LLM:OPENROUTER] Response contained error payload: {error_obj}")
        else:
            print("[LLM:OPENROUTER] Response had no choices")
        return ""

    first = choices[0] if isinstance(choices[0], dict) else {}
    message = first.get("message", {}) if isinstance(first, dict) else {}
    content = message.get("content", "") if isinstance(message, dict) else ""
    if not str(content).strip():
        print("[LLM:OPENROUTER] Response choice had empty content")
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


def _extract_keywords(text: str, limit: int = 5) -> list[str]:
    """Extract topic keywords using spaCy when available, with a regex fallback."""
    stop = {
        "video", "title", "channel", "generate", "practical", "learning", "questions",
        "based", "likely", "concepts", "this", "that", "with", "from", "about", "for",
        "and", "the", "are", "your", "you", "into", "using", "minutes", "minute",
        "real", "realistic", "topic", "topics", "question", "questions", "best", "first",
        "step", "steps", "option", "options", "answer", "answers", "explain", "explanation",
        "can", "could", "should", "would", "what", "which", "why", "how", "when", "where",
        "here", "there", "more", "most", "less", "very", "just", "also", "like", "good",
        "small", "use", "used", "using", "well", "done", "show", "shows", "shown", "time",
        "learn", "learns", "learned", "video", "videos", "content", "context", "topic",
    }

    nlp = _get_spacy_nlp()
    if nlp is not None:
      doc = nlp(text)
      keywords: list[str] = []
      for chunk in doc.noun_chunks:
          candidate = chunk.root.lemma_.strip().lower()
          if candidate and len(candidate) >= 4 and candidate not in stop and candidate not in keywords:
              keywords.append(candidate)
          if len(keywords) >= limit:
              break
      if len(keywords) < limit:
          for token in doc:
              candidate = token.lemma_.strip().lower()
              if not candidate or len(candidate) < 4:
                  continue
              if token.is_stop or token.is_punct or candidate in stop:
                  continue
              if token.pos_ not in {"NOUN", "PROPN", "ADJ"}:
                  continue
              if candidate not in keywords:
                  keywords.append(candidate)
              if len(keywords) >= limit:
                  break
      if keywords:
          return keywords[:limit]

    tokens: list[str] = []
    for raw in re.findall(r"[a-zA-Z0-9_-]+", text.lower()):
        token = "".join(ch for ch in raw if ch.isalnum() or ch in {"-", "_"})
        if len(token) < 4 or token in stop:
            continue
        if token not in tokens:
            tokens.append(token)
        if len(tokens) >= limit:
            break
    return tokens or ["core concept"]


def _fallback_questions(transcript_chunk: str) -> list[dict]:
    """Deterministic fallback that still returns usable MCQs when provider calls fail."""
    keywords = _extract_keywords(transcript_chunk, limit=5)
    topic = keywords[0] if keywords else "core concept"
    secondary = keywords[1] if len(keywords) > 1 else "main workflow"
    tertiary = keywords[2] if len(keywords) > 2 else "practical usage"
    quaternary = keywords[3] if len(keywords) > 3 else topic
    quinary = keywords[4] if len(keywords) > 4 else secondary

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
            "explanation": "Review the definition and choose the option that best matches the concept.",
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
            "explanation": "Focus on the role this concept plays in the overall topic.",
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
            "explanation": "Apply the concept to a realistic scenario and check which option fits best.",
            "concept_tag": tertiary,
        },
        {
            "question_id": "q_fallback_4",
            "question": f"What is a good way to verify understanding of {quaternary}?",
            "type": "mcq",
            "difficulty": "medium",
            "options": [
                f"Build a small example and explain how {quaternary} works",
                "Rely only on guesses without checking outcomes",
                "Ignore errors and continue unchanged",
                "Avoid comparing expected vs actual results",
            ],
            "answer": "A",
            "explanation": "A small worked example is a reliable way to confirm understanding.",
            "concept_tag": quaternary,
        },
        {
            "question_id": "q_fallback_5",
            "question": f"Which approach is most robust when implementing or applying {quinary}?",
            "type": "mcq",
            "difficulty": "hard",
            "options": [
                f"Use incremental changes with monitoring and rollback plans for {quinary}",
                "Deploy everything at once without validation",
                "Skip observability and post-deploy checks",
                "Assume defaults always fit every environment",
            ],
            "answer": "A",
            "explanation": "The strongest approach is the one that is testable, observable, and safe to change.",
            "concept_tag": quinary,
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
    prompt = QUESTION_PROMPT.format(transcript_chunk=_trim_transcript(transcript_chunk))
    messages = _build_prompt_messages(prompt)

    has_gemini = bool(_get_gemini_api_key())
    has_openrouter = bool(_get_openrouter_api_key())
    print(f"[LLM] providers available gemini={has_gemini} openrouter={has_openrouter}")

    provider_calls = []
    if has_gemini:
        provider_calls.append(("gemini", _call_gemini))
    if has_openrouter:
        provider_calls.append(("openrouter", _call_openrouter))

    for provider_name, provider_call in provider_calls:
        for attempt in range(2):
            try:
                content = provider_call(messages, max_output_tokens=MAX_OUTPUT_TOKENS) or "{}"
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
                    print(f"[LLM:{provider_name.upper()}] generated {len(normalized)} questions")
                    return normalized
            except Exception:
                if attempt == 1:
                    break

    print("[LLM:FALLBACK] using deterministic local questions")
    return _fallback_questions(transcript_chunk)


async def generate_question_async(transcript_chunk: str, difficulty: str = "medium") -> dict:
    """Generate one question for live WebSocket pipeline."""
    prompt = SINGLE_QUESTION_PROMPT.format(
        difficulty=difficulty,
        transcript_chunk=_trim_transcript(transcript_chunk),
    )
    messages = _build_prompt_messages(prompt)

    has_gemini = bool(_get_gemini_api_key())
    has_openrouter = bool(_get_openrouter_api_key())
    print(f"[LLM] single-question providers gemini={has_gemini} openrouter={has_openrouter}")

    provider_calls = []
    if has_gemini:
        provider_calls.append(("gemini", _call_gemini))
    if has_openrouter:
        provider_calls.append(("openrouter", _call_openrouter))

    for provider_name, provider_call in provider_calls:
        try:
            content = provider_call(messages, max_output_tokens=MAX_OUTPUT_TOKENS) or "{}"
            parsed = _safe_json_loads(content)
            if not isinstance(parsed, dict):
                parsed = {}

            normalized = _normalize_question(parsed)
            if normalized:
                normalized["difficulty"] = difficulty
                print(f"[LLM:{provider_name.upper()}] generated 1 question")
                return normalized
        except Exception:
            pass

    print("[LLM:FALLBACK] using deterministic local single question")
    return _fallback_questions(transcript_chunk)[0] | {"difficulty": difficulty}
