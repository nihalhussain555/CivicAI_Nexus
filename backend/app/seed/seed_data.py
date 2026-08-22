"""
Seeds realistic fictional demo data: 3 demo accounts (citizen/officer/admin
with the password used throughout the spec), 7 departments, 10+ officers,
20+ grievances spanning every category/status, several community incidents,
and notifications.

Usage (from backend/):
    python -m app.seed.seed_data
    python -m app.seed.seed_data --reset   # wipes collections first
"""

import argparse
import random
from datetime import datetime, timedelta

from app.config.database import (
    users_collection,
    grievances_collection,
    incidents_collection,
    departments_collection,
    notifications_collection,
    audit_logs_collection,
    create_indexes,
)
from app.models.user import user_document
from app.models.department import department_document
from app.models.grievance import grievance_document
from app.models.incident import incident_document
from app.models.notification import notification_document
from app.services.prediction_service import predict_resolution_hours, compute_sla_due_at
from app.utils.geo import make_point
from app.utils.security import hash_password


DEMO_PASSWORD = "Demo@123"
CHENNAI_CENTER = (13.0827, 80.2707)

DEPARTMENTS = [
    ("Sanitation Department", "SAN", ["WASTE"]),
    ("Water Supply Department", "WAT", ["WATER"]),
    ("Public Works Department", "PWD", ["ROAD", "DRAINAGE"]),
    ("Electricity Department", "ELE", ["ELECTRICITY", "STREET_LIGHT"]),
    ("Traffic Police Department", "TRF", ["TRAFFIC"]),
    ("Public Safety Department", "SAF", ["PUBLIC_SAFETY"]),
    ("General Administration", "GEN", ["GENERAL"]),
]

OFFICER_NAMES = [
    "Arun Kumar", "Priya Sharma", "Suresh Babu", "Lakshmi Narayan",
    "Vikram Singh", "Divya Menon", "Karthik Raja", "Anjali Reddy",
    "Ramesh Iyer", "Sowmya Krishnan", "Manoj Pillai",
]

CITIZEN_NAMES = [
    "Aditya Verma", "Meera Nair", "Rahul Desai", "Sneha Pillai",
    "Vijay Anand", "Kavya Subramanian", "Rohan Gupta", "Nisha Rao",
]

GRIEVANCE_TEMPLATES = [
    ("WASTE", "Garbage not collected on {street}",
     "Household waste has piled up on {street} for over a week. Bins are overflowing and attracting stray animals."),
    ("WATER", "No water supply in {street}",
     "There has been no piped water supply to {street} for three days. Residents are struggling without water."),
    ("ROAD", "Large pothole on {street}",
     "A deep pothole has formed on {street}, causing traffic slowdowns and a real risk to two-wheeler riders."),
    ("ELECTRICITY", "Frequent power outages near {street}",
     "Power has been cutting out several times a day near {street}. Suspect a faulty transformer."),
    ("STREET_LIGHT", "Street lights not working on {street}",
     "Multiple street lights are non-functional on {street}, making it unsafe to walk at night."),
    ("DRAINAGE", "Waterlogging after rain on {street}",
     "Every time it rains, {street} floods ankle-deep due to blocked stormwater drains."),
    ("TRAFFIC", "Traffic signal malfunction at {street}",
     "The traffic signal at the {street} junction has been stuck on red for both directions, causing congestion."),
    ("PUBLIC_SAFETY", "Broken footpath railing near {street}",
     "The pedestrian railing near {street} is broken and poses a fall risk, especially for children and elderly."),
]

STREETS = [
    "Anna Nagar 4th Avenue", "T Nagar Main Road", "Adyar Bridge Road",
    "Velachery Bypass", "Mylapore Tank Street", "Besant Nagar Beach Road",
    "Guindy Industrial Estate Road", "Nungambakkam High Road",
    "Perambur Market Street", "Tambaram Station Road",
]

STATUSES_POOL = [
    "SUBMITTED", "DEPARTMENT_ASSIGNED", "DEPARTMENT_ASSIGNED", "OFFICER_ACCEPTED",
    "IN_PROGRESS", "IN_PROGRESS", "RESOLUTION_SUBMITTED", "CITIZEN_VERIFICATION",
    "CLOSED", "CLOSED", "CLOSED", "ESCALATED",
]


def jitter(base, spread=0.02):
    return base + random.uniform(-spread, spread)


