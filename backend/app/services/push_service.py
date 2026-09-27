import json

from pywebpush import webpush, WebPushException

from app.config.database import push_subscriptions_collection
from app.config.settings import settings


VAPID_CLAIMS = {"sub": settings.VAPID_CLAIM_EMAIL}


def send_push_notification(user_id, title, body, url="/"):
    """Push a notification to every device/browser this user has
    subscribed on. Best-effort — a failure here should never break the
    caller (grievance actions must still succeed even if a push fails),
    and a dead subscription (the browser revoked it, or the user
    uninstalled the app) is cleaned up automatically rather than retried
    forever."""
    subscriptions = list(
        push_subscriptions_collection.find({"user_id": user_id})
    )

    if not subscriptions:
        return

    payload = json.dumps({"title": title, "body": body, "url": url})

    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub["endpoint"],
            "keys": sub["keys"],
        }

        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims=dict(VAPID_CLAIMS),
            )

        except WebPushException as error:
            status_code = getattr(error.response, "status_code", None)

            if status_code in (404, 410):
                # The push service says this subscription no longer
                # exists (browser revoked it / uninstalled) — remove it
                # so we stop wasting requests on it.
                push_subscriptions_collection.delete_one(
                    {"endpoint": sub["endpoint"]}
                )
            else:
                print(f"WARNING: push send failed ({status_code}): {error}")

        except Exception as error:
            print(f"WARNING: push send failed: {type(error).__name__}: {error}")