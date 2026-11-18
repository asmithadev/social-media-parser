# Social Media Evidence Capture and Documentation Tool

A tool that automatically captures and documents the social media accounts of an accused or suspect during an investigation, so examiners don't have to take and organise screenshots by hand.

Built for the National Investigation Agency (NIA), Anti-Cyber Terrorism Division. Problem statement year: 2024. Category: Software (Miscellaneous).

---

## What the project is

When investigators examine a suspect's social media accounts and write up a panchnama, they currently open each account and take screenshots by hand. That is slow, easy to get wrong, and hard to review later. Pages get missed, screenshots end up out of order, and nobody can prove a file wasn't changed afterwards.

This project is a software tool that does the capture for them. The examiner logs in to the account on the platform's own screen, and the tool walks through the account, takes the screenshots, and puts everything into a documented report that can be printed.

Some accounts refuse to open on a desktop even with the right credentials, and examiners end up using a spare phone. So the tool comes in two versions: one for **macOS** and one for **iOS**, both feeding the same backend.

## What the project is supposed to do

- Let an examiner pick a case, a suspect and one of the suspect's accounts, then choose the platform (Facebook, Twitter, Instagram, Telegram, WhatsApp or a Google account).
- Capture each part of the account in a fixed order: account info, posts, messages, timeline, friend list, followers and following.
- Save every screenshot with a SHA-256 hash, a sequence number and a timestamp, so any later change to the file can be detected.
- Read the text and details out of the screenshots and store them so they can be searched and reviewed.
- Produce a printable report in a documented form, with the panchnama number, witnesses and file hashes included.
- Let a reviewer approve the report, and keep a log of who did what.
- Flag any section that could not be captured instead of silently skipping it.

What it deliberately does **not** do: post, send, like or delete anything on the examined account, store passwords or OTPs, or bypass two-factor or platform security. It is read-only, and it is meant to be used only on accounts the agency is legally allowed to examine.

## Modules and features

| Module | What it does |
|---|---|
| Login and roles | Accounts for admins, examiners and reviewers. What you can do depends on your role. |
| Case and suspect management | Create cases and assign examiners. A suspect is stored once and can be linked to several ongoing cases. |
| Social account registry | Records each account (platform, handle, permanent account ID, profile link) against the suspect. Platforms and their capture sections are kept as data, so adding a platform doesn't need a schema change. |
| Panchnama and capture sessions | A panchnama holds the number, place, time, legal authority reference and witnesses. Each account examined in that sitting is one capture session, on a macOS or iOS device. |
| Capture engine | **macOS version:** opens the platform in a controlled browser session and captures section by section. **iOS version:** drives a dummy iPhone connected to the Mac and captures from the official app. |
| Parsing | Reads text out of the screenshots and stores the parsed data (posts, messages, friends and so on) in MongoDB, since the shape differs by platform. |
| Evidence integrity | SHA-256 hash on every screenshot and report. Files are never overwritten; a recapture is saved as a new item. |
| Report generation | Builds the documented PDF report. Reports are versioned, and a reviewer must approve one before it is final. |
| Audit trail | Implemented: database-backed logging for record changes, captures, report generation and approvals, plus login events. SHA-256 chaining and admin verification endpoints are available. Print requests are recorded as audit events. See [audit setup and API documentation](backend/docs/audit-trail.md). |

## What our team is building

We are building this for the project evaluation, in phases.

**Phase 1 (design) covers:**
- ER diagram: 14 PostgreSQL tables and 1 MongoDB collection
- Data flow diagram
- Technology stack

**Planned tech stack**

| Layer | Choice |
|---|---|
| Frontend | React, Tailwind CSS |
| Backend | Node.js, Express |
| Databases | PostgreSQL (structured records), MongoDB (parsed content) |
| macOS version | Electron, Playwright |
| iOS version | Appium with XCUITest, driven from the Mac |
| OCR and parsing | Python (Tesseract, OpenCV, NumPy) |
| Reports | PDFKit |
| Version control | Git, GitHub, GitHub Actions |

AI features (Gemini or OpenAI APIs, embeddings for search) are optional and off by default, because sending evidence to an outside service would take it out of the agency's network.

**Status:** The backend implements authentication, case management, capture sessions,
screenshot storage, parsed evidence lookup, PDF generation and review, and audit
verification. The React frontend, automated capture clients, and OCR ingestion
remain to be built.

---

## Repository contents

- `backend/` contains the Express API, MVC structure, Prisma schema, migrations, SQL verification, and tests.
- `frontend/` is reserved for the React app.
- `backend/docs/audit-trail.md` documents the audit API and its integration tests.

## Local backend setup

From the repository root, enter the backend before running npm or Prisma:

```sh
cd backend
npm ci
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy
npx prisma db seed
npm start
```

Set `DATABASE_URL`, `MONGO_URI`, and `JWT_SECRET` in your local `backend/.env`
or in the API host environment. Use an absolute `EVIDENCE_DIR` path for
existing local evidence or a private persistent mount on the API host.

For a new checkout, copy `backend/.env.example` to `backend/.env` and replace
the example values before running Prisma or starting the API. Create the target
PostgreSQL database first and ensure MongoDB is running. On macOS, MongoDB's
[installation guide](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-os-x/)
describes its Homebrew installation and service commands. An existing local
`.env` should be preserved; it contains computer-specific paths and secrets.

Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` before seeding to create the
initial administrator. The seed preserves existing users and credentials.
Check `http://localhost:3000/health` after startup; both databases should report
`connected`. The port can be changed with `PORT`.

Configure separate deployment roots when both apps are ready. The Express API
runs from `backend/`. The React build will run from `frontend/`. Configure
the frontend's public API base URL and the API's allowed frontend origin.
