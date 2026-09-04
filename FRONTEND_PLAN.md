# EthioCKD Frontend Plan

> **AUTHORITATIVE.** This document is the single source of truth for frontend **requirements**.
> It supersedes `.kiro/specs/ckd-frontend/` (retained as historical documentation).
> The reasoning behind every Phase 0 change is recorded in
> [FRONTEND_REQUIREMENTS_RECONCILIATION.md](FRONTEND_REQUIREMENTS_RECONCILIATION.md).
>
> Two companion documents were produced in Phase 1 and are authoritative in their own scope:
> [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) owns the **design** that satisfies these
> requirements (information architecture, routes, design system, data flow, ADRs), and
> [FRONTEND_TEST_PLAN.md](FRONTEND_TEST_PLAN.md) owns the **test and CI specification**. Where a
> requirement here and a design decision there disagree, this document wins and the architecture
> records the amendment. Section references of the form `§n` below point into the architecture.

**Project:** EthioCKD — Explainable AI for CKD Risk Screening
**Repository:** <https://github.com/Bereket18/ckd-detection>
**Current phase:** Phase 0 complete. Phase 1 complete (architecture, test plan, and the requirement
amendments recorded in the Phase 1 ledger). Phase 2 not started — no dependency installed, no
component written.

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
11. **Never render a server-supplied filesystem path, anywhere.** Verified in Phase 1 to be wider
    than first written: absolute paths reach the browser through `/model.artifacts[*].path`, through
    the same `artifacts` block embedded in every `/predict` response, through a degraded `/health`
    response's `detail`, and through a 503 `detail`. So the rule is not "the Model Card must not
    render `artifacts[*].path`" but **no server string is rendered until it has passed the path
    filter**, and `detail` is never rendered at all. Use `model.version` as the version identifier —
    the backend already supplies it (see the contract table). Backed by tests
    ([FRONTEND_TEST_PLAN.md](FRONTEND_TEST_PLAN.md) §4).
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

**Four application endpoints, plus the OpenAPI document used for schema metadata.** Anything not
listed here does not exist. Re-verified against the running backend in Phase 1; architecture §0 holds
the full field-by-field record, including exact response shapes and every error body.

| Endpoint | Returns |
|---|---|
| `GET /health` | `status` (`ok`/`degraded`), `model` — a *status* string (`"ready"`), **not** a name. A degraded backend answers with **HTTP 200**, not an error status, and carries a `detail` string containing an absolute path — so `degraded` must be detected from the body, and `detail` must never be rendered (rule 11) |
| `GET /model` | 11 keys: `name`, `version`, `feature_count`, `feature_schema` (24 names, ordered), `datasets`, `n_rows`, `n_train`, `n_test`, `metrics`, `artifacts`, `limitations`. `version` is already the first 12 characters of the model artefact's `sha256` — read it, do not derive it. **Every key inside `metrics` is conditional** (accuracy, precision, recall, specificity, f1, auc_roc, brier_score, confusion_matrix, intervals) and any of them may be absent, so every metric renders optional |
| `POST /predict` | `prediction`, `ckd_score`, `risk_band`, **`explanation`** (a backend-authored plain-language sentence, present in every response and the primary thing a patient reads), `shap_drivers` (3; `top_n` is hardcoded), `imputed_fields`, `imputation_count`, `disclaimer`, and an embedded **`model`** block identical to `/model` — which is why Results needs no second request for `limitations`, and why rule 11 applies here too |
| `POST /predict/batch` | `count`, `results[]`. Items carry `prediction`, `ckd_score`, `risk_band`, `imputed_fields`, `imputation_count` — but **no `disclaimer` and no `model`**, so batch provenance comes from a separate `/model` read. Accepts `text/csv`, `application/csv`, or `application/json`; `?explain=false` by default. It declares **no `requestBody` in OpenAPI**, so those content types are the one schema fact that cannot be read from the backend and is held as a documented constant instead |
| `GET /openapi.json` | Not an application endpoint — the schema-metadata source. Supplies numeric `minimum`/`maximum` and categorical `enum` for `PatientAssessment`, on the non-null branch of each field's `anyOf`. `PatientAssessment` is `extra="forbid"` with **no required fields** |

Two verified behaviours that shape the design more than any response field:

- **All-missing input is legal.** A `/predict` body of 24 nulls returns 200 with
  `imputation_count: 24`. Missing data is the normal case, not an error case.
- **Batch imputes silently.** A CSV containing only `age,bp` returns **200** with
  `imputation_count: 22` — no warning, no rejection. The frontend must validate the header against
  `feature_schema` before upload and disclose imputation unconditionally (R8.5).

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

Every screen that displays data carries one of these, visibly, and never by colour alone — the word
itself is always rendered, alongside a structurally distinct glyph (architecture §5.4):

- **VERIFIED** — came from a live backend response in this session.
- **PROVISIONAL** — real content that must not be read as a verified measurement: either a backend
  value whose interpretation is limited (`ckd_score`, `metrics.intervals`) or editorially authored
  material (`/learn`).
- **NOT VERIFIED** — a claim the frontend cannot substantiate from any endpoint. Nothing numeric is
  shown. This is a lint target, and the target is zero.
- **SIMULATION** — illustrative content that never claims to be real system output.
- **PLANNED** — specified, with a named backend dependency, and not built.

