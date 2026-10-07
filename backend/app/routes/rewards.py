from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.models.reward import TIERS
from app.services.reward_service import get_citizen_summary, get_leaderboard
from app.services.certificate_service import generate_certificate_pdf
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


@router.get("/certificate/{tier_key}")
def download_tier_certificate(tier_key: str, current_user=Depends(require_roles("citizen"))):
    """Generates the citizen's digital certificate for a reward tier they
    have actually reached — validated server-side against their real
    point total, never just trusted from the URL."""
    tier = next((t for t in TIERS if t["key"] == tier_key), None)
    if not tier or tier["key"] == "NONE":
        raise HTTPException(status_code=404, detail="Unknown reward tier")

    summary = get_citizen_summary(current_user["_id"])
    if summary["total_points"] < tier["min_points"]:
        raise HTTPException(
            status_code=403,
            detail=f"You need {tier['min_points']} points to unlock this certificate — you currently have {summary['total_points']}.",
        )

    cert_id = f"CIV-{str(current_user['_id'])[-8:]}-{tier_key}".upper()

    pdf_bytes = generate_certificate_pdf(
        recipient_name=current_user.get("name", "Citizen"),
        headline="Certificate of Recognition",
        subtitle="CivicAI Nexus — Civic Rewards Program",
        achievement_label=f"Awarded for reaching {tier['label']} — {tier['min_points']}+ civic points",
        cert_id=cert_id,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="CivicAI_{tier["key"]}_Certificate.pdf"'},
    )