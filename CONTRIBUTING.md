# Contributing to Feedy

Use Node.js 22 and PostgreSQL 16. Follow README.md for local setup. Keep test data separate from real feedback.

Before submitting a change, run:

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run check:secrets
npm run test:e2e
```

Database integration tests require a disposable local database:

```sh
TEST_DATABASE_URL=postgresql://feedy:feedy@127.0.0.1:5433/feedy_test?sslmode=disable npm run test:integration
```

Apply migrations to that database first. Never run integration or browser tests against production data.

Keep functions small and names descriptive. Prefer ordinary functions and explicit dependency objects over frameworks, decorators or clever generic abstractions. Extract logic when it has a clear responsibility, not just to add another layer.

- `src/entities`: browser-safe domain types, storage interfaces and API contracts.
- `src/use-cases`: application workflows and query orchestration; dependencies are explicit ports.
- `src/server`: wires repositories, storage and image/PDF processing into those ports.
- `src/data-access`: parameterized SQL and metadata transactions.
- `src/lib`: focused infrastructure and shared utilities.
- `src/app`: transport parsing, status/response mapping, page composition.
- `src/features`: client state, HTTP operations and presentation.

ESLint enforces these import boundaries. Preserve public response shapes when refactoring. Add regression tests for failures and recovery, not only success paths.

For schema changes, run `npm run db:generate -- --name=descriptive_name` and commit the migration and metadata. See docs/03-storage-and-photos.md for cleanup and recovery.

Do not commit environment files, credentials, customer screenshots, personal filesystem paths or runtime data. The repository uses the MIT license.