Fixed vocabulary: always upper-case, one term per concept, never replaced by a synonym. `LIVE`,
`REAL`, `DEMO`, `MOCK`, `BETA`, and `COMING SOON` are banned. Applied consistently, the rule that
follows is the useful one: **an unlabelled number is a verified number.**

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
| `/research/batch` | Batch scoring | `/predict/batch` + `/model.limitations` — VERIFIED |
| `/model-card` | Model Card | `/model` — VERIFIED |
| `/about` | About | Content layer + `/model.version`; hosts the status-label legend |
| `/facilities` | Nearby Facilities | No provider chosen — PLANNED |

Two areas are deliberately **not routes**, because neither has content of its own: **Demo Mode** is an
app-wide state with a persistent banner (R11), and **Reports** is a capability offered from `/results`
and `/research/batch` (R13). Giving either a route would create a page whose only honest content is
"nothing here yet". Architecture §1.11 and §1.17.

State management: TanStack Query owns `/health`, `/model`, and `/openapi.json`; React Hook Form + Zod
own the assessment form, with the field validators built at runtime from `/openapi.json`;
`sessionStorage` holds in-progress input; the prediction response lives in a React context mounted
**above** the router outlet, so ordinary in-app navigation cannot lose it while a reload discards it.
There is no global store.

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
3. THE Assessment SHALL group the fields into **five** steps, in this order: **About you**
   (`age`, `bp`), **Your health history** (`htn`, `dm`, `cad`, `appet`, `pe`, `ane`), **Urine test**
   (`sg`, `al`, `su`, `rbc`, `pc`, `pcc`, `ba`), **Blood chemistry** (`bgr`, `bu`, `sc`, `sod`,
   `pot`), **Blood count** (`hemo`, `pcv`, `wc`, `rc`). Amended from six groups: demographics and
   vital signs would have been screens of one and two fields, and the order is deliberately
   no-lab-first so a person without a lab report reaches something they can answer before anything
   they cannot. The steps partition the 24 fields exactly, and a test asserts that.
4. THE Assessment SHALL allow every field to be left empty, and SHALL treat empty as missing.
5. THE Assessment SHALL provide an explicit "I don't know" affordance per field that is
   indistinguishable in effect from leaving it empty.
6. THE Assessment SHALL block submission on *invalid* values only, never on empty ones.
7. WHEN a numeric field contains non-numeric text, THE Assessment SHALL display
   "Must be a valid number".
8. WHEN a numeric value is below the minimum, THE Assessment SHALL display
   "Value must be at least X".
9. WHEN a numeric value exceeds the maximum, THE Assessment SHALL display "Value must be at most X".
10. THE Assessment SHALL display each field's label with both abbreviation and full name, including
    the unit — e.g. "BP — Blood Pressure, diastolic (mm/Hg)". `bp` is **diastolic**: the backend's
    30–200 range makes that unambiguous, and an unqualified "Blood Pressure" invites a systolic value
    of 120, which is inside the valid range and therefore accepted in silence. Labels for ambiguous
    fields state which measurement is wanted, and a non-blocking plausibility hint covers the rest.
11. THE Assessment SHALL offer, per field: unit, patient-friendly explanation, technical
    explanation, why the model uses it, and where to find the value.
12. THE Assessment SHALL show a running data-quality indicator of how many fields are provided.
13. THE Assessment SHALL persist in-progress input to `sessionStorage` and SHALL NOT write any
    patient value to `localStorage`.
14. WHEN submitted, THE Assessment SHALL `POST /predict` with all 24 keys present, sending `null`
    for empty fields.
15. WHILE the request is in flight, THE Assessment SHALL disable all inputs, show a spinner on the
    submit button, and display "Analysing your answers…" — amended from "Analyzing patient data…",
    which addresses the reader in the third person as a clinical record. UI copy uses British
    spelling throughout, since that is the convention in Ethiopian English; identifiers and CSS
    properties keep their own spelling.
16. THE Assessment SHALL use the same wording for the same fault whether it is caught in the browser
    or returned by the server, so a person never sees two phrasings of one mistake. The client
    validator's messages and the messages derived from the server's Pydantic `type` + `ctx` are
    asserted string-identical by test.

### 3. Results

1. THE Results SHALL compose `prediction` and `risk_band` into **one statement**, not two independent
   badges. Rendering them separately produces "NOT CKD" in green beside "MODERATE" in amber, which
   reads as a contradiction. Only four verdict × band pairs are reachable — the backend's verdict
   threshold sits at 0.5 and its band bounds at 0.35/0.65 inclusive — and each has authored wording
   (architecture §3.11): `notckd`+`LOW`, `notckd`+`MODERATE`, `ckd`+`MODERATE`, `ckd`+`HIGH`. In every
   case `MODERATE` means *near the decision boundary*. The two unreachable pairs render a
   contract-violation state rather than a plausible-looking result.
2. THE Results SHALL display `risk_band` taken from the response, never recomputed, with colour
   (LOW green, MODERATE amber, HIGH red) as a **secondary** channel only: the band word is always
   rendered and carries a distinct glyph, so the meaning survives greyscale and colour-blindness.
   `RISK_BAND_BOUNDS` is not exposed by the API and must appear nowhere in frontend source.
3. THE Results SHALL lead with the response's `explanation` — a plain-language sentence the backend
   authors for every prediction. It is the first thing a patient reads, and it is not paraphrased or
   regenerated. WHEN `explanation` is absent, THE Results SHALL fall back to the composed statement
   from R3.1 rather than to invented prose.
4. THE Results SHALL present `ckd_score` as a model score, NOT as a percentage and NOT as a
   probability, with wording stating it is not calibrated — sourced from `model.limitations`, not
   hardcoded.
5. WHEN `imputation_count > 0`, THE Results SHALL list every `imputed_fields` entry with a warning
   indicator and explain that the model estimated those values. The list comes from the response and
   is never derived by comparing it against the submitted payload.
