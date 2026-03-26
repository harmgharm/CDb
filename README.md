# Cinema Database (CDb)

A movie, anime, and TV show tracking app for a group of friends who watch together. Log what you've
watched, who picked it, rate everything, and see how your tastes compare.

## Features

- **Watch Sessions** — Log viewing events with date, picker, attendees, and per-person ratings
  (1-10)
- **Media Database** — Browse, filter, and search all watched media (movies, TV, anime) with
  metadata from TMDB and Jikan
- **User Profiles** — Stats, rating distributions, top genres, pick history, and personal watchlists
- **Recommendations** — Personalized suggestions via content-based, collaborative filtering,
  TMDB/Jikan API, and group trending algorithms
- **Predictions** — "Predict My Rating" engine using 6 weighted signals (collaborative, genre,
  director, external, group, era)
- **Find Similar** — Select up to 5 titles and discover similar media across TMDB and Jikan
- **Watchlist** — Personal planning lists with status tracking and auto-prediction scores
- **Games** — Poster Reveal and Rating Guess games with solo and real-time multiplayer modes
- **Notifications** — Real-time alerts for new sessions, pending ratings, friend activity, and game
  invites
- **Admin Panel** — Audit log, user management, invite code generation, and bulk media refresh
- **Real-time Presence** — See who's online via Ably WebSocket

## Tech Stack

Next.js 16 (App Router) | TypeScript (strict) | Neon Postgres | Kysely | Tailwind CSS 4 + shadcn/ui
| SWR | Ably | TMDB + Jikan APIs | Vitest

See [CLAUDE.md](./CLAUDE.md) for full conventions and development details.

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10+
- A [Neon](https://neon.tech) Postgres database
- [TMDB API key](https://developer.themoviedb.org)
- [Ably API key](https://ably.com)

### Setup

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.local.example .env.local
# Fill in DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, TMDB_API_KEY, ABLY_API_KEY

# Run database migrations
pnpm db:migrate

# Seed admin user
ADMIN_PASSWORD=your-password pnpm db:seed:admin

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up requires an invite code generated from
the admin panel.

## Scripts

| Command                  | Description                  |
| ------------------------ | ---------------------------- |
| `pnpm dev`               | Start dev server (Turbopack) |
| `pnpm build`             | Production build             |
| `pnpm start`             | Start production server      |
| `pnpm lint`              | ESLint check                 |
| `pnpm lint:fix`          | ESLint auto-fix              |
| `pnpm format`            | Prettier format              |
| `pnpm format:check`      | Prettier check               |
| `pnpm typecheck`         | TypeScript type checking     |
| `pnpm test`              | Run tests (Vitest)           |
| `pnpm test:watch`        | Run tests in watch mode      |
| `pnpm db:migrate`        | Run database migrations      |
| `pnpm db:migrate:down`   | Rollback last migration      |
| `pnpm db:migrate:status` | Show migration status        |
| `pnpm db:migrate:test`   | Run migrations on test DB    |
| `pnpm test:e2e`          | Run Playwright E2E tests     |
| `pnpm test:e2e:ui`       | Run E2E tests with UI        |
