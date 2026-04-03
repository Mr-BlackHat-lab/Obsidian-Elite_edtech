from __future__ import annotations

from fastapi import APIRouter, Request
from pymongo.errors import DuplicateKeyError

from models.user import User, UserCreateRequest

router = APIRouter()


@router.post("/register")
async def register(req: UserCreateRequest, request: Request) -> dict:
    db = request.app.state.db

    existing = await db.users.find_one({"username": req.username}, projection={"_id": 0, "user_id": 1})
    if existing:
        return {"user_id": existing.get("user_id"), "message": "User already exists"}

    user = User(username=req.username, email=req.email)
    try:
        await db.users.insert_one(user.model_dump())
    except DuplicateKeyError:
        existing = await db.users.find_one({"username": req.username}, projection={"_id": 0, "user_id": 1})
        return {
            "user_id": existing.get("user_id") if existing else None,
            "message": "User already exists",
        }

    return {"user_id": user.user_id, "username": user.username}


@router.get("/user/{user_id}")
async def get_user(user_id: str, request: Request) -> dict:
    db = request.app.state.db

    user = await db.users.find_one({"user_id": user_id}, projection={"_id": 0})
    if not user:
        return {"error": "User not found"}

    return user
