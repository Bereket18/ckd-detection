# Frontend Requirements Reconciliation Report

**Phase:** 0 — Frontend audit, requirements reconciliation, cleanup
**Date:** 2026-09-01
**Status:** Complete
**Outcome:** [FRONTEND_PLAN.md](FRONTEND_PLAN.md) is now the single authoritative source for
frontend development. The original specification is retained as superseded historical documentation
at [docs/archive/frontend-spec/](docs/archive/frontend-spec/).

## Why this report exists

Two frontend specifications existed side by side and contradicted each other:

| | Original spec (now archived) | `FRONTEND_PLAN.md` (before) |
|---|---|---|
| Written for | Clinicians, desktop 768–1920 px | Patients + researchers, unspecified |
| Product | One page: form → results, plus CSV batch | 10 areas incl. Learn, Federated, Research Lab |
| Framework | Vite + React 18, port 5173 | Next.js |
| Score display | `ckd_score` as a percentage | "never a calibrated medical probability" |
| Acceptance criteria | 70, EARS-style | none |
| Size | 159 + 1194 + 658 lines, 11/91 tasks done | 320 lines |

Neither was kept for existing. Each requirement was evaluated against the live backend contract
(`api/schemas.py`, `api/routes/*.py`, `src/services/clinical_prediction.py`, `config.py`) and
against the product intent. Requirements that named backend capabilities which do not exist were
demoted to dependencies rather than silently carried forward.

## 1. Kept from the original specification

Roughly 45 of its 70 acceptance criteria survive. Each was checked against the backend before
being kept.

### Verified against the backend contract, kept verbatim

- **Numeric ranges** (R1.3) — all 14 numeric fields compared field-by-field against
  `api/schemas.py:11-24`. Exact match: `age` 0-120, `bp` 30-200, `sg` 1.0-1.03, `al` 0-5, `su` 0-5,
  `bgr` 0-600, `bu` 0-400, `sc` 0-80, `sod` 0-200, `pot` 0-50, `hemo` 0-25, `pcv` 0-60,
  `wc` 0-30000, `rc` 0-10.
- **Categorical enums** (R1.4) — all 10 compared against `api/schemas.py:25-34`. Exact match:
  `rbc`/`pc` normal|abnormal, `pcc`/`ba` present|notpresent, `htn`/`dm`/`cad`/`pe`/`ane` yes|no,
  `appet` good|poor.
- **Every field nullable = missing data** (R1.5) — matches the Pydantic defaults.
- **Disclaimer read from the response, never hardcoded** (R3.6) — `PredictionResponse.disclaimer`
  exists and is returned on every prediction.
- **Imputation transparency** (R3.4) — `imputed_fields` and `imputation_count` are both returned.

### Kept with the error taxonomy corrected

- **Error handling** (R2.4–R2.7 plus `design.md` §Error Handling). Verified these are the status
  codes the backend actually emits: 422 from `api/routes/assessment.py:30`, 503 from
  `api/dependencies.py:21`, 500 from unhandled service errors.
- **415 added.** The original spec missed it. `/predict/batch` rejects a non-`text/csv` content type
  with 415, so the frontend needs a case for it. This is the one place the reconciliation *adds* a
  requirement rather than keeping or rejecting one.
- 30 s timeout and offline handling kept as specified.

### Kept as product requirements

- **SHAP presentation** (R4.1–R4.6) — descending absolute impact, per-direction indicator
  (raises_risk / lowers_risk / neutral), the patient's own value shown beside each driver, and a
  tooltip explaining what a SHAP value is.
- **Validation copy** (R6.1–R6.5, R6.7) — label with abbreviation and full name, inline errors,
  "Must be a valid number", "Value must be at least X", "Value must be at most X", per-field
  clinical tooltip.
- **Health monitoring** (R5.1–R5.5) — check `/health` on load, retry every 60 s while not `ok`,
  block submission on `degraded`, banner when unreachable.
- **Accessibility floor** (R7.4–R7.7) — ≥14 px body text, WCAG 2.1 AA contrast (4.5:1), full
  keyboard operation, ARIA labels on every input and button.
