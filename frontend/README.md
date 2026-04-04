# LearnPulse Auth Platform

This folder contains a full authentication system split into:

- apps/web: React + TypeScript authentication web app
- apps/api: Node.js + TypeScript REST API with JWT auth and email verification

## Features

- Signup with name, email, and password
- Email verification flow with expiring verification token
- Login blocked until account is verified
- JWT access token + refresh token rotation
- Protected user profile endpoint
- Input validation, modular architecture, and centralized error handling
- CORS support for web app origins

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Configure API environment:

PowerShell (Windows):

```powershell
Copy-Item apps/api/.env.example apps/api/.env
```

Bash (macOS/Linux):

```bash
cp apps/api/.env.example apps/api/.env
```

3. Push Prisma schema to SQLite database:

```bash
npm run db:push -w apps/api
```

4. Run both apps:

```bash
npm run dev
```

- Web app: http://localhost:5173
- API: http://localhost:4000

## Verification Email Delivery

By default, `apps/api/.env` leaves SMTP fields empty. In that case, the app runs in dev preview mode:

- Real emails are not delivered to inboxes.
- The UI shows a dev preview verification link after signup/resend.

To send real emails, configure SMTP in `apps/api/.env` and restart the API:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="LearnPulse AI <your-email@gmail.com>"
SMTP_SECURE=false
```

Notes:

- For Gmail, use an App Password (not your normal account password).
- If you use port 465, set `SMTP_SECURE=true`.

## Important Endpoints

- POST /api/auth/signup
- POST /api/auth/verify-email
- GET /api/auth/verify-email?token=...
- POST /api/auth/login
- POST /api/auth/resend-verification
- POST /api/auth/refresh-token
- POST /api/auth/logout
- GET /api/users/me (protected)
