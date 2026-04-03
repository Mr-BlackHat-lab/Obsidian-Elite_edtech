# LearnPulse AI - Stage Demo Runbook

Use this file when presenting progress and running live checks.

## Current Stage Status

- Stage 1 (Docker setup): done
- Stage 2 (backend models): done
- Stage 3 (API routes): done
- Stage 4 (CLI commands): done
- Stage 5 (Redis live keys + TTL): done

## 0) Start Services

```bash
docker compose up --build -d
docker compose ps
```

Expected:

- `learnpulse_backend` up and healthy
- `learnpulse_mongo` up and healthy
- `learnpulse_redis` up and healthy
- `learnpulse_celery` up

## 1) Backend Smoke Checks

```bash
curl http://localhost:8000/health
```

Expected:

```json
{ "status": "ok" }
```

## 2) Seed Demo Data (for reliable presentation)

Run this from repo root:

```powershell
@'
db = db.getSiblingDB('learnpulse');

db.users.updateOne(
  { user_id: 'cli_user' },
  {
    $set: {
      user_id: 'cli_user',
      username: 'cli_user',
      email: 'cli_user@example.com',
      total_sessions: 1,
      overall_score: 0.67
    }
  },
  { upsert: true }
);

db.sessions.updateOne(
  { session_id: 'demo-session' },
  {
    $set: {
      session_id: 'demo-session',
      user_id: 'cli_user',
      video_url: 'https://www.youtube.com/watch?v=demo',
      transcript: 'Docker volumes persist data. Kubernetes orchestrates containers.',
      concepts: ['Docker fundamentals', 'Kubernetes basics'],
      questions: [
        {
          question_id: 'q1',
          question: 'What is the purpose of a Docker volume?',
          type: 'mcq',
          difficulty: 'medium',
          options: [
            'To speed up image builds',
            'To persist data outside container lifecycle',
            'To expose container ports',
            'To link multiple containers'
          ],
          answer: 'B',
          explanation: 'Volumes persist data independently from container lifecycle.',
          concept_tag: 'Docker fundamentals'
        },
        {
          question_id: 'q2',
          question: 'What does Kubernetes orchestrate?',
          type: 'mcq',
          difficulty: 'easy',
          options: [
            'Word documents',
            'Containers and services',
            'Physical servers only',
            'Database backups'
          ],
          answer: 'B',
          explanation: 'Kubernetes orchestrates containerized workloads and services.',
          concept_tag: 'Kubernetes basics'
        }
      ],
      attempts: [],
      score: 0.0,
      weak_topics: [],
      source: 'recorded',
      status: 'ready'
    }
  },
  { upsert: true }
);
'@ | docker exec -i learnpulse_mongo mongosh "mongodb://localhost:27017/learnpulse" --quiet
```

## 3) API Route Demo

### Submit answer

```powershell
Invoke-RestMethod -Method POST "http://localhost:8000/submit-answer" `
  -ContentType "application/json" `
  -Body '{"session_id":"demo-session","question_id":"q1","user_answer":"B","concept_tag":"Docker fundamentals"}'
```

Expected shape:

```json
{
  "correct": true,
  "explanation": "...",
  "updated_score": 1.0,
  "weak_topics": []
}
```

### Performance report

```powershell
Invoke-RestMethod -Method GET "http://localhost:8000/performance/cli_user" | ConvertTo-Json -Depth 6
```

## 4) CLI Demo

Install deps once:

```bash
python -m pip install -r cli/requirements.txt
```

Run from `cli/`:

```bash
cd cli
python main.py process --url "https://www.youtube.com/watch?v=demo"
python main.py test --session-id demo-session
python main.py progress --user-id cli_user
```

## 5) Stage 5 Redis Demo

```bash
docker exec learnpulse_redis redis-cli ping
docker exec learnpulse_redis redis-cli RPUSH live:buffer:test123 "chunk-1" "chunk-2"
docker exec learnpulse_redis redis-cli SADD live:asked:test123 "q-docker-1"
docker exec learnpulse_redis redis-cli EXPIRE live:buffer:test123 7200
docker exec learnpulse_redis redis-cli EXPIRE live:asked:test123 7200
docker exec learnpulse_redis redis-cli TTL live:buffer:test123
docker exec learnpulse_redis redis-cli TTL live:asked:test123
```

Expected:

- `PONG` from ping
- positive TTL values close to 7200

## Presentation Sequence (2-3 min)

1. Show Docker services up.
2. Hit `/health`.
3. Run one `/submit-answer` call.
4. Run `python main.py test --session-id demo-session`.
5. Run `python main.py progress --user-id cli_user`.
6. Show Redis TTL checks for Stage 5 readiness.
