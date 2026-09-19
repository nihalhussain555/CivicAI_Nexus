from fastapi import APIRouter, Depends

from app.models.reward import TIERS
from app.services.reward_service import get_citizen_summary, get_leaderboard
from app.utils.dependencies import get_current_user, require_roles
from app.utils.helpers import serialize_documents


router = APIRouter(prefix="/api/rewards", tags=["Rewards"])


@router.get("/me")
def my_rewards(current_user=Depends(require_roles("citizen"))):
    summary = get_citizen_summary(current_user["_id"])

    return {
        "success": True,
        "data": {
            **summary,
            "ledger": serialize_documents(summary["ledger"]),
        },
    }


@router.get("/leaderboard")
def leaderboard(limit: int = 10, current_user=Depends(get_current_user)):
    limit = max(1, min(50, limit))
    rows = get_leaderboard(limit=limit)

    return {
        "success": True,
        "data": serialize_documents(rows),
    }


@router.get("/tiers")
def tiers(current_user=Depends(get_current_user)):
    return {
        "success": True,
        "data": TIERS[1:],  # drop the internal "NONE" floor tier
    }