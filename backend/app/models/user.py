from datetime import datetime


def user_document(
    name,
    email,
    password_hash,
    role="citizen",
    department=None,
    specialization=None,
    phone=None,
):
    now = datetime.utcnow()

    return {
        "name": name.strip(),
        "email": email.lower().strip(),
        "password_hash": password_hash,
        "role": role,  # citizen | officer | admin

        "language": "English",

        "phone": phone,
        "address": None,
        "profile_image": None,

        # officer-only fields
        "department": department,
        "specialization": specialization,
        "badge_id": None,
        "cases_resolved": 0,
        "avg_resolution_hours": None,

        # citizen preferences
        "notification_preferences": {
            "email": True,
            "in_app": True,
        },

        "active": True,

        "created_at": now,
        "updated_at": now,
    }
