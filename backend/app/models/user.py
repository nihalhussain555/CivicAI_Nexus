from datetime import datetime


def user_document(
    name,
    email,
    password_hash,
    role="citizen",
    department=None,
    specialization=None,
    phone=None,
    district=None,
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
        "date_of_birth": None,
        "country": None,
        "city": None,
        "postal_code": None,

        # officer/admin jurisdiction — the district they're responsible for.
        # Admins with a district set can only create officers in that same
        # district; admins with district=None are treated as unrestricted
        # ("super admin"), e.g. for the seeded demo admin account.
        "district": district,

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