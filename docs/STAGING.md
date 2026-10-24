# Staging environment (Railway)

Project **Metallurgy Software** → environment **staging** (isolated from `production`; production still runs the old stack).

| Service | Public URL / internal host |
|---|---|
| frontend | https://frontend-staging-4d6a.up.railway.app |
| gateway (Caddy API) | https://gateway-staging-71ee.up.railway.app |
| pdf-service | https://pdf-service-staging-4cbf.up.railway.app |
| auth (GoTrue v2.174.0) | auth.railway.internal:9999 |
| rest (PostgREST v12.2.12) | rest.railway.internal:3000 |
| storage-api (v1.24.7) | storage-api.railway.internal:8080 |
| functions | functions.railway.internal:8080 |
| Postgres-2Xif (postgres-ssl:18) | postgres-2xif.railway.internal:5432 |
| backup-job | cron 02:00 IST |
| Buckets | `metallurgy-staging-media`, `metallurgy-staging-backup` |

- frontend, gateway, functions and pdf-service sleep when idle (first request after a quiet period takes a few
  seconds); auth, rest and storage-api stay awake.
- Secrets (JWT secret, anon / service-role keys, DB role passwords) live only in Railway variables. Other services
  reference `auth`'s keys (`${{auth.ANON_KEY}}`) instead of holding copies.
- Migrations applied: all files in `backend/supabase/migrations` (tracked in `public.app_schema_migrations`).
- Deployed from branch `claude/app-claude-browser-0adcb3` with `railway up <dir> --path-as-root` (no GitHub link yet).

## Smoke test result (2026-10-24)

Register lab → sign in → calibration → sample → upload to private bucket → grain-size analysis (2.9 s, G = 5.96,
same as the old Python) → signed-URL overlay (public link refused) → review → dashboard → audit log. Cross-lab upload,
anonymous reads and reading the AI key are all refused. PDF service renders PDFs and refuses requests without login.

**Backup (manual run, 2026-10-24):** 172 KB dump + all stored files in `metallurgy-staging-backup`; dump verified
with `pg_restore --list`. Nightly cron set on the service (next run 02:00 IST).

**AI cross-check (DeepSeek `deepseek-v4-flash-vision-exp`, lab key):** vision call answered in ~4.5 s with
observations, numeric estimates and caveats; comparison and Retry AI work; the browser only ever sees the key hint.
Agreement was "low" on the synthetic test image (the AI noted it had no scale bar) — expected; judge accuracy on real
etched specimens.

Not yet covered: password-reset email (no SMTP on staging), Ring Test AI (not enabled in AI Setting yet).
