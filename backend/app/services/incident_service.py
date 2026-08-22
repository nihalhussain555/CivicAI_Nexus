import uuid
from datetime import datetime

from app.config.database import incidents_collection, grievances_collection
from app.config.settings import settings
from app.models.incident import incident_document
from app.utils.geo import haversine_km, make_point, point_lat_lon


def make_incident_id():
    return f"INC-{datetime.utcnow():%Y}-{uuid.uuid4().hex[:6].upper()}"


CATEGORY_LABELS = {
    "WASTE": "Waste Overflow",
    "WATER": "Water Supply Disruption",
    "ROAD": "Road Damage",
    "ELECTRICITY": "Power Outage",
    "STREET_LIGHT": "Street Lighting Outage",
    "DRAINAGE": "Waterlogging",
    "TRAFFIC": "Traffic Congestion",
    "PUBLIC_SAFETY": "Public Safety Concern",
    "GENERAL": "Civic Issue",
}


def _risk_level(report_count):
    if report_count >= 15:
        return "HIGH"
    if report_count >= 6:
        return "MEDIUM"
    return "LOW"


def cluster_grievance(grievance: dict) -> dict | None:
    """
    Attempts to attach a newly created grievance to an existing incident, or
    forms a new one once enough nearby same-category reports accumulate.
    Returns the incident document if the grievance was clustered, else None.
    """
    location = grievance.get("location")
    if not location or "coordinates" not in location:
        return None

    lat, lon = point_lat_lon(location)
    if lat is None:
        return None

    category = grievance.get("category", "GENERAL")

    # 1. Try to attach to an existing active incident nearby.
    candidates = incidents_collection.find(
        {"category": category, "status": {"$in": ["ACTIVE", "MONITORING"]}}
    )

    for incident in candidates:
        c_lat, c_lon = point_lat_lon(incident["center"])
        if c_lat is None:
            continue
        distance = haversine_km(lat, lon, c_lat, c_lon)
        if distance <= settings.INCIDENT_CLUSTER_RADIUS_KM:
            new_count = incident["report_count"] + 1
            label = CATEGORY_LABELS.get(category, category.title())
            address = incident["center"].get("address") or "the affected area"
            incidents_collection.update_one(
                {"incident_id": incident["incident_id"]},
                {
                    "$push": {"grievance_ids": grievance["grievance_id"]},
                    "$set": {
                        "report_count": new_count,
                        "risk_level": _risk_level(new_count),
                        "ai_summary": (
                            f"{label} cluster detected — {new_count} community reports "
                            f"near {address}. Risk level: {_risk_level(new_count)}."
                        ),
                        "updated_at": datetime.utcnow(),
                    },
                },
            )
            grievances_collection.update_one(
                {"grievance_id": grievance["grievance_id"]},
                {"$set": {"incident_id": incident["incident_id"]}},
            )
            incident["report_count"] = new_count
            return incident

    # 2. No existing incident nearby — check if enough *unclustered* nearby
    #    reports of the same category exist to justify forming a new one.
    nearby_unclustered = []
    same_category = grievances_collection.find(
        {
            "category": category,
            "incident_id": None,
            "location": {"$ne": None},
        },
        {"grievance_id": 1, "location": 1},
    ).limit(500)

    for other in same_category:
        o_lat, o_lon = point_lat_lon(other.get("location"))
        if o_lat is None:
            continue
        if haversine_km(lat, lon, o_lat, o_lon) <= settings.INCIDENT_CLUSTER_RADIUS_KM:
            nearby_unclustered.append(other["grievance_id"])

    if grievance["grievance_id"] not in nearby_unclustered:
        nearby_unclustered.append(grievance["grievance_id"])

    if len(nearby_unclustered) < settings.INCIDENT_MIN_REPORTS:
        return None

    incident_id = make_incident_id()
    label = CATEGORY_LABELS.get(category, category.title())
    address = location.get("address") or "the affected area"

    incident = incident_document(
        incident_id=incident_id,
        title=f"{label} Cluster — {address}",
        category=category,
        center=make_point(lat, lon, address),
        department=grievance.get("department", "General Administration"),
    )
    incident["grievance_ids"] = nearby_unclustered
    incident["report_count"] = len(nearby_unclustered)
    incident["risk_level"] = _risk_level(len(nearby_unclustered))
    incident["probable_root_cause"] = _guess_root_cause(category)
    incident["ai_summary"] = (
        f"{label} cluster detected — {len(nearby_unclustered)} community reports "
        f"near {address}. Risk level: {incident['risk_level']}."
    )

    incidents_collection.insert_one(incident)

    grievances_collection.update_many(
        {"grievance_id": {"$in": nearby_unclustered}},
        {"$set": {"incident_id": incident_id}},
    )

    return incident


def _guess_root_cause(category):
    guesses = {
        "WASTE": "Missed or infrequent collection schedule in this zone.",
        "WATER": "Possible pipeline leak or supply-line fault.",
        "ROAD": "Pavement wear accelerated by recent heavy vehicle traffic or rain.",
        "ELECTRICITY": "Localized transformer or feeder-line fault.",
        "STREET_LIGHT": "Circuit fault affecting a street-light segment.",
        "DRAINAGE": "Blocked or undersized stormwater drainage for this area.",
        "TRAFFIC": "Signal timing or road-layout issue at this junction.",
        "PUBLIC_SAFETY": "Recurring safety concern reported by multiple residents.",
        "GENERAL": "Root cause requires field investigation.",
    }
    return guesses.get(category, guesses["GENERAL"])
