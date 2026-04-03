import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.middleware.sessions import SessionMiddleware

from api.routes.auth import router as auth_router
from api.routes.performance import router as performance_router
from api.routes.transcription import router as transcription_router
from api.routes.users import router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://mongo:27017/learnpulse")
    client = AsyncIOMotorClient(mongodb_url)
    db_name = mongodb_url.rsplit("/", 1)[-1] if "/" in mongodb_url else "learnpulse"
    app.state.mongo_client = client
    app.state.db = client[db_name]

    # Create key indexes once to keep session/user lookups fast.
    await app.state.db.sessions.create_index("session_id", unique=True)
    await app.state.db.sessions.create_index("user_id")
    await app.state.db.sessions.create_index("video_url")
    await app.state.db.users.create_index("user_id", unique=True)
    await app.state.db.users.create_index("username", unique=True)
    await app.state.db.users.create_index("email", sparse=True)

    yield

    client.close()


app = FastAPI(title="LearnPulse AI", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("JWT_SECRET", "changeme"),
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(performance_router)
app.include_router(transcription_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "LearnPulse AI"}


@app.get("/")
def root() -> dict[str, str]:
    env = os.getenv("APP_ENV", "development")
    return {"service": "learnpulse-backend", "env": env}
