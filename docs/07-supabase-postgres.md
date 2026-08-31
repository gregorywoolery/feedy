# 07. Switching to Supabase-compatible Postgres

Feedy uses standard PostgreSQL tables and Drizzle migrations. Supabase is used only as a PostgreSQL provider in this release; Supabase Auth and Supabase Storage are not integrated.

## Preferred: one connection URL

For a host-run application, replace the local URL:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require
DATABASE_SCHEMA=feedy
STORAGE_DRIVER=database
```

You may instead use `SUPABASE_DB_URL` or `POSTGRES_URL`, but clear any higher-precedence variable first. `DATABASE_URL` wins over both.

For the full Docker stack, leave the host `DATABASE_URL` alone and set:

```dotenv
DOCKER_DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require
```

Compose passes this value into the app as its canonical `DATABASE_URL`. The bundled local PostgreSQL container may still start for its health-gated Compose dependency, but the app and migration command use the external URL.

Supabase hosts require `sslmode=require` or `sslmode=verify-full`. The configuration resolver rejects a Supabase URL without a required TLS mode.

## Alternative: split Supabase values

Host-run commands can assemble the URL from:

```dotenv
DATABASE_URL=
POSTGRES_URL=
SUPABASE_DB_URL=
SUPABASE_DB_HOST=db.example.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=replace-me
```

All four host/name/user/password values are required together. Port defaults to 5432. The URL builder safely encodes user and password characters and automatically adds `sslmode=require`.

The split values are resolved by host-run application and database commands. Docker Compose accepts the single `DOCKER_DATABASE_URL` override rather than forwarding the split variables.

## Apply the schema

`DATABASE_SCHEMA=feedy` keeps Feedy tables separate from another application's `public` schema in the same Supabase project. The migration command creates both `feedy` and the isolated `feedy_migrations` journal schema when they do not exist.

After selecting the Supabase connection, apply the checked-in migration:

```bash
npm run db:migrate
```

Optionally add the example records:

```bash
npm run db:seed
```

The seed upserts fixed UUIDs and is repeatable. Avoid it if those example records are not appropriate for the target database.

## Connection behavior

The client reads SSL from the URL, disables prepared statements, and uses a default pool size of 10. That makes the same code path usable with local PostgreSQL and pooled Supabase connections. Feedy's dashboard deliberately loads four independent datasets in parallel, so use `DATABASE_POOL_SIZE=5` on Vercel; a single-connection pool can stall that concurrent query group with Supabase's transaction pooler. Tune `DATABASE_IDLE_TIMEOUT_SECONDS` and `DATABASE_CONNECT_TIMEOUT_SECONDS` as needed.

Use a database user that can create the migration tables and application records. Keep the URL server-side; it is not a browser/public Supabase key.

## Photo storage

Set `STORAGE_DRIVER=database` on Vercel so photo bytes are stored in the isolated schema's `photo_objects` table and remain available across serverless invocations. This requires no Supabase Storage API key.

If `STORAGE_DRIVER=local`, changing the database does not upload existing files: bytes remain under `UPLOAD_DIR` or in the `feedy_uploads` Docker volume. Driver changes do not migrate existing bytes automatically. `STORAGE_URL` is currently configuration-only; an object-storage adapter would also require write credentials.

## Revert to local PostgreSQL

Point the host application back to:

```dotenv
DATABASE_URL=postgresql://feedy:feedy@localhost:5433/feedy?sslmode=disable
```

Or remove `DOCKER_DATABASE_URL` so the full Docker stack uses `db:5432` again. Database contents do not move automatically in either direction; migrate data explicitly if continuity is required.
