# Frontend (front) Documentation

This folder contains the React + TypeScript web client for authentication and learner performance visualization.

## Purpose

The app provides:
- User signup and login flows
- Email verification UX
- Protected dashboard experience
- Performance charts and simulation controls

## Tech Stack

- React 18
- TypeScript 5
- Vite 5
- React Router DOM 6
- React Hook Form + Zod validation
- Recharts for data visualization
- Lucide React icons

## Project Structure

```text
front/
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  .env.example
  src/
    main.tsx                 # App bootstrap
    App.tsx                  # Top-level routes + nav shell
    styles.css               # Global theme and component styles
    components/
      AuthLayout.tsx
      ProtectedRoute.tsx
    context/
      AuthContext.tsx        # Session state + token hydration/refresh
    lib/
      api.ts                 # HTTP client + API contracts
    pages/
      LoginPage.tsx
      SignupPage.tsx
      CheckInboxPage.tsx
      VerifyEmailPage.tsx
      DashboardPage.tsx
      NotFoundPage.tsx
    data/
      mockPerformance.ts     # Fallback/seed dashboard data
```

## Prerequisites

- Node.js 18+ (recommended 20+)
- npm 9+

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Start development server:

```bash
npm run dev
```

Default dev URL: `http://localhost:3000`

## Environment Variables

| Name | Required | Description | Example |
|------|----------|-------------|---------|
| `VITE_API_BASE_URL` | Yes | Base URL for backend API endpoints | `http://localhost:4000/api` |

Notes:
- If not set, the frontend falls back to `http://localhost:8000/api`.
- Ensure this matches the backend service you are running.

## Available Scripts

- `npm run dev` - Start Vite dev server
- `npm run build` - Type-check and create production build
- `npm run preview` - Preview production build locally
- `npm run typecheck` - TypeScript type check without emitting files
- `npm run lint` - Currently mapped to TypeScript type check

## Routing

Configured in `src/App.tsx`:

- `/` -> Redirects to `/dashboard` (if logged in) or `/login`
- `/login` -> Login form
- `/signup` -> Registration form
- `/check-email` -> Email verification help + resend flow
- `/verify-email?token=...` -> Token verification screen
- `/dashboard` -> Learner dashboard (wrapped in protected route)
- `*` -> 404 page

## Authentication and Session Model

Managed in `src/context/AuthContext.tsx`.

Session data is stored in `localStorage`:
- `lp_auth_access_token`
- `lp_auth_refresh_token`
- `lp_auth_user`

Startup behavior:
1. Read stored tokens/user from localStorage
2. Validate session using `GET /users/me`
3. If unauthorized, try `POST /auth/refresh-token`
4. Clear session on unrecoverable failure

## Backend API Endpoints Used

Implemented in `src/lib/api.ts`:

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `POST /auth/refresh-token`
- `POST /auth/logout`
- `GET /users/me`
- `GET /performance`
- `POST /performance`

All requests expect JSON envelope shape:

```json
{
  "message": "...",
  "data": { }
}
```

## Dashboard Data Behavior

- Dashboard initializes with fallback data from `src/data/mockPerformance.ts`.
- If `accessToken` is available, it fetches live data via `GET /performance`.
- Simulation buttons submit updates via `POST /performance`.
- Without token, simulation mutates local in-memory state for demo UX.

## Build and Optimization Notes

In `vite.config.ts`:

- Dev server runs on port `3000`
- Terser minification enabled
- Manual chunk splitting:
  - `vendor`: React + router
  - `form`: form + validation libraries

## Known Behavior / Caveat

`src/components/ProtectedRoute.tsx` currently has redirect enforcement commented out. As written, unauthenticated users are not redirected to `/login`.

If strict route protection is required, re-enable:

```tsx
if (!user) {
  return <Navigate to="/login" replace />;
}
```

## Troubleshooting

- Blank or failing auth calls:
  - Confirm `VITE_API_BASE_URL` is correct and backend is running.
- Session appears stale:
  - Clear localStorage keys listed above and re-login.
- Verification email not received:
  - Use the dev preview URL shown in the Check Inbox page when SMTP is not configured.

## Integration Tip

When running with the backend in this monorepo, keep frontend and API ports aligned across:
- `front/.env`
- backend service config
- reverse proxy / docker compose (if used)
