# Metallurgy Lab — QIRLPL LIMS स्टैक पर दोबारा बनाने का प्लान

स्थिति: **नया स्टैक बना, पुराना `apps/` हटाया गया** · तारीख: 2026-10-24 · बाकी: Railway पर deploy और end-to-end टेस्ट

यह दस्तावेज़ दो हिस्सों में है:
1. **मौजूदा ऐप क्या-क्या करती है** (पूरी फंक्शनैलिटी की सूची, ताकि नई ऐप में कुछ छूटे नहीं)
2. **नई ऐप कैसे बनेगी** (QIRLPL LIMS वाला स्टैक, पूरा बैकएंड Railway पर)

---

## भाग 1 — मौजूदा ऐप की फंक्शनैलिटी

### 1.1 अभी का स्टैक (जो हटेगा)

| हिस्सा | अभी | लाइनें |
|---|---|---|
| `apps/web` | Next.js 15 + React 19 + Tailwind 4 | ~14.5k |
| `apps/api` | FastAPI + SQLAlchemy + OpenCV + reportlab, JWT (python-jose) | ~2.3k |
| `apps/worker` | Redis/RQ वर्कर — **कभी इस्तेमाल नहीं होता** (कोई job enqueue नहीं करता) | 24 |
| `apps/desktop` | Electron कैमरा ब्रिज (अलग ऐप, API URL/JWT हाथ से पेस्ट) | छोटा |
| `packages/shared` | TS types | छोटा |

### 1.2 मॉड्यूल और स्क्रीनें

**सार्वजनिक**
- `/` लैंडिंग पेज (Metallurgy Lab, 3 फ़ीचर कार्ड)
- `/login` — ईमेल + पासवर्ड
- `/register` — Full Name, Lab Name, Email, Password (≥8)। रजिस्टर करने वाला नए lab/org का **Owner** बनता है।

**ऐप शेल** — डार्क साइडबार (collapse, localStorage में याद), टॉप बार में org नाम, प्रोफ़ाइल मेन्यू:
Laboratory Setting, User Management, Roles & Module Access, AI Setting (सिर्फ़ owner/admin), Contact Us, Help, Sign Out।
नेविगेशन: Dashboard · Capture Studio · Calibration · Analysis & Jobs · Ring Test · Periodic Table।

**Dashboard** — Samples, Total Jobs, Completed, Pending; हर analysis type के jobs की गिनती।

**Capture Studio** (~1.3k लाइन)
- वेबकैम (`getUserMedia`) से फ़्रेम कैप्चर या इमेज अपलोड
- इमेज एडिटर: brightness/contrast/saturation, black/white levels, rotate/flip, grayscale, invert, zoom 50–400%, pan, crop
- एनोटेशन: pencil, highlighter, eraser, text, line, arrow, rectangle, ellipse, diamond, fill, marker, eyedropper; undo/redo (40)
- Calibration मॉडल (पुरानी चुनें / नई बनाएँ), Sample मॉडल (पुराना चुनें / नया बनाएँ), Analysis Module चुनें
- Run Analysis → sample बनाओ → इमेज अपलोड → job → job detail पर जाओ

**Calibration** — नाम, objective, µm/px X और Y, unit, notes। सूची + नया।

**Analysis & Jobs**
- 5 मॉड्यूल: Grain Size (ISO 643:2019), Inclusion (ISO 4967:1998), Decarb (ISO 3887:2017), Micro, Macro (IS 10138:2010)
- Jobs सूची: search, module/status/AI-agreement फ़िल्टर, Open, Delete
- Job detail: source इमेज + overlay, Software Result (primary), AI Result (advisory), Comparison deltas, PDF रिपोर्ट डाउनलोड, AI दोबारा चलाएँ, Approve/Reject

**Software analysis (OpenCV)** — हर एल्गोरिदम, पैरामीटर और फ़ॉर्मूला नोट कर लिया गया है:
- Grain: Gaussian 5×5 → CLAHE(2.0, 8×8) → Canny(40,120) → dilate; 7+7 test lines पर intercept; **G = −6.6457·log10(L_mm) − 3.298**; planimetric **G = log2(N_A) + 1**
- Inclusion: Otsu inverse → open → contours; aspect/length से type A/B/C/D/DS; severity = min(5, ⌊L/25⌋+1)
- Decarb: बाएँ किनारे से column-mean profile → smoothing → gradient argmax → depth
- Micro: Otsu से light/dark phase fraction
- Macro: Otsu inverse → contours, ≥1 mm stringers

