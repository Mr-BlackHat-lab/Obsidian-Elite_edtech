import os

from celery import Celery

redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
app = Celery("learnpulse", broker=redis_url, backend=redis_url)


@app.task(name="workers.celery_tasks.ping")
def ping() -> str:
    return "pong"