6. THE Results SHALL display the `disclaimer` string from the response verbatim and SHALL NOT
   hardcode disclaimer text.
7. THE Results SHALL display the `limitations` list, read from the `model` block **embedded in the
   prediction response** — no second request is needed.
8. THE Results SHALL offer both a patient-friendly and a technical reading of the same result, drawn
   from one composed state so the two cannot contradict each other.
9. THE Results SHALL provide a control that starts a new assessment and clears the previous result,
   the draft, and any demo state, after confirmation.

### 4. Explainable AI

1. THE Explainability view SHALL render every SHAP driver the response returns. The backend
   currently returns 3 (`top_n` is hardcoded in `predict_one`); a larger number is a backend
   dependency, not a frontend choice.
2. THE Explainability view SHALL render drivers in the order received. The backend already sorts by
   descending absolute impact inside `predict_one`; re-sorting in the frontend would duplicate that
   rule and silently diverge if the backend changed it. The test asserts rendered order equals
   response order — it does not assert the ordering is by absolute impact, which is the backend's
   business.
3. WHEN a driver's direction is `raises_risk`, THE view SHALL use a red indicator; `lowers_risk`,
   green; `neutral`, grey. Direction is read from the `direction` field only. Colour is never the
   sole channel: each direction also carries its own glyph and its own word.
4. THE view SHALL never compute direction or contribution in the frontend. No `Math.abs` and no sign
   inspection of `shap_value` may appear in the render path.
5. THE view SHALL show the feature name and the patient's own value beside each driver, taking the
   value from the driver's own `value` field rather than looking it back up in the submitted form.
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
5. THE Research Lab SHALL state, beside every metric it shows, that the figures describe held-out
   test performance and carry the caveats in `model.limitations` — read from the response, not
   authored in the frontend.
6. THE Research Lab SHALL host batch scoring at its own route, `/research/batch` (relocated from the
   Kiro assessment flow, which is wrong for a patient completing one assessment):
   - accept a CSV file upload;
   - **before uploading**, parse the header row in the browser and check it against
     `/model.feature_schema`. Report unknown columns and missing columns as a local error. This is
     not optional politeness: the backend imputes missing columns *silently* and returns HTTP 200 —
     a file containing only `age,bp` scores every row with 22 fields invented, and nothing in the
     response says the file was wrong. Header validation is the only place that fault can be caught.
   - `POST /predict/batch` with `Content-Type: text/csv`;
   - show a progress indicator during upload;
   - render a summary table of `count` and per-row `prediction`, `ckd_score`, `risk_band`,
     `imputation_count`. Batch items carry **no** `disclaimer` and **no** `model` block, so the page
     supplies both from its own `/model` query and says where they came from;
   - surface `imputation_count` per row prominently, and refuse to export rows whose count is
     unexpectedly high without an explicit acknowledgement;
   - allow export as CSV with the prediction columns appended, generated in the browser;
   - WHEN the response is 422, display row-level errors from `detail`. Batch `loc` arrays are
     **numeric-first** — `[rowIndex, field]`, not `["body", field]` — and the CSV line a person sees
     in their editor is `loc[0] + 2` (zero-based row, plus the header). The error list SHALL show
     that line number, not the raw index;
   - WHEN the response is 415, state that the file must be CSV. Note that 415 and 503 send `detail`
     as a bare **string**, not the array of objects a 422 sends; the parser must handle both shapes.

### 9. Model Card

1. THE Model Card SHALL display model metadata and `limitations` from `/model`.
2. THE Model Card SHALL identify the model version by reading `model.version`, which the backend
   already computes as the first 12 characters of the artifact `sha256`. The frontend SHALL NOT slice
   `sha256` itself — duplicating the truncation rule is how the displayed version drifts from the one
   the server means.
3. THE Model Card SHALL NEVER render `artifacts[*].path`, and neither SHALL any other view. Those are
   absolute filesystem paths on the server. This is Critical Rule 11, which covers all four leak
   routes — `/model`, the `model` block embedded in every prediction response, a degraded `/health`
   `detail`, and a 503 `detail` — and it is enforced by test.
4. THE Model Card SHALL NOT display a training date until the backend exposes one (**PLANNED**).
   `model_metadata()` returns no date, so the string `training_date` SHALL NOT appear in frontend
   source at all; a test asserts its absence, since a type that names a field nobody supplies invites
   someone to fill it in.
5. THE Model Card SHALL treat **every** key under `metrics` as conditional. The backend emits them
   only when the artefact carries them; a missing key renders as "not reported", never as `0`, `—`,
   or `NaN`.

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
exists, and one is not required for this design. Reports are a capability offered from Results,
Explainability, and Batch — not a route of their own (architecture §1.17).

1. THE report SHALL contain: a report reference, date/time, model version (`model.version`),
   prediction, score, risk band, data quality, imputed fields, SHAP drivers, both interpretations,
   limitations, and the `disclaimer` from the response.
2. THE report reference SHALL be generated on the device with `crypto.randomUUID()` and labelled as
   such. `PredictionResponse` contains **no identifier of any kind**, so an "assessment id" would be
   a fabricated backend capability; worse, printing a plausible-looking id implies a server-side
   record that does not exist and could be requested later. The report says "Report reference —
   generated on this device".
3. THE report SHALL NOT contain any filesystem path.
4. THE report SHALL be generated without transmitting patient data anywhere: a print stylesheet plus
   `window.print()` for paper, and a `Blob` for a file. No PDF library, no upload, no third-party
   font or asset fetched at print time. A test spies on `fetch` and `XMLHttpRequest` and asserts zero
   calls.

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
2. No secret in any `VITE_*` variable or `.env.*` file — they are compiled into the bundle. There is
   no server tier in which a secret could hide, so this is absolute, not a preference.