**AI cross-check** — DeepSeek या OpenAI (OpenAI-compatible API), vision → फेल हो तो text fallback → फिर "unavailable"; agreement high/medium/low (औसत relative diff < 15% / < 40%)। हर lab की अपनी key; न हो तो सर्वर की `OPENAI_API_KEY`।

**PDF रिपोर्ट** — org नाम, sample, software metrics तालिका, AI observations, comparison, disclaimer। (अभी इसमें lab logo/header/footer और इमेज **नहीं** आते।)

**Admin / Settings**
- Laboratory Setting: company name (org का नाम भी बदलता है), GST, contact person, mobile, email, address, PIN, city, state, country; logo/header/footer/watermark अपलोड
- User Management: सदस्य सूची, नया employee (नाम, ईमेल, temp password, role)
- Roles: owner > admin > reviewer > analyst > viewer (क्रमानुसार)
- AI Setting: provider, model, API key (सिर्फ़ hint दिखता है), key हटाएँ

**Ring Test — IS 1786:2008** (~5k लाइन, पूरा client-side)
- Sample info → इमेज (अपलोड/कैमरा) → mm/px कैलिब्रेशन लाइन → Inner/Outer ring (auto-detect + circle/polygon एडिटिंग) → diameter lines → t1–t8 thickness (45° के अंतर पर)
- PASS = हर thickness 0.07d–0.15d **और** TM area 30–50%
- इमेज adjust, auto enhance, sharpen, crop; draft sessionStorage में
- Save (operator, observation, annotated इमेज) → Reports सूची → Certificate (print/PDF)
- Settings (mm/px override, angular correction, gaps, रंग) — सिर्फ़ localStorage में

**Periodic Table** — सभी 118 तत्व (हर तत्व का metallurgy note), तापमान स्लाइडर (−273…6000 °C) से phase, category फ़िल्टर, search, spotlight, element detail पेज।

### 1.3 अधूरे / बेकार हिस्से (नई ऐप में फ़ैसला चाहिए)
- Redis/RQ worker (इस्तेमाल नहीं होता) → **हटेगा**
- `/api/ai/analyze-ring` (Ring Test AI) — endpoint कहीं नहीं बना, बटन हमेशा बंद
- Org switcher का UI नहीं; jobs की "Edit" लिंक कुछ नहीं करती; bulk checkbox का कोई action नहीं
- Calibration/sample edit-delete नहीं; member का role बदलना/हटाना नहीं; पासवर्ड रीसेट नहीं
- `audit_logs` टेबल बनी है पर कभी लिखी नहीं जाती

### 1.4 मौजूदा सुरक्षा कमियाँ (नई ऐप में अपने-आप ठीक होंगी)
- `/files/*` बिना लॉगिन के खुला है → नई ऐप में private bucket + signed URL
- AI keys plaintext में, API से पढ़ी जा सकती हैं → नई ऐप में `api_key` कॉलम पर SELECT revoke
- Admin किसी को owner बना सकता है; दूसरे lab का calibration ID इस्तेमाल हो सकता है; login में `is_active` चेक नहीं; CORS `*`
- UI में role के हिसाब से कुछ नहीं छिपता (सिर्फ़ admin मेन्यू)

---

## भाग 2 — नई ऐप (QIRLPL LIMS स्टैक)

### 2.1 फ़ोल्डर स्ट्रक्चर (LIMS जैसा)

```
Metallurgy Software/
├── frontend/                 React 19 + TypeScript + Vite 7
├── backend/
│   ├── supabase/migrations/  SQL migrations (YYYYMMDDHHMMSS_name.sql), psql से Railway Postgres पर
│   ├── gateway/              Caddy API gateway (/auth/v1, /rest/v1, /storage/v1, /functions/v1)
│   ├── functions/            Node 22 सर्विस (register, users, analysis, AI)
│   ├── pdf-service/          Playwright HTML → PDF
│   └── scripts/              refuse-hosted-cloud.cjs, seed, data-migration
├── desktop/                  Electron कैमरा ब्रिज (नए auth/API पर अपडेट)
├── standards/                (जैसा है)
├── package.json              root proxy scripts (dev, build, typecheck, lint, pdf:dev)
└── README.md
```

`apps/`, `packages/`, `railway.toml` पूरी तरह हटेंगे।

### 2.2 Railway सर्विसेज़ (LIMS जैसी)

