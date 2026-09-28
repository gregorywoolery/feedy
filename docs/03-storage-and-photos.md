# 03. Storage and photos

## Storage adapters

`PhotoStorage` defines `put`, `get`, and `delete`. Select local persistent disk with:

```dotenv
STORAGE_DRIVER=local
UPLOAD_DIR=./data/uploads
```

If `UPLOAD_DIR` is omitted, the host default is `<working-directory>/data/uploads`. The directory must be outside `public/`; photos are served through `/api/photos/:id` instead of as static files.

Docker fixes the container path at `/app/data/uploads` and mounts the `feedy_uploads` volume there.

For Vercel, multi-instance hosting, or another environment without durable local disk, store the normalized bytes in PostgreSQL:

```dotenv
STORAGE_DRIVER=database
```

`DatabasePhotoStorage` writes to `photo_objects` using the same database and schema configuration as the application. Existing local files are not migrated automatically when the driver changes.

## Upload rules

A feedback record may contain:

- Up to 10 photos
- Up to 10 MiB per source file
- Up to 50 MiB across the request
- JPEG, PNG, or WebP data only

Validation does not trust the filename extension. `file-type` inspects the byte signature, the declared browser MIME type must agree when supplied, and Sharp must be able to decode the image. Input decoding is capped at 40 million pixels.

Accepted images are auto-rotated from metadata, constrained to a 2400 by 2400 pixel box without enlargement, and re-encoded:

- JPEG: quality 86 with MozJPEG
- PNG: compression level 8
- WebP: quality 86

Width, height, normalized byte size, MIME type, original basename, and user-selected order are saved in PostgreSQL. The normalized bytes are written to storage.

## Storage keys and filesystem safety

Files use random 32-byte hexadecimal names with a MIME-derived extension, for example a 64-character hex value followed by `.jpg`. User filenames are never used as filesystem paths.

The local adapter:

- Creates the upload directory with owner-only permissions where supported
- Creates files exclusively to avoid overwrites
- Rejects malformed keys and traversal strings
- Rejects symbolic links and non-file entries when reading
- Treats deletion of an already-missing file as successful

The photo API looks up a UUID in PostgreSQL, resolves its opaque key, reads the storage adapter, and returns `X-Content-Type-Options: nosniff`. The response is private-cacheable for one hour.

## Backup and restore

A complete backup needs both sides of the relationship:

1. A PostgreSQL backup containing the application tables and, for database storage, `photo_objects`
2. For local storage only, the matching upload directory or `feedy_uploads` Docker volume

With local storage, restoring only the database produces photo records whose bytes may be missing, while restoring only the files leaves no route that can identify them. With database storage, one consistent database backup contains both metadata and bytes.

## Limitations

This release has no object-bucket adapter, thumbnail cache, background upload processor, photo editing, or orphan-reconciliation job. Database storage is appropriate for the current moderate-size evidence files on serverless hosting; high-volume deployments should add an object-storage adapter and migration process.

## Cleanup and recovery

Deletion and photo replacement enqueue `photo_cleanup_jobs` in the metadata transaction. Immediate cleanup attempts remove the bytes and clear the job. Failed work remains durable; run `npm run storage:cleanup` periodically to retry up to 1,000 jobs per invocation. The adapter namespace prevents a job being applied to a different local upload directory or storage driver.

A process interruption between writing new bytes and committing metadata can leave an unreferenced object. `npm run storage:reconcile` reports unreferenced objects older than 24 hours in the selected storage adapter. Inspect the result, then run `npm run storage:reconcile -- --apply` to queue and remove them. The age threshold protects in-flight uploads. Run maintenance with the same database, schema, storage driver and upload directory as the app. Do not change storage drivers without migrating existing bytes.
