import re


STOPWORDS = {
    "the", "and", "for", "with", "this", "that", "have", "has", "are",
    "was", "were", "our", "your", "near", "not", "but", "you", "from",
}


def normalize_text(text):
    text = (text or "").lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return set(
        word for word in text.split()
        if len(word) > 2 and word not in STOPWORDS
    )


def similarity(text1, text2):
    words1 = normalize_text(text1)
    words2 = normalize_text(text2)

    if not words1 or not words2:
        return 0.0

    intersection = words1.intersection(words2)
    union = words1.union(words2)

    return len(intersection) / len(union)


def find_similar_cases(text, grievances_collection, category=None, exclude_id=None, limit=100):
    """Returns candidates ranked by text similarity, optionally scoped to a
    category to keep the comparison set relevant and fast."""
    query = {}
    if category:
        query["category"] = category
    if exclude_id:
        query["grievance_id"] = {"$ne": exclude_id}

    candidates = grievances_collection.find(
        query,
        {"grievance_id": 1, "description": 1, "title": 1, "location": 1, "status": 1},
    ).sort("created_at", -1).limit(limit)

    scored = []
    for candidate in candidates:
        candidate_text = f"{candidate.get('title', '')} {candidate.get('description', '')}"
        score = similarity(text, candidate_text)
        if score > 0:
            scored.append({**candidate, "similarity": round(score, 3)})

    scored.sort(key=lambda item: item["similarity"], reverse=True)
    return scored


def find_duplicate(text, grievances_collection, citizen_id=None, category=None):
    """Duplicate detection scoped to the same citizen (repeat report of the
    same issue) — separate from community incident clustering, which looks
    across citizens for the same underlying incident."""
    query = {}
    if citizen_id:
        query["citizen_id"] = citizen_id
    if category:
        query["category"] = category

    existing = grievances_collection.find(
        query, {"grievance_id": 1, "description": 1, "title": 1}
    ).limit(100)

    best_score = 0.0
    best_match = None

    for grievance in existing:
        candidate_text = f"{grievance.get('title', '')} {grievance.get('description', '')}"
        score = similarity(text, candidate_text)
        if score > best_score:
            best_score = score
            best_match = grievance

    is_duplicate = best_score >= 0.70

    return {
        "duplicate": is_duplicate,
        "score": round(best_score * 100, 2),
        "match": best_match.get("grievance_id") if best_match else None,
    }