| सर्विस | इमेज / सोर्स | पोर्ट | पब्लिक |
|---|---|---|---|
| `frontend` | repo `frontend/`, RAILPACK static SPA (`dist`) | – | हाँ |
| `api` | Caddy `caddy:2.10-alpine` (`backend/gateway`) | 80 | हाँ (API डोमेन) |
| `auth` | `supabase/gotrue:v2.174.0` | 9999 | नहीं |
| `rest` | `postgrest/postgrest:v12.2.12` | 3000 | नहीं |
| `storage-api` | `supabase/storage-api:v1.24.7` → Railway Bucket | 8080 | नहीं |
| `Postgres` | `postgres-ssl:18` + volume | 5432 | TCP proxy |
| Bucket | Railway S3 bucket (मौजूदा `metallurgy-media` या नया) | – | – |
| `functions` | Node 22 (`backend/functions`) | 8080 | नहीं |
| `pdf-service` | Playwright (`backend/pdf-service`) | – | हाँ |

एक ही HS256 `JWT_SECRET` auth/rest/storage पर; `ANON_KEY` (frontend) और `SERVICE_ROLE_KEY` (functions, storage) उसी से साइन। MinIO, Redis और worker **नहीं** चाहिए।

### 2.3 फ्रंटएंड — dependencies बिल्कुल LIMS वाली

React 19, react-router-dom 7, @tanstack/react-query 5, @supabase/supabase-js 2 (Railway API URL के साथ), Tailwind 3 + tailwindcss-animate, shadcn/Radix (dialog, dropdown-menu, label, scroll-area, select, separator, slot, tabs, tooltip), sonner, lucide-react, cva, clsx, tailwind-merge; dev: Vite 7, TS ~5.9 strict, ESLint 9 flat config।
Metallurgy के लिए जोड़ना ज़रूरी: कुछ नहीं (canvas एडिटर, ring detection, periodic table सब plain TS है)।

कोड पैटर्न (`.cursorrules` के अनुसार):
- `src/main.tsx` provider क्रम: QueryClient → Theme → AuthProvider → OrgProvider/ModuleAccess → App + Toaster
- `src/routes/routeElements.tsx` में lazy pages, `RequireAuth`, `RequireRole` गार्ड
- `src/components/layout/GlobalLayout.tsx` + `src/lib/appNav.ts` (nav tree data)
- `src/features/<module>/` में `*Page`, `*MasterPage`, `*HeaderBar`, `*Table`, `*Form`, `*FooterBar`, `*Api.ts`, `types.ts`
- `src/components/ui` shadcn सेट, `src/lib/supabaseClient.ts`, `formatSupabaseError.ts`
- फ़ीचर फ़ोल्डर: `auth`, `public-site`, `dashboard`, `capture`, `calibrations`, `analysis` (jobs + job detail), `ring-test`, `periodic-table`, `settings` (lab, users, roles, ai), `help`

थीम: मौजूदा Metallurgy रंग (teal accent, डार्क साइडबार, square corners) LIMS वाले HSL token सिस्टम में; Ring Test का डार्क sub-theme बना रहेगा।

### 2.4 डेटाबेस (Postgres + RLS)

Metallurgy एक **multi-tenant SaaS** है (कई lab), जबकि LIMS single-lab है। इसलिए org-स्कोपिंग RLS से होगी:

- `organizations` (name, slug, accent) · `lab_settings` (org_id, company fields, asset paths)
- `user_profiles` (id → auth.users, full_name, email, status) — `handle_new_user()` trigger से
- `memberships` (user_id, org_id, role enum owner/admin/reviewer/analyst/viewer)
- `calibrations`, `samples`, `analysis_jobs` (+ reviewed_by, review_notes, reviewed_at), `ring_tests`, `ring_test_settings` (org-स्तर पर, अब localStorage नहीं)
- `ai_settings` (org_id, provider, model, `api_key` — authenticated के लिए SELECT revoke, `has_api_key` generated column)
- `audit_log` + `write_audit_log()` trigger (LIMS जैसा)

SQL helpers (SECURITY DEFINER, LIMS पैटर्न): `app_org_role(org_id)`, `app_has_org_role(org_id, min_role)`।
हर टेबल पर policy: पढ़ना = सदस्य (viewer+), लिखना = analyst+, review = reviewer+, settings/members = admin+। Role बढ़ाने से रोक (admin owner नहीं बना सकता)।
Storage buckets (private): `job-images`, `job-overlays`, `lab-branding`, `ring-test-images` — path `<org_id>/<uuid>.<ext>`, policy में org_id चेक। इमेज signed URL से।

### 2.5 functions सर्विस (Node 22) — routes

