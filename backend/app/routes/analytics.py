from datetime import datetime, timedelta

from fastapi import (
    APIRouter,
    Depends,
)

from app.config.database import (
    grievances_collection,
    incidents_collection,
    users_collection,
)

from app.utils.dependencies import (
    require_admin,
    require_staff,
)

from app.utils.helpers import (
    serialize_documents,
)


router = APIRouter(
    prefix="/api/analytics",
    tags=["Analytics"],
)


def admin_grievance_query(admin):
    if admin.get("district"):
        return {
            "district":
                admin["district"]
        }

    return {}


def incident_ids_for_district(
    district
):
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
def admin_overview(
    admin=Depends(require_admin)
):
    base = admin_grievance_query(
        admin
    )

    total = (
        grievances_collection.count_documents(
            base
        )
    )

    open_count = (
        grievances_collection.count_documents(
            {
                **base,
                "status": {
                    "$nin": ["CLOSED"]
                },
            }
        )
    )

    resolved = (
        grievances_collection.count_documents(
            {
                **base,
                "status":
                    "CLOSED",
            }
        )
    )

    unassigned = (
        grievances_collection.count_documents(
            {
                **base,
                "status":
                    "DEPARTMENT_ASSIGNED",
                "assigned_officer":
                    None,
            }
        )
    )

    high_priority = (
        grievances_collection.count_documents(
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

    escalated = (
        grievances_collection.count_documents(
            {
                **base,
                "status":
                    "ESCALATED",
            }
        )
    )

    now = datetime.utcnow()

    sla_breaches = (
        grievances_collection.count_documents(
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
    admin=Depends(require_admin)
):
    grievance_query = {
        "location": {
            "$ne": None
        }
    }

    if admin.get("district"):
        grievance_query[
            "district"
        ] = admin["district"]

    grievances = list(
        grievances_collection.find(
            grievance_query,
            {
                "grievance_id": 1,
                "title": 1,
                "category": 1,
                "severity": 1,
                "priority": 1,
                "status": 1,
                "location": 1,
                "district": 1,
                "created_at": 1,
            },
        ).limit(1000)
    )

    incident_query = {
        "status": {
            "$in": [
                "ACTIVE",
                "MONITORING",
            ]
        }
    }

    if admin.get("district"):
        ids = incident_ids_for_district(
            admin["district"]
        )

        incident_query[
            "grievance_ids"
        ] = {
            "$in":
                ids or ["__NONE__"]
        }

    incidents = list(
        incidents_collection.find(
            incident_query,
            {
                "incident_id": 1,
                "title": 1,
                "category": 1,
                "risk_level": 1,
                "center": 1,
                "report_count": 1,
            },
        )
    )

    return {
        "success": True,
        "data": {
            "grievances":
                serialize_documents(
                    grievances
                ),
            "incidents":
                serialize_documents(
                    incidents
                ),
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