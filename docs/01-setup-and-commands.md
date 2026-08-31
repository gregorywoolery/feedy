# 01. Setup and commands

## Requirements

- Node.js 22 (the same major used by the Docker and Vercel runtimes)
- npm
- PostgreSQL, either through the included Docker service or another compatible server
- Docker and Docker Compose for the container workflows

No remote media service is required. Photos can be stored on the local filesystem or in PostgreSQL.

## Recommended development setup

Run the application on the host and PostgreSQL in Docker:

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

The default host URLs are:

- Application: `http://localhost:3000`
- PostgreSQL: `postgresql://feedy:feedy@localhost:5433/feedy?sslmode=disable`
- Uploaded photos: `./data/uploads`

The seed is optional and safe to run repeatedly. It upserts two fixed projects and three fixed feedback records; it does not seed photos.

## Environment loading

Next.js and the database scripts load the standard local environment files. Start from `.env.example`, which is committed as a reference; `.env` and `.env.local` are ignored.

The database resolver checks values in this order:

1. `DATABASE_URL`
2. `POSTGRES_URL`
3. `SUPABASE_DB_URL`
4. A URL assembled from all required `SUPABASE_DB_*` values

The first non-empty direct URL wins. This matters when switching environments: a leftover local `DATABASE_URL` will override `SUPABASE_DB_URL`.

Optional connection tuning is available through:

- `DATABASE_POOL_SIZE` (default `10`)
- `DATABASE_IDLE_TIMEOUT_SECONDS` (default `20`)
- `DATABASE_CONNECT_TIMEOUT_SECONDS` (default `10`)
- `DATABASE_SCHEMA` (default `public`; useful for isolating Feedy in a shared database)

All three must be positive integers. Prepared statements are disabled by the database client for compatibility with pooled PostgreSQL connections.

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Feedback dashboard, filters, selection, and exports |
| `/projects` | Project directory and project/feedback creation |
| `/projects/:id` | One project, its feedback filters/exports, and project-scoped creation/deletion |
| `/feedback/:id` | Complete feedback record and photo gallery |
| `/api/projects` | `POST` project creation |
| `/api/projects/:id` | `DELETE` one project and its feedback |
| `/api/feedback` | `POST` multipart feedback creation or `DELETE` an ID batch |
| `/api/photos/:id` | Read one stored photo by photo ID |
| `/api/feedback/:id/export` | Download one feedback PDF |
| `/api/feedback/export` | `POST` a selected-ID or filtered-result batch and download one PDF |

## Commands

| Command | Result |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create the production/standalone Next.js build |
| `npm run start` | Serve a completed build |
| `npm run lint` | Run ESLint over the repository |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm test` | Run all `tests/unit` files once with Vitest |
| `npm run test:coverage` | Run unit tests with text and HTML V8 coverage |
| `npm run test:e2e` | Start the configured test server and run Playwright |
| `npm run db:migrate` | Apply SQL migrations from `drizzle/` |
| `npm run db:seed` | Upsert the checked-in sample records |
| `npm run db:generate` | Generate a new migration from the Drizzle schema |
| `npm run db:studio` | Open Drizzle Studio against the selected database |

## Current product boundaries

There is no authentication or authorization. The API and pages trust network access, so do not expose this build to an untrusted network. Creating, reading, filtering, exporting, and deleting projects/feedback are implemented; editing is not.
