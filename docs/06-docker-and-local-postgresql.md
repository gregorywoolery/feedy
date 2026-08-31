# 06. Docker and local PostgreSQL

## Database-only development

For the fastest edit/reload cycle, run only PostgreSQL in Docker:

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

The `db` service uses PostgreSQL 16 Alpine, publishes container port 5432 as host port 5433 by default, and waits for `pg_isready`. Change the host port with `POSTGRES_PORT`.

The named `feedy_pg_data` volume persists data when containers stop or are recreated.

## Full stack

Run the production-style application and database together:

```bash
docker compose up --build
```

The application image:

- Uses Node.js 22 Bookworm Slim
- Installs from `package-lock.json` with `npm ci`
- Produces Next.js standalone output
- Runs as the non-root `nextjs` user
- Waits for the database health check
- Applies migrations before starting `server.js`

The app is available on `APP_PORT` (default `3000`). With `STORAGE_DRIVER=local`, photos are mounted at `/app/data/uploads` using the `feedy_uploads` named volume. With `STORAGE_DRIVER=database`, photo bytes are stored in PostgreSQL instead.

Migrations run automatically, but seeds do not. To add the sample records:

```bash
DATABASE_URL=postgresql://feedy:feedy@localhost:5433/feedy?sslmode=disable npm run db:seed
```

Seeding is a host-side development command and is intentionally not included in the minimal production runtime image.

## Database URL behavior in Docker

The application process always receives its database as `DATABASE_URL`. Compose derives that value as follows:

- If `DOCKER_DATABASE_URL` is unset, use the included service at `db:5432`.
- If `DOCKER_DATABASE_URL` is set, pass that external URL into the app container.

The host-oriented `DATABASE_URL` in `.env.example` is for commands run outside containers and is not used as the Compose override.

Compose also passes `DATABASE_SCHEMA` (default `public`) to the app and migration process. Set it to a dedicated schema such as `feedy` when `DOCKER_DATABASE_URL` points to a shared PostgreSQL database.

## Operations

```bash
docker compose ps
docker compose logs -f app
docker compose logs -f db
docker compose down
```

`docker compose down` preserves the named volumes. Removing the volumes separately destroys the PostgreSQL data and uploaded photos; back up both before doing so.

## Local database defaults

| Setting | Default |
| --- | --- |
| Database | `feedy` |
| User | `feedy` |
| Password | `feedy` |
| Host access | `localhost:5433` |
| App-container access | `db:5432` |
| SSL | Disabled for the local URL |

These defaults are for local development only. Change them before using the bundled service in any shared or externally reachable environment.
