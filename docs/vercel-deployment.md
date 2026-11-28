# Deploy the frontend and API to Vercel

The React frontend and Express API are separate Vercel projects from the same
repository. The API uses Vercel Private Blob for evidence files, WASM Tesseract
for English OCR, and PostgreSQL and MongoDB providers connected through the
Vercel Marketplace.

## Create the projects

Import this repository twice from the Vercel dashboard:

1. Create `social-media-parser-frontend` with root directory `frontend`.
   Set `VITE_USE_DEMO_DATA=false` and
   `VITE_API_BASE_URL=https://<backend-domain>/api` for Production, Preview,
   and Development as needed.
2. Create `social-media-parser-backend` with root directory `backend`.
   Vercel detects the Express application in `index.js`; `vercel-build` runs
   Prisma Client generation.

Deploy the backend first, then set `VITE_API_BASE_URL` on the frontend to its
production domain and redeploy the frontend. Set `FRONTEND_ORIGINS` on the API
to the exact frontend origin. Do not put a trailing slash or `/api` in that
value.

## Connect data services

Connect Neon PostgreSQL and MongoDB Atlas using Vercel Marketplace integrations.
The API accepts `POSTGRES_URL` (or `DATABASE_URL`) and `MONGODB_URI` (or
`MONGO_URI`). Keep the providers and the Vercel Function in nearby regions.

Create a **private** Vercel Blob store connected to the backend project. The
SDK reads its Vercel-managed Blob credentials. Never use a public Blob store for
screenshots or reports.

Set these backend Production environment variables:

- `JWT_SECRET`: a unique random value of at least 32 bytes.
- `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`: initial administrator; use a
  unique password of at most 72 UTF-8 bytes.
- `FRONTEND_ORIGINS`: the frontend production origin.
- `TRUST_PROXY_HOPS`: `1` for the Vercel proxy.

## Apply the database

After the database integrations are connected, run these commands from
`backend/` with the Production environment variables loaded:

```sh
npx prisma migrate deploy
npx prisma db seed
```

The seed creates platforms and the initial administrator when configured. It
does not replace an existing administrator password. Vercel Functions are
stateless, so migrations and seeds are not run on every request.

## Limits and verification

The API's incoming screenshot endpoint is limited to 10 MB in the app, while
Vercel Functions have a 4.5 MB request/response payload limit by default. Files
larger than the Vercel limit need the Vercel Blob client-upload flow before they
can be captured through this deployment. Validate the screenshot sizes produced
by the target Mac and iPhone before relying on this API. The OCR function uses
WASM Tesseract in the function; its worker uses `/tmp` only as a disposable
cache. Evidence itself is stored in private Blob, not local disk.

After deploy, check `/health/live` and `/health`, sign in with the seeded admin,
create fictional case records, upload and verify a screenshot, run OCR, generate
and download a report, and verify the audit chain. Keep real case evidence out of
the service until its data handling and retention terms have been approved.
