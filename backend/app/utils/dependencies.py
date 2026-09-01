from bson import ObjectId
from bson.errors import InvalidId

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config.database import users_collection
from app.utils.security import decode_token


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = decode_token(credentials.credentials)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")

    try:
        object_id = ObjectId(user_id)
    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        )

    user = users_collection.find_one({"_id": object_id})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
        )

    if not user.get("active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deactivated",
        )

    return user


def require_roles(*roles):
    """Dependency factory: restrict an endpoint to a set of roles."""

    def _checker(current_user=Depends(get_current_user)):
        if current_user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of the following roles: {', '.join(roles)}",
            )
        return current_user

    return _checker


def require_admin(current_user=Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def require_super_admin(current_user=Depends(get_current_user)):
    """Unrestricted admins only (district=None) — used for actions that
    outrank district-scoped admins, like creating other admin accounts."""
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    if current_user.get("district"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only unrestricted super-admins can manage admin accounts.",
        )
    return current_user


def require_officer(current_user=Depends(get_current_user)):
    if current_user["role"] not in ("officer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Officer access required",
        )
    return current_user


def require_staff(current_user=Depends(get_current_user)):
    """Officer or admin — used for endpoints staff share."""
    if current_user["role"] not in ("officer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff access required",
        )
    return current_user