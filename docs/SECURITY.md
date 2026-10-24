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

**Railway → auth (GoTrue) must have:**

```
GOTRUE_DISABLE_SIGNUP=true
GOTRUE_PASSWORD_MIN_LENGTH=10
GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED=true
GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL=10
GOTRUE_JWT_EXP=3600
GOTRUE_RATE_LIMIT_EMAIL_SENT=30
GOTRUE_RATE_LIMIT_TOKEN_REFRESH=150
GOTRUE_RATE_LIMIT_VERIFY=30
GOTRUE_URI_ALLOW_LIST=https://<frontend-domain>/reset-password
```

## 2. Data isolation

- Every row and every storage object path carries the lab id; RLS checks the caller's membership (`app_my_org_ids`, `app_has_org_role`).
- Composite foreign keys stop a job from pointing at another lab's sample or calibration.
- Buckets are private. Images are opened through signed URLs (1 hour), never public links.
- `npm run test:db --prefix backend` runs 27 checks on every PR (lab isolation, role limits, hidden key, storage paths, signed-off jobs).

## 3. Input safety

- Browser: images must be png/jpg/webp/bmp/gif and ≤ 25 MB (branding: png/jpg/webp ≤ 10 MB; SVG is not allowed).
- Storage buckets enforce MIME type and size again on the server.
- Functions: JSON bodies ≤ 15 MB, images ≤ 50 MP (`MAX_IMAGE_PIXELS`), upstream timeouts, 5xx responses never include internal details.
- PDF HTML escapes every value (`esc()` in `lib/reportHtml.ts`); pdf-service blocks external assets except `PDF_ASSET_HOSTS`.

## 4. Transport & browser

- Caddy gateway: HSTS, `nosniff`, `X-Frame-Options: DENY`, strict CORS allow-list (`FRONTEND_ORIGIN`).
- Frontend server: CSP, HSTS, `frame-ancestors 'none'`.
- Only the API gateway, frontend and pdf-service are public. auth / rest / storage-api / functions / Postgres stay on `*.railway.internal`.

## 5. Abuse & load

- Rate limits (per replica): register 5/15 min/IP; member admin 30/min/user; analysis 30/min/user; AI 10/min/user.
- Concurrency gate: `ANALYSIS_CONCURRENCY` (default 2) analyses at once, queue of `ANALYSIS_QUEUE` (20), then 503.
- A job already "processing" cannot be started twice (stale after 10 min).
- Postgres `statement_timeout`: 15 s for signed-in users, 5 s for anon.

## 6. Audit & recovery

- `audit_log` records every insert / update / delete with before / after (API keys stripped); admins read it in Settings → Audit Log.
- Nightly `backup-job`: Postgres dump + copy of all files to a separate bucket, 30-day retention. See `docs/OPERATIONS.md` for restore.

## 7. Secrets

- Never commit `.env`. Railway variables only.
- One `JWT_SECRET` signs `ANON_KEY` and `SERVICE_ROLE_KEY`. The service-role key lives only in `functions` and `storage-api`.
- Rotate: new `JWT_SECRET` → re-sign both keys → update auth, rest, storage-api, functions, frontend (rebuild), pdf-service. All sessions end.

## Known gaps (next steps)

1. **Ring Test upload aspect ratio**: uploads are resized to 590×590 regardless of shape (inherited from the old app). This can distort a non-square photo in one axis and affect mm/px. Fix: keep the aspect ratio, then re-validate measurements against known samples.
2. MFA (TOTP) for admins/owners (`GOTRUE_MFA_TOTP_ENROLL_ENABLED=true` + UI).
3. Rate limits are in memory per replica; move them to the gateway or Redis if `functions` scales out.
4. Lint debt: `react-hooks/set-state-in-effect` in ported pages (CI reports it but does not block).
5. Run a full penetration test on staging once deployed.
