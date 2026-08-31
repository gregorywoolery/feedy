# 05. Testing

## Automated checks

Run the complete non-browser verification set before merging:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Generate unit-test coverage when needed:

```bash
npm run test:coverage
```

Vitest discovers `tests/unit/**/*.test.ts` and `tests/unit/**/*.test.tsx`, uses JSDOM by default, and switches individual storage/image/PDF files to the Node environment where required. Current unit coverage exercises:

- Database URL precedence, split Supabase assembly, TLS mode, and pool settings
- Project, feedback, dashboard-query, and batch-export validation
- File signature checks, MIME mismatch handling, limits, image resize, and filename safety
- Local storage round trips, opaque keys, traversal rejection, deletion, and driver selection
- PDF metadata, content, filenames, record ordering, and photo ordering
- App-shell navigation, sheet accessibility, and mobile navigation controls

## Playwright

The Playwright configuration runs both Desktop Chrome and a Pixel 7-style mobile Chrome project. By default it starts the development server at `http://127.0.0.1:3911`, reusing an existing server outside CI. Set `PLAYWRIGHT_PORT` to choose another local port, or set `PLAYWRIGHT_BASE_URL` to test an already-running build without starting a second server.

The browser suite needs a migrated PostgreSQL database and a writable upload directory. One local sequence is:

```bash
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run test:e2e
```

The parent environment is inherited by the Playwright web server, so ensure `DATABASE_URL`, `STORAGE_DRIVER`, and `UPLOAD_DIR` point to test-safe resources. Browser tests create records; do not point them at production data.

The primary workflow test creates a project through its three-stage side sheet, creates feedback with and without a photo, searches and filters global and project views, verifies browser-local time rendering, validates single/selected/filtered PDF downloads, and exercises single feedback, bulk feedback, and project deletion. A second test covers recent projects and persistent pinning. Both run in desktop and mobile projects, create uniquely named data, and remove their projects before completion.

Playwright records a trace on the first retry in CI and screenshots failures. Reports and test results are ignored by Git.

## Manual acceptance checklist

Use both a desktop viewport and a narrow mobile viewport:

1. Create a project from the right-side sheet; verify form, review, success, and refreshed project list.
2. Add two feedback records to that project, one with valid photos and one without.
3. Reorder and remove photos before saving; confirm the detail page shows the final order.
4. Try an unsupported or MIME-mismatched file; confirm the sheet gives a clear error and saves nothing.
5. Search by project, version, and description text.
6. Apply project, version, with/without-photo, and created-date filters; clear them and verify the URL updates.
7. Sort each supported column in both directions and change rows per page.
8. Select one row, then all rows on the current page; clear selection and repeat.
9. Download one PDF and verify its project, version, description, dates, and photos stay together.
10. Download a selected batch and verify its cover, contents, record order, and page numbering.
11. Export a filtered dashboard and project result; confirm off-page matches are included and unrelated records are not.
12. Delete one feedback item, then a selected batch; verify both confirmation dialogs and refreshed counts.
13. Delete a project and confirm its feedback and photos are removed.
14. Visit projects in different orders, pin one, refresh, and confirm recent/pinned navigation persists.
15. Change the browser/system time zone and confirm all visible portal timestamps use it rather than a fixed zone.
16. Refresh a filtered URL and confirm the same view returns.
17. Check empty, no-match, loading, and invalid feedback-detail states.
18. On mobile, confirm filters, cards, navigation, side sheets, and action buttons remain usable without horizontal page scrolling.

Because there is no authentication, a smoke test should also confirm that pages and API routes are reachable without signing in; that is an intentional current limitation, not a security guarantee.
