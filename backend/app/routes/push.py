from fastapi import APIRouter, Depends

from app.config.database import push_subscriptions_collection
from app.config.settings import settings
from app.models.push_subscription import push_subscription_document
from app.schemas.push import PushSubscribeRequest, PushUnsubscribeRequest
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/api/push", tags=["Push Notifications"])


@router.get("/vapid-public-key")
def vapid_public_key():
    # Public by design — this is what the browser needs to create a push
    # subscription. It's not a secret (only the private key is).
    return {"success": True, "data": {"public_key": settings.VAPID_PUBLIC_KEY}}


@router.post("/subscribe")
def subscribe(
    data: PushSubscribeRequest,
    current_user=Depends(get_current_user),
):
    doc = push_subscription_document(
        current_user["_id"], data.endpoint, data.keys.model_dump()
    )

    # Same browser/device re-subscribing (e.g. after clearing site data)
    # replaces its old row rather than creating a duplicate — endpoint is
    # unique per browser+origin pairing.
    push_subscriptions_collection.update_one(
        {"endpoint": data.endpoint},
        {"$set": doc},
        upsert=True,
    )

    return {"success": True, "message": "Subscribed to push notifications."}


@router.post("/unsubscribe")
def unsubscribe(
    data: PushUnsubscribeRequest,
    current_user=Depends(get_current_user),
):
    push_subscriptions_collection.delete_one(
        {"endpoint": data.endpoint, "user_id": current_user["_id"]}
    )

    return {"success": True, "message": "Unsubscribed from push notifications."}