- **Loading states** (R9.1–R9.7) — spinner on submit, inputs disabled during the request,
  "Analyzing patient data…", error alert on failure, upload progress.
- **Model metadata display** (R10.1–R10.3, R10.5, R10.6) — call `/model` on load, show metrics and
  feature count, link to the model card.

### Kept from `design.md`

These are better written than anything in the new plan and survive intact:

- The **ErrorBoundary** pattern and the automatic-retry / graceful-degradation strategies.
- **`sessionStorage`, never `localStorage`**, for in-progress form data, with the stated reason: no
  patient data persists past the tab.
- The **four-tier test split** — unit / component / integration with MSW / accessibility —
  including its explicit reasoning for why property-based testing does not apply to this codebase.
- Port 5173 and the Vite dev server, which matches both the code on disk and the backend's CORS
  allow-list (`api/main.py`), so no backend change was needed to adopt it.

## 2. Rejected from the original specification, with reasons

Nine requirements do not survive. None was dropped for being inconvenient; each is either
contradicted by the backend or by the product decision recorded in `FRONTEND_PLAN.md`.

| Req | Rejected because | Replacement |
|---|---|---|
| **R3.3** show `ckd_score` as a percentage to one decimal | The backend itself states `"The CKD score is not a calibrated probability."` (`src/services/clinical_prediction.py`, `limitations`). A bare percentage reads as a probability to every user. | Non-percentage score presentation plus the `risk_band`. |
| **R3.5** display up to 5 SHAP drivers | Unachievable. `predict_one(..., top_n=3)` is hardcoded and `/predict` exposes no override. | "Render every driver the response returns (currently 3)." Raising it is a backend dependency. |
| **R5.6** show the model name and `feature_count` from `/health` | Misreads the contract. `/health` returns `model: "ready"` — a *status* string, not a name. | Name and feature count come from `/model`. |
| **R6.6** disable submit until all validation errors are resolved | Collides with the missing-data-first design and its explicit "I don't know" affordance. | Block only on *invalid* values, never on empty ones. |
| **R7.1–R7.3** desktop-first 768–1920 px, two-column grid above 1024 px | Obsolete for a patient-facing product. | Mobile-first from 320 px. |
| **R10.4** display the model training date | Invented capability. `model_metadata()` returns no date; the `training_date?` field in `api.types.ts` mirrors nothing. | **Backend dependency (PLANNED).** |
| **R10.7** update metadata when the health check detects a model change | Undetectable. `/health` returns no version, hash, or timestamp. | **Backend dependency (PLANNED).** |
| `design.md` "core functionality works without JavaScript" | False for a Vite SPA. Carrying a requirement nothing can satisfy is worse than dropping it. | Removed. |
| `design.md` tabbed single-page hierarchy, "React 18+" | Superseded by routed multi-page and React 19.2 as installed. | See the plan's route map. |

## 3. Relocated rather than deleted

**R8 CSV batch upload** (7 criteria) moves out of the assessment path and into **Research Lab**.

Rationale: batch scoring is wrong for a patient completing one assessment, but `/predict/batch` is
implemented and working, and bulk scoring is exactly what a research tool needs. Two corrections
were applied while moving it:

- **415 case added** (the original spec omitted it) — see §1.
- The endpoint also accepts `application/json` and `application/csv`, and takes an
  `explain=false` query parameter, so batch SHAP is opt-in. The original spec described only
  `text/csv`.

## 4. Changed in `FRONTEND_PLAN.md`

The plan was not treated as automatically correct. Eleven changes were made to it.

1. **Stack corrected: Next.js → Vite 8 + React 19 + React Router.** The plan named a framework the
   repo does not use and never used. Vite is what is installed, what `design.md` specified, and
   what the backend's CORS allow-list already permits.
2. **Consequence of having no server tier, which the plan missed:** every `VITE_*` variable is
   inlined into the browser bundle at build time. The plan's "do not expose secrets" rule was
   therefore restated concretely: *no secret may ever live in a `VITE_*` variable or a `.env.*`
   file.*
3. **Rule 6 ("do not hardcode the 24-feature schema") made implementable.** As written it had no
   mechanism. It now has a three-source strategy, every source verified to exist — see §5.
