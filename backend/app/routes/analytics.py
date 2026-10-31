from datetime import datetime, timedelta, timezone
import re

from fastapi import ( APIRouter, Depends, Query, )
from app.config.database import ( grievances_collection, incidents_collection, users_collection, )
from app.utils.dependencies import ( require_admin, require_staff,)
from app.utils.helpers import (serialize_documents,)

router = APIRouter( prefix="/api/analytics", tags=["Analytics"], )

# Statuses that mean "nobody is working on this any more" — used by the map's
# open-only filter, and deliberately including WITHDRAWN: a deleted report
# shouldn't show up as live work on a duty officer's map.
MAP_CLOSED_STATUSES = ["CLOSED", "WITHDRAWN"]


def text_match(value):
    """Case-insensitive equality as a query, with the caller's text escaped so
    a value containing regex metacharacters matches itself and nothing else."""
    return {"$regex": f"^{re.escape(value.strip())}$", "$options": "i"}


def facet_values(field, base_query):
    """Distinct stored values for a filter dropdown, newest dataset wins over
    any hard-coded list because these fields are classifier output."""
    return sorted(
        {value for value in grievances_collection.distinct(field, base_query) if value}
    )


def admin_grievance_query(admin):
    if admin.get("district"):
        return { "district": admin["district"] }
    return {}


def incident_ids_for_district( district ):
    if not district:
        return None

    grievance_ids = grievances_collection.distinct(
        "grievance_id",
        {
            "district": district
        },
    )

    return grievance_ids


@router.get("/admin/overview")
def admin_overview( admin=Depends(require_admin) ):
    base = admin_grievance_query( admin )
    total = ( grievances_collection.count_documents( base))
    open_count = ( grievances_collection.count_documents(
            {
                **base,
                "status": {
                    "$nin": ["CLOSED"]
                },
            }
        )
    )

    resolved = ( grievances_collection.count_documents(
            {
                **base,
                "status":
                    "CLOSED",
            }
        )
    )

    unassigned = ( grievances_collection.count_documents(
            {
                **base,
                "status":
                    "DEPARTMENT_ASSIGNED",
                "assigned_officer":
                    None,
            }
        )
    )

    high_priority = ( grievances_collection.count_documents(
            {
                **base,
                "priority": {
                    "$in": [
                        "HIGH",
                        "CRITICAL",
                    ]
                },
            }
        )
    )

    escalated = ( grievances_collection.count_documents(
            {
                **base,
                "status":
                    "ESCALATED",
            }
        )
    )

    now = datetime.utcnow()
    sla_breaches = ( grievances_collection.count_documents(
            {
                **base,
                "status": {
                    "$nin": ["CLOSED"]
                },
                "sla_due_at": {
                    "$lt": now,
                    "$ne": None,
                },
            }
        )
    )

    avg_pipeline = [
        {
            "$match": {
                **base,
                "resolved_at": {
                    "$ne": None
                },
            }
        },
        {
            "$project": {
                "hours": {
                    "$divide": [
                        {
                            "$subtract": [
                                "$resolved_at",
                                "$created_at",
                            ]
                        },
                        1000 * 60 * 60,
                    ]
                }
            }
        },
        {
            "$group": {
                "_id": None,
                "avg_hours": {
                    "$avg":
                        "$hours"
                },
            }
        },
    ]

    agg = list(
        grievances_collection.aggregate(
            avg_pipeline
        )
    )

    avg_resolution_hours = (
        round(
            agg[0]["avg_hours"],
            1,
        )
        if agg
        and agg[0]["avg_hours"]
        is not None
        else None
    )

    confidence_pipeline = [
        {
            "$match": base
        },
        {
            "$group": {
                "_id": None,
                "avg_confidence": {
                    "$avg":
                        "$confidence"
                },
            }
        },
    ]

    confidence = list(
        grievances_collection.aggregate(
            confidence_pipeline
        )
    )

    avg_confidence = (
        round(
            confidence[0][
                "avg_confidence"
            ],
            2,
        )
        if confidence
        and confidence[0][
            "avg_confidence"
        ] is not None
        else None
    )

    officer_query = {
        "role": "officer"
    }

    citizen_query = {
        "role": "citizen"
    }

    if admin.get("district"):
        officer_query[
            "district"
        ] = admin["district"]

        citizen_query[
            "district"
        ] = admin["district"]

    return {
        "success": True,
        "data": {
            "district":
                admin.get("district"),
            "total_grievances":
                total,
            "open":
                open_count,
            "resolved":
                resolved,
            "unassigned":
                unassigned,
            "high_priority":
                high_priority,
            "escalated":
                escalated,
            "sla_breaches":
                sla_breaches,
            "avg_resolution_hours":
                avg_resolution_hours,
            "resolution_rate":
                round(
                    (
                        resolved /
                        total
                    ) * 100,
                    1,
                )
                if total
                else 0,
            "escalation_rate":
                round(
                    (
                        escalated /
                        total
                    ) * 100,
                    1,
                )
                if total
                else 0,
            "avg_ai_confidence":
                avg_confidence,
            "total_incidents":
                incidents_collection.count_documents(
                    {}
                ),
            "active_incidents":
                incidents_collection.count_documents(
                    {
                        "status":
                            "ACTIVE"
                    }
                ),
            "total_officers":
                users_collection.count_documents(
                    officer_query
                ),
            "total_citizens":
                users_collection.count_documents(
                    citizen_query
                ),
        },
    }


