# EthioCKD Frontend Plan

> **AUTHORITATIVE.** This document is the single source of truth for frontend development.
> It supersedes `.kiro/specs/ckd-frontend/` (retained as historical documentation).
> The reasoning behind every change is recorded in
> [FRONTEND_REQUIREMENTS_RECONCILIATION.md](FRONTEND_REQUIREMENTS_RECONCILIATION.md).

**Project:** EthioCKD — Explainable AI for CKD Risk Screening
**Repository:** <https://github.com/Bereket18/ckd-detection>
**Current phase:** Phase 0 complete. Phase 1 not started.

## Mission

Build the frontend as a professional, accessible, research-grade health-informatics web
application. The existing Python backend and ML system are already implemented and are treated as a
protected dependency: the frontend adds presentation and editorial copy, and nothing else.

## Critical Rules

1. Do NOT rewrite the existing ML system.
2. Do NOT duplicate ML logic in JavaScript/TypeScript.
3. Do NOT modify backend behavior unless required for a clearly documented frontend integration
   issue — and then only as an explicit, reviewed change, never as a side effect.
4. Do NOT delete backend files.
5. Do NOT hardcode model metrics.
6. Do NOT hardcode the 24-feature schema. Read it from the backend — see
   [Schema strategy](#schema-strategy) for the mechanism.
7. Get model, schema, and results from the backend API.
8. The Python backend remains the single source of truth.
9. Do not expose model files or secrets to the browser. Concretely, because this is a static SPA
   with no server tier: **every `VITE_*` variable is inlined into the bundle at build time, so no
   secret may ever live in a `VITE_*` variable or a `.env.*` file.**
10. **Never recompute a derived value the backend already returns.** This covers `risk_band`
    (`config.RISK_BAND_BOUNDS` is not exposed and must not be duplicated), SHAP direction,
    `imputed_fields`, and the disclaimer text.
11. **Never render `model.artifacts[*].path`.** `/model` currently returns absolute filesystem
    paths; use `sha256` as the version identifier. Backed by a test.
12. Do not make medical claims beyond what the backend and model documentation support. Never
    describe `ckd_score` as a calibrated probability — the backend itself states it is not one.
13. Clearly distinguish VERIFIED, PROVISIONAL, NOT VERIFIED, and PLANNED functionality.
14. Add tests for new critical functionality.
15. Keep the application responsive (mobile-first from 320 px) and accessible (WCAG 2.1 AA).
16. Prefer simple, maintainable architecture over unnecessary dependencies.

## Target architecture

```text
Browser
  └─ Vite 8 SPA · React 19 · TypeScript · Tailwind · React Router
       └─ /api/* → Vite dev proxy → FastAPI :8000
FastAPI (protected)
  └─ ClinicalPredictionService
       └─ existing Python model + preprocessor + SHAP
```

Vite, not Next.js. The previous version of this plan named Next.js; the repository has always been
Vite, `.kiro/specs/ckd-frontend/design.md` specified Vite on port 5173, and the backend's CORS
allow-list already permits `http://localhost:5173`. Choosing Vite meant **no backend change was
required in Phase 0** — see the reconciliation report.

### Frontend stack

| | |
|---|---|
| Build / runtime | Vite 8, React 19, TypeScript (strict) |
| Routing | React Router |
| Styling | Tailwind CSS |
| Icons | Lucide |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Server state | TanStack Query for `/health` and `/model` |
| Form persistence | `sessionStorage` only — **never `localStorage`**, so no patient data outlives the tab |
| Testing | Vitest, React Testing Library, MSW for integration, Playwright where appropriate |

Installed in Phase 0: none of the above beyond what already exists (Vite, React, TS, Vitest, RTL,
Zod, React Hook Form). React Router, Tailwind, Lucide, Recharts, TanStack Query, and MSW are
installed in Phase 2 when the code that uses them is written.

## Backend contract (verified)

The API surface is exactly four routes. Anything not listed here does not exist.

| Route | Returns |
|---|---|
| `GET /health` | `status` (`ok`/`degraded`), `model` — a *status* string (`"ready"`), not a name |
| `GET /model` | `feature_schema` (24 names, ordered), `datasets`, `n_rows`, `n_train`, `n_test`, `metrics` (accuracy, precision, recall, specificity, f1, auc_roc, brier_score, confusion_matrix, intervals), `limitations`, `artifacts` |
| `POST /predict` | `prediction`, `ckd_score`, `risk_band`, `shap_drivers` (3, `top_n` is hardcoded), `imputed_fields`, `imputation_count`, `disclaimer` |
| `POST /predict/batch` | `count`, `results[]`. Accepts `text/csv`, `application/csv`, or `application/json`; `?explain=false` by default |

## Schema strategy

Rule 6 forbids hardcoding the 24-feature schema. Three sources, each verified to exist:

| Source | Supplies |
|---|---|
| `GET /model` → `feature_schema` | Field **list and order** — the 24 raw names (`age…rc`, `rbc…ane`), not encoded columns |
| `GET /openapi.json` | Numeric **min/max** and categorical **enum values**. FastAPI already emits Pydantic `ge`/`le` as `minimum`/`maximum` and `Literal` as `enum` |
| `src/content/fields.ts` | **Editorial copy only** — patient-friendly label, unit text, tooltip, where-to-find-this-value, technical explanation. Prose, not schema |

**Parity test — required.** A test asserts the content-layer keys are exactly the names in
`/model.feature_schema`. A backend schema change then fails the frontend build instead of silently
dropping a field from the form. This is the drift alarm the current hand-copied types lack.

Reference values, for review only — never as the source at runtime:
`age` 0-120, `bp` 30-200, `sg` 1.0-1.03, `al` 0-5, `su` 0-5, `bgr` 0-600, `bu` 0-400, `sc` 0-80,
`sod` 0-200, `pot` 0-50, `hemo` 0-25, `pcv` 0-60, `wc` 0-30000, `rc` 0-10;
`rbc`/`pc` normal|abnormal, `pcc`/`ba` present|notpresent, `htn`/`dm`/`cad`/`pe`/`ane` yes|no,
`appet` good|poor. Every field is nullable, and null means "not provided".

The backend also holds patient-phrased prompts for all 24 fields in `config.FEATURE_PROMPTS` — good
source material for the copy, currently not exposed by any endpoint.

## Status labels

Every screen that displays data carries one of these, visibly:

- **VERIFIED** — comes from a backend response, live.
- **PROVISIONAL** — real data, but the interpretation or presentation is not clinically validated.
- **NOT VERIFIED** — no backend source exists yet; nothing numeric is shown.
- **SIMULATION** — illustrative content that never claims to be real system output.
- **PLANNED** — specified but not built.

## Product identity

**ETHIOCKD** — Explainable AI for CKD Risk Screening.

The interface should feel professional, calm, trustworthy, modern, accessible, and
research-oriented. It must not look like a generic student CRUD application.

## Route map

| Route | Area | Data source |
|---|---|---|
| `/` | Dashboard | `/health`, `/model` — VERIFIED |
| `/assessment` | Assessment (guided, multi-step) | `/openapi.json`, `/model` — VERIFIED |
| `/results` | Results | `/predict` response held in memory — VERIFIED |
| `/learn` | Learn | Static editorial content — PROVISIONAL |
| `/explainability` | Explainable AI | `shap_drivers` from `/predict` — VERIFIED |
| `/multimodal` | Multimodal AI | None — SIMULATION |
| `/federated` | Federated AI | None — SIMULATION |
| `/research` | Research Lab | `/model` + `/predict/batch` — mixed, see below |
| `/model-card` | Model Card | `/model` — VERIFIED |
| `/about` | About | Static |
| `/facilities` | Nearby Facilities | No provider chosen — PLANNED |

State management: TanStack Query owns `/health` and `/model`; React Hook Form + Zod own the
assessment form; `sessionStorage` holds in-progress input; the prediction response lives in route
state and is never persisted. There is no global store.

## Area requirements

Written EARS-style. Roughly 45 criteria are carried forward from the Kiro specification, each
verified against the backend before being kept; see the reconciliation report for what was rejected.

### 1. Dashboard

1. WHEN the app loads, THE Dashboard SHALL request `GET /health` and `GET /model`.
2. WHEN `/health` returns `status: "ok"`, THE Dashboard SHALL enable entry to the assessment.
3. WHEN `/health` returns `status: "degraded"`, THE Dashboard SHALL display a warning banner and
   block entry to the assessment.
4. WHEN `/health` is unreachable, THE Dashboard SHALL display an offline banner.
5. WHILE `/health` status is not `ok`, THE Dashboard SHALL retry every 60 seconds.
6. THE Dashboard SHALL display the model's feature count and headline metrics from `/model`, never
   from a hardcoded value.
7. THE Dashboard SHALL NOT present `/health`'s `model` field as a model name — it is a status string.

### 2. Assessment

A guided multi-step flow, not all 24 fields at once.

1. THE Assessment SHALL derive its field list and order from `/model.feature_schema`.
2. THE Assessment SHALL derive numeric bounds and categorical options from `/openapi.json`.
3. THE Assessment SHALL group fields into steps (demographics, vital signs, urinalysis, blood
   chemistry, blood counts, medical history).
4. THE Assessment SHALL allow every field to be left empty, and SHALL treat empty as missing.
5. THE Assessment SHALL provide an explicit "I don't know" affordance per field that is
   indistinguishable in effect from leaving it empty.
6. THE Assessment SHALL block submission on *invalid* values only, never on empty ones.
7. WHEN a numeric field contains non-numeric text, THE Assessment SHALL display
   "Must be a valid number".
8. WHEN a numeric value is below the minimum, THE Assessment SHALL display
   "Value must be at least X".
9. WHEN a numeric value exceeds the maximum, THE Assessment SHALL display "Value must be at most X".
10. THE Assessment SHALL display each field's label with both abbreviation and full name
    (e.g. "BP — Blood Pressure (mmHg)").
11. THE Assessment SHALL offer, per field: unit, patient-friendly explanation, technical
    explanation, why the model uses it, and where to find the value.
12. THE Assessment SHALL show a running data-quality indicator of how many fields are provided.
13. THE Assessment SHALL persist in-progress input to `sessionStorage` and SHALL NOT write any
    patient value to `localStorage`.
14. WHEN submitted, THE Assessment SHALL `POST /predict` with all 24 keys present, sending `null`
    for empty fields.
15. WHILE the request is in flight, THE Assessment SHALL disable all inputs, show a spinner on the
    submit button, and display "Analyzing patient data…".

### 3. Results

1. THE Results SHALL show the binary prediction prominently with clear visual distinction.
2. THE Results SHALL display `risk_band` with color coding (LOW green, MODERATE amber, HIGH red)
   and SHALL take the band from the response, never recompute it.
3. THE Results SHALL present `ckd_score` as a model score, NOT as a percentage and NOT as a
   probability, with wording stating it is not calibrated.
4. WHEN `imputation_count > 0`, THE Results SHALL list every `imputed_fields` entry with a warning
   indicator and explain that the model estimated those values.
5. THE Results SHALL display the `disclaimer` string from the response verbatim and SHALL NOT
   hardcode disclaimer text.
6. THE Results SHALL display the `limitations` list from `/model`.
7. THE Results SHALL offer both a patient-friendly and a technical reading of the same result.
8. THE Results SHALL provide a control that starts a new assessment and clears the previous result.

### 4. Explainable AI

1. THE Explainability view SHALL render every SHAP driver the response returns. The backend
   currently returns 3 (`top_n` is hardcoded in `predict_one`); a larger number is a backend
   dependency, not a frontend choice.
2. THE Explainability view SHALL order drivers by descending absolute impact.
3. WHEN a driver's direction is `raises_risk`, THE view SHALL use a red indicator; `lowers_risk`,
   green; `neutral`, grey.
4. THE view SHALL never compute direction or contribution in the frontend.
5. THE view SHALL show the feature name and the patient's own value beside each driver.
6. THE view SHALL include an explanation of what a SHAP value is, and SHALL state that SHAP shows
   association, not causation.

### 5. Learn

1. THE Learn area SHALL explain CKD, kidney function, creatinine, blood urea, hemoglobin,
   urinalysis, diabetes, and hypertension.
2. THE Learn area SHALL provide a simple and a technical explanation of each topic.
3. THE Learn area SHALL cite a reliable source for every clinical claim.
4. THE Learn area SHALL be labelled PROVISIONAL — it is editorial content, not backend output.

### 6. Multimodal AI — SIMULATION

1. THE Multimodal page SHALL be labelled SIMULATION persistently and visibly.
2. THE page SHALL illustrate the clinical + imaging + text → specialised models → embeddings →
   fusion → prediction pipeline.
3. THE page SHALL NOT display any number as a measured multimodal result. No endpoint exposes one.
   `saved_models/imaging_model.pt` and `fusion_model.pt` exist on disk but are unreachable via the API.
4. THE page SHALL NOT imply real patient-level multimodal pairing.

### 7. Federated AI — SIMULATION

1. THE Federated page SHALL be labelled SIMULATION persistently and visibly.
2. THE page SHALL visualise simulated Hospital A/B/C → local training → federated server → FedAvg →
   global model.
3. THE page SHALL NOT imply real hospital deployment or real patient data.
4. THE page SHALL NOT display federated accuracy figures. `src/federated/` exists but no route
   reaches it — federated results are a **backend dependency (PLANNED)**.

### 8. Research Lab

Split by what the backend can actually supply. Nothing here is hardcoded, and nothing absent is
invented.

**VERIFIED — build from `/model`:** datasets, `n_rows`, `n_train`, `n_test`, and the metrics block
(accuracy, precision, recall, specificity, f1, auc_roc, brier_score, confusion_matrix, intervals).

**NOT VERIFIED — backend endpoint PLANNED:** model comparisons, threshold analysis, federated
results. `tabular_model.threshold_sweep` and `src/federated/` exist in the codebase but no route
exposes them.

1. THE Research Lab SHALL render every metric it displays from the `/model` response.
2. THE Research Lab SHALL render the confusion matrix from `metrics.confusion_matrix`.
3. THE Research Lab SHALL display confidence intervals from `metrics.intervals` where present.
4. THE Research Lab SHALL show a NOT VERIFIED / PLANNED placeholder — with no numbers — for
   comparisons, threshold analysis, and federated results.
5. THE Research Lab SHALL host batch scoring (relocated from the Kiro assessment flow, which is
   wrong for a patient completing one assessment):
   - accept a CSV file upload;
   - `POST /predict/batch` with `Content-Type: text/csv`;
   - show a progress indicator during upload;
   - render a summary table of `count` and per-row `prediction`, `ckd_score`, `risk_band`,
     `imputation_count`;
   - allow export as CSV with the prediction columns appended;
   - WHEN the response is 422, display row-level errors from `detail`;
   - WHEN the response is 415, state that the file must be CSV.

### 9. Model Card

1. THE Model Card SHALL display model metadata and `limitations` from `/model`.
2. THE Model Card SHALL identify the model version by the first 12 characters of the artifact
   `sha256`.
3. THE Model Card SHALL NEVER render `artifacts[*].path`. Those are absolute filesystem paths on the
   server; a test enforces this.
4. THE Model Card SHALL NOT display a training date until the backend exposes one (**PLANNED**).

### 10. About

1. THE About page SHALL state that EthioCKD is a screening-support tool, not a diagnostic device.
2. THE About page SHALL link to the model card and to the reconciliation and plan documents.

### 11. Demo Mode

1. WHILE Demo Mode is active, THE app SHALL display a persistent, visible banner saying so.
2. THE app SHALL hold demo values in state separate from real user input.
3. THE app SHALL provide no path by which demo data can be submitted or presented as a real
   assessment.
4. WHEN Demo Mode is exited, THE app SHALL discard all demo values.

### 12. Nearby Healthcare Facilities — PLANNED

Marked PLANNED because no data provider has been chosen. Constraints that hold regardless of
provider:

1. THE facility finder SHALL request explicit geolocation consent before reading location.
2. THE facility finder SHALL NOT send any assessment field, prediction, or score to the location
   service.
3. THE facility finder SHALL NOT persist precise coordinates.
4. THE facility finder SHALL be presented as navigation, never as a medical referral.

### 13. Reports

Generated **client-side** from the response the user already holds. No backend report endpoint
exists, and one is not required for this design.

1. THE report SHALL contain: assessment id, date/time, model version (`sha256[:12]`), prediction,
   score, risk band, data quality, imputed fields, SHAP drivers, interpretations, limitations, and
   the `disclaimer` from the response.
2. THE report SHALL NOT contain any filesystem path.
3. THE report SHALL be generated without transmitting patient data anywhere.

## Cross-cutting requirements

### Error handling

Verified against the codes the backend actually emits.

| Condition | Frontend behaviour |
|---|---|
| 422 | Map `detail` to the offending fields; show inline per-field errors |
| 415 (`/predict/batch`) | State that the upload must be CSV |
| 500 | Generic message plus a retry action |
| 503 | "Temporarily unavailable" — the model is not loaded |
| Timeout at 30 s | Timeout message plus retry |
| Network failure | Offline message |

Layering, kept from `design.md`: `APIError.message` stays the raw `"<status> <statusText>"`;
user-facing copy is produced by `ErrorHandler.handleAPIError()`. Components read the handler, never
the raw error. An ErrorBoundary wraps each route.

### Accessibility

1. THE app SHALL be operable keyboard-only end to end, including completing an assessment.
2. THE app SHALL meet WCAG 2.1 AA contrast (4.5:1 for normal text).
3. THE app SHALL keep body text at 14 px or larger.
4. THE app SHALL provide ARIA labels on every input and button.
5. THE app SHALL use semantic HTML and visible focus states.
6. THE app SHALL respect `prefers-reduced-motion`.
7. THE app SHALL be mobile-first from 320 px upward. (The Kiro spec's desktop-first 768–1920 px
   two-column grid is rejected — this is a patient-facing product.)

#### Patterns carried forward from the deleted form components

`src/components/form/` was removed in Phase 0 because it was hand-rolled BEM CSS built for the flat
all-24-fields-at-once form. The accessibility work in it was good and is to be **re-implemented in
Tailwind, not rediscovered**:

- `aria-describedby` switched between the error id and the tooltip id depending on state, so a
  screen reader hears the error instead of the hint when both exist.
- `aria-invalid` on the input whenever a validation error is present.
- `role="alert"` with `aria-live="polite"` on the error region.
- `role="tooltip"` with a 500 ms hover delay and timer cleanup on unmount.
- A clear-to-null button at `tabIndex={-1}` so it does not interrupt tab order.
- An explicit "Not provided" option representing `null` in every select.
- Range and unit text folded into the `aria-label`, e.g. "Blood Pressure in mmHg, 30 to 200".

### Security

1. Never expose model files, joblib/pickle artifacts, secret keys, or backend credentials.
2. No secret in any `VITE_*` variable or `.env.*` file — they are compiled into the bundle.
3. Validation happens on the server; frontend validation is a convenience, never the gate.
4. Use safe error messages — never surface stack traces or paths.
5. Prefer the Vite `/api` proxy over cross-origin calls, in dev and in production. This removes CORS
   from the critical path. Today `vite.config.ts` defines the proxy but `api.ts` calls the absolute
   `VITE_API_BASE_URL`, so the proxy is dead config and CORS is load-bearing — resolve this in Phase 2.
6. Prepare for HTTPS deployment.

## Testing

Four tiers, kept from `design.md` including its reasoning that property-based testing does not fit
this codebase (the input domain is a fixed 24-field schema with published bounds, so exhaustive
boundary cases are cheaper and more legible than generated ones).

| Tier | Scope |
|---|---|
| Unit | Validation schema, error handler, content layer, formatting |
| Component | Form fields, results panels, status labels (React Testing Library) |
| Integration | Full request/response cycles against MSW |
| Accessibility | Keyboard traversal, ARIA wiring, contrast |

Must-have tests, each guarding a requirement that can silently stop being true:

1. Field ranges and enums match `/openapi.json`.
2. Content-layer keys are exactly `/model.feature_schema` — the parity test.
3. The 422 / 415 / 500 / 503 / timeout / offline mapping.
4. SHAP ordering and per-direction rendering.
5. `artifacts[*].path` is never rendered.
6. `risk_band` is never recomputed.
7. Imputation is disclosed when `imputation_count > 0`.
8. The assessment completes keyboard-only.
9. Contrast ratios meet AA.
10. Demo data cannot be submitted as a real assessment.

### Continuous integration — PLANNED, first Phase 1 action

`.github/workflows/tests.yml` runs `pytest` only. Nothing in CI would have caught the corrupted file
that has been sitting committed and green in this repository. Add a Node job — as a **separate
workflow file**, so the backend's workflow is not touched — running:

```bash
npx tsc --noEmit -p tsconfig.app.json
npx eslint .
npx vitest run
npm run build
```

Not added in Phase 0: adding files to `.github/` was outside the approved cleanup scope. It is the
single highest-value follow-up, because every fix recorded below can silently regress without it.

## Development phases

| Phase | Scope | Status |
|---|---|---|
| 0 | Frontend audit, requirements reconciliation, cleanup | **Complete** |
| 1 | Requirements sign-off, information architecture, design tokens, test plan, frontend CI | Next |
| 2 | Vite foundation: React Router, Tailwind, `/api` proxy, dependency install | |
| 3 | Design system and navigation, including the four status labels | |
| 4 | Assessment workflow (guided multi-step, schema-driven) | |
| 5 | Results and SHAP | |
| 6 | Learn | |
| 7 | Research Lab, Federated, Multimodal | |
| 8 | Nearby facilities and reports | |
| 9 | Security, accessibility, testing hardening | |
| 10 | Deployment | |
| 11 | Final frontend audit | |

Phase 2 is a Vite foundation, not a Next.js one. Suggested Phase 1 order: requirements sign-off →
route map and IA → design tokens and the four status labels → the `content/fields.ts` shape → the
test plan above → frontend CI.

### Proposed Phase 1 source layout

```text
src/
  routes/          dashboard, assessment, results, learn, explainability,
                   multimodal, federated, research, model-card, about
  features/<area>/ components colocated with the area that owns them
  components/ui/   design-system primitives (the a11y patterns above, in Tailwind)
  content/         fields.ts, education.ts — editorial copy, key-parity tested
  lib/api/         api.ts, error-handler.ts (both kept from Phase 0),
                   + schema.ts reading /openapi.json
  lib/state/       TanStack Query setup, sessionStorage helpers
```

Three shaping principles: the backend stays the only source of predictions, schema, and metrics; the
frontend adds only presentation and editorial copy; every area lacking a backend source carries a
visible SIMULATION / PLANNED / NOT VERIFIED label rather than plausible-looking numbers.

## Backend dependencies (PLANNED — none actioned)

The backend was not modified in Phase 0. These are proposals for a later phase; until each lands,
the corresponding frontend feature stays labelled PLANNED.

1. Model training date on `/model`.
2. A `top_n` override on `/predict`, to show more than 3 SHAP drivers.
3. A `/schema` endpoint carrying units and human labels, so `config.FEATURE_PROMPTS` can be reused
   rather than re-authored in the frontend.
4. A federated-results endpoint.
5. A threshold-sweep endpoint exposing `tabular_model.threshold_sweep`.
6. A model-version field on `/health`, so a model change is detectable.
7. Redaction of `artifacts[*].path` from `/model` — a security issue, mitigated frontend-side for now.
8. A report endpoint, only if reports move server-side.

## Risks

1. **Working source was excluded from version control.** `ckd-frontend/.gitignore` listed
   `src/services/api.ts`, `error-handler.ts`, and `*.test.ts` as "corrupted". They were not; 648
   lines of working source were invisible to git and one `git clean -fdx` from permanent loss.
   **Fixed in Phase 0**, and the files are now tracked.
2. **The repository's own documentation misdiagnosed the repository.** Three files named `api.ts` as
   broken; none named `validation.schema.ts`, the file that actually was. Anyone acting on them would
   have made things worse. **Fixed in Phase 0** — those documents are removed and the real breakage
   is repaired.
3. **`/model` publishes absolute filesystem paths to the browser**, against rule 9. Not fixed —
   the backend is frozen. Mitigated by rule 11 plus a test; recorded as a Phase 1 backend proposal.
4. **No frontend CI.** Still open. See the CI section — it is the first Phase 1 action.
5. **This plan previously promised Research Lab, Federated, and Multimodal content the API cannot
   supply.** Fixed here by labelling; left unaddressed it would have led Phase 7 to invent data.
6. **The Vite `/api` proxy is dead config** while `api.ts` calls the absolute `VITE_API_BASE_URL`,
   making CORS load-bearing. Open — decide in Phase 2; the proxy is the better path.
7. **No drift alarm between backend and frontend schema.** `api.types.ts` and the field ranges were
   hand-copied from `api/schemas.py`; nothing fails today if the backend changes. The parity test
   closes this in Phase 1.
8. **`tsconfig.app.json` is strict** (`noUncheckedIndexedAccess`, `erasableSyntaxOnly`,
   `verbatimModuleSyntax`). Correct, and the source of earlier type-import churn. Expect it; do not
   loosen it.

## Definition of success

A polished end-to-end user experience that uses the existing Python backend as its authoritative
source for predictions, preprocessing, SHAP, model metadata, and results — and that never shows a
number it cannot trace to a backend response.

<!-- PLAN_APPEND_MARKER -->