def reset_collections():
    for col in (
        users_collection, grievances_collection, incidents_collection,
        departments_collection, notifications_collection, audit_logs_collection,
    ):
        col.delete_many({})


def seed_departments():
    dept_docs = []
    for name, code, categories in DEPARTMENTS:
        doc = department_document(name, code, f"Handles {', '.join(categories).lower()} related grievances", categories)
        result = departments_collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        dept_docs.append(doc)
    return dept_docs


def seed_users(dept_docs):
    demo_citizen = user_document("Demo Citizen", "citizen@demo.com", hash_password(DEMO_PASSWORD), role="citizen")
    demo_officer = user_document(
        "Demo Officer", "officer@demo.com", hash_password(DEMO_PASSWORD),
        role="officer", department="Sanitation Department", specialization="Waste Management",
    )
    demo_admin = user_document("Demo Admin", "admin@demo.com", hash_password(DEMO_PASSWORD), role="admin")

    demo_ids = {}
    for key, doc in (("citizen", demo_citizen), ("officer", demo_officer), ("admin", demo_admin)):
        result = users_collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        demo_ids[key] = doc

    citizens = [demo_ids["citizen"]]
    for name in CITIZEN_NAMES:
        email = name.lower().replace(" ", ".") + "@example.com"
        doc = user_document(name, email, hash_password(DEMO_PASSWORD), role="citizen")
        result = users_collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        citizens.append(doc)

    officers = [demo_ids["officer"]]
    for i, name in enumerate(OFFICER_NAMES):
        dept = dept_docs[i % len(dept_docs)]
        email = name.lower().replace(" ", ".") + "@civicai.gov"
        doc = user_document(
            name, email, hash_password(DEMO_PASSWORD), role="officer",
            department=dept["name"], specialization=dept["categories"][0] if dept["categories"] else None,
        )
        result = users_collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        officers.append(doc)
        departments_collection.update_one({"_id": dept["_id"]}, {"$inc": {"total_officers": 1}})

    return citizens, officers, demo_ids["admin"]


def seed_grievances(citizens, officers, dept_docs, count=24):
    dept_by_category = {}
    for dept in dept_docs:
        for cat in dept["categories"]:
            dept_by_category[cat] = dept["name"]

    officers_by_dept = {}
    for officer in officers:
        officers_by_dept.setdefault(officer.get("department"), []).append(officer)

    created = []
    now = datetime.utcnow()

    for i in range(count):
        category, title_tpl, desc_tpl = random.choice(GRIEVANCE_TEMPLATES)
        street = random.choice(STREETS)
        title = title_tpl.format(street=street)
        description = desc_tpl.format(street=street)

        citizen = random.choice(citizens)
        department = dept_by_category.get(category, "General Administration")
        severity = random.choice(["LOW", "MEDIUM", "MEDIUM", "HIGH", "CRITICAL"])
        priority = severity if severity != "CRITICAL" else "CRITICAL"
        status = random.choice(STATUSES_POOL)

        created_at = now - timedelta(days=random.randint(0, 25), hours=random.randint(0, 23))
        lat, lon = jitter(CHENNAI_CENTER[0]), jitter(CHENNAI_CENTER[1])

        grievance_id = f"CIV-2026-{1000 + i:05d}"
        doc = grievance_document(
            grievance_id=grievance_id,
            citizen_id=citizen["_id"],
            title=title,
            description=description,
            language="English",
            location=make_point(lat, lon, street),
        )

        predicted_hours = predict_resolution_hours(category, severity)
        sla_due_at, _ = compute_sla_due_at(priority, created_at)

        doc.update({
            "translated_text": f"{title}. {description}",
            "category": category,
            "severity": severity,
            "urgency_score": random.randint(30, 95),
            "priority": priority,
            "priority_score": random.randint(30, 95),
            "confidence": round(random.uniform(0.7, 0.96), 2),
            "sentiment": random.choice(["NEGATIVE", "NEUTRAL"]),
            "ai_summary": f"Citizen reported a {category.lower()} issue near {street}.",
            "recommended_action": "Assign to the relevant department officer for review.",
            "ai_provider": "mock",
            "department": department,
            "predicted_resolution_hours": predicted_hours,
            "escalation_risk": "HIGH" if status == "ESCALATED" else random.choice(["LOW", "LOW", "MEDIUM"]),
            "sla_due_at": sla_due_at,
            "status": status,
            "created_at": created_at,
            "updated_at": created_at,
        })

        if status not in ("SUBMITTED",):
            doc["history"].append({
                "status": "AI_ANALYZED", "message": "AI analysis completed",
                "actor_role": "system", "timestamp": created_at,
            })
            doc["history"].append({
                "status": "DEPARTMENT_ASSIGNED", "message": f"Routed to {department}",
                "actor_role": "system", "timestamp": created_at,
            })

        dept_officers = officers_by_dept.get(department)
        if status in ("OFFICER_ACCEPTED", "IN_PROGRESS", "RESOLUTION_SUBMITTED",
                      "CITIZEN_VERIFICATION", "CLOSED", "ESCALATED") and dept_officers:
            officer = random.choice(dept_officers)
            doc["assigned_officer"] = officer["_id"]
            doc["history"].append({
                "status": "OFFICER_ACCEPTED", "message": f"Accepted by {officer['name']}",
                "actor_role": "officer", "timestamp": created_at + timedelta(hours=2),
            })

        if status in ("RESOLUTION_SUBMITTED", "CITIZEN_VERIFICATION", "CLOSED"):
            doc["resolution_note"] = "Issue inspected and resolved by field team."
            doc["resolved_at"] = created_at + timedelta(hours=predicted_hours * 0.8)

        if status == "CLOSED":
            doc["citizen_verified"] = True

        grievances_collection.insert_one(doc)
        created.append(doc)

    return created