@router.get(
    "/admin/category-distribution"
)
def category_distribution(
    admin=Depends(require_admin)
):
    base = admin_grievance_query(
        admin
    )

    pipeline = [
        {
            "$match": base
        },
        {
            "$group": {
                "_id": "$category",
                "count": {
                    "$sum": 1
                },
            }
        },
        {
            "$sort": {
                "count": -1
            }
        },
    ]

    results = list(
        grievances_collection.aggregate(
            pipeline
        )
    )

    return {
        "success": True,
        "data": [
            {
                "category":
                    item["_id"],
                "count":
                    item["count"],
            }
            for item in results
        ],
    }


@router.get(
    "/admin/department-performance"
)
def department_performance(
    admin=Depends(require_admin)
):
    base = admin_grievance_query(
        admin
    )

    pipeline = [
        {
            "$match": base
        },
        {
            "$group": {
                "_id":
                    "$department",
                "total": {
                    "$sum": 1
                },
                "resolved": {
                    "$sum": {
                        "$cond": [
                            {
                                "$eq": [
                                    "$status",
                                    "CLOSED",
                                ]
                            },
                            1,
                            0,
                        ]
                    }
                },
                "escalated": {
                    "$sum": {
                        "$cond": [
                            {
                                "$eq": [
                                    "$status",
                                    "ESCALATED",
                                ]
                            },
                            1,
                            0,
                        ]
                    }
                },
            }
        },
        {
            "$sort": {
                "total": -1
            }
        },
    ]

    results = list(
        grievances_collection.aggregate(
            pipeline
        )
    )

    for item in results:
        item["resolution_rate"] = (
            round(
                (
                    item["resolved"] /
                    item["total"]
                ) * 100,
                1,
            )
            if item["total"]
            else 0
        )

    return {
        "success": True,
        "data": results,
    }


@router.get(
    "/admin/trends"
)
def complaint_trends(
    days: int = 30,
    admin=Depends(require_admin),
):
    days = max(
        1,
        min(365, days),
    )

    since = (
        datetime.utcnow()
        - timedelta(
            days=days
        )
    )

    base = admin_grievance_query(
        admin
    )

    pipeline = [
        {
            "$match": {
                **base,
                "created_at": {
                    "$gte": since
                },
            }
        },
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format":
                            "%Y-%m-%d",
                        "date":
                            "$created_at",
                    }
                },
                "count": {
                    "$sum": 1
                },
            }
        },
        {
            "$sort": {
                "_id": 1
            }
        },
    ]

    results = list(
        grievances_collection.aggregate(
            pipeline
        )
    )

    return {
        "success": True,
        "data": [
            {
                "date":
                    item["_id"],
                "count":
                    item["count"],
            }
            for item in results
        ],
    }


