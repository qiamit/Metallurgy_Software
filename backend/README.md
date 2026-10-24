# Metallurgy Lab backend (Railway only)

Same service layout as QIRLPL LIMS. Every piece runs as a Railway service; nothing uses Supabase Cloud.
The browser talks to the `api` gateway with `supabase-js` (a protocol client only).

| Service | Source | Internal host:port |
|---|---|---|
| `frontend` | repo, root `frontend` (Railpack static SPA, `RAILPACK_SPA_OUTPUT_DIR=dist`) | – |
| `api` | repo, root `backend/gateway` (Caddy) | `api.railway.internal:80` |
| `auth` | image `supabase/gotrue:v2.174.0` | `auth.railway.internal:9999` |
| `rest` | image `postgrest/postgrest:v12.2.12` | `rest.railway.internal:3000` |
| `storage-api` | image `supabase/storage-api:v1.24.7` → Railway Bucket | `storage-api.railway.internal:8080` |
| `Postgres` | `ghcr.io/railwayapp-templates/postgres-ssl:18` + volume | `postgres.railway.internal:5432` |
| `functions` | repo, root `backend/functions` (Node 22: register, members, OpenCV analysis, AI) | `functions.railway.internal:8080` |
| `pdf-service` | repo, root `backend/pdf-service` (Playwright HTML → PDF) | public URL |

Removed from the old stack: FastAPI, Redis + RQ worker (never used), MinIO.

## First-time setup order

1. **Postgres** — create it, then run `supabase/migrations/20261024000000_bootstrap_roles.sql` and set
   `ALTER ROLE authenticator WITH PASSWORD '…';`
2. **Secrets** — one HS256 `JWT_SECRET`. Sign two JWTs with it: `ANON_KEY` (`{"role":"anon"}`) and
   `SERVICE_ROLE_KEY` (`{"role":"service_role"}`).
3. **auth** (GoTrue) — `GOTRUE_DB_DATABASE_URL` (as `postgres`), `GOTRUE_DB_NAMESPACE=auth`,
   `GOTRUE_DB_AUTOMIGRATE=true` for the first boot, `GOTRUE_JWT_SECRET`, `GOTRUE_JWT_AUD=authenticated`,
   `GOTRUE_JWT_ADMIN_ROLES=service_role`, `API_EXTERNAL_URL=https://<api-domain>/auth/v1`,
   `GOTRUE_SITE_URL=https://<frontend-domain>`, `GOTRUE_URI_ALLOW_LIST=https://<frontend-domain>/reset-password`,
   `GOTRUE_DISABLE_SIGNUP=true` (labs register through `functions /register`), `GOTRUE_MAILER_AUTOCONFIRM=true`,
   SMTP (`GOTRUE_SMTP_*`) for password-reset emails.
4. **storage-api** — `DATABASE_URL` (as `postgres`), `PGRST_JWT_SECRET`/`AUTH_JWT_SECRET`, `ANON_KEY`, `SERVICE_KEY`,
   `POSTGREST_URL=http://rest.railway.internal:3000`, `STORAGE_BACKEND=s3`, `GLOBAL_S3_BUCKET`, `GLOBAL_S3_ENDPOINT`,
   `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `REGION=auto`, `TENANT_ID=stub`, `FILE_SIZE_LIMIT=52428800`.
5. Run the remaining migrations in order (they need the `auth` and `storage` schemas from steps 3–4):
   ```bash
   psql "$DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 -f supabase/migrations/<file>.sql
   ```
6. **rest** (PostgREST) — `PGRST_DB_URI` (as `authenticator`), `PGRST_DB_SCHEMAS=public`, `PGRST_DB_ANON_ROLE=anon`,
   `PGRST_JWT_SECRET`, `PGRST_DB_MAX_ROWS=10000`.
7. **functions** — `AUTH_URL`, `REST_URL`, `STORAGE_URL=http://storage-api.railway.internal:8080`, `SERVICE_ROLE_KEY`,
   optional `OPENAI_API_KEY` / `OPENAI_MODEL` (server-wide fallback when a lab has no AI key).
8. **api** (Caddy) — `GOTRUE_UPSTREAM`, `PGRST_UPSTREAM`, `STORAGE_UPSTREAM`, `FUNCTIONS_UPSTREAM`,
   `FRONTEND_ORIGIN` (and optional `FRONTEND_ORIGIN_ALT`) for CORS.
9. **pdf-service** — `AUTH_URL`, `AUTH_ANON_KEY`, `PDF_ALLOWED_ORIGINS=https://<frontend-domain>`.
10. **frontend** — `VITE_SUPABASE_URL=https://<api-domain>`, `VITE_SUPABASE_ANON_KEY`, `VITE_PDF_SERVICE_URL`.

## Tests

```bash
npm install --prefix backend && npm run test:db --prefix backend          # migrations + RLS (PGlite)
npm install --prefix backend/functions && npm test --prefix backend/functions  # OpenCV.js parity with the old Python
```

## Rules

- Schema changes: add a new `supabase/migrations/YYYYMMDDHHMMSS_name.sql`; end with `NOTIFY pgrst, 'reload schema';`.
- Never `supabase link`, `supabase db push`, or Vercel — `npm run db:push` refuses on purpose.
