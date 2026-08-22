from datetime import datetime


def audit_log_document(actor_id, actor_role, action, entity_type, entity_id, details=None):
    return {
        "actor_id": actor_id,
        "actor_role": actor_role,
        "action": action,                # e.g. "GRIEVANCE_STATUS_CHANGE"
        "entity_type": entity_type,       # e.g. "grievance"
        "entity_id": entity_id,
        "details": details or {},
        "created_at": datetime.utcnow(),
    }