| Route | काम |
|---|---|
| `POST /register` | (बिना लॉगिन) GoTrue admin API से user + org + owner membership। GoTrue में public signup बंद रहेगा, LIMS जैसा। |
| `POST /create-user`, `/update-member`, `/remove-member`, `/reset-password` | admin+ के लिए सदस्य प्रबंधन |
| `POST /analyze-job` | storage से इमेज → OpenCV analysis → overlay storage में → AI → `analysis_jobs` अपडेट |
| `POST /rerun-ai` | सिर्फ़ AI + comparison दोबारा |
| `GET /health` | – |

AI calls और keys सिर्फ़ इसी सर्विस में (service-role key से `ai_settings` पढ़ती है), LIMS के qi-assistant जैसा। DeepSeek/OpenAI prompts, model-swap नियम, fallback chain और agreement सीमाएँ हूबहू।

### 2.6 OpenCV analysis कहाँ चलेगा (मुख्य तकनीकी फ़ैसला)

LIMS में Python नहीं है। सुझाव: **functions सर्विस (Node) में OpenCV.js (WASM, `@techstark/opencv-js`) + `sharp`** (इमेज decode/encode)। सभी इस्तेमाल होने वाले ऑपरेशन (GaussianBlur, CLAHE, Canny, dilate/morphology, Otsu, findContours, connectedComponents, drawing) OpenCV.js में मौजूद हैं, कोड लगभग लाइन-दर-लाइन port होगा।
- सुरक्षा: पुराने Python और नए Node आउटपुट को कुछ नमूना इमेजों पर मिलाकर parity test होगा। मिलान होने तक पुराना कोड नहीं हटेगा।
- विकल्प (अगर parity न मिले): एक छोटी Python `analysis-service` सिर्फ़ गणना के लिए, functions उसे अंदर से बुलाए।

### 2.7 PDF

reportlab हटेगा; Job रिपोर्ट और Ring Test certificate दोनों HTML (frontend में `build*Html.ts`) → `pdf-service` (Playwright)। इसमें lab logo, header, footer, watermark, source/overlay इमेज और review status जुड़ेंगे (अभी नहीं आते)।

### 2.8 Desktop ब्रिज

`desktop/` में रहेगा; JWT/API URL पेस्ट करने के बजाय नए auth से लॉगिन करके storage में अपलोड + `/functions/v1/analyze-job`।

---

## भाग 3 — काम के चरण

| # | चरण | नतीजा |
|---|---|---|
| 0 | नया स्टैक पुराने के साथ बनना शुरू, पुराना कोड अभी नहीं हटेगा | – |
| 1 | `frontend/` scaffold (Vite, tsconfig, Tailwind, shadcn, ESLint, थीम, layout, routing) | खाली शेल चलता है |
| 2 | `backend/`: gateway, functions skeleton, pdf-service, baseline migration (tables, RLS, buckets) | लोकल/स्टेजिंग पर स्टैक |
| 3 | Auth: login, register (org), RequireAuth, org/role context, user management | लॉगिन से डैशबोर्ड |
| 4 | Calibrations, Samples, Capture Studio (पूरा एडिटर port) | इमेज अपलोड |
| 5 | Analysis engine port (OpenCV.js) + parity tests + AI + comparison | Jobs बनते हैं |
| 6 | Jobs सूची/detail, review, PDF रिपोर्ट | पूरा analysis flow |
| 7 | Ring Test (editor, detection, save, reports, certificate PDF, settings DB में) | – |
| 8 | Periodic Table, Lab/AI settings, Help/Contact, लैंडिंग | सारे फ़ीचर |
| 9 | Railway पर नई सर्विसेज़ deploy, पुराना डेटा migrate (bcrypt hash GoTrue में सीधे जा सकते हैं) | – |
| 10 | जाँच के बाद `apps/`, `packages/`, `railway.toml` डिलीट, README अपडेट | पुराना स्टैक ख़त्म |

## फ़ैसले (2026-10-24)
1. **Multi-tenant** — हर lab ख़ुद रजिस्टर करे, org_id + RLS से अलगाव।
2. **नई शुरुआत** — पुराना डेटा migrate नहीं होगा (चरण 9 में सिर्फ़ deploy)।
3. **OpenCV Node functions में** — OpenCV.js (WASM) + sharp, Python नहीं; parity test ज़रूरी।
4. **अधूरे हिस्से पूरे बनेंगे** — Ring Test AI (functions `/analyze-ring`), org switcher, calibration/sample/member edit-delete, password reset, jobs bulk delete, job edit।

## अभी खुला
- Railway: इसी Metallurgy प्रोजेक्ट में नई सर्विसेज़; API डोमेन — deploy के समय तय होगा।
