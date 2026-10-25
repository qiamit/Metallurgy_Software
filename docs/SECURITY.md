# Security & Safety Baseline

What protects the app today, and the settings that must be on in Railway. Each item names where it lives.

## 1. Identity & access

| Control | Where |
|---|---|
| Login via GoTrue (JWT, HS256). Public sign-up is off; labs register through `functions /register` (5 per 15 min per IP). | `backend/functions/server.mjs` |
| Roles per lab: viewer < analyst < reviewer < admin < owner. Every table has RLS; the browser can never skip it. | `backend/supabase/migrations/*` |
| Nobody can grant or change a role above their own; a lab always keeps at least one owner. | `functions /create-user, /update-member, /remove-member` |
| Reviewed / rejected jobs: only an admin can edit, re-run or delete them. | migration `20261025000000`, `functions assertNotSignedOff` |
| Inactive users are signed out and blocked server-side (`user_profiles.status = 'inactive'`). | `app_org_role`, `requireUser` |
| AI keys are write-only: the `api_key` column is not readable by browser roles; only `api_key_hint` is. | baseline migration grants |
| Passwords: 10–72 characters, not the email, not one repeated character — same rule in the browser, `functions` (admin-created users bypass GoTrue's own check) and GoTrue. | `lib/guards.mjs passwordProblem` |
| AI requests go only to the fixed provider endpoints (`PROVIDER_DEFAULTS`, https); lab data picks provider and model id, never a URL. Model ids are charset-limited (code + DB check); redirects are refused; keys are redacted from errors. | `lib/ai.mjs` |

**Railway → auth (GoTrue) must have:**

```
GOTRUE_DISABLE_SIGNUP=true                       # labs register via functions /register (admin API)
GOTRUE_PASSWORD_MIN_LENGTH=10
GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED=true
GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL=10
GOTRUE_JWT_EXP=3600
GOTRUE_RATE_LIMIT_EMAIL_SENT=30
GOTRUE_RATE_LIMIT_TOKEN_REFRESH=150              # also covers password sign-in attempts (per IP / 5 min)
GOTRUE_RATE_LIMIT_VERIFY=30
GOTRUE_URI_ALLOW_LIST=https://<frontend-domain>/reset-password
GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED=true   # email change must be confirmed on old and new address
GOTRUE_SESSIONS_INACTIVITY_TIMEOUT=168h          # refresh tokens die after 7 days unused (decision: shorter?)
GOTRUE_EXTERNAL_EMAIL_ENABLED=true               # email+password only; no OAuth providers configured
```

`GOTRUE_MAILER_AUTOCONFIRM=true` only affects public sign-up, which is off; admin-created users are confirmed by
`functions`. Verify on staging that `GOTRUE_PASSWORD_MIN_LENGTH` is 10 (backend/README used to say 8).

## 2. Data isolation

- Every row and every storage object path carries the lab id; RLS checks the caller's membership (`app_my_org_ids`, `app_has_org_role`).
- Composite foreign keys stop a job from pointing at another lab's sample or calibration.
- Buckets are private. Images are opened through signed URLs (1 hour), never public links.
- `npm run test:db --prefix backend` runs 36 checks on every PR (lab isolation, role limits, hidden key, storage paths,
  signed-off jobs, append-only audit log, anon cannot call functions, `search_path` pinned).
- Every SECURITY DEFINER function pins `search_path = public, pg_temp`; trigger functions are not callable through
  PostgREST; `anon` has no EXECUTE in `public`; browser roles cannot change bucket definitions.

## 3. Input safety

- Browser: images must be png/jpg/webp/bmp/gif and ≤ 25 MB (branding: png/jpg/webp ≤ 10 MB; SVG is not allowed).
- Storage buckets enforce MIME type and size again on the server.
- Functions: JSON only (415 otherwise), body must be an object; 64 KB for member / job routes, 15 MB only for
  `/analyze-ring`; names ≤ 120 chars, emails validated; images ≤ 50 MP (`MAX_IMAGE_PIXELS`). Ring photos for the AI:
  base64 checked before decoding, ≤ 10 MB (`MAX_RING_IMAGE_BYTES`), real format read from the header with sharp
  (png/jpeg/webp) and pixel-limited. Upstream timeouts; 5xx responses never include internal details; job error
  text is redacted and cut to 300 chars; `X-Request-Id` is length/charset-checked before it is echoed and logged.
- PDF HTML escapes every value (`esc()` in `lib/reportHtml.ts`); pdf-service blocks external assets except
  `PDF_ASSET_HOSTS`, renders with **JavaScript disabled** (submitted HTML cannot open WebSockets to the private
  network, which `page.route` does not see), sanitises margins / filename, runs at most `PDF_CONCURRENCY` (2)
  renders with a queue of `PDF_QUEUE` (10), and hides Chromium errors on 5xx.
- Database: lab-writable AI model id must match `^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$`, key ≤ 512 chars, lab name
  1–200 chars, accent a hex colour (migration `20261026000000`).

## 4. Transport & browser

- Caddy gateway: HSTS, `nosniff`, `X-Frame-Options: DENY`, `Permissions-Policy` (all off), CSP `default-src 'none'`,
  no `Server` header (hides Caddy / PostgREST / GoTrue versions), request bodies ≤ 30 MB, header read timeout 15 s.
  CORS allow-list: `FRONTEND_ORIGIN`, `FRONTEND_ORIGIN_ALT`, and `CORS_DEV_ORIGIN_REGEX` (default: localhost Vite
  ports; **set `^$` in production**).
- Frontend server: CSP built from `VITE_SUPABASE_URL` / `VITE_PDF_SERVICE_URL` (+ `CSP_CONNECT_SRC`): `script-src
  'self'` (no inline scripts), `connect-src` and `img-src` limited to the gateway / PDF service plus `data:` `blob:`,
  `object-src 'none'`, `form-action 'self'`, `frame-ancestors 'none'`. If `VITE_SUPABASE_URL` is missing at runtime
  it logs a warning and falls back to `https:`. `Permissions-Policy: camera=(self)` (capture studio, ring test),
  microphone / geolocation / payment / USB etc. off. `Cross-Origin-Opener-Policy: same-origin`, HSTS.
- pdf-service CORS: only `PDF_ALLOWED_ORIGINS` once it is set (any `*.up.railway.app` while unset); localhost only
  off Railway.
- Only the API gateway, frontend and pdf-service are public. auth / rest / storage-api / functions / Postgres stay on `*.railway.internal`.

## 5. Abuse & load

- Rate limits (per replica): register 5/15 min/IP; member admin 30/min/user; analysis 30/min/user; AI 10/min/user.
- Concurrency gate: `ANALYSIS_CONCURRENCY` (default 2) analyses at once, queue of `ANALYSIS_QUEUE` (20), then 503.
- A job already "processing" cannot be started twice (stale after 10 min).
- Postgres `statement_timeout`: 15 s for signed-in users, 5 s for anon.

## 6. Audit & recovery

- `audit_log` records every insert / update / delete with before / after (API keys stripped); admins read it in Settings → Audit Log.
- `audit_log` is append-only: no role (including `service_role`) holds INSERT / UPDATE / DELETE / TRUNCATE, and
  triggers refuse UPDATE / DELETE / TRUNCATE even for the owner. Retention purge: the table owner disables
  `audit_log_no_update_delete` / `audit_log_no_truncate` inside one transaction, deletes, re-enables.
  `pg_restore` (inserts / drop-and-create) is unaffected.
- Nightly `backup-job`: Postgres dump + copy of all files to a separate bucket, 30-day retention. See `docs/OPERATIONS.md` for restore.

## 7. Secrets

- Never commit `.env`. Railway variables only. `.gitignore` covers `.env` / `.env.*` (except `.env.example`).
- CI `secrets` job runs gitleaks over the full git history (`.gitleaks.toml` allow-lists test fixtures). Manual
  scan on 2026-10-26 found no keys, tokens or connection strings in tracked files or history.
- One `JWT_SECRET` signs `ANON_KEY` and `SERVICE_ROLE_KEY`. The service-role key lives only in `functions` and `storage-api`.
- Rotate: new `JWT_SECRET` → re-sign both keys → update auth, rest, storage-api, functions, frontend (rebuild), pdf-service. All sessions end.

## 8. Dependencies & CI

- CI fails on high/critical advisories in runtime dependencies (`npm audit --omit=dev --audit-level=high`) for
  frontend, backend (migrations), functions and pdf-service; the frontend's full tree (build tools) is reported only.
- Dependabot: npm (frontend, backend, functions, pdf-service), Docker (gateway, functions, pdf-service, backup-job),
  GitHub Actions.
- Audit 2026-10-26: functions, pdf-service, backend: 0 advisories. Frontend: 0 in runtime deps; 4 moderate in build
  tooling (`postcss-selector-parser` < 7.1.6 via `tailwindcss` 3 — CPU exhaustion parsing *our own* CSS at build
  time). Fix needs Tailwind 4 (major). `tailwindcss`, `tailwindcss-animate`, `postcss`, `autoprefixer` moved to
  `devDependencies` (they are build-only).

## Known gaps (next steps)

Decisions / production access needed:

1. **Server images are old** (no patch-level updates exist on the pinned lines, so nothing was changed):
   GoTrue `v2.174.0` → latest stable `v2.197.0`; storage-api `v1.24.7` → `v1.84.x`; PostgREST `v12.2.12` is the last
   v12 release (current `v14.18` / `v16.5`, majors with breaking changes); Caddy `2.10-alpine` (2.10.2, line no longer
   patched) → `2.11.7`. Upgrade on staging first, re-run the smoke test and `npm run test:db`, then production.
2. **Client IP behind Railway**: Caddy does not trust incoming `X-Forwarded-For`, so `functions` sees the Railway edge
   / gateway address and the per-IP `/register` limit (and GoTrue's per-IP limits) are effectively shared by all
   users. Verify on staging (`curl` with a forged `X-Forwarded-For`), then set Caddy `trusted_proxies` to Railway's
   edge range and GoTrue `GOTRUE_RATE_LIMIT_HEADER` accordingly. Do not trust a header the client can set.
3. Railway variables to set (**done on staging 2026-10-25**, see docs/STAGING.md; production still to do): `CORS_DEV_ORIGIN_REGEX=^$` on the gateway (production), `PDF_ALLOWED_ORIGINS` on
   pdf-service, `VITE_SUPABASE_URL` / `VITE_PDF_SERVICE_URL` visible at runtime on frontend (check the CSP header),
   the GoTrue block in §1 (`GOTRUE_PASSWORD_MIN_LENGTH=10`). Then apply migration `20261026000000`.
4. **MFA (TOTP)** for admins/owners: `GOTRUE_MFA_TOTP_ENROLL_ENABLED=true`, `GOTRUE_MFA_TOTP_VERIFY_ENABLED=true` + an
   enrol / challenge UI and an `aal2` check in RLS for admin actions. Not available until the UI exists.
5. Optional `GOTRUE_PASSWORD_HIBP_ENABLED=true` (breached-password check; sends a 5-char hash prefix to
   haveibeenpwned.com) and `GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION=true` (needs SMTP first).
6. `create-user` adds an **existing** account (any lab) to the caller's lab by email without that person's consent,
   and reveals whether an email is registered. Consider an invite / accept step.
7. Any active user can create unlimited labs (`create_my_organization`). Consider a per-user cap.
8. `review_analysis_job` accepts jobs in any status (e.g. pending). Consider requiring `completed`.
9. `backend/scripts/migrate.mjs` uses `rejectUnauthorized: false` for public Postgres URLs (Railway's self-signed
   cert). Prefer the private network or pin the CA when running from a laptop.
10. `storage` schema keeps storage-api's broad table grants to `anon` (protected by RLS: no anon policies). Revisit
    after the storage-api upgrade.
11. **Ring Test upload aspect ratio**: uploads are resized to 590×590 regardless of shape (inherited from the old app).
    This can distort a non-square photo in one axis and affect mm/px. Fix: keep the aspect ratio, then re-validate
    measurements against known samples.
12. Rate limits are in memory per replica; move them to the gateway or Redis if `functions` scales out.
13. Lint debt: `react-hooks/set-state-in-effect` in ported pages (CI reports it but does not block).
14. Run a full penetration test on staging once deployed; enable GitHub secret scanning + push protection on the repo.
