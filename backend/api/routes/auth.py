from __future__ import annotations

import os
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from jose import jwt


from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from models.user import User, UserCreateRequest

router = APIRouter(prefix="/auth", tags=["auth"])
JWT_SECRET = os.getenv("JWT_SECRET", "changeme")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))

oauth = OAuth()

oauth.register(
    name="github",
    client_id=os.getenv("GITHUB_CLIENT_ID", ""),
    client_secret=os.getenv("GITHUB_CLIENT_SECRET", ""),
    access_token_url="https://github.com/login/oauth/access_token",
    authorize_url="https://github.com/login/oauth/authorize",
    api_base_url="https://api.github.com/",
    client_kwargs={"scope": "user:email"},
)


PBKDF2_ITERATIONS = int(os.getenv("PBKDF2_ITERATIONS", "390000"))


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        PBKDF2_ITERATIONS,
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${dk.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, iterations_s, salt, digest_hex = encoded.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False

        iterations = int(iterations_s)
        candidate = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt),
            iterations,
        ).hex()
        return hmac.compare_digest(candidate, digest_hex)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


_bearer = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = __import__('fastapi').Depends(_bearer)) -> dict:
    """JWT dependency — returns decoded payload {user_id, username}."""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {"user_id": payload["user_id"], "username": payload["username"]}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def _get_or_create_oauth_user(db, email: str, username: str, provider: str) -> dict:
    """Find existing user by email or create a new OAuth user."""
    user_doc = await db.users.find_one({"email": email})
    if not user_doc:
        new_user = User(username=username, email=email, auth_provider=provider)
        await db.users.insert_one(new_user.model_dump())
        user_doc = new_user.model_dump()
    return user_doc


# ---------------------------------------------------------------------------
# Normal signup / login
# ---------------------------------------------------------------------------

@router.post("/register")
async def register(req: UserCreateRequest, request: Request) -> dict:
    db = request.app.state.db
    existing = await db.users.find_one({"username": req.username})
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")
    if req.email:
        if await db.users.find_one({"email": req.email}):
            raise HTTPException(status_code=409, detail="Email already registered")
    password_hash = hash_password(req.password)
    user = User(
        username=req.username,
        email=req.email,
        password_hash=password_hash,
        auth_provider="local",
    )
    await db.users.insert_one(user.model_dump())
    token = create_access_token({"user_id": user.user_id, "username": user.username})
    return {"user_id": user.user_id, "username": user.username, "token": token}


@router.post("/login")
async def login(req: UserCreateRequest, request: Request) -> dict:
    db = request.app.state.db
    user = await db.users.find_one({"username": req.username})
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"user_id": user["user_id"], "username": user["username"]})
    return {"user_id": user["user_id"], "username": user["username"], "token": token}


# ---------------------------------------------------------------------------
# GitHub OAuth
# ---------------------------------------------------------------------------

@router.get("/github")
async def github_login(request: Request):
    redirect_uri = request.url_for("github_callback")
    return await oauth.github.authorize_redirect(request, redirect_uri)


@router.get("/github/callback", name="github_callback")
async def github_callback(request: Request):
    token = await oauth.github.authorize_access_token(request)
    resp = await oauth.github.get("user", token=token)
    user_data = resp.json()
    login = user_data.get("login", "")
    email = user_data.get("email") or login
    # GitHub may hide email — fetch from emails endpoint
    if not user_data.get("email"):
        emails_resp = await oauth.github.get("user/emails", token=token)
        for e in emails_resp.json():
            if e.get("primary") and e.get("verified"):
                email = e["email"]
                break
    user_doc = await _get_or_create_oauth_user(request.app.state.db, email, login, "github")
    jwt_token = create_access_token({"user_id": user_doc["user_id"], "username": user_doc["username"]})
    return RedirectResponse(url=f"/?token={jwt_token}")


# ---------------------------------------------------------------------------
# User profile
# ---------------------------------------------------------------------------

@router.get("/user/{user_id}")
async def get_user(user_id: str, request: Request) -> dict:
    db = request.app.state.db
    user = await db.users.find_one({"user_id": user_id}, projection={"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
