import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.middleware.sessions import SessionMiddleware

# Load .env from backend/ folder explicitly
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

from api.routes.auth import router as auth_router
from api.routes.performance import router as performance_router
from api.routes.transcription import router as transcription_router
from api.routes.free_generation import router as free_generation_router
from services.in_memory_storage import get_in_memory_db
from api.routes.users import router as users_router


async def _warmup_whisper() -> None:
    """Load the Whisper model in a background thread at startup so the first
    live audio chunk is not delayed by model initialisation (~5-15 s)."""
    try:
        from services.transcription import get_whisper_model
        await asyncio.to_thread(get_whisper_model)
        print("[startup] Whisper model loaded.")
    except Exception as exc:
        message = str(exc)

        # If the cached Whisper model file is corrupted, remove it once and retry.
        if "SHA256 checksum" in message:
            model_name = os.getenv("WHISPER_MODEL", "base")
            cache_file = f"/root/.cache/whisper/{model_name}.pt"
            try:
                os.remove(cache_file)
                print(f"[startup] Removed corrupted Whisper cache: {cache_file}")
                await asyncio.to_thread(get_whisper_model)
                print("[startup] Whisper model loaded after cache refresh.")
                return
            except Exception as retry_exc:
                message = f"{message}; retry failed: {retry_exc}"

        # Non-fatal — live transcription will still work, just slower on first chunk
        print(f"[startup] Whisper warm-up skipped: {message}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://mongo:27017/learnpulse")
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017/learnpulse")
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

    # Warm up Whisper in background — don’t block startup if it fails
    asyncio.create_task(_warmup_whisper())

    yield

    client.close()


app = FastAPI(title="LearnPulse AI", version="1.0.0", lifespan=lifespan)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("JWT_SECRET", "changeme"),
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"chrome-extension://.*",
    allow_credentials=False,
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
