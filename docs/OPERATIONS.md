# Operations Runbook

## Environments

| | Railway environment | Purpose |
|---|---|---|
| staging | `staging` | Every merge to `main` is tested here first. Own `JWT_SECRET`, DB and buckets. |
| production | `production` | Promote only after staging checks pass. |

## Release checklist

1. CI is green on the PR (frontend, database, functions, pdf-service, gateway).
2. Merge → staging deploys.
3. Migrations, if any:
   ```bash
   DATABASE_URL=<staging> npm run db:migrate --prefix backend -- --dry-run
   DATABASE_URL=<staging> npm run db:migrate --prefix backend
   ```
4. Smoke test on staging: sign in → capture/upload → run each module → review → PDF → Ring Test save → certificate PDF.
5. Check `GET https://<api>/functions/v1/ready` returns `{"ok":true}`.
6. Repeat 3–5 on production.

Never edit an applied migration — the runner refuses files whose checksum changed. Add a new file instead.

## Health checks

| Service | Liveness | Readiness |
|---|---|---|
| api (Caddy) | `GET /health` | — |
| functions | `GET /health` | `GET /ready` (REST, Auth, OpenCV) |
| pdf-service | `GET /health` | — |
| frontend | `GET /health` (when served by `server.mjs`) | — |

## Logs

`functions` writes one JSON line per request: `{t, id, route, status, ms}`. Every response carries `X-Request-Id`; users see `request_id` in error replies. Search Railway logs by that id.

## Tuning (functions variables)

| Variable | Default | Meaning |
|---|---|---|
| `ANALYSIS_CONCURRENCY` | 2 | OpenCV jobs at once per replica (≈ 300–600 MB RAM each for large images) |
| `ANALYSIS_QUEUE` | 20 | Waiting jobs before 503 |
| `MAX_IMAGE_PIXELS` | 50000000 | Larger images are rejected |
| `UPSTREAM_TIMEOUT_MS` | 20000 | REST / Auth call timeout |
| `STALE_PROCESSING_MS` | 600000 | After this, a stuck "processing" job may be re-run |

## Backups

`backend/backup-job` runs nightly at 02:00 IST (Railway cron `30 20 * * *`):
- `db/<timestamp>.dump` — `pg_dump -Fc`, kept 30 days (`BACKUP_RETENTION_DAYS`)
- `files/…` — copy of the media bucket (never deletes)

Also enable Railway's own Postgres volume backups.

**Check the schedule is really set.** Deploying with `railway up <dir> --path-as-root` used the Dockerfile from
`railway.json` but did **not** apply its `cronSchedule`; the job ran once at deploy and had no schedule. Set it on the
service and confirm `nextCronRunAt`:

```bash
railway environment edit -e <env> --json <<'JSON'
{"services":{"<backup-job-service-id>":{"deploy":{"cronSchedule":"30 20 * * *","restartPolicyType":"NEVER"}}}}
JSON
```

Run it on demand (e.g. before a risky migration) with the GraphQL mutation
`deploymentInstanceExecutionCreate(input: { serviceInstanceId })`.

### Restore (practice this on staging every quarter)

```bash
rclone copyto backup:<bucket>/db/<timestamp>.dump ./db.dump
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" ./db.dump
rclone copy backup:<bucket>/files source:<media-bucket>
```
Then restart `rest` (or `NOTIFY pgrst, 'reload schema';`) and run the smoke test.

## Sleeping services (staging)

Public services (frontend, gateway, pdf-service) and functions may sleep — the Railway edge holds the first public
request while they wake, the gateway retries a waking upstream for 30 s (`lb_try_duration`), and functions retry
network errors to its dependencies. Keep **auth, rest and storage-api always on**: an upload sent to a sleeping
storage-api over the private network was lost during staging tests. Production: no sleeping.

## Incidents

| Symptom | Check |
|---|---|
| Everyone gets 401 | `JWT_SECRET` differs between auth / rest / storage-api, or anon key re-signed but frontend not rebuilt |
| "Server is busy" (503) | Raise `ANALYSIS_CONCURRENCY` or add a replica; check RAM |
| Analysis "failed" with image error | Image over `MAX_IMAGE_PIXELS` or unreadable format |
| PDF download fails | `pdf-service` health; `PDF_ALLOWED_ORIGINS` includes the frontend domain |
| Job stuck "processing" | Redeploy interrupted it; it can be re-run after 10 min |
| CORS errors | `FRONTEND_ORIGIN` on the `api` service |

## Next steps (suggested order)

1. **Deploy staging** on Railway following `backend/README.md`; run the smoke test end to end.
2. **Fix the Ring Test 590×590 resize** (keep aspect ratio) and confirm results on known specimens.
3. **Validate analysis accuracy** with real etched specimens per module against a qualified metallurgist (software parity with the old app is already proven).
4. **Monitoring**: uptime check on `/functions/v1/ready` + Railway alerts on restarts and memory.
5. **MFA** for admins and owners.
6. **Background jobs** if analyses get slow: return immediately and poll status, instead of holding the request.
7. **Desktop camera bridge**: rebuild against the new auth + storage when a microscope SDK is needed.