@router.get("/admin/map")
def map_markers(
    admin=Depends(require_admin),
    status: str = Query(None, description="Comma-separated statuses"),
    priority: str = Query(None, description="Comma-separated priorities"),
    category: str = Query(None),
    department: str = Query(None),
    district: str = None,
    days: int = Query(None, ge=1, le=365),
    open_only: bool = False,
    sla_breached: bool = False,
    include_incidents: bool = True,
    limit: int = Query(1500, ge=1, le=5000),
):
    """Every geographically placeable report, plus optional filters so the map
    can answer "show me the open water complaints in Madurai this month"
    without shipping the whole database to the browser.

    Two things the old version got wrong and the frontend can't fix from here:
      - it counted nothing, so a truncated or empty result looked identical to
        "there are no grievances", and
      - it filtered on `location != null`, which passes documents whose
        coordinates are null, so markers silently vanished.
    Hence `meta`: the map is told exactly how many reports exist, how many it
    received, and how many had no usable point.
    """
    query = admin_grievance_query(admin)

    # A district admin is pinned to their own district by admin_grievance_query;
    # only a super admin gets to narrow further with the ?district= filter.
    if district and not admin.get("district"):
        query["district"] = district

    if status:
        wanted = [s.strip().upper() for s in status.split(",") if s.strip()]
        if wanted:
            query["status"] = {"$in": wanted}
    elif open_only:
        query["status"] = {"$nin": MAP_CLOSED_STATUSES}

    if priority:
        wanted = [p.strip().upper() for p in priority.split(",") if p.strip()]
        if wanted:
            query["priority"] = {"$in": wanted}

    if days:
        query["created_at"] = {
            "$gte": datetime.utcnow() - timedelta(days=days)
        }

    if sla_breached:
        # Overdue and still live — a breached SLA on a closed case is history,
        # not something to plot for whoever is on duty today.
        query["sla_due_at"] = {"$lt": datetime.utcnow()}
        query.setdefault("status", {"$nin": MAP_CLOSED_STATUSES})

    # Category and department are classifier output, not a clean enum ("WASTE"
    # beside "Sanitation" beside "Municipal Waste Management Department"), so
    # matching is case-insensitive on the stored value and the UI is handed the
    # values that actually exist in scope (`meta.facets`) rather than a fixed
    # list that would silently filter out anything spelled differently. Applied
    # last, so the facet lists describe the other filters rather than themselves.
    facet_base = dict(query)
    if category:
        query["category"] = text_match(category)
    if department:
        query["department"] = text_match(department)

    total_in_scope = grievances_collection.count_documents(query)

    # Newest first: when a filter matches more than `limit` rows, the ones that
    # get dropped should be the oldest, not an arbitrary slice of the collection.
    cursor = grievances_collection.find(
        {**query, "location": {"$ne": None}},
        {
            "grievance_id": 1, "title": 1, "category": 1, "severity": 1,
            "priority": 1, "status": 1, "location": 1, "district": 1,
            "department": 1, "created_at": 1, "sla_due_at": 1,
            "assigned_officer": 1, "flagged_invalid": 1,
        },
    ).sort("created_at", -1).limit(limit)

    placeable, unusable = [], 0
    for row in cursor:
        coordinates = (row.get("location") or {}).get("coordinates")
        # [0, 0] is not "a place in the ocean", it's a missing GPS fix that got
        # stored anyway. Plotting it would drag fitBounds off the country.
        if not coordinates or len(coordinates) != 2 or not any(coordinates):
            unusable += 1
            continue
        placeable.append(row)

    incidents = []
    if include_incidents:
        incident_query = {"status": {"$in": ["ACTIVE", "MONITORING"]}}
        if admin.get("district") or district:
            ids = incident_ids_for_district(admin.get("district") or district)
            incident_query["grievance_ids"] = {"$in": ids or ["__NONE__"]}

        incidents = list(incidents_collection.find(
            incident_query,
            {
                "incident_id": 1, "title": 1, "category": 1, "risk_level": 1,
                "center": 1, "report_count": 1, "status": 1, "district": 1,
            },
        ))

    return {
        "success": True,
        "data": {
            "grievances": serialize_documents(placeable),
            "incidents": serialize_documents(incidents),
            "meta": {
                "total_in_scope": total_in_scope,
                "returned": len(placeable),
                "without_coordinates": unusable,
                "truncated": total_in_scope > len(placeable) + unusable,
                "generated_at": datetime.now(timezone.utc),
                "facets": {
                    "categories": facet_values("category", facet_base),
                    "departments": facet_values("department", facet_base),
                },
            },
        },
    }


