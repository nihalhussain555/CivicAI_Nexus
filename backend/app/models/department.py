from datetime import datetime


def department_document(name, code, description="", categories=None):
    now = datetime.utcnow()
    return {
        "name": name,
        "code": code,
        "description": description,
        "categories": categories or [],
        "active": True,
        "total_officers": 0,
        "avg_resolution_hours": None,
        "created_at": now,
        "updated_at": now,
    }
