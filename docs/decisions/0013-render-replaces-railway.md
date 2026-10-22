# Decision 0013: Render Replaces Railway for the API, Worker, and Database

Status: approved on 2026-10-22. Render services created the same day; see `STATE.md` for what remains of the cutover.

Date: 2026-10-22  
Decision owner: User  
AI role: compared Render with self-hosting on the user's Hetzner server and drafted the record

## Question

Railway disclosed a security incident on 2026-10-21 in which customer environment variables may have been decrypted, and it paused all deployments (reported by OfficeChai and The CyberSec Guru, retrieved 2026-10-22). Where should the API, worker, and PostgreSQL 17 run instead?

## Decision

Render hosts the API as a web service, the worker as a background worker, and PostgreSQL 17 as a managed database, defined in `render.yaml`. Vercel still serves the web application. Railway is retired once Render is serving.

Self-hosting on the user's Hetzner server was considered. It keeps secrets off third-party platforms but adds patching, TLS, backups, and uptime to the project; the user chose Render.

## Consequences

- Expected cost is about $20 a month at list prices: $7 for the Starter web service, $7 for the Starter worker, and $6 for the basic-256mb database (render.com/pricing, retrieved 2026-10-22). The user confirms the price when creating the services.
- Every secret that was stored on Railway is rotated rather than copied: the internal API token, which Vercel also holds, the application auth secret, and the database password. Attio and Lemlist keys were never on Railway.
- The Railway database held only the synthetic `inspection-v1` fixture and its audit, so nothing is migrated; Render's pre-deploy step reloads the fixture.
- Vercel's `API_BASE_URL` moves to the Render API address, and the Lemlist webhook is registered there.
- Auto-deploy is off in the Blueprint, so pushing to `main` does not deploy without an explicit step.
- On first deploy the API's pre-deploy migration ran before the new database accepted connections and failed; a manual redeploy succeeded. The worker restarted until the migrations existed, then completed the audit job with the expected 22 findings.
- Milestone 2's evidence describes the Railway deployment as it was; it is history and is not rewritten.