@router.get(
    "/officer/overview"
)
def officer_overview(
    current_user=Depends(
        require_staff
    )
):
    if current_user["role"] == "officer":
        query = {
            "assigned_officer":
                current_user["_id"]
        }
    else:
        query = {}

    total = (
        grievances_collection.count_documents(
            query
        )
    )

    open_count = (
        grievances_collection.count_documents(
            {
                **query,
                "status": {
                    "$nin": ["CLOSED"]
                },
            }
        )
    )

    resolved = (
        grievances_collection.count_documents(
            {
                **query,
                "status":
                    "CLOSED",
            }
        )
    )

    escalated = (
        grievances_collection.count_documents(
            {
                **query,
                "status":
                    "ESCALATED",
            }
        )
    )

    high_priority = (
        grievances_collection.count_documents(
            {
                **query,
                "priority": {
                    "$in": [
                        "HIGH",
                        "CRITICAL",
                    ]
                },
            }
        )
    )

    return {
        "success": True,
        "data": {
            "total_assigned":
                total,
            "open":
                open_count,
            "resolved":
                resolved,
            "escalated":
                escalated,
            "high_priority":
                high_priority,
            "resolution_rate":
                round(
                    (
                        resolved /
                        total
                    ) * 100,
                    1,
                )
                if total
                else 0,
        },
    }


# --- Fake-grievance detection analytics -------------------------------
# Bounded Python-side aggregation over a projection, rather than a Mongo
# pipeline. Three reasons: the dates need UTC-naive bucket math anyway, the
# per-document signal list has to be exploded, and — most usefully — a real
# LLM authenticity read costs a provider call per *submission*, so scoring
# history must never become a reporting bottleneck. A 30-day demo dataset fits
# in one scan; at national scale this is the query to move onto a nightly
# precomputed summary collection, and that's the documented next step.
INTEGRITY_SCAN_LIMIT = 3000


