from app.config.database import notifications_collection
from app.models.notification import notification_document


def notify(user_id, title, message, notification_type="INFO", related_grievance_id=None):
    doc = notification_document(user_id, title, message, notification_type, related_grievance_id)
    notifications_collection.insert_one(doc)
    return doc