3. Validation happens on the server; frontend validation is a convenience, never the gate.
4. Use safe error messages — never surface stack traces or paths. See Critical Rule 11: the paths
   arrive from four different endpoints, so this is enforced at the render boundary, not per call
   site.
5. Route **all** API traffic through the Vite `/api` proxy, in dev and in production, by configuring
   the client with a relative base of `/api`. Today `vite.config.ts` defines the proxy but `api.ts`
   calls the absolute `VITE_API_BASE_URL`, so the proxy is dead config and CORS is load-bearing.
   Fixing this in Phase 2 makes the app same-origin, which removes CORS from the critical path,
   removes the API host from the shipped bundle, and lets a Content-Security-Policy `connect-src`
   of `'self'` be meaningful. The consequence to accept: the proxy becomes load-bearing, so the
   production deployment must terminate at a reverse proxy rather than serve static files alone. That
   is a deployment requirement, recorded here so Phase 2 does not discover it late.
6. Log no request body and no response body, in any environment. Assessment answers and predictions
   are health data; a `console.log` left in a component publishes them to the browser console, to any
   extension reading it, and to any error-reporting tool added later. The lint configuration forbids
   `console` in `src/` with no per-file escape.
7. Build production with `build.sourcemap: false`. A sourcemap ships the frontend's full reasoning —
   including every comment explaining which fields matter clinically and how the score is presented —
   and makes the leak-prevention code trivially auditable by anyone probing the deployment. Debug
   builds may enable it locally.
8. Prepare for HTTPS deployment.
9. Anything asserted above is proved by a test, not by review: the security matrix in
   `FRONTEND_TEST_PLAN.md` §4 lists thirteen, each naming the tier it runs in and the method it uses.

## Testing

`FRONTEND_TEST_PLAN.md` is the authority for testing and CI. It specifies **181 tests** across six
tiers, a fixture strategy, coverage floors, and the writing order. What follows is the summary; where
the two documents differ in detail, the test plan is the one to implement.

Six tiers. The four from `design.md` are kept — including its reasoning that property-based testing
does not fit this codebase, since the input domain is a fixed 24-field schema with published bounds,
so boundary cases derived from `/openapi.json` at test time are cheaper and more legible than
generated ones — plus two the audit showed were missing.

| Tier | Scope | May reach the network |
|---|---|---|
| Unit | Validation schema, error handler, content layer, formatting | No |
| Component | Form fields, results panels, status labels (React Testing Library) | No |
| Integration | Full request/response cycles against MSW | No |
| Accessibility | Keyboard traversal, ARIA wiring, contrast (jest-axe) | No |
| Contract | Recorded fixtures vs the live API — opt-in, `VITEST_CONTRACT=1` | Yes |
| E2E | Whole-journey smoke — **PLANNED**, runner not chosen | Yes |

MSW is not a dependency yet. It was removed in Phase 0 because nothing imported it, and it returns
with the first integration test that needs it — in Phase 5, not Phase 2.

Must-have tests, each guarding a requirement that can silently stop being true:

1. Field ranges and enums match `/openapi.json`.
2. Content-layer keys are exactly `/model.feature_schema` — the parity test.
3. The 422 / 415 / 500 / 503 / timeout / offline mapping.
4. SHAP order as received, and per-direction rendering.
5. `artifacts[*].path` is never rendered, from any of its four sources.
6. `risk_band` is never recomputed, and `0.35` / `0.65` / `0.5` appear nowhere in `src/`.
7. Imputation is disclosed when `imputation_count > 0`.
8. The assessment completes keyboard-only.
9. Contrast ratios meet AA.
10. Demo data cannot be submitted as a real assessment.

### Continuous integration — specified, first Phase 2 action

`.github/workflows/tests.yml` runs `pytest` only. Nothing in CI would have caught the corrupted file
that had been sitting committed and green in this repository. Add a Node job as a **new, separate
workflow file** — `.github/workflows/frontend.yml`, so the backend's workflow is not touched —
running:

```bash
npx tsc --noEmit -p tsconfig.app.json
npx eslint .
npx vitest run
npm run build
```

`FRONTEND_TEST_PLAN.md` §8 specifies the workflow in full: path filter, working directory, the Node
version pinned via `.nvmrc` and `engines` (`^22.13.0 || >=24.0.0` — the intersection of what Vite,
ESLint, jsdom, and Vitest declare, which excludes Node 23), npm caching, no `continue-on-error`, and
why the `build` step earns its place beside `tsc`.

Not created in Phase 1: a gate that runs before the suite it protects exists would be red from its
first commit, which teaches a team to ignore it. Phase 2 creates the file as its first act, alongside
the dependency install.

## Development phases

| Phase | Scope | Status |
|---|---|---|
| 0 | Frontend audit, requirements reconciliation, cleanup | **Complete** |
| 1 | Information architecture, route architecture, design system, content architecture, API/data architecture, security, accessibility, test plan, ADRs | **Complete** |
| 2 | Vite foundation: dependency install, React Router, Tailwind, relative `/api` base, `frontend.yml` CI | Next |
| 3 | Design system and navigation, including the five status labels | |
| 4 | Assessment workflow (guided five-step, schema-driven) | |
| 5 | Results and SHAP; MSW returns with the first integration test | |
| 6 | Learn | |
| 7 | Research Lab, Federated, Multimodal, batch scoring | |
| 8 | Nearby facilities and reports | |
| 9 | Security, accessibility, testing hardening | |
| 10 | Deployment | |
| 11 | Final frontend audit | |

