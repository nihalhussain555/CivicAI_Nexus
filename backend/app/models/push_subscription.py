from datetime import datetime


def push_subscription_document(user_id, endpoint, keys):
    return {
        "user_id": user_id,
        "endpoint": endpoint,
        "keys": keys,  # {"p256dh": ..., "auth": ...} — from the browser's PushSubscription
        "created_at": datetime.utcnow(),
    }