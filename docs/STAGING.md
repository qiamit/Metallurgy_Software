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

- App services sleep when idle; the first request after a quiet period takes a few seconds.
- Secrets (JWT secret, anon / service-role keys, DB role passwords) live only in Railway variables. Other services
  reference `auth`'s keys (`${{auth.ANON_KEY}}`) instead of holding copies.
- Migrations applied: all files in `backend/supabase/migrations` (tracked in `public.app_schema_migrations`).
- Deployed from branch `claude/app-claude-browser-0adcb3` with `railway up <dir> --path-as-root` (no GitHub link yet).

## Smoke test result (2026-10-24)

Register lab → sign in → calibration → sample → upload to private bucket → grain-size analysis (2.9 s, G = 5.96,
same as the old Python) → signed-URL overlay (public link refused) → review → dashboard → audit log. Cross-lab upload,
anonymous reads and reading the AI key are all refused. PDF service renders PDFs and refuses requests without login.

Not yet covered: password-reset email (no SMTP on staging), AI with a real DeepSeek/OpenAI key, a manual run of
`backup-job`.
