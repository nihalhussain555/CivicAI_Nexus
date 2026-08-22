from fastapi import APIRouter, Depends, Query

from app.config.database import incidents_collection
from app.utils.dependencies import get_current_user, require_staff
from app.utils.helpers import serialize_document, serialize_documents


router = APIRouter(prefix="/api/incidents", tags=["Incidents"])


@router.get("/")
def list_incidents(
    status: str = None,
    category: str = None,
    risk_level: str = None,
    page: int = 1,
    limit: int = 20,
    current_user=Depends(get_current_user),
):
    query = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    if risk_level:
        query["risk_level"] = risk_level

    page = max(1, page)
    limit = max(1, min(100, limit))
    skip = (page - 1) * limit

    total = incidents_collection.count_documents(query)
    items = list(
        incidents_collection.find(query).sort("report_count", -1).skip(skip).limit(limit)
    )

    return {
        "success": True,
        "data": {
            "items": serialize_documents(items),
            "total": total,
            "page": page,
            "limit": limit,
        },
    }


@router.get("/map")
def incidents_for_map(current_user=Depends(get_current_user)):
    """Lightweight payload optimized for the admin/officer map view."""
    items = list(
        incidents_collection.find(
            {"status": {"$in": ["ACTIVE", "MONITORING"]}},
            {"incident_id": 1, "title": 1, "category": 1, "center": 1, "risk_level": 1, "report_count": 1},
        )
    )
    return {"success": True, "data": serialize_documents(items)}


@router.get("/{incident_id}")
def get_incident(incident_id: str, current_user=Depends(get_current_user)):
    incident = incidents_collection.find_one({"incident_id": incident_id})
    if not incident:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"success": True, "data": serialize_document(incident)}