4. **"Never recompute derived values" generalised.** The plan said this for SHAP direction only. It
   now also covers `risk_band`: `config.RISK_BAND_BOUNDS = (0.35, 0.65)` is not exposed by any
   endpoint and must not be duplicated in the frontend.
5. **New hard rule: the frontend never renders `model.artifacts[*].path`.** `/model` currently ships
   absolute filesystem paths to the browser — see §7 item 7.
6. **Acceptance criteria added.** The plan had none; it was a vision document. Each of the 10 areas
   now carries EARS-style criteria, seeded from the ~45 criteria kept in §1.
7. **Areas with no backend data source are now labelled**, not described as if they were live. See §6.
8. **Demo Mode rules added** — a persistently visible banner, synthetic values held in state
   separate from real input, and no path by which demo data can reach a real assessment.
9. **Nearby Facilities constrained** — provider unnamed, so marked PLANNED; requires explicit
   geolocation consent; forbidden from receiving any assessment field; precise coordinates never
   persisted.
10. **Reports specified as client-side** generation from the response the user already holds, since
    no backend report endpoint exists.
11. **Routing, state management, and a frontend CI job named** — the plan specified none of the three.

## 5. The three-source schema strategy

This resolves the plan's rule 6. All three sources were verified against the running contract.

| Source | Supplies | Verified at |
|---|---|---|
| `GET /model` → `feature_schema` | Field **list and order** — the 24 raw field names, not encoded columns | `config.py:90-102` (`NUMERIC_COLUMNS + BINARY_COLUMNS`) |
| `GET /openapi.json` | Numeric **min/max** and categorical **enum values** | FastAPI emits Pydantic `ge`/`le` as `minimum`/`maximum` and `Literal` as `enum` for `PatientAssessment` |
| Frontend `content/fields.ts` | **Editorial copy** — patient-friendly label, unit text, tooltip, where-to-find-this-value, technical explanation | Prose, not schema; legitimately owned by the frontend |

**Parity test (required, not optional).** A test asserts the content-layer keys are exactly the 24
names in `/model.feature_schema`. A backend schema change then fails the frontend build instead of
silently dropping a field from the form. Without it the three sources drift and nobody finds out.

Note: the backend already holds patient-phrased prompts for all 24 fields in
`config.FEATURE_PROMPTS` (`config.py:145`). Good source material for the editorial copy — currently
not exposed by any endpoint.

## 6. Unresolved conflicts

Stated plainly rather than papered over. The API surface is exactly four routes —
`/health`, `/model`, `/predict`, `/predict/batch` (`api/main.py`).

### Conflict 1 — Research Lab cannot be built as specified

The plan says Research Lab shows *real backend data* for datasets, models, metrics, comparisons,
confusion matrices, threshold analysis, and **federated results**, and that nothing is hardcoded.

What `/model` actually exposes: `datasets`, `n_rows`, `n_train`, `n_test`, and a metrics block with
`accuracy`, `precision`, `recall`, `specificity`, `f1`, `auc_roc`, `brier_score`,
`confusion_matrix`, and `intervals`.

What it exposes for the rest: **nothing.** There is no route for federated results, model
comparisons, or threshold analysis. `src/federated/` and `tabular_model.threshold_sweep` exist in
the codebase but no endpoint reaches them.

**Resolution:** build Research Lab from `/model` for the parts that exist. Mark comparisons,
threshold analysis, and federated results **NOT VERIFIED — backend endpoint PLANNED**. Do not
fabricate them.

### Conflict 2 — Federated AI and Multimodal AI have no data source at all

The plan already requires labelling federated content as a simulation, which is consistent. It also
asks Multimodal to avoid implying real patient-level pairing "unless verified by the backend" — but
there is no endpoint to verify against, so the answer is fixed rather than conditional: **both pages
are educational simulations, statically labelled, with no live data.**

`saved_models/imaging_model.pt` and `saved_models/fusion_model.pt` exist on disk but are not
reachable through the API.

### Conflict 3 — model version identity

