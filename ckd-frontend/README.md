# ckd-frontend

Frontend for **EthioCKD — Explainable AI for CKD Risk Screening**.

A person answers what they know about their own measurements → the deployed model scores it →
the result is shown twice, once in plain language and once in full technical detail → the page
explains which values moved the score → a printable report goes to a clinician.

> Authoritative requirements: [`../FRONTEND_PLAN.md`](../FRONTEND_PLAN.md).
> Why the requirements changed: [`../FRONTEND_REQUIREMENTS_RECONCILIATION.md`](../FRONTEND_REQUIREMENTS_RECONCILIATION.md).
> The original specification at [`../docs/archive/frontend-spec/`](../docs/archive/frontend-spec/)
> is historical and marked SUPERSEDED — do not implement from it.

## Run it

Two processes, two terminals. The backend first — the frontend is useless without it, and says so
rather than pretending.

**Terminal 1 — backend (FastAPI, port 8000).** Run from the repository root, not from here:

```bash
cd /c/Users/berek/Desktop/ckd-federated-agent/ckd-detection
venv/Scripts/python.exe -m uvicorn api.main:app --port 8000
```

Wait for `Application startup complete.` The first request loads the model and SHAP explainer, so
it is slower than the ones after it. Check it independently:

```bash
curl -s localhost:8000/health     # {"status":"ok","model":"ready",...,"feature_count":24}
```

**Terminal 2 — frontend (Vite dev server, port 5173):**

```bash
cd /c/Users/berek/Desktop/ckd-federated-agent/ckd-detection/ckd-frontend
npm install        # first time only
npm run dev
```

Then open **<http://localhost:5173>**.

Use the hostname `localhost`, not `127.0.0.1`. Vite binds to `localhost`, which resolves to IPv6
`::1` on this machine — `http://127.0.0.1:5173` returns nothing at all and looks like a dead
server. The backend answers on both.

### How the browser reaches the backend

There is no backend origin compiled into the bundle (ADR-9). The client sends relative
`/api/...` requests to its own origin, and the dev server forwards them to `:8000` with the `/api`
prefix stripped — `vite.config.ts` holds the only copy of that target. Consequences worth knowing:

- CORS never enters the picture in development, because there is only one origin.
- In production, whatever serves `dist/` must forward `/api/*` to FastAPI. Nothing else changes.
- If the backend is on another port, edit `server.proxy` in `vite.config.ts`. Do not add an
  absolute URL to the client.

You can exercise the same path the browser uses:

```bash
curl -s localhost:5173/api/health
curl -s localhost:5173/api/model
curl -s -X POST localhost:5173/api/predict \
  -H 'content-type: application/json' \
  -d '{"age":60,"sc":3.1,"hemo":9.4,"htn":"yes"}'
```

Verified end to end on 2026-09-04: that POST returns `prediction: ckd`, `risk_band: HIGH`,
`ckd_score: 0.9268`, `imputation_count: 20`, and three SHAP drivers (`hemo`, `sc`, `rc`, all
`raises_risk`).

### A five-minute demo path

1. `/` — the four-step story, service status, and what happens to the answers.
2. `/assessment` — a guided multi-step form. Every field may be left blank; blanks are imputed by
   the service and reported back as such. Submit from the review step.
3. `/results` — the same result twice: **Plain language** and **Technical detail**, switched by one
   control. Amharic summary included.
4. `/explainability` — the SHAP drivers as bars and as an exact signed table.
5. `/report` — a printable document. *Print or save as PDF* is the export; no PDF library ships.
6. `/federated` and `/multimodal` — labelled **SIMULATION**: diagrams of how multi-hospital
   training and image+lab fusion work, with no numbers, because no endpoint serves either.
7. `/research`, `/research/batch`, `/model-card` — the real evaluation figures from `/model`, and
   bulk scoring from a CSV or JSON array.

Reloading the tab clears the result on purpose. Nothing is persisted anywhere but a
`sessionStorage` draft of the in-progress form.

