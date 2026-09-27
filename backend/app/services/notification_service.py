from app.config.database import notifications_collection, users_collection
from app.models.notification import notification_document
from app.services.push_service import send_push_notification

# Grievance detail pages live at a different base path per role.
ROLE_BASE_PATH = {
    "citizen": "/citizen/grievances",
    "officer": "/officer/grievances",
    "admin": "/admin/grievances",
}


def notify(user_id, title, message, notification_type="INFO", related_grievance_id=None):
    doc = notification_document(user_id, title, message, notification_type, related_grievance_id)
    notifications_collection.insert_one(doc)

    # Web Push, best-effort: every existing call site that already creates
    # an in-app notification now also sends a real push, without needing
    # to touch any of those call sites individually. A push failure (no
    # subscription, expired one, network issue) must never break whatever
    # action triggered the notification in the first place.
    try:
        url = "/"
        if related_grievance_id:
            user = users_collection.find_one({"_id": user_id}, {"role": 1})
            base = ROLE_BASE_PATH.get(user.get("role") if user else None, "/citizen/grievances")
            url = f"{base}/{related_grievance_id}"

        send_push_notification(user_id, title, message, url=url)
    except Exception as error:
        print(f"WARNING: push notify failed: {error}")

    return doc