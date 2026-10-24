# Metallurgy Lab — Image Analysis SaaS (Railway)

Multi-tenant metallography analysis platform. Same stack and layout as QIRLPL LIMS:
React + Vite frontend, and a backend that runs **only on Railway** (API gateway, Auth, PostgREST,
Storage, Postgres, functions, PDF). It does not use Supabase Cloud; the browser uses `supabase-js`
against the Railway API gateway.

- Browser webcam capture + image upload, canvas editor and annotations (Capture Studio)
- Deterministic OpenCV analysis (primary): Grain Size (ISO 643), Inclusion (ISO 4967), Decarb (ISO 3887), Micro, Macro (IS 10138)
- Vision AI advisory cross-check (DeepSeek / OpenAI, key stored per lab on the server)
- Ring Test (IS 1786:2008 TMT rib measurement) with certificates
- Periodic table with metallurgy notes
- Roles per lab: owner / admin / reviewer / analyst / viewer (enforced by Postgres RLS)

## Project Structure

```
Metallurgy Software/
├── frontend/                 # React 19 + TypeScript + Vite 7 + Tailwind 3 + shadcn/Radix
└── backend/
    ├── supabase/migrations/  # SQL migrations (+ supabase/tests: RLS tests on PGlite)
    ├── gateway/              # Caddy API gateway
    ├── functions/            # Node 22: register, members, OpenCV.js analysis, AI
    ├── pdf-service/          # Playwright HTML → PDF
    ├── backup-job/           # Nightly Postgres + files backup (Railway cron)
    └── scripts/
standards/                    # Local standards PDFs (not for redistribution)
docs/REBUILD_PLAN.md          # Feature inventory and migration notes from the old Next.js/FastAPI app
docs/SECURITY.md              # Security & safety baseline, required GoTrue settings, known gaps
docs/OPERATIONS.md            # Releases, health checks, backups/restore, incidents, next steps
```

Railway services and setup order: see [backend/README.md](backend/README.md).

## Local Setup

1. `npm install --prefix frontend`
2. Copy `frontend/.env.example` to `frontend/.env` and set the Railway values:
   - `VITE_SUPABASE_URL` = Railway API gateway URL
   - `VITE_SUPABASE_ANON_KEY` = Railway anon JWT
   - `VITE_PDF_SERVICE_URL` = Railway PDF service
3. `npm run dev`

Optional local services: `npm run functions:dev`, `npm run pdf:install && npm run pdf:dev`.

## Notes

- Never commit `.env` files.
- Do not run `supabase link`, `supabase db push`, or `vercel` against this repo.
- Schema changes: add SQL under `backend/supabase/migrations/` and apply on Railway Postgres.
