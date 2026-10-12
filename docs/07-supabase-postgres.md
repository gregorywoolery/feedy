# 07. Switching to Supabase-compatible Postgres

Feedy uses standard PostgreSQL tables and Drizzle migrations. Supabase is used only as a PostgreSQL provider in this release; Supabase Auth and Supabase Storage are not integrated.

## Preferred: one connection URL

For a host-run application, replace the local URL:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=verify-full
DATABASE_SCHEMA=feedy
STORAGE_DRIVER=database
```

You may instead use `SUPABASE_DB_URL` or `POSTGRES_URL`, but clear any higher-precedence variable first. `DATABASE_URL` wins over both.

For the full Docker stack, leave the host `DATABASE_URL` alone and set:

```dotenv
DOCKER_DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=verify-full
```

Compose passes this value into the app as its canonical `DATABASE_URL`. The bundled local PostgreSQL container may still start for its health-gated Compose dependency, but the app and migration command use the external URL.

Supabase hosts require `sslmode=verify-full`. Legacy `sslmode=require` URLs are accepted and upgraded to verified TLS.

Supabase uses its own certificate authority. Download the CA certificate from **Database → Settings → SSL configuration** in the Supabase dashboard, then set `DATABASE_CA_CERT` to the certificate's PEM contents. On Vercel, read the certificate file into the production environment variable:

```bash
vercel env add DATABASE_CA_CERT production < prod-ca-2021.crt
```

Redeploy after changing environment variables. This supplies the trusted CA while retaining certificate and hostname verification. The certificate is public data; database passwords and connection URLs remain private.

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

All four host/name/user/password values are required together. Port defaults to 5432. The URL builder safely encodes user and password characters and automatically adds `sslmode=verify-full`.

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

The application uses a `node-postgres` pool through Drizzle's PostgreSQL adapter. Local, Docker and Vercel runtimes reuse one bounded pool per warm process. Vercel's `attachDatabasePool` integration releases idle clients before a function suspends. On Vercel, use `DATABASE_POOL_SIZE=1` to avoid opening many independent sockets against Supabase's shared transaction pooler.

Tune `DATABASE_IDLE_TIMEOUT_SECONDS` and `DATABASE_CONNECT_TIMEOUT_SECONDS` as needed. Set `DATABASE_MAX_LIFETIME_SECONDS=15` on Vercel as an additional bound on transaction-pool sockets. Runtime queries time out after `DATABASE_QUERY_TIMEOUT_SECONDS` (default `15`) instead of leaving the page waiting indefinitely. Migration and seed commands continue to use Postgres.js with prepared statements disabled.

Application SQL schema-qualifies every table (for example, `feedy.projects`) instead of depending on a session `search_path`. This is important with transaction pooling because upstream PostgreSQL sessions can be reused between clients. Migration and seed commands still establish the target search path while applying unqualified checked-in SQL.

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