@router.get("/admin/integrity")
def admin_integrity(admin=Depends(require_admin), days: int = 30):
    """How much fake reporting there is, which signals fire, whether the
    detector agrees with the humans who overrode it, and who to look at."""
    base = admin_grievance_query(admin)
    days = max(1, min(365, days))
    since = datetime.utcnow() - timedelta(days=days)

    rows = list(grievances_collection.find(
        {**base, "created_at": {"$gte": since}},
        {
            "grievance_id": 1, "citizen_id": 1, "district": 1, "category": 1,
            "department": 1, "status": 1, "created_at": 1, "attachments": 1,
            "flagged_invalid": 1, "flag_appeal_status": 1, "flag_reversed_at": 1,
            "needs_authenticity_review": 1, "authenticity": 1, "integrity": 1,
        },
    ).sort("created_at", -1).limit(INTEGRITY_SCAN_LIMIT))

    scored = [r for r in rows if (r.get("authenticity") or {}).get("verdict")]

    verdicts = {"LIKELY_GENUINE": 0, "NEEDS_REVIEW": 0, "LIKELY_FAKE": 0}
    signal_counts = {}
    districts = {}
    categories = {}
    days_bucket = {}
    evidence = {"with_photo": [0, 0], "no_photo": [0, 0]}  # [scored, fake]
    human = {"agree": 0, "disagree": 0, "total": 0}
    appeals = {"PENDING": 0, "APPROVED": 0, "REJECTED": 0}
    flags = {"active": 0, "reversed": 0}
    offenders = {}
    disagreements = 0

    for row in rows:
        authenticity = row.get("authenticity") or {}
        integrity = row.get("integrity") or {}
        verdict = authenticity.get("verdict")
        rule_verdict = authenticity.get("rule_verdict")
        is_fake = verdict == "LIKELY_FAKE"

        if row.get("flagged_invalid"):
            flags["active"] += 1
        if row.get("flag_reversed_at"):
            flags["reversed"] += 1
        if row.get("flag_appeal_status") in appeals:
            appeals[row["flag_appeal_status"]] += 1

        if not verdict:
            continue

        verdicts[verdict] = verdicts.get(verdict, 0) + 1
        if authenticity.get("estimator_disagreement"):
            disagreements += 1

        has_photo = bool(row.get("attachments"))
        bucket_key = "with_photo" if has_photo else "no_photo"
        evidence[bucket_key][0] += 1
        if is_fake:
            evidence[bucket_key][1] += 1

        for signal in authenticity.get("signals") or []:
            if signal.get("impact", 0) < 0:
                name = signal.get("signal")
                if name:
                    signal_counts[name] = signal_counts.get(name, 0) + 1

        # Where detection and adjudication diverge is the only honest scorecard
        # for the scorer itself. Compared against rule_verdict, not the fused
        # verdict, because the fused score mixes in the AI read a human may
        # have been looking at too.
        decision = integrity.get("human_decision")
        if decision:
            human["total"] += 1
            matched = (decision == "FAKE") == (rule_verdict == "LIKELY_FAKE")
            human["agree" if matched else "disagree"] += 1

        district = row.get("district") or "Unspecified"
        d = districts.setdefault(district, {"scored": 0, "likely_fake": 0, "flagged": 0})
        d["scored"] += 1
        if is_fake:
            d["likely_fake"] += 1
        if row.get("flagged_invalid"):
            d["flagged"] += 1

        category = row.get("category") or "GENERAL"
        c = categories.setdefault(category, {"scored": 0, "likely_fake": 0, "flagged": 0})
        c["scored"] += 1
        if is_fake:
            c["likely_fake"] += 1
        if row.get("flagged_invalid"):
            c["flagged"] += 1

        created = row.get("created_at")
        if created:
            day = created.strftime("%Y-%m-%d")
            b = days_bucket.setdefault(day, {"scored": 0, "likely_fake": 0, "needs_review": 0})
            b["scored"] += 1
            if is_fake:
                b["likely_fake"] += 1
            elif verdict == "NEEDS_REVIEW":
                b["needs_review"] += 1

        if row.get("flagged_invalid") and row.get("citizen_id"):
            offenders[row["citizen_id"]] = offenders.get(row["citizen_id"], 0) + 1

    scored_total = len(scored)

    def rate(count):
        return round((count / scored_total) * 100, 1) if scored_total else 0

    def fake_rate(bucket):
        total_in_bucket, fake = evidence[bucket]
        return {
            "scored": total_in_bucket,
            "likely_fake": fake,
            "fake_rate": round((fake / total_in_bucket) * 100, 1) if total_in_bucket else 0,
        }

    top_citizens = sorted(offenders.items(), key=lambda kv: kv[1], reverse=True)[:10]
    offender_rows = []
    for citizen_id, count in top_citizens:
        person = users_collection.find_one(
            {"_id": citizen_id}, {"name": 1, "email": 1, "district": 1, "trust": 1}
        ) or {}
        trust = person.get("trust") or {}
        offender_rows.append({
            "citizen_id": str(citizen_id),
            "name": person.get("name"),
            "email": person.get("email"),
            "district": person.get("district"),
            "flagged_reports": count,
            "trust_score": trust.get("score"),
            "trust_label": trust.get("label"),
        })

    return {
        "success": True,
        "data": {
            "window_days": days,
            "reports_in_window": len(rows),
            "scored": scored_total,
            "unscored": len(rows) - scored_total,
            "verdicts": verdicts,
            "likely_fake_rate": rate(verdicts["LIKELY_FAKE"]),
            "needs_review_rate": rate(verdicts["NEEDS_REVIEW"]),
            "queue_backlog": sum(
                1 for r in scored
                if r.get("needs_authenticity_review")
                and not (r.get("integrity") or {}).get("human_decision")
            ),
            "flags": flags,
            "appeals": {
                **appeals,
                "uphold_rate": round(
                    appeals["APPROVED"] / (appeals["APPROVED"] + appeals["REJECTED"]) * 100, 1
                ) if (appeals["APPROVED"] + appeals["REJECTED"]) else 0,
            },
            # Detection-vs-adjudication agreement. A low number here is the
            # signal to retune weights, not to flag more reports.
            "human_agreement": {
                **human,
                "agreement_rate": round(
                    human["agree"] / human["total"] * 100, 1
                ) if human["total"] else 0,
            },
            "estimator_disagreements": disagreements,
            "top_signals": sorted(
                ({"signal": k, "count": v} for k, v in signal_counts.items()),
                key=lambda item: item["count"],
                reverse=True,
            )[:10],
            "evidence": {
                "with_photo": fake_rate("with_photo"),
                "no_photo": fake_rate("no_photo"),
            },
            "by_district": dict(sorted(
                districts.items(),
                key=lambda kv: kv[1]["likely_fake"],
                reverse=True,
            )),
            "by_category": dict(sorted(
                categories.items(),
                key=lambda kv: kv[1]["likely_fake"],
                reverse=True,
            )),
            "timeline": [
                {"date": day, **days_bucket[day]}
                for day in sorted(days_bucket)
            ],
            "top_offenders": offender_rows,
        },
    }
