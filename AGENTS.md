# Working on Social Media Evidence Capture

This team project helps authorized examiners document social media evidence for
a case and panchnama. The capture clients target macOS and iOS. An examiner signs
in to the social platform through its own sign-in screen. Platform credentials
and OTPs stay with the platform.

## Repository and ownership

- `backend/` is the Express API. Its MVC code is under `backend/src/`.
  Routes call controllers. Controllers validate inputs and use Prisma for
  PostgreSQL records or Mongoose for parsed screenshot artifacts. Authentication
  and role middleware are under `src/middleware/`.
- `frontend/` is reserved for the teammate's React app. Use function components
  and hooks. Agree on page assignments and response examples before building.
  Start with sign-in, case listing, and case detail. Continue with panchnamas,
  capture progress, evidence review, reports, and role-specific admin tools.
- The backend maintainer owns API contracts, database migrations, and evidence
  storage. Coordinate contract changes before merging work that affects both apps.
- See the [project README](README.md) for setup and the
  [audit guide](backend/docs/audit-trail.md) for audit endpoints and verification.

## Current state and integration order

- Express supports login, case access, record management, capture sessions,
  screenshot upload and retrieval, parsed evidence lookup, report generation,
  approval, print requests, and admin audit verification.
- Pause new backend features while the team builds the first React screens.
  Use fictional fixtures before connecting the UI to the API.
- The current login endpoint issues a JWT. The API uses the signed-in user's
  latest role and case assignments to authorize requests. OAuth 2.0 and OIDC
  provider integration is a future decision. Confirm the mentor's intended
  meaning of “ACID server integration” before making architectural changes.
- Automated macOS/iOS capture and OCR ingestion into MongoDB are pending.
  The first integration milestone is one macOS screenshot through upload,
  OCR, evidence review, and an approved PDF.

## Development and verification

Run backend commands from `backend/`. Use `npm ci` for a clean install,
`npx prisma generate` for the client, and `npx prisma migrate status` to check
the target database. Review the target before applying migrations with
`npx prisma migrate deploy`. Start the API with `npm start` or `npm run dev`.

Run `npm test` with `TEST_DATABASE_URL` set to a local PostgreSQL test database
and `psql` installed. Without that variable, the audit suite skips its
integration checks. The suite uses a temporary schema. For changes to evidence
workflows, also verify access checks, file round trips, hash validation, and
audit events.

## Evidence and deployments

- Keep case authorization and database access in Express. The React app calls
  the API using a public base URL and displays loading, empty, and error states.
- Deploy each app from its own project root. Restrict API CORS to the configured
  frontend origin when serving the apps separately.
- Keep `DATABASE_URL`, `MONGO_URI`, `JWT_SECRET`, and other secrets in the backend
  environment. Store screenshots and PDFs in private persistent storage using
  `EVIDENCE_DIR`. Use fictional records and assets for fixtures and demos.
- Preserve existing migrations, evidence files, hashes, and audit entries.
  Use the database audit service for authenticated record mutations and keep
  sensitive inputs out of logs.

## Collaboration and Codex

- Treat requests for review, explanation, or planning as read-only. Edit project
  files only when the user explicitly requests edits. For Git changes, stay within
  the user's requested commit and push scope.
- Preserve teammates' work. Check the working tree and branch before editing.
  Make small, reviewable commits with actual timestamps. Use one commit per
  completed route when implementing routes and verify each change.
- Describe the behavior changed, the checks run, and any work still pending.
  Use issue or PR descriptions to record API changes that the frontend depends on.
