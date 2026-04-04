from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from api.routes.auth import get_current_user, hash_password
from models.user import UserUpdateRequest

router = APIRouter(prefix="/users", tags=["users"])

_PROJECTION = {"_id": 0, "password_hash": 0}


# ---------------------------------------------------------------------------
# CREATE  — handled by POST /auth/register (see auth.py)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# READ — get own profile or any user by id (admin-style)
# ---------------------------------------------------------------------------

@router.get("/me")
async def get_me(request: Request, current_user: dict = Depends(get_current_user)) -> dict:
    """Return the authenticated user's profile."""
    db = request.app.state.db
    user = await db.users.find_one({"user_id": current_user["user_id"]}, projection=_PROJECTION)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Get any user by user_id (requires auth)."""
    db = request.app.state.db
    user = await db.users.find_one({"user_id": user_id}, projection=_PROJECTION)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/")
async def list_users(
    request: Request,
    current_user: dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 20,
) -> list[dict]:
    """List all users (paginated). Requires auth."""
    db = request.app.state.db
    cursor = db.users.find({}, projection=_PROJECTION).skip(skip).limit(limit)
    return await cursor.to_list(length=limit)


# ---------------------------------------------------------------------------
# UPDATE — update own profile only
# ---------------------------------------------------------------------------

@router.put("/me")
async def update_me(
    req: UserUpdateRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Update the authenticated user's profile."""
    db = request.app.state.db
    updates: dict = {}

    if req.username is not None:
        if await db.users.find_one({"username": req.username, "user_id": {"$ne": current_user["user_id"]}}):
            raise HTTPException(status_code=409, detail="Username already taken")
        updates["username"] = req.username

    if req.email is not None:
        if await db.users.find_one({"email": req.email, "user_id": {"$ne": current_user["user_id"]}}):
            raise HTTPException(status_code=409, detail="Email already registered")
        updates["email"] = req.email

    if req.password is not None:
        updates["password_hash"] = hash_password(req.password)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    user = await db.users.find_one({"user_id": current_user["user_id"]}, projection=_PROJECTION)
    return user


# ---------------------------------------------------------------------------
# DELETE — delete own account only
# ---------------------------------------------------------------------------

@router.delete("/me")
async def delete_me(
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Delete the authenticated user's account."""
    db = request.app.state.db
    result = await db.users.delete_one({"user_id": current_user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Account deleted successfully", "user_id": current_user["user_id"]}
