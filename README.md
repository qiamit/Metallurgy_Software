# Metallurgy Lab — Image Analysis SaaS

Multi-tenant metallography analysis platform with:

- Browser USB webcam capture + image upload
- Deterministic OpenCV software analysis (primary)
- Vision AI advisory comparison
- RBAC (owner / admin / analyst / reviewer / viewer)
- Modules: Grain Size (ISO 643), Inclusion (ISO 4967), Decarb (ISO 3887), Micro, Macro (IS 10138)
- Phase 3 Electron camera bridge for proprietary SDKs

## Monorepo

```
apps/web       Next.js SaaS UI
apps/api       FastAPI + OpenCV analysis
apps/worker    Redis/RQ worker entrypoint
apps/desktop   Electron local camera bridge
packages/shared  Shared TypeScript types
standards/     Local standards PDFs (not for public redistribution)
```

## Local development

### API

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Web

```bash
cd apps/web
npm install
set NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
npm run dev
```

Open http://localhost:3000 — register a lab workspace, add calibration, capture/upload, run analysis.

### Desktop bridge (Phase 3)

```bash
cd apps/desktop
npm install
npm start
```

## Railway

Project ID: `5e1af02b-8472-4588-914b-a275620f937a`

Services: `web`, `api`, `worker`, `Postgres`, `Redis`, bucket `metallurgy-media`.

## Product rule

**Software analysis is primary (standards-oriented). AI is advisory only.**
