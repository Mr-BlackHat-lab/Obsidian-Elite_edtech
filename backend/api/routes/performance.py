from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request

from models.session import PerformanceResponse, SubmitAnswerRequest, SubmitAnswerResponse

router = APIRouter()


@router.post("/submit-answer", response_model=SubmitAnswerResponse)
async def submit_answer(req: SubmitAnswerRequest, request: Request) -> SubmitAnswerResponse:
    db = request.app.state.db

    session = await db.sessions.find_one({"session_id": req.session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    question = next(
        (q for q in session.get("questions", []) if q.get("question_id") == req.question_id),
        None,
    )

    correct = False
    explanation = "No explanation available."
    if question:
        expected = str(question.get("answer", "")).strip().lower()
        received = req.user_answer.strip().lower()
        correct = received == expected
        explanation = str(question.get("explanation", explanation))

    attempt = {
        "question_id": req.question_id,
        "user_answer": req.user_answer,
        "correct": correct,
        "concept_tag": req.concept_tag,
        "timestamp": datetime.utcnow(),
    }

    all_attempts = session.get("attempts", []) + [attempt]
    updated_score = calculate_score(all_attempts)
    weak_topics = identify_weak_topics(all_attempts)

    await db.sessions.update_one(
        {"session_id": req.session_id},
        {
            "$push": {"attempts": attempt},
            "$set": {"score": updated_score, "weak_topics": weak_topics},
        },
    )

    return SubmitAnswerResponse(
        correct=correct,
        explanation=explanation,
        updated_score=updated_score,
        weak_topics=weak_topics,
    )


@router.get("/session/{session_id}")
async def get_session(session_id: str, request: Request) -> dict:
    db = request.app.state.db
    session = await db.sessions.find_one({"session_id": session_id}, projection={"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/performance/{user_id}", response_model=PerformanceResponse)
async def get_performance(user_id: str, request: Request) -> PerformanceResponse:
    db = request.app.state.db

    cursor = db.sessions.find(
        {"user_id": user_id, "status": "ready"},
        projection={
            "_id": 0,
            "session_id": 1,
            "video_url": 1,
            "score": 1,
            "attempts": 1,
            "created_at": 1,
        },
    )
    sessions = await cursor.to_list(length=100)

    if not sessions:
        return PerformanceResponse(
            user_id=user_id,
            overall_accuracy=0.0,
            total_sessions=0,
            total_questions=0,
            topic_breakdown={},
            weak_topics=[],
            feedback="No sessions found. Start watching a video!",
            sessions=[],
        )

    all_attempts: list[dict] = []
    for session in sessions:
        all_attempts.extend(session.get("attempts", []))

    total_questions = len(all_attempts)
    overall_accuracy = calculate_score(all_attempts)
    weak_topics = identify_weak_topics(all_attempts)
    topic_breakdown = get_topic_breakdown(all_attempts)
    feedback = generate_feedback(weak_topics, overall_accuracy)

    return PerformanceResponse(
        user_id=user_id,
        overall_accuracy=overall_accuracy,
        total_sessions=len(sessions),
        total_questions=total_questions,
        topic_breakdown=topic_breakdown,
        weak_topics=weak_topics,
        feedback=feedback,
        sessions=[
            {
                "session_id": item.get("session_id"),
                "video_url": item.get("video_url"),
                "score": item.get("score", 0.0),
                "created_at": str(item.get("created_at", "")),
            }
            for item in sessions
        ],
    )


def calculate_score(attempts: list[dict]) -> float:
    if not attempts:
        return 0.0
    correct = sum(1 for attempt in attempts if attempt.get("correct", False))
    return round(correct / len(attempts), 4)


def identify_weak_topics(attempts: list[dict]) -> list[str]:
    stats = defaultdict(lambda: {"correct": 0, "total": 0})
    for attempt in attempts:
        tag = attempt.get("concept_tag", "unknown")
        stats[tag]["total"] += 1
        if attempt.get("correct"):
            stats[tag]["correct"] += 1

    return [
        topic
        for topic, values in stats.items()
        if values["total"] >= 2 and (values["correct"] / values["total"]) < 0.6
    ]


def get_topic_breakdown(attempts: list[dict]) -> dict:
    stats = defaultdict(lambda: {"correct": 0, "total": 0})
    for attempt in attempts:
        tag = attempt.get("concept_tag", "unknown")
        stats[tag]["total"] += 1
        if attempt.get("correct"):
            stats[tag]["correct"] += 1

    return {
        topic: {
            "correct": values["correct"],
            "total": values["total"],
            "accuracy": round(values["correct"] / values["total"], 2) if values["total"] else 0.0,
        }
        for topic, values in stats.items()
    }


def generate_feedback(weak_topics: list[str], accuracy: float) -> str:
    if not weak_topics:
        if accuracy >= 0.8:
            return "Excellent work! You are performing very well across all topics."
        return "Good progress! Keep practicing to improve your accuracy."

    topics_str = ", ".join(f'"{topic}"' for topic in weak_topics[:3])
    return (
        f"You are struggling with {topics_str}. "
        f"Your overall accuracy is {int(accuracy * 100)}%. "
        "Revise these topics before your next session."
    )
