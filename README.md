# SKOLA

SKOLA is a full-stack university batch management platform with a NestJS backend and a Vite + React frontend.

## Project Structure

- `backend/` - NestJS API, MySQL persistence (TypeORM), auth, classrooms, academics, resources, lounge, arena, admin/moderation, notifications.
- `web_ui/` - React + TypeScript client (Vite), Tailwind UI, React Query, routing, PWA support.

## Core Features

- Telegram-based authentication
- Classroom and member management
- Schedule and assessment tracking
- Resource sharing and voting
- Lounge posts, reactions, and moderation
- Quiz arena and leaderboard
- Announcements and admin/owner controls
- In-app and web push notifications
- AI Classroom Assistant (Gemini 2.5, BYOK-only per user/classroom)
- Maintenance mode route override with a dedicated responsive maintenance page

## Prerequisites

- Node.js 20+ (or newer LTS)
- npm 10+ (repo also includes Bun lockfiles, but npm works out of the box)
- MySQL 8+

## Environment Setup

### Backend

1. Copy env template:
   ```bash
   cd backend
   cp .env.example .env
   ```
2. Update `.env` values for your machine (DB credentials, JWT secret, Telegram bot token, optional VAPID/IMGBB keys).
3. For BYOK encryption at rest, set `BYOK_ENCRYPTION_KEY` (recommended in all environments).

### Frontend

Create `web_ui/.env.development` with:

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_TELEGRAM_BOT_NAME=your_telegram_bot_name
VITE_MAINTENANCE_MODE=false
```

Note: `web_ui/vite.config.ts` uses port `5174` for local dev.

For production, set `web_ui/.env.production` similarly:

```env
VITE_API_BASE_URL=https://your-domain/api
VITE_TELEGRAM_BOT_NAME=your_telegram_bot_name
VITE_MAINTENANCE_MODE=false
```

`VITE_MAINTENANCE_MODE` accepts truthy values (`true`, `1`, `yes`, `on`).  
When enabled, the frontend redirects all routes to the maintenance page.

## Install Dependencies

Run from repo root:

```bash
cd backend && npm install
cd ../web_ui && npm install
```

## Database Migrations

After backend `.env` is configured:

```bash
cd backend
npm run migration:run
```

## Run Locally

Open two terminals.

Terminal 1 (backend):

```bash
cd backend
npm run start:dev
```

Backend URL: `http://localhost:3000/api`

Terminal 2 (frontend):

```bash
cd web_ui
npm run dev
```

Frontend URL: `http://localhost:5174`

## Useful Scripts

### Backend (`backend/package.json`)

- `npm run start:dev` - start API in watch mode
- `npm run build` - build backend
- `npm run lint` - lint/fix TypeScript files
- `npm run migration:generate -- --name=YourMigrationName` - generate migration
- `npm run migration:run` - apply migrations
- `npm run migration:revert` - rollback last migration

### Frontend (`web_ui/package.json`)

- `npm run dev` - start Vite dev server
- `npm run build` - production build
- `npm run preview` - preview production build
- `npm run lint` - lint frontend code

## Production Notes

- Restrict backend CORS (`origin: '*'` is currently permissive in development).
- Set strong secrets for `JWT_SECRET` and `BYOK_ENCRYPTION_KEY`.
- Configure proper VAPID keys for push notifications.
- Use a production MySQL instance and run migrations before starting the API.
- AI assistant is BYOK-only (no shared server AI key). Users must save a personal Gemini API key in Settings > BYOK.
- Gemini quota/rate-limit exhaustion returns a clear limit message to the client (HTTP 429) with retry guidance when available.

## Assistant Notes

- Assistant context is classroom-scoped and does not pull data from other classrooms.
- Context sources currently include courses, assessments, schedules, resources, announcements, members, and quizzes.
- Lounge content is intentionally excluded from assistant context.
- Assistant UI supports:
  - mobile bottom-sheet mode
  - collapsed quick prompts by default
  - per-message source toggle
  - `New` action to start a fresh chat (previous thread cleared)
