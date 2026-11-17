# Audit trail

## Enable it

Install dependencies, generate Prisma's client, and apply the migrations to your
configured PostgreSQL database. Run these commands from the repository's `backend/` directory:

```sh
npm ci
npx prisma generate
npx prisma migrate deploy
```

The feature uses the existing `audit_logs` table and PostgreSQL's built-in SHA-256
function. It requires no additional secret or extension. PostgreSQL 15 was used
for integration testing. `DATABASE_URL` must point at your application's database;
authentication continues to use `JWT_SECRET`.

Existing audit rows are preserved exactly. Rows written before this feature with
placeholder or incompatible hashes will fail verification at their first invalid
ID. The migration does not rewrite history or manufacture a trusted legacy chain.

## Recorded events

| Activity | Actions |
| --- | --- |
| Authentication | `LOGIN_SUCCEEDED`, `LOGIN_FAILED` |
| Record management | `USER_CREATED`, `CASE_UPDATED`, `SUSPECT_DELETED`, etc. |
| Capture sessions | `CAPTURE_STARTED`, `CAPTURE_COMPLETED`, `CAPTURE_FAILED` |
| Section results | `CAPTURE_SECTION_RECORDED` |
| Screenshot insertion | `SCREENSHOT_CAPTURED` |
| Report insertion | `REPORT_GENERATED` |
| Report approval changes | `REPORT_APPROVED`, `REPORT_APPROVAL_REVOKED` |
| Report print request | `REPORT_PRINT_REQUESTED` |

Every insert, update and delete across the 14 domain tables has a database trigger.
Updates that leave every field unchanged produce no event. A section event uses
the capture session as its `entityId`; its `detail.record.platform_section_id`
identifies the section. Inserting an already-approved report emits both generation
and approval events. The screenshot upload, report generation, and report approval routes attach the signed-in actor to their database events. Print requests are recorded explicitly.

Existing API writes attach the authenticated actor through `withAuditActor`:

```js
const { withAuditActor } = require('../services/audit');

const report = await withAuditActor(req.user.id, tx =>
  tx.report.update({
    where: { id: reportId },
    data: { approvedBy: req.user.id, approvedAt: new Date() },
  })
);
```

Use the supplied `tx` client for all work inside the callback. The actor is set
with transaction-local PostgreSQL configuration and cannot leak into another
pooled request. Direct SQL writes and seed operations are still recorded, with
`userId: null` when no authenticated actor context exists. Failed login attempts
are anonymous and store only a reason code.

Row changes and their audit events commit or roll back together. If audit insertion
fails, the record change fails. A successful login response is only returned after
its event has been saved. Audited writes require READ COMMITTED isolation. A global
transaction lock serializes writes so IDs and predecessors stay ordered across
concurrent requests. Keep write transactions short; this favors correctness over
write throughput for the current application.

Details contain the operation, changed field names, and an allowlist of IDs,
statuses, roles, evidence hashes, and sequence/version numbers. They exclude
passwords and password hashes, access tokens, names, email addresses, Aadhaar,
witness contact details, source URLs, file paths, section failure text, and
arbitrary captured metadata/content. Read-only API requests are not logged as
record changes. Denied or failed mutations do not create a successful change event.

## Admin endpoints

Both endpoints require an active admin's Bearer token. Examiners and reviewers
cannot read this cross-case audit stream. There are no edit/delete endpoints.

`GET /api/audit-logs?limit=50&after=123`

Returns `{ logs, nextCursor }` in ascending ID order. `after` is optional;
`limit` defaults to 50 and accepts 1–100. Audit IDs are decimal strings to preserve
64-bit precision. `nextCursor: null` means there are no more entries in that page's
snapshot. An incremental poller should retain the last returned ID for future polls.

`GET /api/audit-logs/verify`

```json
{
  "valid": true,
  "checked": "42",
  "headId": "47",
  "headHash": "<64 lowercase hexadecimal characters>",
  "firstInvalidId": null,
  "checkpointMatches": null
}
```

Verification runs against one database snapshot and checks the entire chain.
`checked` counts rows, not sequence values: rolled-back transactions may leave ID
gaps. Corruption returns HTTP 200 with `valid: false` and the first invalid ID;
check `valid`, not only the HTTP status. Invalid query parameters return 400.

Retain the returned `headId` and `headHash` in a trusted location outside this
database. To check the chain against that saved checkpoint:

```text
GET /api/audit-logs/verify?checkpointId=47&checkpointHash=<saved hash>
```

Both parameters must be supplied together. A missing checkpoint row or a hash
mismatch returns `valid: false` and `checkpointMatches: false`. Later legitimate
entries may extend the chain beyond the checkpoint.

## Hash format and limits

The first predecessor is 64 zeroes. Each hash covers this PostgreSQL JSONB array,
serialized as text, encoded as UTF-8, and hashed using SHA-256:

```text
["audit-v1", previousHash, decimalIdString, userId, action,
 entityType, entityId, detail, utcTimestampWithSixFractionalDigits]
```

IDs, actor, action, target, full detail text, and the precise stored timestamp are
all bound to the hash. The database assigns the timestamp and replaces any
caller-supplied chain hash. The existing triggers reject audit UPDATE, DELETE,
and TRUNCATE operations.

A database owner/superuser can disable triggers or rewrite data and recompute an
unkeyed hash chain. The application DB role should not own tables or have schema
modification/TRUNCATE privileges. Hash chaining detects altered records, interior
deletions and reordered entries, but a remaining valid prefix cannot reveal tail
deletion by itself. An external trusted checkpoint is needed to detect deletion
or rewriting at/before that checkpoint; newer uncheckpointed entries are not
protected against privileged suffix removal. Checkpoints are returned by the API;
automatic off-database checkpoint storage is not implemented.

## Tests

```sh
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/audit_test npm test
```

The integration suite requires `psql` and a PostgreSQL role that can create
schemas. It creates a random schema, applies all migrations, exercises the real
Express API and database triggers, and removes only that schema afterward.
It covers user attribution, privacy, authentication outcomes, transaction rollback,
audit failure, concurrent and multi-row writes, no-op updates, screenshots, report
approval, permissions, pagination, precision, time zones, privileged tampering,
legacy hashes, deletion/checkpoints, and the existing SQL constraint checks.
Without `TEST_DATABASE_URL`, the integration suite is skipped.