Phase 2 is a Vite foundation, not a Next.js one. Its order: create `.github/workflows/frontend.yml`
and `.nvmrc` first so nothing lands unguarded → install the five Phase 2 dependencies with the
justifications in `FRONTEND_ARCHITECTURE.md` §10 → design tokens → the router shell → switch the API
client to the relative `/api` base. The four test groups in `FRONTEND_TEST_PLAN.md` §10 are written
before the code they guard.

### Source layout — decided in Phase 1

Specified in full in [`FRONTEND_ARCHITECTURE.md`](FRONTEND_ARCHITECTURE.md); reproduced here so the
requirements document is readable on its own.

```text
src/
  routes/          dashboard, assessment, results, explainability, learn,
                   multimodal, federated, research, research/batch,
                   model-card, about
  features/<area>/ components colocated with the area that owns them
  components/ui/   design-system primitives (the a11y patterns above, in Tailwind)
  components/status/ the five status labels, one component
  content/         fields.ts, education.ts — editorial copy, key-parity tested
  lib/api/         api.ts, error-handler.ts (both kept from Phase 0),
                   + schema.ts deriving bounds and enums from /openapi.json
  lib/state/       TanStack Query setup, the prediction context, sessionStorage helpers
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
3. **The backend publishes absolute filesystem paths to the browser** — and from four places, not
   one: `/model.artifacts[*].path`, the same `model` block embedded in *every* prediction response, a
   degraded `/health` `detail`, and a 503 `detail`. Phase 1 found the three extra routes; only the
   first was known in Phase 0. Not fixed — the backend is frozen. Mitigated by Critical Rule 11
   enforced at the render boundary plus the security tests in `FRONTEND_TEST_PLAN.md` §4; recorded as
   backend dependency 7.
4. **No frontend CI.** Still open, now fully specified. `FRONTEND_TEST_PLAN.md` §8 gives the workflow
   file verbatim; creating it is Phase 2's first act, deliberately not Phase 1's, because a gate with
   no suite behind it is a gate people learn to ignore.
5. **This plan previously promised Research Lab, Federated, and Multimodal content the API cannot
   supply.** Fixed here by labelling; left unaddressed it would have led Phase 7 to invent data.
6. **The Vite `/api` proxy is dead config** while `api.ts` calls the absolute `VITE_API_BASE_URL`,
   making CORS load-bearing. **Decided in Phase 1, open until Phase 2 implements it:** switch to a
   relative `/api` base. The accepted cost is that the production deployment must terminate at a
   reverse proxy — see security rule 5.
7. **No drift alarm between backend and frontend schema.** `api.types.ts` and the field ranges were
   hand-copied from `api/schemas.py`; nothing fails today if the backend changes. **Designed in Phase
   1:** the three-source strategy plus the five-assertion parity test and the eleven contract tests in
   `FRONTEND_TEST_PLAN.md` §6. Still open in code until Phase 2 writes them, and they are among the
   four groups written first.
8. **`tsconfig.app.json` is strict** (`noUncheckedIndexedAccess`, `erasableSyntaxOnly`,
   `verbatimModuleSyntax`). Correct, and the source of earlier type-import churn. Expect it; do not
   loosen it.
9. **A stale `.tsbuildinfo` can crash `tsc -b` with a false out-of-memory error.** During Phase 0
   verification `npm run build` died at `tsc -b` with `FATAL ERROR: Zone Allocation failed - process
   out of memory` at only ~150 MB of heap, while `tsc --noEmit -p tsconfig.app.json` on the identical
   files passed in seconds. Cause was the stale incremental artefact in `node_modules/.tmp`, written
   before the corrupted schema file was repaired. `rm -rf node_modules/.tmp && npx tsc -b
   tsconfig.app.json --force` cleared it permanently; the build has been green and repeatable since.
   Recorded because the error message points at the wrong thing entirely — reach for `--force`
   before believing a memory problem.
10. **Three backend behaviours look like success and are not.** Found in Phase 1 while reading the
    OpenAPI document and the service code. A degraded `/health` returns **HTTP 200**, so status must
    be read from the body, never from `response.ok`. An all-null `/predict` body returns **200** with
    `imputation_count: 24` — a complete-looking result built entirely from estimated values. A batch
    CSV containing only `age,bp` returns **200** with `imputation_count: 22` per row and no indication
    the file was wrong. Each is a place where a reasonable frontend shows a confident answer that
    should have been a warning. Addressed by R1.3 health handling, R3.5 imputation disclosure, and
    R8.6 header validation; each has a test.
11. **`/predict/batch` declares no `requestBody` in the OpenAPI document**, so nothing about the CSV
    contract is machine-readable and the schema-derivation layer cannot cover batch. The batch tests
    therefore rely on recorded fixtures rather than derived bounds. Open; a backend `requestBody`
    declaration would close it, and is not requested in this phase.

## Definition of success

A polished end-to-end user experience that uses the existing Python backend as its authoritative
source for predictions, preprocessing, SHAP, model metadata, and results — and that never shows a
number it cannot trace to a backend response.

---

## Phase 1 ledger

Closed 2026-09-02. Phase 1 designed nothing into code: no component, no route, no dependency, no
`.github/` file, no backend change. It produced two new documents and amended this one.

Deliverables: [`FRONTEND_ARCHITECTURE.md`](FRONTEND_ARCHITECTURE.md) (information architecture for 14
areas, route architecture, assessment IA, design system and tokens, the five-label status system,
content architecture, API and data architecture, security and privacy, accessibility, and twenty-five
recorded contradictions), [`FRONTEND_TEST_PLAN.md`](FRONTEND_TEST_PLAN.md) (six tiers, 181 specified
tests, fixture strategy, coverage floors, the frontend CI workflow, and the writing order), the ADR
set in architecture §10, and the amendments below.

### What Phase 1 verified against the running backend

Every claim in the two new documents was checked against `api/`, `src/services/clinical_prediction.py`,
`config.py`, and a live `GET /openapi.json` — not inferred from the previous phase's notes.

- The API surface is exactly four application routes plus the OpenAPI document. No fifth route exists,
  and none was invented.
- `/model.feature_schema` is `NUMERIC_COLUMNS + BINARY_COLUMNS` — the 24 raw field names in order, not
  encoded columns. It is the only ordering the frontend will use.
- `/openapi.json` carries Pydantic `ge`/`le` as `minimum`/`maximum` and `Literal` as `enum`, on the
  non-null branch of each field's `anyOf`. Every field is optional and nullable; `extra="forbid"` is
  declared; there are no required fields.
- `RISK_BAND_BOUNDS = (0.35, 0.65)` with inclusive comparison, and the verdict threshold at 0.5,
  together make only four of six verdict × band pairs reachable. `ckd`+`LOW` and `notckd`+`HIGH`
  cannot occur and now render a contract-violation state.
- `predict_one` hardcodes `top_n=3` and sorts drivers itself. The frontend renders what it receives.
- `model.version` is already `sha256[:12]`; the frontend reads it rather than truncating.
- Pydantic v2 error discriminators are `greater_than_equal`, `less_than_equal`, `literal_error`,
  `float_parsing`, and `extra_forbidden`, with bounds in `ctx.ge`/`ctx.le` and choices in
  `ctx.expected`. Single-prediction `loc` is `["body", field]`; batch `loc` is `[rowIndex, field]`.
- 415 and 503 send `detail` as a bare string; 422 sends an array of objects. Both shapes are handled.
- `config.FEATURE_PROMPTS` holds patient-phrased prompts for all 24 fields but no endpoint exposes
  them — good source material for the content layer, recorded as backend dependency 3, not assumed.

### Requirements changed in this document

The route map gained `/research/batch`; Demo Mode and Reports are stated to be deliberately not
routes. The backend-contract table was rewritten row by row against the live document. The five status
labels were rewritten, with a fixed vocabulary and `LIVE`/`REAL`/`DEMO`/`MOCK`/`BETA`/`COMING SOON`
banned. Critical Rule 11 was broadened from `/model` to all four path-leak routes.

Area requirements amended: **R2.3** into five named steps with a no-lab-first rationale; **R2.10** to
name BP as diastolic and record the systolic-120-inside-range hazard; **R2.15** to address the reader
in the second person, with a British-spelling house rule; **new R2.16** requiring client and server
wording for one fault to be string-identical. **R3** was restructured so verdict and band compose into
one statement rather than two badges that can read as contradictory, with colour demoted to a
secondary channel and `model.limitations` read from the embedded block. **R4.2** now asserts received
order instead of imposing a sort. **R8.5–R8.6** added client-side header validation, per-row
imputation prominence, the `loc[0] + 2` CSV line rule, and the two `detail` shapes. **R9.2** reads
`model.version` instead of slicing `sha256`; **R9.4** forbids `training_date` from appearing in source
at all; **new R9.5** makes every `metrics` key conditional. **R13** replaced the non-existent
"assessment id" with a device-generated reference. Security gained the relative-`/api` decision, a
no-body-logging rule, and `sourcemap: false`. Testing now points at `FRONTEND_TEST_PLAN.md` and lists
six tiers. Risks 3, 4, 6, and 7 were updated, and risks 10 and 11 added.

Three requirements were found to describe things that do not exist and were resolved without inventing
backend capability: the "assessment id", the training date, and a fifth SHAP driver.

---

## Phase 0 ledger

Closed 2026-09-01. This section records what Phase 0 actually did, so nothing here has to be
re-derived. It is a record, not a requirement — the requirements are everything above.

Phase 0 deliverables: this document (rewritten as the single authority),
[`FRONTEND_REQUIREMENTS_RECONCILIATION.md`](FRONTEND_REQUIREMENTS_RECONCILIATION.md), SUPERSEDED
banners on the three `.kiro/specs/ckd-frontend/` files, and a `ckd-frontend/` tree that typechecks,
lints, tests, and builds clean. No UI was built. No dependency was installed. The backend was not
touched.

### What was found

The frontend on disk was **a stock Vite template sitting on top of a genuinely good data layer**,
with documentation that misdescribed both.

- `ckd-frontend/src/App.tsx` (deleted in Phase 0) was the unmodified Vite starter — a click
  counter with links to Vite docs, Discord, Bluesky, and X — plus its 184-line `App.css` and
  111-line `index.css` (purple `#aa3bff` accent). No product UI existed at all.
