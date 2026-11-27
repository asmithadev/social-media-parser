# Self-hosting

This Compose setup runs PostgreSQL, MongoDB, the Express API with local English
Tesseract OCR, and the React app behind Nginx. The browser uses one origin, so
Nginx forwards `/api` and health checks to the API. Database ports are not
published. The API and web ports bind to loopback for a separate TLS proxy on
the host.

## Prepare secrets

From the repository root:

```sh
cp .env.hosting.example .env
openssl rand -hex 32
```

Replace every example password and secret in `.env` with independent values.
The PostgreSQL and Mongo passwords are embedded in connection URLs; use
URL-safe values such as the output of `openssl rand -hex 32`. Set a real admin
email and a unique initial password. Protect `.env` as a secret and do not add it
to source control. If the public site uses a separately hosted frontend origin,
set `FRONTEND_ORIGINS` to its exact HTTPS origin(s), comma separated.

## Start the services

```sh
docker compose -f compose.hosting.yaml up --build -d
docker compose -f compose.hosting.yaml ps
docker compose -f compose.hosting.yaml logs -f backend
```

On first start, the API applies checked-in Prisma migrations, seeds the platform
sections and creates the initial administrator if the seed variables are set.
The seed does not replace an existing user's password. The web app is available
on `http://127.0.0.1:8080` by default. The API is also bound to
`http://127.0.0.1:3000` on loopback for the Mac capture clients. Both ports can
be changed with `WEB_PORT` and `API_PORT`.

For public access, configure a maintained TLS reverse proxy on the host to route
HTTPS traffic to `127.0.0.1:8080`. The included Nginx serves the frontend and
proxies API requests to the private backend network. Do not expose PostgreSQL or
MongoDB ports publicly. Use HTTPS for browser access and remote capture clients.
If using another proxy hop count, configure `TRUST_PROXY_HOPS` to match the
trusted proxy chain. Do not set it to `true` or trust arbitrary client-supplied
forwarding headers.

## Persistent data and backups

Compose creates persistent named volumes for PostgreSQL, MongoDB, and evidence
files. Keep all three in backups and verify restores before using the system for
case records. Preserve the audit tables and exported audit checkpoints. Store
checkpoints separately from the database and evidence volumes. Evidence files
are private to the backend container; only authorized API routes serve them.

The API container runs as the unprivileged Node user with a read-only root
filesystem. Tesseract uses a temporary filesystem for scratch files. Logs go to
the container log stream. Configure host-level collection and retention to meet
your organization's requirements.

## Before using the hosted instance

- Review the case access, data retention, backup, restore, and incident response
  process with the project owner.
- Replace the sample TLS proxy, DNS, firewall, secret storage, and backup setup
  with the host's production equivalents.
- Verify `/health/live` and `/health` through the TLS proxy. The latter returns
  only dependency names and connected/unavailable status; it does not expose
  database error text.
- Complete the macOS browser workflow against the actual supported account
  types and complete the iOS workflow on the intended physical iPhone/iOS
  version. The repository's automated capture tests use fictional pages/devices
  and cannot establish platform coverage or device compatibility.
- Check OCR text and structured candidates against representative, authorized
  screenshots before approval. Candidate extraction is not identity
  verification; full bubble segmentation and sender inference are not shipped.
- Set the unique initial administrator password before first boot. The seed
  preserves an existing user's password; password rotation is not currently
  available in the UI. Verify examiner, reviewer, approval, download, and audit
  workflows with fictional records.

For a separate frontend/API deployment, keep the frontend demo mode off, set its
public API URL at build time, set `FRONTEND_ORIGINS` to the exact frontend
origin(s), and terminate TLS at the host proxy. `FRONTEND_ORIGINS` is an allowlist;
an empty value disables cross-origin browser access.
