from datetime import datetime


def incident_document(
    incident_id,
    title,
    category,
    center,
    department="General Administration",
):
    now = datetime.utcnow()

    return {
        "incident_id": incident_id,
        "title": title,
        "category": category,
        "department": department,

        # GeoJSON Point of the cluster centroid
        "center": center,
        "radius_km": 1.0,

        "grievance_ids": [],
        "report_count": 0,

        "risk_level": "LOW",           # LOW | MEDIUM | HIGH
        "status": "ACTIVE",            # ACTIVE | MONITORING | RESOLVED
        "probable_root_cause": None,
        "ai_summary": None,

        "created_at": now,
        "updated_at": now,
    }
