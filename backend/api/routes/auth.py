from __future__ import annotations

from fastapi import APIRouter, Request

from models.user import User, UserCreateRequest

router = APIRouter()


@router.post("/register")
async def register(req: UserCreateRequest, request: Request) -> dict:
    db = request.app.state.db

    existing = await db.users.find_one({"username": req.username})
    if existing:
        return {
            "user_id": existing.get("user_id"),
            "message": "User already exists",
        }

    user = User(username=req.username, email=req.email)
    await db.users.insert_one(user.model_dump())

    return {"user_id": user.user_id, "username": user.username}


@router.get("/user/{user_id}")
async def get_user(user_id: str, request: Request) -> dict:
    db = request.app.state.db

    user = await db.users.find_one({"user_id": user_id}, projection={"_id": 0})
    if not user:
        return {"error": "User not found"}

    return user
