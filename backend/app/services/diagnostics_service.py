"""Stores and serves the platform's error events.

Two entry points: the global exception handlers in main.py (real failures) and
the diagnostics routes (browser-side failures and user reports). Both funnel
through record(), so every event is classified and redacted the same way.
"""

import logging
from datetime import datetime, timedelta, timezone

from pymongo.errors import PyMongoError

from app.config.database import error_events_collection
from app.models.error_event import error_event_document
from app.utils.error_catalog import build_diagnosis, redact

# A page load can fail several requests at once (a dashboard firing five
# parallel queries with the backend down produces five identical events). They
# are still recorded — the dashboard's value is the occurrence count — but each
# one costs a write, so the caller-side throttle in the frontend is what keeps
# this from becoming a flood.
GROUP_SCAN_LIMIT = 200
MAX_PAGE_SIZE = 100

VALID_STATUSES = ("new", "triaged", "resolved", "ignored")


def _utcnow():
    # Stored naive-UTC, matching every other collection here (see
    # utils/helpers._stringify_object_ids for why the serializer then tags it).
    return datetime.now(timezone.utc).replace(tzinfo=None)


def record(diagnosis, source="backend", message=None, user=None, context=None,
           reported_by_user=False, reporter_note=None, occurred_at=None):
    """Insert one error event. Returns its id, or None when storage failed.

    Recording must never be the reason a request fails: if the database is the
    thing that broke, the insert raises too. That failure is logged loudly
    rather than swallowed, because an error tracker that silently loses events
    is worse than none.
    """
    try:
        doc = error_event_document(
            diagnosis,
            source=source,
            message=message,
            occurred_at=occurred_at,
            user=user,
            context=context,
            reported_by_user=reported_by_user,
            reporter_note=reporter_note,
        )
        result = error_events_collection.insert_one(doc)
        return str(result.inserted_id)
    except PyMongoError as error:
        logging.error("Could not store error event (%s): %s", source, redact(error))
        return None
    except Exception:  # noqa: BLE001
        logging.exception("Error-event recording raised unexpectedly")
        return None


def record_exception(exc=None, request=None, status_code=None, message=None,
                     category=None, user=None, source="backend", extra=None,
                     store=True):
    """Classify a failure, store it, and hand back the diagnosis + event id.

    The id goes into the API response so the user's "Report Issue" can point at
    the exact server-side event instead of describing it. `store=False`
    diagnoses without storing — used for 4xx responses that are the user's
    correction to make, not a platform fault.
    """
    path = None
    method = None
    if request is not None:
        path = request.url.path
        method = request.method

    diagnosis = build_diagnosis(
        exc=exc,
        status_code=status_code,
        message=message,
        category=category,
        path=path,
        method=method,
    )

    context = {"path": path, "method": method}
    if extra:
        context.update(extra)

    event_id = record(
        diagnosis,
        source=source,
        message=message or (str(exc) if exc is not None else None),
        user=user,
        context={k: v for k, v in context.items() if v not in (None, "")},
    ) if store else None
    if event_id:
        diagnosis = {**diagnosis, "error_ref": event_id}
    return diagnosis, event_id


def _match(status=None, category=None, feature=None, source=None,
           days=None, since=None, only_user_reports=None):
    query = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    if feature:
        query["feature"] = feature
    if source:
        query["source"] = source
    if only_user_reports:
        query["reported_by_user"] = True
    window_start = since
    if days and window_start is None:
        window_start = _utcnow() - timedelta(days=days)
    if window_start is not None:
        query["occurred_at"] = {"$gte": window_start}
    return query


def list_groups(status=None, category=None, feature=None, source=None,
                days=30, limit=25, only_user_reports=None):
    """Occurrence counts per distinct failure, newest first.

    One aggregation for the counts, then a single query for a representative
    event per group — two round trips regardless of how many groups match.
    """
    limit = max(1, min(int(limit or 25), 100))
    query = _match(status, category, feature, source, days, only_user_reports=only_user_reports)

    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$fingerprint",
            "count": {"$sum": 1},
            "last_seen": {"$max": "$occurred_at"},
            "first_seen": {"$min": "$occurred_at"},
        }},
        {"$sort": {"last_seen": -1}},
        {"$limit": limit},
    ]

    try:
        grouped = list(error_events_collection.aggregate(pipeline, allowDiskUse=True))
    except PyMongoError as error:
        logging.error("Error-group aggregation failed: %s", redact(error))
        grouped = []

    fingerprints = [g["_id"] for g in grouped if g.get("_id")]
    representatives = {}
    if fingerprints:
        # Newest event per fingerprint carries the display fields.
        cursor = (error_events_collection
                  .find({"fingerprint": {"$in": fingerprints}}, {"_id": 0})
                  .sort("occurred_at", -1)
                  .limit(GROUP_SCAN_LIMIT))
        for doc in cursor:
            if doc.get("fingerprint") not in representatives:
                representatives[doc["fingerprint"]] = doc

    groups = []
    for group in grouped:
        fp = group.get("_id")
        rep = representatives.get(fp) or {}
        groups.append({
            "fingerprint": fp,
            "count": group.get("count", 0),
            "first_seen": rep.get("occurred_at") or group.get("first_seen"),
            "last_seen": group.get("last_seen"),
            "category": rep.get("category"),
            "category_label": _category_label(rep.get("category")),
            "severity": rep.get("severity"),
            "feature": rep.get("feature"),
            "feature_label": rep.get("feature_label"),
            "message": rep.get("message"),
            "what": rep.get("what"),
            "reason": rep.get("reason"),
            "solution": rep.get("solution"),
            "retryable": rep.get("retryable"),
            "status": rep.get("status", "new"),
            "source": rep.get("source"),
            "reported_by_user": rep.get("reported_by_user", False),
            "technical": rep.get("technical") or {},
            "latest_event_id": str(rep.get("_id")) if rep.get("_id") else None,
        })
    return groups