- The stack on disk was **Vite 8 + React 19 + hand-rolled BEM CSS**, not the Next.js + Tailwind this
  plan used to name. That mismatch is why the stack decision went to Vite: the code, the old Kiro
  `design.md`, and the backend's CORS allow-list (`:5173`) already agreed with each other, and only
  this document disagreed.
- Beneath it sat ~1,100 lines worth keeping: the API client, the error handler, the response types,
  and the 24-field metadata table.
- **Three documents named the wrong file as broken.** `CORRUPTED_FILES.md`, `STATUS.md`, and
  `REPOSITORY_CLEANUP.md` all said `src/services/api.ts` was corrupted and uncommittable. It was
  neither — it compiled, and 18 of its 22 tests passed. The file that actually was corrupted,
  `src/types/validation.schema.ts`, was named nowhere.
- **`ckd-frontend/.gitignore` was excluding 648 lines of working source** on the strength of that
  false claim. `src/services/api.ts`, `error-handler.ts`, and `src/services/*.test.ts` were invisible
  to git and one `git clean -fdx` from unrecoverable loss.

Backend decoupling was verified before anything was deleted, not assumed:

- A repo-wide search for `ckd-frontend` across every `*.py`, `*.toml`, `*.cfg`, `*.ini`, `*.yml`,
  `Makefile`, `*.ps1`, and `*.txt` returned **zero hits**. No Python file imports, reads, or serves
  anything under `ckd-frontend/`.
