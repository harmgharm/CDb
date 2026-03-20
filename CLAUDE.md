# CinemaDatabase (CDB)

A movie, anime, and TV show tracking app for a group of friends. Log watch sessions, rate media,
view stats, get personalized recommendations, and play media-themed games together.

## Tech Stack

| Layer         | Technology                                    |
| ------------- | --------------------------------------------- |
| Framework     | Next.js 16 (App Router, Turbopack)            |
| Language      | TypeScript (strict mode)                      |
| Database      | Neon Postgres (serverless, WebSocket)         |
| DB Client     | Kysely + @neondatabase/serverless Pool        |
| Auth          | Custom JWT (jose) + Argon2 + httpOnly cookies |
| Validation    | Zod 4                                         |
| Styling       | Tailwind CSS 4 + shadcn/ui (new-york)         |
| Data Fetching | SWR                                           |
| Animations    | Motion (Framer Motion) + GSAP                 |
| Real-time     | Ably (pub/sub, presence, token auth)          |
| External APIs | TMDB (movies/TV) + Jikan (anime/MAL)          |
| Testing       | Vitest + React Testing Library                |
| Linting       | ESLint 9 (flat config) + Prettier             |
| Git Hooks     | Husky + lint-staged                           |
| Hosting       | Vercel + Neon                                 |

## Commands

```bash
pnpm dev                    # Start dev server (Turbopack)
pnpm build                  # Production build
pnpm start                  # Start production server
pnpm lint                   # ESLint check
pnpm lint:fix               # ESLint auto-fix
pnpm format                 # Prettier format
pnpm format:check           # Prettier check
pnpm typecheck              # TypeScript type checking
pnpm test                   # Run Vitest
pnpm test:watch             # Run Vitest in watch mode
pnpm db:migrate             # Run database migrations
pnpm db:migrate:down        # Rollback last migration
pnpm db:migrate:status      # Show migration status
ADMIN_PASSWORD=xxx pnpm db:seed:admin  # Seed admin user
pnpm db:migrate:test        # Run migrations on test DB
pnpm test:e2e               # Run Playwright E2E tests
pnpm test:e2e:ui            # Run E2E tests with UI
```

## Environment Variables

```env
DATABASE_URL=               # Neon Postgres connection string
JWT_SECRET=                 # JWT signing secret (min 32 chars)
JWT_REFRESH_SECRET=         # Refresh token secret (min 32 chars)
TMDB_API_KEY=               # TMDB API v3 key (required)
TMDB_ACCESS_TOKEN=          # TMDB API v4 read access token (optional)
ABLY_API_KEY=               # Ably API key (real-time features)
NEXT_PUBLIC_APP_URL=        # Public app URL (defaults to http://localhost:3000)
```

## Development Conventions

### Code Style

- TypeScript strict mode — no `any` unless absolutely necessary
- Prefer `const` over `let`, never `var`
- Named exports everywhere except page/layout files (default export)
- Server components by default; `"use client"` only when needed
- Double quotes, printWidth 100, trailing commas

### Naming

- Files/folders: `kebab-case`
- Components: `PascalCase`
- Functions/variables: `camelCase`
- Database columns: `snake_case`
- Types/interfaces: `PascalCase` (no `I` prefix)
- Constants: `UPPER_SNAKE_CASE` for true constants

### Database

- All queries through Kysely typed client (`src/lib/db/`)
- Schema changes via migrations only — never modify the DB directly
- Use transactions for multi-step writes (`src/lib/db/transaction.ts`)
- Kysely `avg()` returns `string`, `countAll()` returns `string | number` — always wrap with
  `Number()`
- JSONB genre filtering: `` sql<boolean>`media.genres @> ${JSON.stringify([genre])}::jsonb` ``

### API Routes

- Consistent response shape: `{ data, error, message }` via `src/lib/api/response.ts`
- Validate all input with Zod schemas (`src/lib/validations/`)
- Server-side auth via `requireAuth()` / `requireAdmin()` from `src/lib/auth/session.ts`
- Client-side fetching uses `fetchWithAuth` (auto-refreshes on 401)
- SWR fetcher unwraps the `ApiResponse` shape (extracts `.data`, throws on `.error`)

### Git

- Branch naming: `feature/description`, `fix/description`, `chore/description`
- Commit messages: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)
- Pre-commit: lint-staged runs ESLint + Prettier + typecheck

## Lint Patterns

The ESLint config is strict (typescript-eslint strict + stylistic, SonarJS, Unicorn). Common
patterns:

- `(await response.json()) as Type` — not `const data: Type = ...` (no-unsafe-assignment)
- `value.length === 0` / `value.length > 0` — not `!value` for strings (strict-boolean-expressions)
- `String(val)` in template literals for possibly-undefined values (restrict-template-expressions)
- `.toSorted()` not `.sort()` (unicorn/no-array-sort)
- `previous` not `prev` for callback args (unicorn/prevent-abbreviations)
- `void handleSubmit(event)` for fire-and-forget promises in event handlers (no-floating-promises)
- Arrow wrappers in `.map()`: `.map((x) => fn(x))` not `.map(fn)` (no-misused-spread)
- Zod 4 uses top-level APIs: `z.email()`, `z.url()`, `z.uuid()`, `z.treeifyError()`