def list_events(fingerprint=None, status=None, category=None, feature=None,
                source=None, days=30, limit=50):
    query = _match(status, category, feature, source, days)
    if fingerprint:
        query["fingerprint"] = fingerprint
    limit = max(1, min(int(limit or 50), MAX_PAGE_SIZE))
    cursor = (error_events_collection.find(query, {"_id": 0})
              .sort("occurred_at", -1)
              .limit(limit))
    return list(cursor)


def get_event(event_id):
    from bson import ObjectId
    from bson.errors import InvalidId
    try:
        oid = ObjectId(event_id)
    except (InvalidId, TypeError):
        return None
    return error_events_collection.find_one({"_id": oid}, {"_id": 0})


def summary(days=7):
    """Headline numbers for the dashboard header."""
    query = _match(days=days)
    try:
        total = error_events_collection.count_documents(query)
        by_category = _count_by(query, "category")
        by_feature = _count_by(query, "feature")
        by_status = _count_by(query, "status")
        user_reports = error_events_collection.count_documents(
            {**query, "reported_by_user": True}
        )
        new_today = error_events_collection.count_documents({
            "status": "new",
            "occurred_at": {"$gte": _utcnow() - timedelta(days=1)},
        })
    except PyMongoError as error:
        logging.error("Error summary failed: %s", redact(error))
        total, by_category, by_feature, by_status, user_reports, new_today = (
            0, {}, {}, {}, 0, 0
        )

    return {
        "window_days": days,
        "total": total,
        "new_last_24h": new_today,
        "user_reports": user_reports,
        "by_category": by_category,
        "by_feature": by_feature,
        "by_status": by_status,
        "distinct_failures": len(_distinct("fingerprint", query)),
    }


def set_status(event_ids, status, admin_user):
    """Move a group (or a single event) along the triage path."""
    if status not in VALID_STATUSES:
        raise ValueError(f"Status must be one of: {', '.join(VALID_STATUSES)}")

    from bson import ObjectId
    from bson.errors import InvalidId

    object_ids = []
    for raw in event_ids or []:
        try:
            object_ids.append(ObjectId(raw))
        except (InvalidId, TypeError):
            continue
    if not object_ids:
        return 0

    result = error_events_collection.update_many(
        {"_id": {"$in": object_ids}},
        {"$set": {
            "status": status,
            "resolved_at": _utcnow() if status == "resolved" else None,
            "resolved_by": str(admin_user.get("_id")) if admin_user else None,
            "updated_at": _utcnow(),
        }},
    )
    return result.modified_count


def set_group_status(fingerprint, status, admin_user, days=90):
    """Triage every occurrence of one distinct failure at once."""
    if status not in VALID_STATUSES:
        raise ValueError(f"Status must be one of: {', '.join(VALID_STATUSES)}")
    query = _match(days=days)
    query["fingerprint"] = fingerprint
    result = error_events_collection.update_many(
        query,
        {"$set": {
            "status": status,
            "resolved_at": _utcnow() if status == "resolved" else None,
            "resolved_by": str(admin_user.get("_id")) if admin_user else None,
            "updated_at": _utcnow(),
        }},
    )
    return result.modified_count


def _count_by(query, field):
    pipeline = [
        {"$match": query},
        {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    rows = list(error_events_collection.aggregate(pipeline, allowDiskUse=True))
    return {row["_id"]: row["count"] for row in rows if row.get("_id")}


def _distinct(field, query):
    return error_events_collection.distinct(field, {k: v for k, v in query.items() if k != field})


def _category_label(category):
    from app.utils.error_catalog import CATEGORY_LABELS
    return CATEGORY_LABELS.get(category, "Unknown")