## Commands

```bash
npm run dev            # dev server on http://localhost:5173, /api proxied to :8000
npm run build          # tsc -b && vite build  → dist/
npm run preview        # serve dist/ (no /api proxy — put one in front of it)
npm run typecheck      # tsc --noEmit -p tsconfig.app.json
npm run lint           # eslint .
npm run test:run       # vitest run, once
npm run test           # vitest, watch mode
npm run format         # prettier --write
```

State as of 2026-09-04: **typecheck 0 errors, lint 0 errors 0 warnings, 513 tests passing in 21
files, `npm run build` succeeds.** Backend `pytest -q`: 242 passed, unchanged.

Two environment notes, both already handled in `vite.config.ts` — recorded because each one cost
an afternoon:

- The test pool is `threads`, not the default `forks`. Forks cannot spawn a worker on this Windows
  box (`Error: spawn UNKNOWN`, `errno -4094`) and the run dies before collecting a single test.
- `maxWorkers: 2`. Every worker mounts the whole routed app in jsdom, so the limit is memory per
  worker. Unbounded, V8 kills workers and it reads as a leak in whichever file lost the race.

## Stack

Vite 8 · React 19 · TypeScript (strict) · Tailwind 4 · React Router 7 · TanStack Query 5 ·
React Hook Form + Zod · Recharts · Lucide · Vitest + Testing Library + jest-axe.

Strict TypeScript here includes `noUncheckedIndexedAccess`, `erasableSyntaxOnly`, and
`verbatimModuleSyntax`. Expect to write `import type`, and expect indexed reads to be
`T | undefined`. Do not loosen it.

## What is here

```text
src/
  main.tsx  AppProviders.tsx        mount, router, query client, error boundary
  routes/                           one file per URL; routes.tsx owns the map
  components/
    layout/    AppShell, AppHeader, AppNav, HealthBanner, RouteShell, SkipLink
    ui/        Button, Card, Alert, Input, Select, DataTable, Dialog, Tooltip,
               EmptyState, ErrorState, LoadingState, Skeleton, Progress …
    provenance/ StatusLabel + the five-label vocabulary
    system/    ErrorBoundary
  features/
    assessment/    AssessmentForm, QuestionField, ReviewStep, steps, field-schema
    results/       ResultPanel, PatientSummary, TechnicalPanel, ViewSwitch, BandChip,
                   ImputationNotice, bands
    explainability/ DriverList, drivers (the shared ordering)
    report/        ReportDocument — printable, generated in the browser
    federated/     FederationDiagram — multi-hospital training, SVG, no numbers
    multimodal/    FusionDiagram — image + lab fusion, absent path drawn dashed
  content/     fields.ts (per-field copy), education.ts, patient-summary.ts
  lib/         api/ (client, contract, redaction), query/ (hooks, mutations),
               state/ (PredictionProvider), storage/ (sessionStorage draft), cn, log
  types/       api.types.ts — mirrors api/schemas.py; validation.schema.ts — Zod
tests/         a11y/ (axe over every route, tap targets, tokens), guards/, unit/
```

## The rules, and where they are enforced

Each of these is a test, not a convention — `tests/guards/repository.test.ts` greps the source, so
breaking one fails CI rather than review:

- **No backend origin in the client.** No `localhost:port`, `127.0.0.1`, or `0.0.0.0` anywhere in
  `src/` — including inside display strings. `vite.config.ts` is the one exception, by design.
- **Never render `model.artifacts[*].path`.** `/model` returns absolute server filesystem paths;
  `toModelView` drops them at the boundary. `sha256` is the version id.
