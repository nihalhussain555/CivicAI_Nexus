from datetime import datetime, timedelta

from fastapi import APIRouter, Depends

from app.config.database import grievances_collection, incidents_collection, users_collection
from app.utils.dependencies import require_admin, require_staff
from app.utils.helpers import serialize_documents


router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/admin/overview")
def admin_overview(admin=Depends(require_admin)):
    total = grievances_collection.count_documents({})
    open_count = grievances_collection.count_documents({"status": {"$nin": ["CLOSED"]}})
    resolved = grievances_collection.count_documents({"status": "CLOSED"})
    high_priority = grievances_collection.count_documents({"priority": {"$in": ["HIGH", "CRITICAL"]}})
    escalated = grievances_collection.count_documents({"status": "ESCALATED"})

    now = datetime.utcnow()
    sla_breaches = grievances_collection.count_documents(
        {"status": {"$nin": ["CLOSED"]}, "sla_due_at": {"$lt": now, "$ne": None}}
    )

    avg_resolution_pipeline = [
        {"$match": {"resolved_at": {"$ne": None}}},
        {"$project": {"hours": {"$divide": [{"$subtract": ["$resolved_at", "$created_at"]}, 1000 * 60 * 60]}}},
        {"$group": {"_id": None, "avg_hours": {"$avg": "$hours"}}},
    ]
    agg = list(grievances_collection.aggregate(avg_resolution_pipeline))
    avg_resolution_hours = round(agg[0]["avg_hours"], 1) if agg else None

    confidence_pipeline = [{"$group": {"_id": None, "avg_confidence": {"$avg": "$confidence"}}}]
    conf_agg = list(grievances_collection.aggregate(confidence_pipeline))
    avg_confidence = round(conf_agg[0]["avg_confidence"], 2) if conf_agg and conf_agg[0]["avg_confidence"] else None

    return {
        "success": True,
        "data": {
            "total_grievances": total,
            "open": open_count,
            "resolved": resolved,
            "high_priority": high_priority,
            "escalated": escalated,
            "sla_breaches": sla_breaches,
            "avg_resolution_hours": avg_resolution_hours,
            "resolution_rate": round((resolved / total) * 100, 1) if total else 0,
            "escalation_rate": round((escalated / total) * 100, 1) if total else 0,
            "avg_ai_confidence": avg_confidence,
            "total_incidents": incidents_collection.count_documents({}),
            "active_incidents": incidents_collection.count_documents({"status": "ACTIVE"}),
            "total_officers": users_collection.count_documents({"role": "officer"}),
            "total_citizens": users_collection.count_documents({"role": "citizen"}),
        },
    }


@router.get("/admin/category-distribution")
def category_distribution(admin=Depends(require_admin)):
    pipeline = [{"$group": {"_id": "$category", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    results = list(grievances_collection.aggregate(pipeline))
    return {"success": True, "data": [{"category": r["_id"], "count": r["count"]} for r in results]}


@router.get("/admin/department-performance")
def department_performance(admin=Depends(require_admin)):
    pipeline = [
        {
            "$group": {
                "_id": "$department",
                "total": {"$sum": 1},
                "resolved": {"$sum": {"$cond": [{"$eq": ["$status", "CLOSED"]}, 1, 0]}},
                "escalated": {"$sum": {"$cond": [{"$eq": ["$status", "ESCALATED"]}, 1, 0]}},
            }
        },
        {"$sort": {"total": -1}},
    ]
    results = list(grievances_collection.aggregate(pipeline))
    for r in results:
        r["resolution_rate"] = round((r["resolved"] / r["total"]) * 100, 1) if r["total"] else 0
    return {"success": True, "data": results}


@router.get("/admin/trends")
def complaint_trends(days: int = 30, admin=Depends(require_admin)):
    since = datetime.utcnow() - timedelta(days=days)
    pipeline = [
        {"$match": {"created_at": {"$gte": since}}},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    results = list(grievances_collection.aggregate(pipeline))
    return {"success": True, "data": [{"date": r["_id"], "count": r["count"]} for r in results]}


@router.get("/admin/map")
def map_markers(admin=Depends(require_staff)):
    grievances = list(
        grievances_collection.find(
            {"location": {"$ne": None}},
            {"grievance_id": 1, "title": 1, "category": 1, "severity": 1, "priority": 1,
             "status": 1, "location": 1, "created_at": 1},
        ).limit(1000)
    )
    incidents = list(
        incidents_collection.find(
            {"status": {"$in": ["ACTIVE", "MONITORING"]}},
            {"incident_id": 1, "title": 1, "category": 1, "risk_level": 1, "center": 1, "report_count": 1},
        )
    )
    return {"success": True, "data": {"grievances": serialize_documents(grievances),
                                       "incidents": serialize_documents(incidents)}}


@router.get("/officer/overview")
def officer_overview(current_user=Depends(require_staff)):
    query = {"assigned_officer": current_user["_id"]} if current_user["role"] == "officer" else {}

    total = grievances_collection.count_documents(query)
    open_count = grievances_collection.count_documents({**query, "status": {"$nin": ["CLOSED"]}})
    resolved = grievances_collection.count_documents({**query, "status": "CLOSED"})
    escalated = grievances_collection.count_documents({**query, "status": "ESCALATED"})
    high_priority = grievances_collection.count_documents({**query, "priority": {"$in": ["HIGH", "CRITICAL"]}})

    return {
        "success": True,
        "data": {
            "total_assigned": total,
            "open": open_count,
            "resolved": resolved,
            "escalated": escalated,
            "high_priority": high_priority,
            "resolution_rate": round((resolved / total) * 100, 1) if total else 0,
        },
    }
