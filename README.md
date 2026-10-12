# Feedy

Feedy is a local-first feedback tracker for project reviews. Create projects, add versioned feedback with supporting photos, search and filter the dashboard, then download one record or a selected batch as a structured PDF.

This release intentionally has **no authentication**. Anyone who can reach the application can view data, create projects and feedback, read photos, and download exports. Run it only in a trusted environment until authentication and authorization are added.

I created this when Apple was taking too long with my account updates, since I couldn’t use their in-app feedback tool.

## What is implemented

- Project creation and a project directory
- Feedback creation in a responsive side sheet with form, review, and success stages
- Project version, description, and up to 10 ordered photos per feedback record
- Dashboard metrics, full-text-style search, project/version/photo/date filters, sorting, pagination, and responsive table/card views
- Project-level search, filters, sorting, pagination, and export of the complete filtered result
- Individual feedback detail pages with photo previews
- Individual, page-selected batch, and filtered-result PDF downloads
- Single and bulk feedback deletion, plus confirmed project deletion
- Recently accessed projects and browser-local pinning in desktop and mobile navigation
- Dates and times rendered in the accessing browser's system time zone
- PostgreSQL through Drizzle ORM, with checked-in SQL migrations and repeatable seed data
- Local disk and PostgreSQL photo storage behind one storage interface
- Docker images for the application and PostgreSQL, with persistent named volumes
- Unit tests with Vitest and browser-flow coverage with Playwright

Not implemented yet: sign-in, permissions, object-bucket storage, comments, notifications, or public sharing.

## Quick start: app on the host, PostgreSQL in Docker

Requirements: Node.js 22, npm, and Docker. The deployment runtime is pinned to Node.js 22 to match the verified Docker image.

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). This setup uses PostgreSQL on `localhost:5433` and writes photos to `./data/uploads`; both paths are already represented in `.env.example`.

## Quick start: complete Docker stack

The full stack uses its bundled PostgreSQL service by default. It does not need a host `DATABASE_URL`.

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). The application runs migrations when its container starts. To add optional sample data from the host after installing dependencies:

```bash
DATABASE_URL=postgresql://feedy:feedy@localhost:5433/feedy?sslmode=disable npm run db:seed
```

PostgreSQL data and uploaded photos are retained in the `feedy_pg_data` and `feedy_uploads` named volumes. `docker compose down` stops the stack without deleting those volumes.

## Common commands

```bash
npm run dev          # local development server
npm run build        # production build
npm run start        # serve a completed production build
npm run lint         # ESLint
npm run typecheck    # TypeScript without emitting files
npm test             # Vitest unit suite
npm run test:coverage
npm run test:e2e     # Playwright desktop and mobile-Chrome projects
npm run db:migrate   # apply checked-in Drizzle migrations
npm run db:seed      # upsert example projects and feedback
npm run db:generate  # generate a migration from schema changes
npm run db:studio    # inspect the configured database with Drizzle Studio
npm run storage:cleanup # retry pending photo deletion jobs
```

## Configuration

The application reads one canonical PostgreSQL URL. Direct URL precedence is `DATABASE_URL`, then `POSTGRES_URL`, then `SUPABASE_DB_URL`; split `SUPABASE_DB_*` values are used only when none of those is set.

| Variable                                                             | Purpose                                                                           | Default or note                                                               |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`                                                       | PostgreSQL URL for host development and deployed app processes                    | Required outside tests unless another accepted database variable is set       |
| `DOCKER_DATABASE_URL`                                                | Database URL injected into the app container                                      | Defaults to the bundled `db` service; set this for external/Supabase Postgres |
| `DATABASE_SCHEMA`                                                    | PostgreSQL schema for application tables                                          | `public`; use `feedy` to isolate tables in a shared database                  |
| `DATABASE_CA_CERT`                                                   | PEM root certificate downloaded from the database provider                        | Optional; required when the provider CA is not in Node's trust store          |
| `STORAGE_DRIVER`                                                     | Photo storage adapter                                                             | `local` for persistent disk or `database` for PostgreSQL-backed bytes         |
| `UPLOAD_DIR`                                                         | Directory for photo bytes                                                         | `./data/uploads` on the host; `/app/data/uploads` in Docker                   |
| `STORAGE_URL`                                                        | Optional external storage base URL retained for future object-storage integration | Not used by the current local/database adapters                               |
| `DATABASE_POOL_SIZE`                                                 | Maximum PostgreSQL connections per warm runtime                                   | `10`; use `1` for Vercel/Supabase deployments                                 |
| `DATABASE_MAX_LIFETIME_SECONDS`                                      | Maximum lifetime of a PostgreSQL client connection                                | `1800`; use a short value such as `15` on serverless deployments              |
| `DATABASE_QUERY_TIMEOUT_SECONDS`                                     | Maximum time an application database query may wait                               | `15`; a timeout produces a retryable error                                    |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` | Bundled PostgreSQL service                                                        | `feedy`, `feedy`, `feedy`, `5433`                                             |
| `APP_PORT`                                                           | Host port for the app container                                                   | `3000`                                                                        |

See [.env.example](.env.example) for the complete set, including split Supabase credentials.

## Documentation

1. [Setup and commands](docs/01-setup-and-commands.md)
2. [Architecture and data model](docs/02-architecture-and-data-model.md)
3. [Storage and photos](docs/03-storage-and-photos.md)
4. [PDF exports](docs/04-exports.md)
5. [Testing](docs/05-testing.md)
6. [Docker and local PostgreSQL](docs/06-docker-and-local-postgresql.md)
7. [Switching to Supabase-compatible Postgres](docs/07-supabase-postgres.md)

## Safety and maintenance

Docker publishes the app and database on `127.0.0.1` only. This release has no sign-in: keep it in a trusted local environment. If a reverse proxy changes the public origin, set `APP_ORIGIN` to the exact browser origin (scheme, host and optional port).

External database connections use certificate-verified TLS. Legacy `sslmode=require`, `allow` and `prefer` URLs are upgraded to `verify-full`; local `sslmode=disable` remains available. If your provider requires a custom CA, set `DATABASE_CA_CERT` to the PEM certificate downloaded from the provider. Certificate and hostname verification remain enabled. Node's `NODE_EXTRA_CA_CERTS` configuration is also supported on hosts where you can supply a certificate file.

PDF exports allow up to 100 selected or 500 filtered records, with at most 100 photos and 50 MiB of stored image bytes. One export runs per application process at a time.

Run `npm run storage:cleanup` periodically to retry pending photo deletions. See [storage maintenance](docs/03-storage-and-photos.md) for interrupted uploads and storage changes.

See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture and verification commands and [SECURITY.md](SECURITY.md) for security reporting. Feedy is available under the [MIT license](LICENSE).