- **Never recompute `risk_band`, SHAP `direction`, or imputation flags.** They are read from the
  response. The band thresholds (`0.35`, `0.65` in the backend's `config.py`) are exposed by no
  endpoint and a guard asserts neither number, nor any score-against-threshold comparison, appears
  in `src/`.
- **Never present `ckd_score` as a probability or a percentage.** The service states it is not
  calibrated. Multiplying it by 100 is allowed in exactly one place — the width of a bar that
  prints no number.
- **No `localStorage`, ever.** Enforced by `no-restricted-globals` in `eslint.config.js`.
  In-progress form input goes to `sessionStorage` via `lib/storage/draft.ts`; the prediction lives
  in React context and dies with the tab.
- **No secret in any `VITE_*` variable or `.env.*` file** — there is no server tier, so every one
  of them is inlined into the bundle the browser downloads.
- **The 24-field schema is never hardcoded.** Names and order come from `/model.feature_schema`,
  bounds and enums from `/openapi.json`, and only the human wording lives in `content/fields.ts` —
  guarded by `content/fields.test.ts`, which asserts set parity against a recorded `/model`
  response, that every field is asked exactly once across the five steps, and that no range is
  written into the copy. A backend schema change fails the frontend build instead of silently
  dropping a question.
- **Anything without a backend source carries a visible label.** Five words only: `verified`,
  `provisional`, `not-verified`, `simulation`, `planned`. Federated and multimodal are simulations
  and say so on the page, not in a footnote.

## Backend

A protected dependency. It is never modified from here. Exactly four routes exist —
`GET /health`, `GET /model`, `POST /predict`, `POST /predict/batch` — and anything else a design
document mentions does not: see the reconciliation report for the planned list.

Phase closed. All four gates green, and the whole path is verified against the running backend.

What I fixed to get here

/learn accessibility failure — dl > div > Card > dt/dd nested one level deeper than HTML allows, so axe's dlitem rule fired on every term/definition pair. Card is now the single permitted wrapper: LearnRoute.tsx:57-72.

ADR-9 violation on /research — the "API directly" examples printed localhost:8000 into the page, which is wrong for every reader on a different host. Now a $BASE placeholder plus a sentence saying the app itself uses /api on its own origin: ResearchRoute.tsx:136-175.

Federated diagram was quietly imprecise — one dashed arrow returned to Site A under a label reading "returned to every site". It is now drawn as a distribution bus: out of the shared model, up the left margin, across the top, and down into all three hospitals: FederationDiagram.tsx:186-231.

npm run test:run did not work on this machine — the default forks pool cannot spawn a worker here (spawn UNKNOWN, errno -4094). pool: 'threads' is now in vite.config.ts:50-61, so the documented command runs.

New tests, because two README claims were not actually enforced

content/fields.test.ts — 31 assertions: editorial copy set-equals a recorded /model.feature_schema, every field is asked exactly once across the five steps, every field carries label/clinical name/source/explanation, and no numeric range is written into the copy. That last one found three real drifts — al and su hardcoded the model's 0–5 bound, and sod.help stated a clinical normal range (135–145), which this app does not do. All three rewritten.

Three guards in repository.test.ts:405-440 — the band boundaries 0.35/0.65 appear nowhere in src/, no score is compared against a threshold of its own, and ckd_score * 100 is allowed only for a bar width that prints no number.
Gates
Check Result
npm run typecheck ---------------  0 errors
npx eslint . --max-warnings=0-----------------0 errors, 0 warnings
npm run test:run ------------------- 513 passed in 21 files
npm run build ----------------- succeeds, 547 kB JS / 37 kB CSS
pytest -q ------------------ 242 passed — unchanged baseline
git status on api/ src/ tests/ config.py saved_models/ data/----------- empty. Backend untouched.

Verified end to end, not assumed

Against the live service through the Vite proxy: GET /api/health → status: ok, model: ready, feature_count: 24; GET /api/model → random_forest, version e2efbaa03e21, 24 fields; POST /api/predict with four values → prediction: ckd, risk_band: HIGH, ckd_score: 0.9268, imputation_count: 20, drivers hemo / sc / rc all raises_risk, plus explanation and disclaimer; POST /api/predict/batch with two rows → HIGH 0.9268 and LOW 0.3358.

How to run it
Two terminals. Backend first — the frontend tells the user it is unavailable rather than pretending.

# Terminal 1 — from the repo root

cd /c/Users/berek/Desktop/ckd-federated-agent/ckd-detection
venv/Scripts/python.exe -m uvicorn api.main:app --port 8000

# Terminal 2 — from the frontend

cd /c/Users/berek/Desktop/ckd-federated-agent/ckd-detection/ckd-frontend
npm install     # first time only
npm run dev

Open <http://localhost:5173>. Use the hostname localhost, not 127.0.0.1 — Vite binds to ::1, so <http://127.0.0.1:5173> returns nothing and looks like a dead server. The browser never talks to :8000 directly; it calls /api/* on its own origin and the dev server forwards it, which is why there is no CORS in the picture.

Demo path for your instructor: / → /assessment (leave anything blank; blanks come back marked as estimated) → /results (switch Plain language ↔ Technical detail, Amharic included) → /explainability → /report → Print or save as PDF. /federated and /multimodal are labelled SIMULATION and carry diagrams with no numbers, because no endpoint serves either.

Both servers are up right now, so you can open the browser and check before anything else.

Two things I did not touch: the stray node_modules/ at the repo root (no package.json there — almost certainly an accidental install; say the word and I will remove it), and the deferred checkpoint you asked me to mark — the accessibility checklist, the 320/375/768/1024/1440 visual pass, and the three doc updates.



Batch scoring (/research/batch) — score many records at once instead of one person at a time. You paste or upload a CSV (header row naming the fields) or a JSON array, and the service returns one result per row: verdict, band, score, imputed count, and optionally three drivers per row. It exists because /predict/batch is real, but it sits in the Research Lab, not the assessment path — it's for evaluating the model over a file of de-identified records, not for screening an individual.

e2efbaa03e21 — the first 12 characters of the SHA-256 hash of the model file itself (tabular_model.joblib). It's a fingerprint of the file's contents, used as the version id. The backend exposes no version number and no training date, so this is the only handle there is: same hash = byte-identical model. The full hashes are in the Artefact integrity table on ModelCardRoute.tsx:317-345; file paths are stripped before the page sees them.

The rest, grouped:

Result terms

ckd_score — the model's raw output, 0–1. Higher means more CKD-like. Not a probability and never shown as a percentage; the service says so in its own limitations.
risk_band — LOW / MODERATE / HIGH, computed by the backend from the score. The frontend displays it and never re-derives it.
Imputed / imputation_count — how many of the 24 fields you left blank, which the service filled in from training data. 20 imputed means the result rests mostly on substituted values.
SHAP drivers — the three fields that moved this particular score most, with a direction (raises_risk ↑ / lowers_risk ↓). SHAP attributes the score across the inputs; it explains this result, not the model in general.
Model-card metrics (all measured on ~80 held-back rows of one public dataset — hence the PROVISIONAL label)

Accuracy — share of test records classified correctly.
Recall / sensitivity — of the people who actually had CKD, the share caught. Misses are the costly error here.
Specificity — of those without CKD, the share correctly cleared. Keeps recall honest, since calling everyone sick gives perfect recall.
Precision — of those flagged, the share who really had CKD.
F1 — precision and recall balanced into one number.
AUC-ROC — how well the score separates the two groups at every threshold, not just the chosen one.
Brier score — error in the raw scores; lower is better. A poor Brier is exactly why the score isn't called a probability.
95% interval — the range the metric could plausibly take given the sample size. Wide intervals here are the sample being small.
Confusion matrix — the four outcomes counted: correctly cleared, false alarms, missed cases, correctly flagged.
Provenance labels — five words, used everywhere: verified (came from the service this session), provisional (real but weakly evidenced), not-verified, simulation (federated and multimodal pages — no endpoint serves them), planned (backend doesn't offer it yet).
