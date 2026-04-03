def get_next_difficulty(session_score: float) -> str:
    """Return next question difficulty from rolling score in [0.0, 1.0]."""
    if session_score < 0.50:
        return "easy"
    if session_score < 0.80:
        return "medium"
    return "hard"


def calculate_score(attempts: list[dict]) -> float:
    """Compute accuracy from attempt dicts with a boolean `correct` field."""
    if not attempts:
        return 0.0

    correct = sum(1 for attempt in attempts if attempt.get("correct", False))
    return round(correct / len(attempts), 4)


def identify_weak_topics(attempts: list[dict]) -> list[str]:
    """Return concept tags with <60% accuracy and at least 2 attempts."""
    from collections import defaultdict

    stats = defaultdict(lambda: {"correct": 0, "total": 0})
    for attempt in attempts:
        topic = attempt.get("concept_tag", "unknown")
        stats[topic]["total"] += 1
        if attempt.get("correct"):
            stats[topic]["correct"] += 1

    return [
        topic
        for topic, values in stats.items()
        if values["total"] >= 2 and (values["correct"] / values["total"]) < 0.6
    ]
