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
from app.services.authenticity_service import (
    LIKELY_FAKE,
    check_grievance_authenticity,
    content_fingerprint,
)
from app.services.trust_service import compute_trust, submission_friction
from app.utils.geo import make_point
from app.utils.security import hash_password


DEMO_PASSWORD = "Demo@123"
CHENNAI_CENTER = (13.0827, 80.2707)
COIMBATORE_CENTER = (11.0168, 76.9558)

DISTRICTS = ["Chennai", "Coimbatore", "Madurai", "Salem", "Erode", "Tiruchirappalli"]

DEPARTMENTS = [
    ("Municipal Corporation", "MUN", ["MUNICIPAL"]),
    ("Police", "POL", ["POLICE"]),
    ("Health", "HLT", ["HEALTH"]),
    ("Education", "EDU", ["EDUCATION"]),
    ("Electricity", "ELE", ["ELECTRICITY"]),
    ("Water Supply", "WAT", ["WATER"]),
    ("Roads & Highways", "RHD", ["ROAD"]),
    ("Sanitation & Waste Management", "SAN", ["WASTE"]),
    ("Agriculture", "AGR", ["AGRICULTURE"]),
    ("Housing", "HOU", ["HOUSING"]),
    ("Revenue & Land Records", "REV", ["REVENUE"]),
    ("Food & Civil Supplies", "FCS", ["FOOD"]),
    ("Transport", "TRN", ["TRANSPORT"]),
    ("Labour & Employment", "LAB", ["LABOUR"]),
    ("Women & Child Welfare", "WCW", ["WOMEN_CHILD"]),
    ("Environment & Forest", "ENV", ["ENVIRONMENT"]),
    ("Social Welfare", "SOC", ["SOCIAL_WELFARE"]),
    ("Public Works", "PWD", ["PUBLIC_WORKS"]),
    ("Rural Development / Panchayat", "RDP", ["RURAL_DEVELOPMENT"]),
    ("e-Governance", "EGOV", ["E_GOVERNANCE"]),
    ("Drainage & Sewerage", "DRN", ["DRAINAGE"]),
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

def jitter(base, spread=0.02):
    return base + random.uniform(-spread, spread)


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

# Each generated report gets one of these appended, rotated in step with the
# template. Two needs: the corpus has to read like nine different people
# writing, and the fingerprints must not collide. The collusion detector hashes
# the *word set* of a report, so 26 reports written from 8 templates would
# present as several copy-paste campaigns — a false positive of the seeder's
# making, not of the scorer's. Seven clauses against eight templates means no
# template/clause pair repeats until report 56.
DETAIL_CLAUSES = [
    "It has been like this since last week and nothing has changed.",
    "Three households and the shop on the corner are affected.",
    "It gets worse after 8 pm, when the crowd gathers.",
    "This is the second time this year; the earlier complaint was never closed.",
    "Children walk past it every morning on the way to school.",
    "The auto stand and the tea stall opposite have also complained.",
    "It started four days ago, right after the pipeline work.",
]

STATUSES_POOL = [
    "SUBMITTED", "DEPARTMENT_ASSIGNED", "DEPARTMENT_ASSIGNED", "OFFICER_ACCEPTED",
    "IN_PROGRESS", "IN_PROGRESS", "RESOLUTION_SUBMITTED", "CITIZEN_VERIFICATION",
    "CLOSED", "CLOSED", "CLOSED", "ESCALATED",
]

# --- Fake-report examples ------------------------------------------------
# The regular templates above are all genuine reports, which leaves the
# integrity queue, the trust columns and the Fraud & Integrity dashboard
# showing nothing. Each case below is built to trip one specific detector so
# a reviewer (or a demo) sees the whole range: junk text, spam, placeholder
# coordinates, a coordinated campaign, a recycled photo, and a report that is
# alarming but says nothing.
#
# `citizen` indexes into the seeded citizen list (0 is the demo account). The
# first three come from the same account on purpose — the behaviour detector
# reads submission rate, and one account filing four junk reports in an hour
# is the pattern it looks for.
SHARED_PHOTO_SIGNATURE = "9c1f47d02b8e35a6c4d19f70a2e35b6d"

CAMPAIGN_TEXT = (
    "Open a complaint against the corporation for not paying the agreed amount "
    "and harass the contractor immediately"
)


def suspect_location(kind, street):
    """Where a suspect case claims to be, with the street carried as the
    address text. Coordinates alone are not enough for the scorer — a real
    report has a place a worker can drive to, and omitting it would fire
    `no_address` on every seeded case and drown the signals we are
    demonstrating."""
    if kind is None:
        return None
    if kind == "null_island":
        return make_point(0.0, 0.0, street)
    center = COIMBATORE_CENTER if kind == "coimbatore" else CHENNAI_CENTER
    return make_point(jitter(center[0]), jitter(center[1]), street)

SUSPECT_CASES = [
    {   # keyboard mashing + no location at all: the clearest junk
        "key": "gibberish", "citizen": 0, "category": "WASTE", "hours_ago": 3,
        "title": "asdf qwer zxcv", "description": "nb nh mh vkh",
        "at": None, "district": "Chennai",
        # One of them already has a full review cycle on record — flagged, and
        # the citizen has contested it — so the Appeals tab has real content
        # and the dashboard has a detection-vs-adjudication data point.
        "flagged": {
            "reason": "No describable physical defect; the text is keyboard "
                      "mash and the same account filed three more reports "
                      "within two hours.",
            "appeal": "My phone dialled itself in my pocket. The drain on our "
                      "lane really is blocked — please send someone.",
        },
    },
    {   # shouting, and a link: spam rather than a grievance
        "key": "spam", "citizen": 0, "category": "ROAD", "hours_ago": 1,
        "title": "!!! URGENT MONEY OFFER !!! CLICK HERE NOW",
        "description": (
            "WIN FREE GOVERNMENT SCHEME AMOUNT!!! VISIT https://civic-prize-claim.example "
            "IMMEDIATELY AND PAY ONLY SMALL REGISTRY FEE TO RECEIVE YOUR AMOUNT TODAY!!!"
        ),
        "at": "chennai", "district": "Chennai",
    },
    {   # (0,0) is a placeholder, not a place — and the text is a test entry
        "key": "null_island", "citizen": 0, "category": "GENERAL", "hours_ago": 2,
        "title": "test", "description": "test test test",
        "at": "null_island", "district": "Chennai",
    },
    {   # same wording, three accounts, two districts: a campaign, not a city problem
        "key": "campaign_1", "citizen": 1, "category": "WATER", "hours_ago": 8,
        "title": CAMPAIGN_TEXT, "description": CAMPAIGN_TEXT,
        "at": "chennai", "district": "Chennai",
        # A reviewer looked at the first of these and disagreed with the
        # scorer — which is exactly the disagreement the dashboard counts.
        "confirmed_genuine": True,
    },
    {
        "key": "campaign_2", "citizen": 2, "category": "WATER", "hours_ago": 7,
        "title": CAMPAIGN_TEXT, "description": CAMPAIGN_TEXT,
        "at": "chennai", "district": "Chennai",
    },
    {
        "key": "campaign_3", "citizen": 3, "category": "WATER", "hours_ago": 6,
        "title": CAMPAIGN_TEXT, "description": CAMPAIGN_TEXT,
        "at": "coimbatore", "district": "Coimbatore",
    },
    {   # the photo this account is attaching has already been used elsewhere
        "key": "photo_source", "citizen": 4, "category": "WATER", "hours_ago": 30,
        "title": "Overflowing drain near {street}",
        "description": "The stormwater drain at {street} has been overflowing for a week.",
        "at": "chennai", "district": "Chennai",
        "attachments": [{
            "url": "/uploads/seed_recycled_pothole.jpg",
            "filename": "seed_recycled_pothole.jpg",
            "content_type": "image/jpeg", "size": 182_344,
            "signature": SHARED_PHOTO_SIGNATURE,
        }],
    },
    {   # same file, different citizen, different problem: recycled evidence
        "key": "recycled_photo", "citizen": 5, "category": "ROAD", "hours_ago": 5,
        "title": "Dangerous pothole near {street}",
        "description": "There is a very dangerous deep pothole near {street} please fix it urgent.",
        "at": "chennai", "district": "Chennai",
        "attachments": [{
            "url": "/uploads/seed_recycled_pothole.jpg",
            "filename": "seed_recycled_pothole.jpg",
            "content_type": "image/jpeg", "size": 182_344,
            "signature": SHARED_PHOTO_SIGNATURE,
        }],
    },
    {   # severe wording, no detail: the officer should phone this person
        "key": "vague_severe", "citizen": 6, "category": "PUBLIC_SAFETY", "hours_ago": 4,
        "title": "Very dangerous",
        "description": "something very dangerous is happening and it is life threatening please come immediately",
        "at": "chennai", "district": "Chennai",
        "severity": "CRITICAL",
    },
]


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
    # Account age is an integrity signal in its own right — a report from an
    # account created an hour ago is treated more warily than one from an
    # account four years old — and a database seeded in a single second would
    # otherwise make every demo account brand new. Days, in the order the
    # citizens below are created; a couple are deliberately young.
    now = datetime.utcnow()
    citizen_ages = [420, 12, 260, 95, 3, 180, 68, 15, 310]

    demo_citizen = user_document("Demo Citizen", "citizen@demo.com", hash_password(DEMO_PASSWORD), role="citizen")
    demo_citizen["email_verified"] = True  # seeded/demo accounts skip OTP verification
    demo_citizen["created_at"] = now - timedelta(days=citizen_ages[0])
    demo_officer = user_document(
        "Demo Officer", "officer@demo.com", hash_password(DEMO_PASSWORD),
        role="officer", department="Sanitation Department", specialization="Waste Management",
        district="Chennai",
    )
    # Unrestricted "super admin" (district=None) — can create officers in
    # any district. Kept as the primary demo admin so existing flows and
    # docs referencing admin@demo.com aren't affected by the new rule.
    demo_admin = user_document("Demo Admin", "admin@demo.com", hash_password(DEMO_PASSWORD), role="admin")

    # A second, district-restricted admin — demonstrates the actual rule:
    # this account can only create officers within Chennai.
    demo_district_admin = user_document(
        "Chennai District Admin", "chennai.admin@demo.com", hash_password(DEMO_PASSWORD),
        role="admin", district="Chennai",
    )

    demo_ids = {}
    for key, doc in (
        ("citizen", demo_citizen), ("officer", demo_officer),
        ("admin", demo_admin), ("district_admin", demo_district_admin),
    ):
        result = users_collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        demo_ids[key] = doc

    citizens = [demo_ids["citizen"]]
    for i, name in enumerate(CITIZEN_NAMES):
        email = name.lower().replace(" ", ".") + "@example.com"
        doc = user_document(name, email, hash_password(DEMO_PASSWORD), role="citizen")
        doc["email_verified"] = True  # seeded accounts skip OTP verification
        doc["created_at"] = now - timedelta(days=citizen_ages[i + 1])
        result = users_collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        citizens.append(doc)

    # All seeded officers are based in Chennai, matching the seeded
    # grievances' locations (all jittered around CHENNAI_CENTER) — so
    # department+district matching works correctly out of the box.
    officers = [demo_ids["officer"]]
    for i, name in enumerate(OFFICER_NAMES):
        dept = dept_docs[i % len(dept_docs)]
        email = name.lower().replace(" ", ".") + "@civicai.gov"
        doc = user_document(
            name, email, hash_password(DEMO_PASSWORD), role="officer",
            department=dept["name"], specialization=dept["categories"][0] if dept["categories"] else None,
            district="Chennai",
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
        category, title_tpl, desc_tpl = GRIEVANCE_TEMPLATES[i % len(GRIEVANCE_TEMPLATES)]
        street = random.choice(STREETS)
        title = title_tpl.format(street=street)
        description = (
            f"{desc_tpl.format(street=street)} {DETAIL_CLAUSES[i % len(DETAIL_CLAUSES)]}"
        )

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
            district="Chennai",  # matches seeded officers' district
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


def seed_suspect_grievances(citizens, dept_docs, admin, start_index):
    """Inserts SUSPECT_CASES with the derived fields the detectors read already
    in place (fingerprint, attachment signature), so a later case can see an
    earlier one, and with one full review cycle already on record."""
    dept_by_category = {}
    for dept in dept_docs:
        for cat in dept["categories"]:
            dept_by_category[cat] = dept["name"]

    now = datetime.utcnow()
    created = []

    for offset, case in enumerate(SUSPECT_CASES):
        street = random.choice(STREETS)
        category = case["category"]
        severity = case.get("severity", "LOW")
        priority = "HIGH" if severity == "CRITICAL" else severity
        department = dept_by_category.get(category, "General Administration")
        created_at = now - timedelta(hours=case["hours_ago"])

        doc = grievance_document(
            grievance_id=f"CIV-2026-{start_index + offset:05d}",
            citizen_id=citizens[case["citizen"]]["_id"],
            title=case["title"].format(street=street),
            description=case["description"].format(street=street),
            language="English",
            location=suspect_location(case["at"], street),
            district=case["district"],
        )
        sla_due_at, _ = compute_sla_due_at(priority, created_at)

        doc.update({
            "translated_text": doc["description"],
            "category": category,
            "severity": severity,
            "urgency_score": 82 if severity == "CRITICAL" else 24,
            "priority": priority,
            "priority_score": 84 if severity == "CRITICAL" else 22,
            "confidence": 0.44,
            "sentiment": "NEGATIVE",
            "ai_summary": f"Reported as a {category.lower()} problem in {case['district']}.",
            "recommended_action": "Confirm the details with the citizen before dispatching.",
            "ai_provider": "mock",
            "department": department,
            "predicted_resolution_hours": predict_resolution_hours(category, severity),
            "escalation_risk": "LOW",
            "sla_due_at": sla_due_at,
            "status": "SUBMITTED",
            "created_at": created_at,
            "updated_at": created_at,
            "attachments": case.get("attachments", []),
            "content_fingerprint": content_fingerprint(
                f"{doc['title']} {doc['description']}"
            ),
        })

        flag = case.get("flagged")
        if flag:
            decided_at = created_at + timedelta(hours=2)
            doc.update({
                "flagged_invalid": True,
                "flagged_reason": flag["reason"],
                "flagged_by": admin["_id"],
                "flagged_at": decided_at,
                "needs_authenticity_review": False,
                "integrity": {
                    "human_decision": "FAKE",
                    "human_decision_at": decided_at,
                    "human_decision_by": admin["_id"],
                    "points_held": True,
                },
                "flag_appeal_status": "PENDING",
                "flag_appeal_reason": flag["appeal"],
                "flag_appeal_requested_at": created_at + timedelta(hours=3),
                "flag_appeal_count": 1,
            })
            doc["history"] += [
                {"status": "SUBMITTED", "actor_role": "admin", "timestamp": decided_at,
                 "message": f"Integrity review: marked false/misleading by {admin['name']}. {flag['reason']}"},
                {"status": "SUBMITTED", "actor_role": "citizen",
                 "timestamp": created_at + timedelta(hours=3),
                 "message": "Citizen appealed the false-report flag."},
            ]

        if case.get("confirmed_genuine"):
            doc.update({
                "needs_authenticity_review": False,
                "integrity": {
                    "human_decision": "GENUINE",
                    "human_decision_at": created_at + timedelta(hours=1),
                    "human_decision_by": admin["_id"],
                },
            })
            doc["history"].append({
                "status": "SUBMITTED", "actor_role": "admin",
                "timestamp": created_at + timedelta(hours=1),
                "message": f"Integrity review: confirmed genuine by {admin['name']}.",
            })

        grievances_collection.insert_one(doc)
        created.append(doc)

    return created


HUMAN_DECISION_KEYS = ("human_decision", "human_decision_at", "human_decision_by")


def score_seeded_grievances():
    """Runs the same authenticity pass a live submission gets over everything
    the seed inserted.

    Two things make this a separate step rather than part of the insert loop:
    `gather_context` reads the database, so a campaign or a recycled photo is
    only visible once every other case is already stored; and the AI fusion
    read is switched off here (`use_ai=False`) because a seed must not spend
    provider credits — the fused path is covered by the test suite instead."""
    rows = list(grievances_collection.find({}))

    fingerprints_written = 0
    for row in rows:
        if row.get("content_fingerprint"):
            continue
        fingerprint = content_fingerprint(f"{row.get('title', '')} {row.get('description', '')}")
        if fingerprint:
            grievances_collection.update_one(
                {"grievance_id": row["grievance_id"]}, {"$set": {"content_fingerprint": fingerprint}}
            )
            fingerprints_written += 1

    trust_by_citizen = {}
    for row in rows:
        citizen_id = row.get("citizen_id")
        if citizen_id and citizen_id not in trust_by_citizen:
            # Persisted, because the whole point of the account standing is
            # that the next submission reads it back off the user document.
            trust_by_citizen[citizen_id] = compute_trust(citizen_id, persist=True)

    scored = 0
    for row in rows:
        try:
            authenticity = check_grievance_authenticity(row, use_ai=False)
        except Exception as error:
            print(f"WARNING: authenticity scoring failed for {row['grievance_id']}: {error}")
            continue

        trust = trust_by_citizen.get(row.get("citizen_id"), {})
        friction = submission_friction(trust, authenticity)
        decided = row.get("integrity") or {}

        integrity = {
            "trust_score": trust.get("score"),
            "trust_label": trust.get("label"),
            "trust_level": trust.get("level"),
            "staff_first": friction["staff_first"],
            "evidence_expected": friction["evidence_expected"],
            "points_held": friction["hold_points"] or authenticity["verdict"] == LIKELY_FAKE,
            "reason": friction["reason"],
            "basis": authenticity.get("basis"),
        }
        # A seeded human decision outranks the score — never overwrite it.
        integrity.update({k: decided[k] for k in HUMAN_DECISION_KEYS if k in decided})

        grievances_collection.update_one(
            {"grievance_id": row["grievance_id"]},
            {"$set": {
                "authenticity": authenticity,
                "integrity": integrity,
                "needs_authenticity_review": (
                    "human_decision" not in decided
                    and (authenticity["queue_for_review"] or friction["staff_first"])
                ),
            }},
        )
        scored += 1

    return scored, fingerprints_written


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

    print("Seeding fake-report examples...")
    suspects = seed_suspect_grievances(citizens, dept_docs, admin, start_index=2000 + 26)

    print("Scoring every seeded report for authenticity...")
    scored, _ = score_seeded_grievances()

    print("Seeding incidents...")
    seed_incidents(grievances, dept_docs)

    print("Seeding notifications...")
    seed_notifications(citizens, grievances)

    print("Creating indexes...")
    create_indexes()

    print("\nSeed complete.")
    print(f"Authenticity scored {scored} reports; {len(suspects)} were built to look suspicious.")
    print("Demo accounts (password: Demo@123):")
    print("  citizen@demo.com")
    print("  officer@demo.com  (Chennai district)")
    print("  admin@demo.com    (unrestricted - can add officers in any district)")
    print("  chennai.admin@demo.com  (Chennai district - can only add officers in Chennai)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Wipe collections before seeding")
    args = parser.parse_args()
    run(reset=args.reset)