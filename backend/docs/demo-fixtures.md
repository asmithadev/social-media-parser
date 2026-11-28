# Demo fixtures

The demo seeder creates a fictional data set for exercising the API and UI. It is separate from `db:seed`. The Vercel backend build calls it, but it skips unless `SEED_DEMO_DATA=true` is set.

## Run locally

1. Start the local PostgreSQL and MongoDB databases and apply migrations plus the standard platform/admin seed:

   ```sh
   npm run db:deploy
   npm run db:seed
   ```

2. Set a unique, disposable demo password (16–72 UTF-8 bytes) and run:

   ```sh
   DEMO_SEED_PASSWORD='choose-a-unique-local-demo-password' npm run db:seed:demo
   ```

The seed refuses to write to non-loopback databases, Vercel, or Vercel Blob unless `ALLOW_DEMO_DATA=true` is explicitly set. For hosted production demo data, set `SEED_DEMO_DATA=true`, `ALLOW_DEMO_DATA=true`, and `DEMO_SEED_PASSWORD` in the backend Vercel Production environment, then redeploy. Use a unique password of 16–72 UTF-8 bytes; never commit it. For Preview and Development, leave `SEED_DEMO_DATA` unset so demo records are not inserted there.

The command is safe to rerun: it locates records using stable `DEMO-*` identifiers and does not delete or reset existing records. The two demo users are `demo.examiner@example.test` and `demo.reviewer@example.test`; both use the value supplied through `DEMO_SEED_PASSWORD`. They are ordinary active users and should only be created in an isolated test environment.

## Fixtures included

- Three cases: `DEMO-OPEN-001`, `DEMO-REPORT-001`, and `DEMO-CLOSED-001`, assigned to both demo roles.
- One fictional suspect linked to the open and report-ready cases, with an account for each seeded platform (Facebook, X/Twitter, Instagram, Telegram, WhatsApp, Google).
- Open and completed panchnamas/sessions, macOS and iOS device types, a fictional witness, captured and skipped section outcomes, and PNG screenshots stored through the configured evidence-storage adapter.
- MongoDB OCR parsed artifacts for the screenshots, including searchable fictional text, and a generated report PDF with a SHA-256 hash.
- Audit events are produced by the database triggers and normal application audit paths when the fixture records are inserted.

## Endpoint coverage

Use the examiner login to exercise case, suspect, account, panchnama, witness, platform, capture-session, section-outcome, screenshot, OCR, evidence-search, report-generation/download, and print-request flows. Use the reviewer login to exercise report approval. Use the admin account seeded by the normal seed to exercise user management, case/assignment changes, suspect/account administration, and audit listing/chain verification. The fixtures provide records and valid identifiers; mutating endpoints can still change their state, so use a disposable database and rerun the seeder as needed.

The fixture set supplies representative records for the existing API. It does not manufacture a response for every validation failure or authorization permutation; use the backend integration/unit tests for those cases.
