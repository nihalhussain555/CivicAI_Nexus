from datetime import datetime


def notification_document(
    user_id,
    title,
    message,
    notification_type="INFO",
    related_grievance_id=None,
):
    return {
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notification_type,  # INFO | STATUS_CHANGE | INCIDENT | SLA_RISK | SUCCESS
        "related_grievance_id": related_grievance_id,
        "read": False,
        "created_at": datetime.utcnow(),
    }
