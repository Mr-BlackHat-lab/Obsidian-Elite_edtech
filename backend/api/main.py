import os

from fastapi import FastAPI

app = FastAPI(title="LearnPulse AI", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    env = os.getenv("APP_ENV", "development")
    return {"service": "learnpulse-backend", "env": env}