The only version handle is the first 12 characters of the model file's sha256. Adequate for display,
useless for change detection — which is why R10.7 was rejected. Documented as a dependency, not
solved.

## 7. Backend dependencies (all PLANNED — none actioned in Phase 0)

No file under `api/`, `src/`, `tests/`, `config.py`, `saved_models/`, or `data/` was modified.
These are proposals for a later phase:

1. **Model training date** on `/model` — blocks R10.4.
2. **`top_n` override** on `/predict` — blocks showing more than 3 SHAP drivers.
3. **A `/schema` endpoint** carrying units and human labels — would let `config.FEATURE_PROMPTS` be
   reused instead of re-authored in the frontend.
4. **Federated results endpoint** — blocks the Federated AI page and part of Research Lab.
5. **Threshold-sweep endpoint** — `tabular_model.threshold_sweep` exists but is unreachable.
6. **A model-version field on `/health`** — blocks R10.7 change detection.
7. **Redaction of `artifacts[*].path`.** `artifact_metadata` in
   `src/services/clinical_prediction.py` embeds `"path": str(path)`, so an absolute filesystem path
   such as `C:\Users\<user>\...\saved_models\tabular_model.joblib` reaches the browser today. The
   backend is frozen in Phase 0, so this is mitigated frontend-side by the never-render rule in §4
   item 5 plus a test, and recorded here as a Phase 1 backend security issue. Use `sha256` as the
   version id.
8. **A report endpoint**, only if reports move server-side. Not needed for the client-side design.

## 8. Requirements that must be tested

This list feeds the Phase 1 test plan. Each item is a requirement that can silently stop being true:

1. The 24 field ranges and enums match `/openapi.json`.
2. Content-layer keys are exactly `/model.feature_schema` (the parity test from §5).
3. The 422 / 500 / 503 / 415 / timeout / offline error mapping.
4. SHAP drivers render in descending absolute impact with the correct per-direction indicator.
5. `model.artifacts[*].path` is never rendered.
6. `risk_band` is never recomputed in the frontend.
7. Imputation is disclosed whenever `imputation_count > 0`.
8. The assessment can be completed keyboard-only.
9. Contrast ratios meet WCAG 2.1 AA.
10. Demo data can never be submitted as a real assessment.

## 9. Documentation superseded

Three documents actively misdiagnosed the repository. All three named
`ckd-frontend/src/services/api.ts` as corrupted and uncommittable. It is not — it compiles cleanly
and 18 of its 22 tests pass. The file that *is* corrupted,
`ckd-frontend/src/types/validation.schema.ts`, was named by none of them. Anyone following that
documentation would have "fixed" working code and left the real breakage in place.

Worse, the false claim had been encoded into `ckd-frontend/.gitignore`, which excluded
`src/services/api.ts`, `src/services/error-handler.ts`, and `src/services/*.test.ts` from version
control — 648 lines of working source that a single `git clean -fdx` would have destroyed with no
history to recover from.

Historical facts worth keeping from `REPOSITORY_CLEANUP.md` before its removal:

- The original specification comprised **10 requirements / 70 acceptance criteria / 91 tasks**, of
  which 11 were marked complete. Those figures are the baseline this reconciliation measures against.
- The frontend was built across four commits (`31d1660` → `65cf810`), with the service layer added
  last and never tracked, which is how the `.gitignore` exclusion went unnoticed.
- Its stated fallback option — "all specifications are complete, regenerate clean code from specs" —
  is now resolved: the specifications were *not* complete or consistent, which is why this report
  exists.

Its incorrect claims were not carried forward. Removed: `REPOSITORY_CLEANUP.md`,
`ckd-frontend/CORRUPTED_FILES.md`, `ckd-frontend/STATUS.md`.

## 10. Status of the original specification

Its `requirements.md`, `design.md`, and `tasks.md` are **retained**, each carrying a SUPERSEDED
banner pointing at `FRONTEND_PLAN.md`. Contents are otherwise unchanged and no specification
document was deleted; all three are archived at
[docs/archive/frontend-spec/](docs/archive/frontend-spec/). The 91 tasks in `tasks.md` are
superseded, not scheduled — none were executed in Phase 0.
