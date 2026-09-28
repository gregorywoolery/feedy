# 04. PDF exports

Feedy generates PDFs on demand with `pdf-lib`. Sharp converts attached images to embedded JPEG data sized for the document. Exports are not persisted; the API returns them as `application/pdf` downloads with `Cache-Control: no-store`.

## Single record

Use the PDF action on a dashboard row/card or the **Download PDF** button on a feedback detail page. The endpoint is:

```http
GET /api/feedback/:feedbackId/export
```

The generated filename follows:

```text
feedy-<project>-<version>-YYYY-MM-DD.pdf
```

Filename segments are lowercase ASCII, punctuation is reduced to hyphens, and each segment is capped at 60 characters.

## Selected and filtered batches

Select one or more visible dashboard records and choose **Download selected**. The client sends:

```http
POST /api/feedback/export
Content-Type: application/json

{"ids":["<feedback-uuid>", "<feedback-uuid>"]}
```

The request accepts 1 to 100 unique UUIDs. All IDs must still exist; otherwise the entire export returns an error. The UI selection is page-local and is cleared when the server-rendered dashboard view changes.

Both the main dashboard and a project detail view can export the entire current filtered result. The client sends the validated dashboard query instead of IDs:

```http
POST /api/feedback/export
Content-Type: application/json

{"query":{"q":"navigation","projectId":"<project-uuid>","sort":"createdAt","order":"desc"}}
```

Filtered exports include every matching record, not only the current page, up to a 500-record safety limit. Project-page exports always include that project's ID in the query.

The batch filename is:

```text
feedy-feedback-export-YYYY-MM-DD.pdf
```

## Document structure

Every feedback item keeps its related fields together:

- Project name and project version
- Complete feedback description, continued on additional pages when needed
- Created and updated timestamps
- Attached photos in stored order with original filenames
- Generated date and page numbering

A single-record document begins with that record. A multi-record document adds a cover with item/project totals and a contents page before the records. Records and photos retain the requested order.

If no photos are attached, the PDF explicitly says so. Images are auto-rotated, constrained for page placement, flattened onto white, and encoded as JPEG before embedding.

## Failure cases

- An invalid ID receives a validation error.
- A missing selected record fails the whole export; partial exports are not produced.
- Missing photo bytes cause export generation to fail rather than silently omitting the evidence.
- A selected batch with no IDs, duplicate IDs, or more than 100 IDs is rejected.
- A filtered export with no matches or more than 500 matches is rejected with an actionable error.

PDF generation is synchronous in the request process. There is no background queue, stored export history, CSV export, ZIP bundle, or custom export template in this release.

## Resource budgets

All export routes share one per-process admission slot, including image loading. Photo metadata is checked before reading any bytes: at most 100 photos and 50 MiB total per export. Actual returned bytes are checked again. A busy process returns HTTP 429; an oversized selection returns HTTP 400 with an actionable message. Existing 100-selected/500-filtered record limits also apply. Multi-instance hosting has one slot per process, not a global queue.