def seed_incidents(grievances, dept_docs):
    dept_by_category = {}
    for dept in dept_docs:
        for cat in dept["categories"]:
            dept_by_category[cat] = dept["name"]

    by_category = {}
    for g in grievances:
        by_category.setdefault(g["category"], []).append(g)

    count = 0
    for category, items in by_category.items():
        if len(items) < 3 or count >= 10:
            continue
        cluster = items[:min(len(items), random.randint(3, 6))]
        lat_avg = sum(jitter(CHENNAI_CENTER[0], 0.01) for _ in cluster) / len(cluster)
        lon_avg = sum(jitter(CHENNAI_CENTER[1], 0.01) for _ in cluster) / len(cluster)

        incident_id = f"INC-2026-{100 + count:04d}"
        doc = incident_document(
            incident_id=incident_id,
            title=f"{category.title().replace('_', ' ')} Cluster — {cluster[0]['location']['address']}",
            category=category,
            center=make_point(lat_avg, lon_avg, cluster[0]["location"]["address"]),
            department=dept_by_category.get(category, "General Administration"),
        )
        doc["grievance_ids"] = [g["grievance_id"] for g in cluster]
        doc["report_count"] = len(cluster)
        doc["risk_level"] = "HIGH" if len(cluster) >= 6 else "MEDIUM"
        doc["probable_root_cause"] = "Requires field investigation to confirm root cause."
        doc["ai_summary"] = f"{len(cluster)} community reports clustered near {cluster[0]['location']['address']}."

        incidents_collection.insert_one(doc)
        grievances_collection.update_many(
            {"grievance_id": {"$in": doc["grievance_ids"]}},
            {"$set": {"incident_id": incident_id}},
        )
        count += 1


def seed_notifications(citizens, grievances):
    for g in grievances[:15]:
        doc = notification_document(
            g["citizen_id"], "Grievance Update",
            f"Grievance {g['grievance_id']} is now {g['status'].replace('_', ' ').title()}.",
            notification_type="STATUS_CHANGE", related_grievance_id=g["grievance_id"],
        )
        notifications_collection.insert_one(doc)


def run(reset=False):
    if reset:
        print("Resetting collections...")
        reset_collections()

    if users_collection.count_documents({"email": "admin@demo.com"}) > 0:
        print("Seed data already present (admin@demo.com exists). Use --reset to reseed.")
        return

    print("Seeding departments...")
    dept_docs = seed_departments()

    print("Seeding users (citizens, officers, admin)...")
    citizens, officers, admin = seed_users(dept_docs)

    print("Seeding grievances...")
    grievances = seed_grievances(citizens, officers, dept_docs, count=26)

    print("Seeding incidents...")
    seed_incidents(grievances, dept_docs)

    print("Seeding notifications...")
    seed_notifications(citizens, grievances)

    print("Creating indexes...")
    create_indexes()

    print("\nSeed complete.")
    print("Demo accounts (password: Demo@123):")
    print("  citizen@demo.com")
    print("  officer@demo.com")
    print("  admin@demo.com")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Wipe collections before seeding")
    args = parser.parse_args()
    run(reset=args.reset)
