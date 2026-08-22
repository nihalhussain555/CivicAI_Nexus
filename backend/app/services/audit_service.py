from app.config.database import audit_logs_collection
from app.models.audit_log import audit_log_document


def log_action(actor_id, actor_role, action, entity_type, entity_id, details=None):
    doc = audit_log_document(actor_id, actor_role, action, entity_type, entity_id, details)
    audit_logs_collection.insert_one(doc)
    return doc