- No `StaticFiles`, no `mount`, no Jinja templates in `api/` or `src/` — the API never serves the
  frontend bundle. The only coupling is HTTP plus CORS.
- Exactly one `package.json` and one `node_modules` in the repository, both under `ckd-frontend/`.
  No stray Next, Vue, Svelte, loose `.jsx`, or orphan `.html` anywhere else.

### What was removed

Every path below was confirmed frontend-only against the repo-wide search above before deletion.

**Vite template scaffolding** — `src/App.tsx`, `src/App.css`, `src/App.test.tsx`, `src/index.css`,
`src/assets/` (`hero.png`, `react.svg`, `vite.svg`), `public/favicon.svg`, `public/icons.svg`
(Vite's Discord/Bluesky/X sprite), and the stale `dist/` build output of that template.

**Superseded form components** — `src/components/` in full: `NumericInput` (211 lines),
`CategoricalSelect` (131), `FormSection` (73), three `.css` files, three test files, and `index.ts`.
About 1,700 lines, 988 of them tests. They were BEM-CSS components built for a flat
all-24-fields-at-once clinician form, which the reconciliation rejects in favour of a guided
multi-step patient flow in Tailwind. **Their accessibility patterns were harvested into the
Accessibility section above before deletion** — that was the point of doing Part A first.

**`src/types/validation.schema.example.tsx`** — a demo file, and the source of two of the four lint
errors.

**Documentation that was actively wrong** — `ckd-frontend/CORRUPTED_FILES.md` (naming the wrong
file; following it would have "fixed" working code and left the real breakage in place),
`ckd-frontend/STATUS.md`, `ckd-frontend/TASK_4.5_VERIFICATION.md`, and the root
`REPOSITORY_CLEANUP.md`. All four also had mangled backtick escapes. Their genuinely useful
history — the 10-requirement / 70-criteria / 91-task shape of the Kiro spec and the four-commit
provenance `31d1660` → `65cf810` — is preserved in §9 of the reconciliation report; their incorrect
claims were not preserved.

`ckd-frontend/README.md` was **rewritten, not deleted** (it claimed React 18, a single-page
clinician app, and MSW).

Nothing under `.kiro/` was deleted. Nothing in `api/`, `src/`, `tests/`, `config.py`,
`saved_models/`, `data/`, `notebooks/`, `scripts/`, or `.github/` was touched.

### What was preserved, and what was repaired

Kept as-is:

- `src/types/api.types.ts` (185 lines) — every field, `ShapDriver`, `PredictionResponse`,
  `BatchPrediction*`, and `HealthResponse` compared against `api/schemas.py` field by field:
  accurate. One caveat for Phase 1: its `ModelInfo` under-describes what `/model` really returns and
  invents `training_date`. Replace it when the real shape is typed.
- `src/services/api.ts`, `error-handler.ts`, `index.ts` and both test files — the `AbortController`
  timeout, `APIError` / `TimeoutError` / `NetworkError`, and the `handleAPIError` /
  `handleValidationError` mapping. These are now **tracked by git for the first time**.
- `src/utils/field-metadata.ts` and its test — 24 fields with labels, full clinical names, units,
  ranges, sections, and good clinical tooltips. This is the precursor to `content/fields.ts`.
- All configuration unchanged: `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc`,
  `tests/setup.ts`, `.env.development`, `.env.production`, `package-lock.json`, `node_modules/`.

Repaired:

| File | What was wrong | Fix |
|---|---|---|
| `src/types/validation.schema.ts` | 10 `z.enum` message strings had unescaped nested double quotes. This was the entire 50-error typecheck failure, and it silently stopped `validation.schema.test.ts` from collecting any of its 466 lines of assertions. | Outer quotes changed to single quotes. Syntax only — the schema contract is unchanged. |
| `src/services/api.test.ts` | Four assertions expected friendly copy from `APIError.message`, which is by design the raw `` `${status} ${statusText}` ``. **The tests were wrong, not the code.** | Each now asserts `.status`, the raw `.message`, and `errorHandler.handleAPIError(err).message` separately — the layering this plan mandates. The `as any` cast behind the third lint error became `as unknown as typeof globalThis.fetch`. |
| `src/services/error-handler.ts:165` | A `Record<string, unknown>` → `FastAPIValidationError` cast TypeScript refuses to narrow directly. | Widened through `unknown`, with a comment explaining why. |
| `src/utils/field-metadata.test.ts` | 18 `Object is possibly 'undefined'` errors under `noUncheckedIndexedAccess`. | `!` assertions, matching the idiom the file already used at line 211. |
| `src/main.tsx` | Imported the deleted `App.tsx`. | Rewritten as a bare `StrictMode` mount with a placeholder, so the build works until Phase 2 adds the router. |
| `index.html` | Dead `<link rel="icon" href="/favicon.svg">` after the icon deletion. | Link removed, real `<title>` and description meta added. |
| `ckd-frontend/.gitignore` | The `# Corrupted files` block excluding working source, plus dead `TASK_*.md`, `SETUP_COMPLETE.md`, and `*.py` rules. | Whole block deleted. |
| root `.gitignore` | A pointless `ckd-frontend/*.py` rule. | Removed. |

Two `NumericInput.test.tsx` tooltip tests were also failing, at the 5-second timeout:
`vi.useFakeTimers()` was active in the `Tooltip` describe block while the test `await waitFor(...)`,
and the fake timers were never advanced. Diagnosed and recorded rather than fixed — the component was
deleted. **Re-implementing the tooltip in Phase 3 means re-encountering this**: with fake timers,
advance them explicitly instead of polling with `waitFor`.

### Dependencies removed

One: **`msw` `^2.15.0`** (devDependency). Declared but imported nowhere — the tests mock
`globalThis.fetch` directly. Phase 5 re-adds it with the integration tests that actually need it.

Kept despite being unused today: `react-hook-form` and `@hookform/resolvers` (their only consumer
was the deleted example file, but both are in the target stack and the assessment form is the next
thing built) and `@types/node`.

Not installed — these belong to Phase 2: `react-router-dom`, `tailwindcss` + `@tailwindcss/vite`,
`lucide-react`, `recharts`, TanStack Query.

### Current state of `ckd-frontend/`

```text
ckd-frontend/
  index.html                    retitled, dead favicon link removed
  package.json                  msw removed
  vite.config.ts  tsconfig.json  tsconfig.app.json  tsconfig.node.json
  eslint.config.js  .prettierrc  .gitignore        corrupted-files block deleted
  .env.development  .env.production
  README.md                     rewritten
  public/                       empty, awaiting real brand assets
  src/
    main.tsx                    bare mount; Phase 2 replaces with the router
    types/     api.types.ts  validation.schema.ts (repaired)  index.ts  README.md
               api.types.test.ts  validation.schema.test.ts (now collecting)
    services/  api.ts  error-handler.ts  index.ts  + 2 test files, now tracked
    utils/     field-metadata.ts  field-metadata.test.ts
  tests/setup.ts
```

No `App.tsx`, no components, no styles — deliberately. Phase 1 designs; Phase 2 scaffolds.

### Verified end state

Every number below is from a command run after the last edit, not from an earlier run.

| Check | Before Phase 0 | After |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | 50 errors | **0 errors, exit 0** |
| `npx eslint .` | 4 errors | **0 errors, exit 0** |
| `npx vitest run` | 185 passed, 6 failed, 9 files | **156 passed, 0 failed, 5 files** |
| `npm run build` | never succeeded | **exit 0**, `dist/` 191 kB, repeatable |
| `venv/Scripts/python.exe -m pytest -q` | 242 passed | **242 passed**, unchanged |
| `git status --porcelain api/ src/ tests/ config.py saved_models/ data/` | — | **empty** |

The test count drops from 191 to 156 because four test files were deleted with their components
(`App.test.tsx` and the three form-component suites, 988 lines). Offsetting that,
`validation.schema.test.ts` collects and runs for the first time — its 466 lines of assertions had
been silently skipped for as long as the corrupted file has been in the repository.

`dist/` was deleted again after the build, so the starting point stays clean.

#### Live contract check

Run against `uvicorn api.main:app --port 8000`, confirming the schema strategy works before Phase 1
depends on it:

- `GET /health` → `{"status":"ok","model":"ready","preprocessor":"ready","shap":"ready",`
  `"schema_compatible":true,"feature_count":24}`. Note `model` is the string `"ready"` — a status, not
  a name. This is why the reconciliation rejects "show the model name from `/health`".
- `GET /model` → `feature_schema` has exactly **24** entries in the order
  `age, bp, sg, al, su, bgr, bu, sc, sod, pot, hemo, pcv, wc, rc, rbc, pc, pcc, ba, htn, dm, cad,`
  `appet, pe, ane`. **Source 1 confirmed.**
- `GET /openapi.json` → `PatientAssessment` carries `minimum`/`maximum` on all **14** numeric fields
  and `enum` on all **10** categorical fields, 24 total. **Source 2 confirmed** — nothing needs
  hardcoding.
- `FIELD_METADATA` in `field-metadata.ts` has **24** keys, identical to `feature_schema` as a set and
  in the same order. **Source 3 is already at parity today**, so the parity test will pass the moment
  it is written.
- `/model` also confirmed: **4 artifacts, every one carrying an absolute `C:\...` path** — the leak in
  rule 11 is real and live. No `training_date` field exists, confirming that requirement was invented.
  `metrics` has 9 keys including `confusion_matrix` and `intervals`, so the Research Lab metrics work
  is buildable. No federated and no threshold key exists anywhere in the response, confirming those
  areas must stay PLANNED.

### Scope notes

Three things a reader might expect to find and will not:

1. **No frontend CI workflow was added.** Creating files under `.github/` was outside the approved
   cleanup scope. It is specified above and is the first Phase 1 action. Flagging it plainly: without
   it, every repair in this ledger can regress silently — which is exactly how a corrupted file stayed
   committed and green.
2. **`ckd-frontend/.env.production` is still gitignored** by the root `.gitignore`. Left alone as
   outside the approved scope, but worth a deliberate decision in Phase 2 — if it holds only a public
   API base URL, it should be tracked; if it will ever hold anything else, see rule 5.
3. **Nothing was committed.** The working tree carries all Phase 0 changes, and the recovered
   `src/services/` files plus both new documents are staged so they are tracked rather than merely
   present. Committing is the user's call.
