# EthioCKD Frontend Architecture

> **Phase 1 deliverable. Implementation-ready, not implemented.** No component, route, or dependency
> from this document exists yet — Phase 2 builds it.
>
> Companion documents: [FRONTEND_PLAN.md](FRONTEND_PLAN.md) is the authoritative requirements
> specification; [FRONTEND_TEST_PLAN.md](FRONTEND_TEST_PLAN.md) is the test matrix and CI definition;
> [FRONTEND_REQUIREMENTS_RECONCILIATION.md](FRONTEND_REQUIREMENTS_RECONCILIATION.md) records why the
> requirements say what they say.
>
> Where this document and `FRONTEND_PLAN.md` disagree, the plan wins and this document is wrong —
> except for the amendments in §11, which were applied to the plan.

## Contents

| § | Deliverable |
|---|---|
| [0](#0-verified-backend-contract) | Verified backend contract |
| [1](#1-information-architecture) | Information architecture |
| [2](#2-route-architecture) | Route architecture |
| [3](#3-assessment-and-result-architecture) | Assessment and result architecture |
| [4](#4-design-system) | Design system |
| [5](#5-status-label-system) | Status-label system |
| [6](#6-content-architecture) | Content architecture |
| [7](#7-api-and-data-architecture) | API and data architecture |
| [8](#8-security-and-privacy-architecture) | Security and privacy architecture |
| [9](#9-accessibility-architecture) | Accessibility architecture |
| [10](#10-architecture-decision-records) | Architecture decision records |
| [11](#11-contradictions-found-and-fixed) | Contradictions found and fixed |
| [12](#12-backend-dependencies-and-open-questions) | Backend dependencies and open questions |

## 0. Verified backend contract

Everything in this section was re-verified in Phase 1 against a running backend
(`uvicorn api.main:app --port 8000`) and against the Python source. Nothing here is inferred from
documentation.

**There are four application endpoints, plus the OpenAPI document used for schema metadata.**
`GET /openapi.json` is FastAPI's own description of the app; it is not an application route and does
not appear in its own `paths`. `paths` contains exactly `/health`, `/model`, `/predict`,
`/predict/batch`. Any capability not derivable from those five URLs does not exist.

### 0.1 The five URLs

| URL | Method | Request | Response shape (verified live) |
|---|---|---|---|
| `/health` | GET | — | `{status, model, preprocessor, shap, schema_compatible, feature_count, detail}` |
| `/model` | GET | — | `model_metadata()` verbatim — 11 keys, see §0.3 |
| `/predict` | POST | `PatientAssessment` JSON, `?explain=bool` | `PredictionResponse` — 9 keys, see §0.4 |
| `/predict/batch` | POST | `text/csv` or `application/json`, `?explain=bool` | `{count, results[]}` of `BatchPredictionItem` |
| `/openapi.json` | GET | — | OpenAPI 3.1 document; the only machine-readable source of field bounds and enums |

### 0.2 `/health` — a status probe, not a model description

```json
{"status":"ok","model":"ready","preprocessor":"ready","shap":"ready",
 "schema_compatible":true,"feature_count":24,"detail":null}
```

`model` is the string `"ready"` — a **component status, not a model name**. The frontend must never
render it as an identity. `status` is `"ok" | "degraded"`. The degraded case returns **HTTP 200**
with a populated `detail`, so a 200 is not proof of readiness; `status` must be read.
`api/routes/health.py` builds `detail` from `str(exc)`, and `ArtifactLoadError` messages embed
absolute artifact paths — so `detail` is a path-leak surface (§8).

### 0.3 `/model` — the metadata document

Keys, all verified present in a live response: `name`, `version`, `feature_count`,
`feature_schema`, `datasets`, `n_rows`, `n_train`, `n_test`, `metrics`, `artifacts`, `limitations`.

- `version` is already `artifacts.model.sha256[:12]` — verified `"e2efbaa03e21"`. The frontend reads
  `version`; it never slices a hash itself.
- `feature_schema` is exactly 24 raw field names in model order:
  `age, bp, sg, al, su, bgr, bu, sc, sod, pot, hemo, pcv, wc, rc, rbc, pc, pcc, ba, htn, dm, cad,
  appet, pe, ane`. This is the single source of field identity and order.
- `metrics` keys are **conditional** — `model_metadata()` copies each key only `if key in
  self.metrics`. All nine (`accuracy`, `precision`, `recall`, `specificity`, `f1`, `auc_roc`,
  `brier_score`, `confusion_matrix`, `intervals`) are present today; every one must still be typed
  and rendered as optional.
- `artifacts` is `{name: {path, sha256}}` where `path` is an **absolute server filesystem path**.
  Verified live: `C:\Users\berek\Desktop\ckd-federated-agent\ckd-detection\saved_models\tabular_model.joblib`.
  Never rendered. `sha256` is safe.
- `limitations` is five backend-authored strings including *"The CKD score is not a calibrated
  probability."* — the source for the model-card caveats, never rewritten.
- The response carries **no `Cache-Control` and no `ETag`**, so there is no HTTP-level caching to
  lean on. Client-side caching is therefore ours to own (§7, ADR-4).

### 0.4 `/predict` — the prediction response

Live response for a fully populated assessment:

```json
{"prediction":"ckd","ckd_score":0.9435899985127416,"risk_band":"HIGH",
 "imputed_fields":[],"imputation_count":0,
 "shap_drivers":[{"feature":"hemo","impact":0.0938,"direction":"raises_risk"}, ...],
 "explanation":"Your hemoglobin level, serum creatinine, and red blood cell count pushed your risk up.",
 "model":{...full /model metadata...},"disclaimer":"..."}
```

Four facts that shape the entire Results area:

1. **`explanation` exists and is patient-phrased.** `string | null`. The backend already writes the
   plain-language summary; the frontend renders it rather than composing its own (§3.11, C5).
2. **`shap_drivers` is already sorted** by descending `abs(impact)` —
   `src/explain/shap_utils.py:99-106`. The frontend renders the received order and never re-sorts
   (C2). There are exactly 3; `top_n` is not exposed by the route.
3. **`model` is the whole metadata dict**, so `/predict` leaks `artifacts[*].path` into the Results
   and Explainability screens, not just the Model Card. The path rule had to broaden (C1).
4. **`risk_band` is a band on P(CKD), not confidence in the verdict.** `RISK_BAND_BOUNDS = (0.35,
   0.65)` with the verdict threshold at 0.5 and inclusive bounds. Only four pairs are reachable:

   | `prediction` | `risk_band` | Meaning | Reachable |
   |---|---|---|---|
   | `notckd` | `LOW` | Score ≤ 0.35 | yes |
   | `notckd` | `MODERATE` | 0.35 < score < 0.5 — near the boundary | yes |
   | `ckd` | `MODERATE` | 0.5 ≤ score < 0.65 — near the boundary | yes |
   | `ckd` | `HIGH` | Score ≥ 0.65 | yes |
   | `ckd` | `LOW` / `notckd` | `HIGH` | impossible — treat as a contract violation |

   `MODERATE` therefore always means *near the decision boundary*, in both directions. A result
   screen that colours the verdict green and the band amber, with no explanation, looks broken and
   misleads (C4, §3.11).

### 0.5 Error contract

| Code | Where | `detail` shape | Notes |
|---|---|---|---|
| 422 | `/predict` | array of `{type, loc, msg, input?, ctx?}` | `loc = ["body", field]`. **`input` echoes the submitted value.** |
| 422 | `/predict/batch` | array | `loc = [rowIndex, field]` — **row index first, as a number** |
| 415 | `/predict/batch` | **string** | `"Use application/json or text/csv for batch prediction."` |
| 503 | any | string from `str(exc)` | Path-leak surface |
| 500 | any | FastAPI default | — |

Real Pydantic **v2** error types observed live: `less_than_equal` / `greater_than_equal` (with
`ctx.le` / `ctx.ge` as numbers), `literal_error` (`ctx.expected: "'normal' or 'abnormal'"`),
`float_parsing`, `extra_forbidden`. The existing `error-handler.ts` matches Pydantic **v1** wording
and never fires (C8).

`PatientAssessment` is `extra="forbid"` with no required fields: the payload must be exactly the 24
schema keys or a subset, all nullable. Any UI-only field added to the body produces a 422 (C13).

### 0.6 `/openapi.json` — the schema-metadata source

The only machine-readable source of bounds and enums. `components.schemas.PatientAssessment`:

```json
"age":  {"anyOf":[{"type":"number","maximum":120.0,"minimum":0.0},{"type":"null"}],"title":"Age"}
"rbc":  {"anyOf":[{"type":"string","enum":["normal","abnormal"]},{"type":"null"}],"title":"Rbc"}
```

Because every field is `T | None`, the reader must walk `anyOf` and take the non-null branch.
14 numeric fields carry `minimum`/`maximum`; 10 carry `enum`; 14 + 10 = 24, matching
`feature_schema`. `additionalProperties: false`, `required` absent.

One gap: **`/predict/batch` declares no `requestBody`**, so the accepted content types are *not*
discoverable from the document. They are `text/csv`, `application/csv`, `application/json`
(`api/routes/assessment.py`), and must be recorded in the frontend as a documented constant with a
comment naming the source (C19).

### 0.7 `/predict/batch` — silent imputation

Verified live: a CSV containing only `age,bp` returned **HTTP 200** with `imputation_count: 22` per
row and confident predictions. Missing or misnamed columns are not an error. Batch items also carry
**no `explanation`, no `model`, and no `disclaimer`** — only `prediction`, `ckd_score`, `risk_band`,
`imputed_fields`, `imputation_count`, `shap_drivers`. Consequences for the frontend: header
validation before upload, a generated template, mandatory imputation disclosure, and a disclaimer
sourced from a separate `/model` read (C6, C20, §1.13).

## 1. Information architecture

### 1.1 The product in one sentence

One person's kidney-risk screening journey — *understand the risk → answer what you know → see an
explained result → learn what to do next* — with a research wing attached to the same verified
backend, and every area that lacks a backend source visibly labelled rather than faked.

### 1.2 Two audiences, one navigation

The plan requires the product to be patient-friendly and to serve technical users. Rather than two
apps or a mode switch, the split is **depth, not duplication**:

- **Patient path** — `/`, `/assessment`, `/results`, `/learn`, `/facilities`. Plain language,
  one decision per screen, no jargon without a definition.
- **Research path** — `/explainability`, `/research`, `/research/batch`, `/model-card`,
  `/multimodal`, `/federated`. Assumes comfort with metrics and model vocabulary.
- **Shared** — `/about`, demo mode, the health banner, the status-label system.

Every technical area is reachable from a patient screen through an explicit "how this works" link,
never through jargon in the primary flow. Nothing in the patient path requires understanding the
research path, and no research area is a prerequisite for a result.

### 1.3 Area map

| # | Area | Route | Audience | Data source | Label |
|---|---|---|---|---|---|
| 1 | Dashboard | `/` | both | `/health`, `/model` | VERIFIED |
| 2 | Assessment | `/assessment` | patient | `/model`, `/openapi.json`, content layer | VERIFIED |
| 3 | Results | `/results` | patient | `/predict` response in memory | VERIFIED |
| 4 | Explainable AI | `/explainability` | both | `shap_drivers` + content layer | VERIFIED |
| 5 | Learn | `/learn` | patient | content layer only | PROVISIONAL |
| 6 | Multimodal AI | `/multimodal` | technical | none | SIMULATION |
| 7 | Federated AI | `/federated` | technical | none | SIMULATION |
| 8 | Research Lab | `/research` | technical | `/model` | VERIFIED + PLANNED parts |
| 9 | Model Card | `/model-card` | both | `/model` | VERIFIED |
| 10 | About | `/about` | both | content layer, `/model.version` | — (editorial) |
| 11 | Demo Mode | cross-cutting | both | synthetic input → real `/predict` | SIMULATION (input) |
| 12 | Nearby Facilities | `/facilities` | patient | none chosen | PLANNED |
| 13 | Batch Scoring | `/research/batch` | technical | `/predict/batch` | VERIFIED |
| 14 | Reports | cross-cutting | both | the response already in memory | inherits its source |

Demo Mode and Reports are deliberately not routes — see §1.11 and §1.17. Fourteen rows, not thirteen:
the plan and the phase brief each list thirteen areas but disagree about the last one (C21), so both are
carried — Batch has a real endpoint and a distinct user, Reports has neither a route nor a data source of
its own but does have requirements to satisfy.

### 1.4 Dashboard — `/`

- **Purpose.** Explain what this tool is and is not in the first screenful, then start the
  assessment. It is an entry point, not a data console.
- **User.** Anyone arriving cold, most likely on a phone, possibly with no prior idea what CKD is.
- **Primary action.** *Start assessment.* One primary button; everything else is secondary.
- **Shows.** A one-sentence statement of purpose; the not-a-diagnosis framing; how long the
  assessment takes and that unknown values are acceptable; backend availability; the model version
  and dataset size as a trust signal; entries to Learn and About.
- **Source.** `/health` for availability, `/model` for `version`, `n_rows`, `name`. Nothing computed.
- **Label.** VERIFIED for the live figures. No label on editorial copy.
- **In.** App root, logo click, post-reset "start over".
- **Out.** `/assessment` (primary), `/learn`, `/about`, `/model-card`, `/research`.
- **Relationships.** The only screen that links to every other area. When `/health.status` is
  `degraded` or unreachable, the primary button is disabled with the reason stated and the Learn and
  research entries stay open — a broken backend must not make the whole product feel broken.

### 1.5 Assessment — `/assessment`

- **Purpose.** Collect as much of the 24-field schema as the person can supply, without making
  missing data feel like failure.
- **User.** Patient or health worker, phone-first, likely holding a paper lab report.
- **Primary action.** Answer the current step and advance; submit at the end.
- **Shows.** One grouped step at a time, progress, per-field help, an explicit *I don't know* on
  every field, a running count of what will be estimated, and a review screen before submitting.
- **Source.** Field identity and order from `/model.feature_schema`; bounds and enums from
  `/openapi.json`; all human wording from `src/content/fields.ts`. Nothing about the schema is
  hardcoded in the UI (§6).
- **Label.** VERIFIED — the fields and limits are the model's own.
- **In.** Dashboard, header CTA, `/results` → "start a new assessment", demo mode.
- **Out.** `/results` on success; stays put on validation failure; drafts survive navigation inside
  the app via `sessionStorage` (§8).
- **Relationships.** The only writer of prediction state. Blocked when `/health.status` is not `ok`,
  because a submission would fail anyway and lose the person's work.

### 1.6 Results — `/results`

- **Purpose.** Deliver the outcome truthfully: what the model said, how sure it is *about the risk*,
  what was estimated rather than measured, and what to do next.
- **User.** The person who just completed the assessment.
- **Primary action.** Read and understand; then either see the explanation in depth or act on the
  next-step guidance.
- **Shows.** The verdict and band as one composed statement from the four-state matrix (§0.4); the
  backend's `explanation` sentence; the top drivers with the person's own values; the imputation
  disclosure whenever `imputation_count > 0`; the backend `disclaimer` verbatim; the score presented
  as a relative indicator that is never called a probability or a percentage; and the embedded
  `model.limitations` list (plan R3.6), which arrives inside the prediction response, so Results needs
  no second read to state the model's own stated limits.
- **Source.** The in-memory `/predict` response only. Nothing recomputed — not the band, not the
  driver order, not the direction, not the imputation list (C2, C3).
- **Label.** VERIFIED.
- **In.** Only a successful `/predict`. Direct navigation with no prediction in memory shows the
  empty state, never a fabricated result (§2.4).
- **Out.** `/explainability` (deep dive), `/facilities`, `/learn`, `/assessment` (new assessment,
  which clears state after confirmation).
- **Relationships.** The hinge of the product. Holds the only patient data in the running app, and
  that data dies with the tab (§8).

### 1.7 Explainable AI — `/explainability`

- **Purpose.** Show *why* — what SHAP is, what these three drivers mean, and what the method cannot
  tell you.
- **User.** Curious patient and technical reviewer, at two reading depths on the same page.
- **Primary action.** Inspect a driver and read its explanation.
- **Shows.** The drivers in received order with impact magnitude and direction; the submitted value
  beside each; a plain-language and a technical explanation per field; a standing note that SHAP
  attributes the model's own output, not physiological causation; and that exactly three drivers are
  returned because the backend fixes `top_n=3`.
- **Source.** `shap_drivers` from the in-memory response; wording from the content layer.
- **Label.** VERIFIED for values; the causation caveat is editorial.
- **In.** `/results`, Learn, Model Card.
- **Out.** back to `/results`, `/learn`, `/model-card`.
- **Relationships.** Depends on live prediction state exactly as `/results` does and shares its empty
  state. Raising the driver count is a backend dependency, not a frontend option (§12).

### 1.8 Learn — `/learn`

- **Purpose.** Kidney-health education that is useful whether or not anyone runs an assessment.
- **User.** Patient, family member, health worker.
- **Primary action.** Read; optionally start an assessment from the end of an article.
- **Shows.** What kidneys do, what CKD is, risk factors, what the 24 measurements mean and where to
  obtain them, when to see a clinician, and what this tool is not.
- **Source.** `src/content/education.ts` only. No backend call, so it is the one area that works
  fully while the backend is down.
- **Label.** `PROVISIONAL` at page level (plan R5.4) — editorially authored, not backend output — with
  per-claim sources in the copy wherever a clinical claim is made (R5.3). A claim with no source is
  `NOT VERIFIED`, and the target for that is zero.
- **In.** Global nav, dashboard, results, field help ("learn more about this measurement").
- **Out.** `/assessment`, `/explainability`, `/facilities`.
- **Relationships.** Target of every "what does this mean?" link in the assessment. Field help
  deep-links to the matching section by field name, which is why education content is keyed by field
  name where it is field-specific (§6.4).

### 1.9 Multimodal AI — `/multimodal`

- **Purpose.** Explain how tabular, imaging, and fused models *would* combine — as education, not as
  a feature.
- **User.** Technical visitor, reviewer, examiner.
- **Primary action.** Read the concept; understand precisely what is and is not running.
- **Shows.** The concept, a static illustrative diagram, and an explicit statement that no imaging
  model is reachable through the API and that no patient-level pairing occurs.
- **Source.** **None.** `saved_models/imaging_model.pt` and `fusion_model.pt` exist on disk but no
  route reaches them; the API surface is the four endpoints in §0.1.
- **Label.** **SIMULATION**, persistent, page-level, before any content — plus a per-figure label on
  every illustrative number.
- **In.** Global nav (research group), About, Research Lab.
- **Out.** `/research`, `/model-card`, `/about`.
- **Relationships.** Sibling of Federated AI; both are honest placeholders. Neither may present a
  number that looks like a measurement, and neither may accept patient input.

### 1.10 Federated AI — `/federated`

- **Purpose.** Explain why federated training suits multi-site Ethiopian health data — data stays at
  the site, only updates travel.
- **User.** Technical visitor, reviewer, examiner.
- **Primary action.** Read the concept and the privacy argument.
- **Shows.** The round-based concept, a static illustration, the privacy rationale, and a statement
  that no federated run is exposed by the API.
- **Source.** **None.** `src/federated/` exists; no route reaches it.
- **Label.** **SIMULATION**, page-level and per-figure.
- **In / Out.** As Multimodal.
- **Relationships.** If a federated results endpoint is ever added (§12), this page becomes VERIFIED
  without an IA change — which is why the label is a component and not baked into the copy.

### 1.11 Demo Mode — cross-cutting, not a route

- **Purpose.** Let someone see the full flow without entering their own health data.
- **User.** Evaluator, teacher, first-time visitor.
- **Primary action.** Load a synthetic case, then walk the real flow.
- **Shows.** A persistent banner on every screen while active; the synthetic values in the normal
  assessment UI; a real prediction from the real backend on synthetic input.
- **Source.** Synthetic input from `src/content/demo-cases.ts`; the prediction is genuine.
- **Label.** **SIMULATION** on the *input*, with the banner stating that the prediction is real but
  the person is not. Results produced in demo mode carry the same badge in the results header.
- **In.** Dashboard, About. **Out.** Exiting clears all demo state and returns to `/`.
- **Design constraints.** It is a mode flag plus a case id in memory, not a route and not a second
  form: (a) the banner is rendered by the root layout so no screen can omit it; (b) demo values live
  in the same form state as real input but the mode flag is separate and is never persisted to
  `sessionStorage`; (c) entering or leaving demo mode discards any existing draft and any existing
  prediction, so real and synthetic data can never be mixed in one payload; (d) a prediction made in
  demo mode is tagged in memory, and the tag travels with it to `/results`, `/explainability`, and
  any export, so a demo result can never be presented or saved as a real assessment.

### 1.12 Research Lab — `/research`

- **Purpose.** Show the evaluation evidence the backend actually publishes, and say plainly what it
  does not publish.
- **User.** Technical reviewer, examiner, clinician-scientist.
- **Primary action.** Inspect dataset provenance and evaluation metrics.
- **Shows.** From `/model`: `datasets`, `n_rows`, `n_train`, `n_test`, and the metrics block —
  `accuracy`, `precision`, `recall`, `specificity`, `f1`, `auc_roc`, `brier_score`,
  `confusion_matrix`, `intervals`. Also the `limitations` strings, `version`, and `feature_count`.
  Every metric is rendered as optional (§0.3).
- **Not shown, because no source exists.** Model comparisons, threshold analysis / sweep, federated
  results, training date, learning curves. Each is a labelled **PLANNED** placeholder stating the
  endpoint it needs — never an empty chart and never a plausible number.
- **Source.** `/model` only.
- **Label.** VERIFIED per rendered figure; PLANNED per absent capability.
- **In.** Dashboard, Model Card, global nav. **Out.** `/model-card`, `/research/batch`,
  `/explainability`.
- **Relationships.** Parent of Batch Scoring, and the technical counterpart to the Model Card: the
  card is the narrative, the lab is the numbers.

### 1.13 Batch Research / Scoring — `/research/batch`

- **Purpose.** Score many rows at once for research and evaluation work.
- **User.** Researcher or evaluator with a CSV. Explicitly **not** part of the patient flow.
- **Primary action.** Upload a CSV, review the per-row results, export them.
- **Shows.** A downloadable template generated from `feature_schema`; client-side header validation
  before any upload; per-row verdict, band, and imputation count; an aggregate imputation warning;
  and row-level 422 errors mapped to CSV line numbers.
- **Source.** `POST /predict/batch`, `text/csv` or `application/json`, `?explain=` optional.
- **Label.** VERIFIED for results; a standing research-use notice.
- **Design constraints forced by the verified contract.** (a) Missing or misnamed columns return
  **200** with silent imputation, so the header must be validated against `feature_schema` in the
  browser and a mismatch must block the upload; (b) batch items carry **no `disclaimer`**, so the
  page shows `/model.limitations` from a separate `/model` read and states that provenance; (c) 422
  `loc[0]` is a numeric row index — CSV line number is `loc[0] + 2` with a header row; (d) an
  unsupported content type returns 415 with a **string** `detail`.
- **In.** `/research`. **Out.** back to `/research`. Never links into `/results`, which belongs to
  the single-patient flow.

### 1.14 Model Card — `/model-card`

- **Purpose.** The one page that answers "should I trust this?" honestly.
- **User.** Everyone, at two depths — a plain summary first, technical detail below.
- **Primary action.** Read the intended use and the limitations.
- **Shows.** `name`, `version`, `feature_count`, dataset provenance, headline metrics, and all
  `limitations` strings verbatim — including that the score is not a calibrated probability. Intended
  use, out-of-scope use, and the population the training data represents.
- **Source.** `/model`. `artifacts[*].sha256` may be shown as an integrity id; `artifacts[*].path`
  never appears.
- **Label.** VERIFIED. Absent facts (training date, evaluation date) are PLANNED, not blank.
- **In.** Footer on every page, results, research lab, about. **Out.** `/research`,
  `/explainability`, `/about`.
- **Relationships.** Reachable from every screen; the destination of every "how was this built?" link.

### 1.15 Nearby Facilities — `/facilities`

- **Purpose.** Turn a result into an action: where to get a real test.
- **User.** A patient who has just seen an elevated result.
- **Primary action.** Find a nearby facility.
- **Shows.** Until a provider is chosen: an explanation of the intent, a PLANNED label, and the
  guidance that works without any data source — what kind of facility to ask for, which tests to
  request, and what to bring.
- **Source.** **None chosen.** No backend endpoint exists and no third-party provider has been
  selected.
- **Label.** **PLANNED**, page-level.
- **Non-negotiable constraints, whatever provider is eventually chosen** (§8.6): geolocation only
  after an explicit in-page consent action, never on page load; no assessment field, score, band,
  driver, or prediction may be included in any facility request; precise coordinates are never
  persisted and never logged; a manual text search must always be available so the feature works
  without location access; and the provider must be named in About.
- **In.** `/results`, `/learn`. **Out.** `/learn`, `/results`.

### 1.16 About — `/about`

- **Purpose.** Provenance, scope, privacy posture, and contact.
- **User.** Everyone, plus reviewers checking claims.
- **Primary action.** Understand who built this, on what data, and what happens to the entered data.
- **Shows.** Project purpose and team; the data-handling statement (nothing leaves the browser except
  the assessment payload sent to the prediction API; nothing is stored server-side by this frontend;
  no analytics containing health data); the running model `version`; third-party providers; and the
  status-label legend (§5.6).
- **Source.** Content layer plus `/model.version`.
- **Label.** None; it is the page that explains the labels.
- **In.** Footer, dashboard. **Out.** `/model-card`, `/learn`.

### 1.17 Reports — cross-cutting, not a route

The plan's thirteenth area. It is a capability rather than a destination: it renders nothing of its own,
it is reachable only where there is something to export, and giving it a route would create a page whose
only honest content is "nothing to report yet".

- **Purpose.** Let a person take the result to a clinician, on paper or as a file, without the result
  passing through a server.
- **User.** Patient taking a result to an appointment; researcher exporting a batch run.
- **Offered from.** `/results` (single assessment, plan R13.1) and `/research/batch` (batch run).
  Nowhere else, because nowhere else holds exportable content.
- **How.** Client-side only (plan R13.2). A print stylesheet for the paper path — `window.print()`
  against `@media print` rules, so the artefact is the page the person already read, not a second
  rendering that can drift from it. A `Blob` download for the file path: CSV for batch (built by the same
  twenty-line writer as the template, ADR-15 dependency ledger), and for a single result the printed page
  rather than a generated PDF, since a PDF library is a large dependency for something the browser's own
  print-to-PDF already does.
- **Contents.** Exactly what Results already shows — composed verdict, `explanation`, drivers with the
  person's values, imputation disclosure, `disclaimer`, `model.version` — plus a generation timestamp and
  a **locally generated** report reference (`crypto.randomUUID()`, first eight characters), printed as
  "Report reference — generated on this device". The backend returns no identifier of any kind, so the
  plan's "assessment id" cannot come from the response (C23); the local reference exists only so a person
  and a clinician can name the same sheet of paper, and it is never sent anywhere.
- **Never contains.** Any filesystem path (§8.3), any `detail` string, any `artifacts[*].path`, and no
  demo-mode output without the demo banner reproduced in the print output (plan R11, §8.5).
- **Never transmitted.** No upload, no third-party service, no telemetry (plan R13.3). The export is a
  local file or a local print job, and that is a testable property (T-SEC-13).
- **Label.** Inherits the label of the content it exports: `VERIFIED` for a real prediction,
  `SIMULATION` for a demo-mode result — the badge is part of the printed artefact, not chrome around it.

### 1.18 What connects the areas

Three shared elements are rendered by the root layout, not by individual pages, so no screen can omit
them: the **health banner** (`/health`, §7.4), the **demo banner** (§1.11), and the **footer** linking
Model Card and About. Two pieces of state cross area boundaries: the **prediction** (memory only,
consumed by Results and Explainability) and the **assessment draft** (`sessionStorage`, owned by
Assessment). Nothing else is global (ADR-8).

## 2. Route architecture

### 2.1 Route table

| Path | Layout | Data needs | Blocked when | Empty state |
|---|---|---|---|---|
| `/` | Root | `/health`, `/model` | never | — |
| `/assessment` | Root + Flow | `/model`, `/openapi.json` | `/health.status !== "ok"` | schema unavailable |
| `/results` | Root + Flow | prediction in memory | no prediction | "no result yet" |
| `/explainability` | Root | prediction in memory | no prediction | "no result yet" |
| `/learn` | Root + Doc | none | never | — |
| `/facilities` | Root | none yet | never | PLANNED notice |
| `/multimodal` | Root + Doc | none | never | — |
| `/federated` | Root + Doc | none | never | — |
| `/research` | Root + Research | `/model` | `/model` unavailable | metrics unavailable |
| `/research/batch` | Root + Research | `/model`, `/predict/batch` | `/health.status !== "ok"` | "no file chosen" |
| `/model-card` | Root + Doc | `/model` | `/model` unavailable | metadata unavailable |
| `/about` | Root + Doc | `/model` (version only) | never | version omitted |
| `*` | Root | none | never | 404 |

### 2.2 Layouts

Four nested layouts, chosen because they differ in *chrome and reading width*, not in decoration:

- **Root** — skip link, header, nav, health banner, demo banner, footer, `<ErrorBoundary>`, and the
  route `<Outlet>`. Wraps everything, including 404.
- **Flow** (`/assessment`, `/results`) — narrow single column, no sidebar, progress affordance,
  minimal nav so the task stays foregrounded.
- **Doc** (`/learn`, `/model-card`, `/about`, `/multimodal`, `/federated`) — prose measure with an
  in-page table of contents on wide screens.
- **Research** (`/research`, `/research/batch`) — wider container for tables and charts, sub-nav
  between the lab and batch scoring.

Assessment steps are **not** routes. They are state inside `/assessment` (ADR-6, §3.2), so a step
cannot be deep-linked into with an empty form and the back button behaves predictably (§2.6).

### 2.3 Route-level states

Every data-bearing route defines four states explicitly, and each is a designed screen rather than a
fallback:

1. **Loading** — skeletons that occupy the final layout, plus a polite live-region announcement.
   Never a bare spinner on a blank page (§9.6).
2. **Empty** — the route is reachable but has nothing to show. Says why and offers the action that
   fixes it.
3. **Error** — a normalized message from `ErrorHandler`, the retry affordance where retry is
   meaningful, and never a raw `detail`, stack, or path (§8.3).
4. **Success.**

### 2.4 The prediction-dependent routes

`/results` and `/explainability` need a prediction that exists only in memory. Direct navigation, a
reload, or a restored tab therefore finds nothing. The rule: **show the empty state; never
re-submit, never reconstruct, never persist the response to make the URL work.**

The empty state says the result is not being kept for privacy, and offers *Start an assessment*. If a
draft exists in `sessionStorage`, it also offers *Resume your assessment*. This is a deliberate
trade: a shareable results URL would mean persisting a health record, which §8 forbids.

### 2.5 Protecting a completed prediction

The requirement is that ordinary UI navigation never loses a completed prediction, while the
prediction still dies with the session. Both hold because the prediction lives in a React context
provider mounted **above** the router outlet:

- Client-side navigation to any route and back — including `/results` → `/learn` → `/results` —
  preserves it, because no route unmounts the provider.
- A full reload, tab close, or external link discards it. That is the intended lifecycle.
- Only two things clear it deliberately: *Start a new assessment* (confirmed first, because it is
  destructive) and entering or leaving demo mode (§1.11).
- An in-flight `/predict` is never abandoned by navigation: leaving `/assessment` while a request is
  pending is blocked by the submitting state itself (§3.10), so the response cannot land in a
  discarded component.

### 2.6 History behaviour

- Route changes push history; back and forward always work and never re-submit anything.
- **Assessment steps do not push history.** Back from step 3 leaves the assessment rather than
  stepping to 2. Steps are a form control, and the in-flow *Back* button is the way to move between
  them. The alternative — a history entry per step — makes the browser back button destroy a partly
  answered step, which is worse than the surprise it avoids.
- `/results` does not replace `/assessment` in history: back from a result returns to the assessment
  with the draft intact, so a person can correct a value and resubmit.
- Scroll resets to the top on route change, except on back/forward where the previous position is
  restored. Advancing an assessment step moves focus to the new step heading rather than scrolling
  blindly (§9.3).
- 404 renders inside the Root layout with working navigation and the three most likely destinations.
  It never redirects to `/`, which would hide the broken link.

## 3. Assessment and result architecture

### 3.1 The shape of the problem

24 fields, all optional, most of them requiring a lab report. A flat page of 24 inputs — what Phase 0
removed — fails for three reasons: it looks like a form only a clinician could complete, it gives
missing data no dignified answer, and it makes the person hunt across one screen for values that are
printed together on one sheet of paper.

The design principle: **group the fields the way the source documents group them**, so each step is
answerable from one place — memory, a urinalysis sheet, a chemistry panel, a blood count.

### 3.2 Steps

Five steps, ordered easiest-first. Field membership is editorial metadata in the content layer keyed
by field name; **order within a step comes from `feature_schema`**, and a parity test fails the build
if any schema field lacks a step or any step names a field that is not in the schema (§6.5). The
grouping is data, not layout code — adding a 25th field backend-side surfaces as a test failure, not
a silently dropped input.

| Step | Title | Fields | Source document |
|---|---|---|---|
| 1 | About you | `age`, `bp` | known or a home monitor |
| 2 | Your health history | `htn`, `dm`, `cad`, `appet`, `pe`, `ane` | memory — all yes/no |
| 3 | Urine test | `sg`, `al`, `su`, `rbc`, `pc`, `pcc`, `ba` | one urinalysis sheet |
| 4 | Blood chemistry | `bgr`, `bu`, `sc`, `sod`, `pot` | one chemistry panel |
| 5 | Blood count | `hemo`, `pcv`, `wc`, `rc` | one CBC sheet |

2 + 6 + 7 + 5 + 4 = 24. Step 6 is the review screen (§3.9); it collects nothing.

Steps 1–2 need no paperwork, so a person always completes something before hitting the hard part —
and because every field is nullable, someone with no lab results at all can still submit after step 2
via *Skip to review*.

### 3.3 Progress

Progress is reported in two independent registers, because "how far along am I" and "how complete is
my data" are different questions and conflating them punishes missing values:

- **Position** — `Step 3 of 5` plus a bar, rendered with `role="progressbar"` and
  `aria-valuenow/min/max`. This is the primary indicator.
- **Coverage** — `14 of 24 answered · 10 will be estimated`, updated live, stated neutrally. Never
  styled as an error, never a percentage-complete ring, and it never blocks anything.

There is no per-step "required" count, because nothing is required.

### 3.4 Field card

Every field renders through one component whose structure is identical across all 24, so the
interaction is learned once:

```text
┌──────────────────────────────────────────────┐
│ Serum creatinine            [?] help         │   label (content), abbreviation for lab match
│ 0–80 mg/dL                                   │   bounds from /openapi.json, unit from content
│ ┌────────────────────────┐  ┌─────────────┐  │
│ │ 1.2                    │  │ I don't know│  │   input + explicit null affordance
│ └────────────────────────┘  └─────────────┘  │
│ ⚠ Value must be at most 80                   │   role="alert", only after blur or submit
│ Found on a blood chemistry report as "Creat"  │  whereToFind (content), always visible
└──────────────────────────────────────────────┘
```

Three sources meet here and stay separated (§6): the **label, unit text, help, and where-to-find copy**
come from `src/content/fields.ts`; the **bounds, enum options, and numeric-vs-categorical decision**
come from `/openapi.json`; the **identity and order** come from `/model.feature_schema`.

### 3.5 Validation presentation

Validation exists to prevent typos, not to gate progress. The rules:

- **Empty is always valid.** Nothing blocks on a missing value — ever. Only an *invalid* value blocks
  submission of that field.
- **Timing.** Validate on blur and on submit; never on the first keystroke. Once a field has shown an
  error, re-validate on change so the error clears as soon as it is fixed.
- **Message.** One sentence, in the person's terms, stating the bound — the same strings the server
  produces for the same fault (§7.5, plan R2.7–R2.9): `Value must be at most 120`. Rendered under the
  input in `role="alert"`, wired via `aria-describedby`, with `aria-invalid="true"` on the control.
- **Step advance.** A step with an invalid field cannot be left forward; focus moves to the first
  invalid field and the error is announced. A step with *empty* fields advances freely.
- **Two tiers.** Hard errors (outside the schema bounds, wrong type, not an allowed enum value) block.
  **Soft plausibility hints** never block: they advise. The `bp` case is the important one — the field
  is **diastolic**, and `120` is inside the accepted 30–200 range while being an obvious systolic
  reading. The hint reads *"That looks like a systolic reading. Enter the lower of the two numbers."*
  and is dismissible (C12).
- **Server 422 outranks client validation.** The backend is authoritative (§8.7). A 422 maps each
  `detail[i].loc[1]` back to its field, sets the error, and moves focus to the first affected field —
  navigating back to the step that owns it. The mapping keys on the Pydantic **v2** `type` plus `ctx`,
  never on message text (C8).

### 3.6 "I don't know"

The single most important affordance in the flow, because the model is built for missing data and the
person must not feel they have failed.

- Every field has an explicit **I don't know** control — a button beside numeric inputs, and a real
  option in every select. It is not a placeholder or an empty string; it sets the value to `null`.
- Choosing it marks the field visibly answered-as-unknown (`Not provided`), clears any error, and
  advances focus to the next field. Answering *I don't know* is a completed action, not a skipped one.
- It is reversible: the field remains editable, and typing a value clears the unknown state.
- Per-step **I don't have this report** sets every field in the step to `null` in one action, with an
  undo. This is what makes a lab-less submission a two-tap path rather than seven separate refusals.
- Copy never implies deficiency. *"We'll estimate this from the rest of your answers"* — not
  *"missing"*, not *"incomplete"*, never a warning colour.
- Serialization: all 24 schema keys are always present, `null` for anything unknown (plan R2.14) — an
  omitted key and an explicit `null` are equivalent to the backend, and sending the full set keeps the
  payload self-describing and testable. No UI-only key is ever added: `extra="forbid"` turns that into a
  422 (C13). `undefined` is never serialized; the mapper converts it to `null` at the boundary.

### 3.7 Missing values, before and after submission

Before submitting, the review screen lists what will be estimated, grouped by step, with a direct link
back to each field. After submitting, the Results screen renders the backend's own `imputed_fields`
and `imputation_count` — never the frontend's idea of what was blank (rule 10). Wording ties the two
together: *"10 values were estimated because they weren't provided"*, followed by the field labels from
the content layer.

### 3.8 Help and education

Three depths, progressively disclosed, so the same card serves a patient and a clinician:

1. **Always visible** — label, unit, accepted range, and `whereToFind`. No interaction required for
   the information a person needs to answer.
2. **On demand** — the `[?]` control opens the field's `patientExplanation` and *why the model uses
   this field*. Implemented as a disclosure (button + `aria-expanded` + adjacent panel), not a hover
   tooltip, because it must work on touch and be readable by a screen reader. The 500 ms-delay hover
   tooltip pattern harvested in Phase 0 is retained only for short glossary terms in prose, never for
   information required to complete a field (§9.5).
3. **Deep** — *Learn more about this measurement* links to the matching `/learn` section by field
   name, opening in the same tab. The draft is in `sessionStorage`, so leaving and returning is safe.

`technicalExplanation` is shown in the same disclosure under a *Technical detail* subheading, collapsed
by default. One content model serves both audiences; no separate clinician build.

### 3.9 Review before submitting

A dedicated step, not a modal, because it is the last chance to correct a value that will drive a
health message. It shows every field grouped by step with its entered value or `Not provided`; each row
has an *Edit* link that returns to the owning step with focus on that field and the review state
remembered. It restates the coverage count, the not-a-diagnosis framing, and — in demo mode — the
SIMULATION badge. The submit button is the only primary action on the screen and is never disabled for
missing data; it is disabled only while a submission is in flight or when a hard validation error
remains anywhere in the form, in which case the button's accessible description names the offending
step.

### 3.10 Submission and loading

- One `POST /predict` with `?explain=true`, carrying exactly the 24 schema keys, `null` for unknowns.
- The whole flow enters a **submitting** state: inputs and navigation controls disable, the button
  shows a spinner with the label *Analysing your answers…*, and the state is announced in a polite live
  region. Because navigation controls are disabled, an in-flight request cannot be orphaned (§2.5).
- 30 s timeout via `AbortController`. On timeout the draft is untouched and the person is offered
  *Try again*; a timeout is never presented as a result.
- On success the response is placed in the prediction context and the router navigates to `/results`.
  The draft stays in `sessionStorage` so *Back* can correct a value and resubmit.
- On 422 the errors map to fields and the flow returns to the first affected step (§3.5).
- On 503 or a `degraded` health status the assessment is blocked *before* submission, so the person
  never loses work to a known-unavailable service.
- Automatic retry applies only to network errors and 5xx, at most twice with backoff, and **never** to
  a 4xx. `/predict` is not idempotent in cost, but it has no side effects, so a bounded retry is safe.

### 3.11 Composing the result — the four reachable states

`prediction` and `risk_band` must be presented as one statement, because independently they contradict
each other (§0.4, C4). The verdict answers "which side of 0.5", the band answers "how far from the
boundary". Never colour them on two different scales in the same visual group.

| `prediction` | `risk_band` | Headline | Supporting sentence |
|---|---|---|---|
| `notckd` | `LOW` | No signs of CKD in these results | Values look typical. Keep up routine checks. |
| `notckd` | `MODERATE` | No signs of CKD, but the result is borderline | Close to the point where the model changes its answer. Worth a clinical check. |
| `ckd` | `MODERATE` | Possible signs of CKD, borderline | Close to the point where the model changes its answer. See a clinician. |
| `ckd` | `HIGH` | Signs consistent with CKD | Clear indicators present. See a clinician promptly. |

`ckd + LOW` and `notckd + HIGH` are unreachable; if either arrives, render the contract-violation state
(§7.7) rather than inventing wording.

Three presentation rules follow: `MODERATE` always carries the *near the decision boundary* sentence in
both directions; `ckd_score` is shown as a position on a labelled Low–Moderate–High scale with the
`risk_band` boundaries marked, never as `94.4%` and never described as a probability or a confidence;
and the backend's `explanation` sentence is rendered directly beneath the headline as the plain-language
summary, with the driver list as its evidence. When `explanation` is `null`, the driver list stands alone
and no substitute sentence is composed.

### 3.12 Mobile

Mobile-first from 320 px, because a screening tool used in an Ethiopian clinic or home is a phone tool.
One column throughout; the field card is full-width; the numeric keypad is requested with
`inputMode="decimal"`; every control including *I don't know* is at least 44 × 44 px with 8 px of
separation; step navigation is a bottom-anchored bar that does not overlap the focused input when the
soft keyboard is open; the review table becomes stacked label-value rows below 640 px; help disclosures
expand inline rather than opening an overlay. Above 768 px the flow container is capped at a readable
measure and centred — the assessment never becomes a two-column grid, because a lab panel is read down
a column, not across.

### 3.13 Keyboard

Full completion without a pointer is a hard requirement (§9.2). Tab order follows visual order:
label → input → *I don't know* → help → next field. `Enter` in a numeric input advances the step rather
than submitting the form, so no one submits from step 2 by reflex; only the review screen's submit
button submits. Selects are native `<select>` elements — arrow keys, type-ahead, and mobile pickers work
for free. The help disclosure toggles with `Enter` or `Space` and closes with `Escape`, returning focus
to its trigger. Advancing a step moves focus to the new step's heading, which is a programmatically
focusable `<h2 tabIndex={-1}>`, so a screen-reader user hears where they are.

## 4. Design system

### 4.1 The brief, restated as constraints

The direction is **clinical, calm, trustworthy, modern, research-oriented** — and explicitly not a
generic SaaS dashboard or a student CRUD app. Translated into rules a reviewer can enforce:

| Rejected | Because | Instead |
|---|---|---|
| Gradient hero, glassmorphism, blur | Decoration on a health verdict reads as marketing | Flat surfaces, one hairline border, generous space |
| KPI tile grid on the landing page | A dashboard of numbers is not an entry point | One purpose statement, one primary action |
| Coloured card per metric | Colour without meaning destroys the status system | Colour reserved for status and risk only |
| Animated counters, confetti, progress rings | Celebrating a health result is inappropriate | Static values, `role="status"` announcements |
| Icon-only buttons | Ambiguous under stress and for screen readers | Text labels, icon as reinforcement |
| Dark-mode-first neon accents | Low-light neon reduces legibility of clinical text | Light default, dark as an equal variant |
| Charts as the primary explanation | A bar chart is not an explanation | Sentence first, chart as evidence |

The positive test: every visual decision must answer *what does this help the reader understand?*
Anything whose only answer is "it looks better" is removed.

### 4.2 Tokens, not values

Everything below is defined once as a design token and consumed by name. Tailwind is the delivery
mechanism (ADR-3): tokens live in the CSS `@theme` block, so a token rename fails the build rather
than drifting. No component hardcodes a hex value, a pixel size, or a radius.

### 4.3 Typography

One family — a humanist sans (system stack first: `ui-sans-serif, "Segoe UI", Roboto, …`) — chosen
over a display face because clinical text is read once, carefully, often on a low-end phone. Numerals
are tabular in tables and results so digits align and a changing score does not shift the layout.

| Token | Size / line-height | Use |
|---|---|---|
| `text-display` | 32 / 1.2, 600 | Result headline only |
| `text-h1` | 28 / 1.25, 600 | Page title |
| `text-h2` | 22 / 1.3, 600 | Section, assessment step |
| `text-h3` | 18 / 1.4, 600 | Field group, card title |
| `text-body` | **16** / 1.6, 400 | All prose and inputs |
| `text-small` | 14 / 1.5, 400 | Units, ranges, help, captions |
| `text-mono` | 14 / 1.5, 400 | Hashes, field keys, CSV rows |

Body is 16 px, not the 14 px floor the old spec set: 14 px is a minimum, and a minimum is the wrong
default for a patient-facing tool. **14 px is the absolute smallest size anywhere**, used only for
secondary metadata, never for an instruction or an error. Prose measure is capped at 68 characters.
Nothing is set in all-caps except the status labels, at their own tracking.

### 4.4 Spacing and layout

A 4 px base with a 4/8/12/16/24/32/48/64 scale — no arbitrary values. Three container widths:
`measure` 42 rem for prose and the assessment flow, `wide` 64 rem for research tables, `full` for the
header and banners. Vertical rhythm is owned by the section, not by trailing margins on children.

Breakpoints, mobile-first, three only: base (320 px+), `md` 768 px, `lg` 1024 px. A fourth breakpoint
was rejected — the layouts are single-column or two-column, and more breakpoints buy nothing but more
states to test. Nothing is hidden at a breakpoint: content reflows, it never disappears.

### 4.5 Colour

Colour carries meaning in exactly two systems — **risk band** and **status label** — and nowhere else.
Brand colour is a single restrained teal used for interactive elements and never for a health signal,
so a link can never be mistaken for a risk indicator.

| Role | Light | Dark | Contrast on its surface |
|---|---|---|---|
| `surface` / `surface-raised` | `#ffffff` / `#f7f9fa` | `#0f1417` / `#161c20` | — |
| `text` / `text-muted` | `#10181c` / `#4a585f` | `#e8eef1` / `#a3b1b8` | ≥ 15:1 / ≥ 4.6:1 |
| `border` / `border-strong` | `#dde4e7` / `#b6c2c8` | `#2a333a` / `#3d4a52` | ≥ 3:1 (strong) |
| `brand` (interactive) | `#0d6b6e` | `#4fd1c5` | ≥ 4.5:1 |
| `risk-low` | `#1a6b3c` | `#5fd08a` | ≥ 4.5:1 |
| `risk-moderate` | `#8a5200` | `#f0b45e` | ≥ 4.5:1 |
| `risk-high` | `#9b1c1c` | `#f78a8a` | ≥ 4.5:1 |
| `info` / `warn` / `danger` | teal / amber / red as above | — | ≥ 4.5:1 |

Rules: every risk and status colour is paired with a text label and a distinct icon shape, so the
meaning survives greyscale and every form of colour blindness (§5.4); risk colour is applied to a
border, an icon, and a text label — **never as a large filled background behind body text**, because a
saturated red panel reads as an emergency; the amber `risk-moderate` is darkened well past the usual
web amber to clear 4.5:1 on white, which is why it looks brown rather than gold; and dark mode is a
token swap only, with the same contrast floors, no separate component variants.

### 4.6 Surfaces, borders, radius, elevation

One card pattern: `surface-raised`, 1 px `border`, radius `8px`, no shadow at rest. Shadow is reserved
for genuinely floating layers — dialog, drawer, disclosure popover — where it signals "above the
page", not decoration. Radius scale is `4` (inputs, badges), `8` (cards, buttons), `12` (dialogs),
`full` (pills, avatars only). Nothing is a perfect circle except icon-only affordances that also carry
an `aria-label`.

The result card is the one element allowed a heavier treatment: a 4 px left border in the risk colour,
which is a shape difference as well as a colour one.

### 4.7 Components

Each entry lists the states that must exist. A component is not done until all of them are built,
because the missing state is always the one a user hits.

**Button** — variants `primary` (one per screen), `secondary`, `ghost`, `danger`. States: rest, hover,
focus-visible (2 px offset ring, never `outline: none`), active, disabled, loading. A disabled button
always has an accessible explanation of what would enable it. Minimum target 44 × 44 px.

**Numeric input** — text field with `inputMode="decimal"`, unit as adjacent text (never inside the
field), range shown as help text, `aria-describedby` pointing at help *and* error when both exist,
`aria-invalid` on error, paired *I don't know* button. Rest / focus / invalid / unknown / disabled.

**Select** — native `<select>` (ADR-11) with an explicit `Not provided` option, options from
`/openapi.json`, labels from the content layer. Same states as the numeric input.

**Disclosure** — the standard help affordance: a button with `aria-expanded` and `aria-controls`, panel
below, `Escape` closes and restores focus. Replaces the hover tooltip everywhere information is needed
to complete a task.

**Tooltip** — retained only for glossary terms in prose. `role="tooltip"`, 500 ms open delay, timer
cleared on unmount, opens on focus as well as hover, dismissible with `Escape`. Never the sole carrier
of any information.

**Alert / banner** — `role="alert"` for errors that appear in response to an action, `role="status"`
for the health banner and other passive changes. Icon + bold lead + one sentence + at most one action.
Banners are dismissible only when re-findable; the health banner is not dismissible while degraded.

**Progress** — `role="progressbar"` with `aria-valuenow/min/max` for step position; a separate plain
text coverage line (§3.3). No indeterminate spinner as a page's only loading signal.

**Skeleton** — mirrors the final layout's boxes so nothing jumps on load; `aria-hidden`, with the real
announcement carried by a live region. Suppressed entirely under `prefers-reduced-motion` in favour of
a static "Loading…" line.

**Empty state** — icon, one-line explanation of why it is empty, and the single action that fills it.
Every empty state is authored copy; none is a shrug.

**Dialog / drawer** — dialog for confirmations only (clearing a prediction, discarding a draft): focus
trapped, `aria-modal`, `Escape` closes, focus restored to the trigger. Drawer only for mobile
navigation. Neither ever holds a form step, so no one can lose an answer by dismissing an overlay.

**Table** — research only. `<caption>`, real `<th scope>`, tabular numerals, horizontal scroll in a
labelled `tabIndex={0}` region below `md`, and a stacked label-value layout for the review screen.

**Chart** — Recharts, research and results only (ADR-12). Every chart has a text alternative that
carries the same facts: SHAP drivers are a list first and a bar chart second; the confusion matrix is a
table first. Charts inherit tokens, never their own palette, and are never the only representation.

**Result card** — the four-state composition from §3.11: headline, band pill, `explanation` sentence,
score position on a labelled scale, driver list, imputation notice, `disclaimer` verbatim.

## 5. Status-label system

### 5.1 What the system is for

A single, uniform answer to one question the reader must never have to guess: **is this number real?**
The product deliberately shows verified backend output next to educational simulations and unbuilt
features, so provenance has to be a first-class, reusable UI primitive rather than prose that a
future edit can drop.

### 5.2 The five labels

| Label | Means | Icon (shape) | Colour role | Typical placement |
|---|---|---|---|---|
| **VERIFIED** | Came from a live backend response in this session | ✔ check in a circle | `info` | Section header, figure caption |
| **PROVISIONAL** | Real content that must not be read as a verified measurement — a backend value whose interpretation is limited, or editorially authored material | ◐ half-filled circle | `warn` | Beside the specific figure, or page-level for editorial areas |
| **NOT VERIFIED** | Claim the frontend cannot substantiate from any endpoint | ? in a circle | `text-muted` | Beside the claim |
| **SIMULATION** | Illustrative content; no real computation behind it | ▨ hatched square | `warn` | Page-level banner + per-figure |
| **PLANNED** | Capability that does not exist yet; needs a named backend endpoint | ⌛ outline | `text-muted` | In place of the missing content |

Wording is fixed and non-negotiable — one term per concept, always upper-case, never translated into a
synonym. `LIVE`, `REAL`, `DEMO`, `MOCK`, `BETA`, and `COMING SOON` are banned, because each invites a
second reading.

### 5.3 Where each appears

- **VERIFIED** — Results, Explainability, Research Lab metric blocks, Model Card, Batch results.
  Applied at the level of the *figure group* it covers, not sprinkled per number.
- **PROVISIONAL** — three uses. Two are backend values needing a caveat: `ckd_score` (not a calibrated
  probability, per `limitations`) and `metrics.intervals` where present (bootstrap intervals from a
  finite test set); both caveats are quoted from the backend's own `limitations`, not written by us. The
  third is **`/learn` at page level, per plan R5.4** — the area is editorially authored rather than
  backend-derived, and the badge says so before the reader assumes the page describes *them*. Per-claim
  sources (R5.3) sit inside it; the page badge is about provenance, the citations are about authority.
- **NOT VERIFIED** — reserved for content that survives in the product but cannot be checked, such as
  a clinical claim in `education.ts` without a cited source. It is a lint target: the aim is zero.
- **SIMULATION** — `/multimodal` and `/federated` at page level; demo mode at app level via the
  persistent banner; any illustrative figure inside those pages individually.
- **PLANNED** — `/facilities` at page level; inside Research Lab for comparisons, threshold analysis,
  federated results, and training date; on the Model Card where an absent fact would otherwise be blank.

Applied consistently, the rule is: **an unlabelled number is a verified number**, and the parity test in
§8.8 checks that every research figure is either inside a `VERIFIED` region or carries its own label.

### 5.4 Colour-independent by construction

Four redundant channels, so removing any one still leaves the meaning:

1. **Text** — the word itself is rendered, never an icon alone.
2. **Shape** — each label has a structurally distinct glyph (check / half-circle / question / hatch /
   hourglass), distinguishable in greyscale and at 16 px.
3. **Position and containment** — page-level labels sit in a bordered banner directly under the page
   title, before any content; figure-level labels sit immediately before the figure they qualify.
4. **Colour** — last, and only from the semantic palette, at ≥ 4.5:1.

Printing the page in greyscale is the acceptance test (§8.8, T-A11Y-06).

### 5.5 Accessible representation

The badge is a `<span>` with the visible word plus a visually hidden expansion, so a screen reader hears
a sentence rather than a token: `SIMULATION` → *"Simulation: illustrative content, not a real
computation."* The icon is `aria-hidden`, since the word is already present. Page-level banners use
`role="note"` with an `aria-labelledby` pointing at their own heading, so they are reachable in a landmark
list rather than being decorative. A figure-level badge is associated with its figure via
`aria-describedby` on the figure, not by proximity alone.

The full definition of each label is available in two ways: an inline disclosure on the badge itself
(button, `aria-expanded`, one-sentence definition — never a hover-only tooltip), and a permanent legend
on `/about` (§1.16) that every badge disclosure links to. A user who has never seen the system can
resolve any label without leaving the page, and can find the whole vocabulary in one place.

### 5.6 One implementation

A single `<StatusLabel status="SIMULATION" scope="page" />` component and a `<StatusRegion>` wrapper. The
five labels are a TypeScript union, so a typo is a type error, and their copy lives in the content layer
beside the field copy — labels are editorial text, and editorial text has exactly one home (§6).

## 6. Content architecture

### 6.1 The line between schema and content

Rule 6 of the plan forbids hardcoding the 24-feature schema. The current
[field-metadata.ts](ckd-frontend/src/utils/field-metadata.ts) violates it: alongside genuine editorial
copy it hardcodes `min`, `max`, `options`, and `type` — a second copy of the contract that no test
compares against the backend (C11).

The split, stated so it can be enforced:

| Fact | Owner | Source | May the frontend author it? |
|---|---|---|---|
| Field exists, and its order | Backend | `/model.feature_schema` | No |
| Numeric vs categorical | Backend | `/openapi.json` `anyOf` branch | No |
| Min / max | Backend | `/openapi.json` `minimum`/`maximum` | No |
| Allowed enum values | Backend | `/openapi.json` `enum` | No |
| Patient-facing label, unit text, explanations, where to find it | Frontend | `content/fields.ts` | **Yes — this is prose** |
| Step grouping | Frontend | `content/fields.ts` | Yes — presentation |

The test for whether something belongs in content: *if the backend changed it, would the frontend be
wrong or merely differently worded?* Wrong ⇒ backend owns it.

### 6.2 `src/content/fields.ts`

```ts
/** Editorial copy for one assessment field. Contains NO schema facts —
 *  no min, no max, no options, no type. Those come from /openapi.json. */
export interface FieldContent {
  /** Patient-facing label. Sentence case. "Serum creatinine" */
  readonly label: string;
  /** How the value is printed on a lab report, for visual matching. "Creat" */
  readonly abbreviation: string;
  /** Full clinical name, for the technical audience. "Serum creatinine" */
  readonly fullName: string;
  /** Unit as displayed beside the input. Display text only — not validated. "mg/dL" */
  readonly unit: string | null;
  /** One or two plain sentences. No jargon, no numbers a patient must interpret. */
  readonly patientExplanation: string;
  /** Clinical/technical detail. Shown collapsed under "Technical detail". */
  readonly technicalExplanation: string;
  /** Why the model uses this field. Never a causal claim. */
  readonly whyItMatters: string;
  /** Where the person can obtain the value. "On a blood chemistry report" */
  readonly whereToFind: string;
  /** Screen-reader label when the visible label plus unit is not self-sufficient. */
  readonly accessibleLabel?: string;
  /** Non-blocking plausibility hint. The `bp`-is-diastolic case. */
  readonly plausibilityHint?: { readonly when: string; readonly message: string };
  /** Assessment step that owns this field. Presentation, not schema. */
  readonly step: StepId;
}

export type StepId = 'about-you' | 'history' | 'urine' | 'chemistry' | 'blood-count';

/** Keyed by backend field name. Intentionally `Record<string, …>`, not a
 *  union-keyed mapped type: a closed key union would make this file a second
 *  schema. Coverage is guaranteed at runtime by the parity test (§6.5), and
 *  `noUncheckedIndexedAccess` forces every lookup to handle `undefined`. */
export const FIELD_CONTENT: Record<string, FieldContent> = { /* 24 entries */ };

export const STEPS: readonly { id: StepId; title: string; intro: string }[] = [ /* 5 */ ];
```

Enumerating the 24 *names* is unavoidable — copy has to attach to something — and it is the one
overlap with the backend that remains. It is acceptable because a name is an identifier, not a
constraint, and because §6.5 fails the build the moment the set diverges. Enumerating bounds, enums,
types, or order would not be acceptable, and none of them appear above.

### 6.3 The runtime schema, and how the two meet

```ts
/** Derived at runtime from /openapi.json. Never authored by hand. */
export interface FieldSchema {
  readonly name: string;
  readonly kind: 'numeric' | 'categorical';
  readonly min?: number;          // numeric only
  readonly max?: number;          // numeric only
  readonly options?: readonly string[];  // categorical only
}

/** What a field card actually receives: order + identity from feature_schema,
 *  constraints from openapi, words from FIELD_CONTENT. */
export interface AssessmentField {
  readonly schema: FieldSchema;
  readonly content: FieldContent;
}
```

`buildAssessmentFields(featureSchema, openapi, FIELD_CONTENT)` walks `feature_schema` **in order**,
reads each field's `anyOf` non-null branch for `kind`, `min`/`max` or `options`, and joins the content
entry. A field present in `feature_schema` with no content entry is a hard failure in development and
degrades to the raw field name in production — a missing sentence must not remove a field the model
needs. Enum *values* come from the schema; their *labels* come from content, keyed by value
(`normal` → "Normal", `notpresent` → "Not present").

### 6.4 `src/content/education.ts`

```ts
export interface EducationSection {
  readonly id: string;                       // URL fragment, stable
  readonly title: string;
  readonly summary: string;                  // one sentence, used in listings
  readonly body: readonly ContentBlock[];    // structured, not HTML strings
  readonly audience: 'patient' | 'technical' | 'both';
  /** Field names this section explains. Enables /learn#<id> deep links
   *  from a field's "Learn more" affordance. Validated against
   *  feature_schema by the same parity test. */
  readonly relatedFields?: readonly string[];
  /** Required for any clinical claim. Absent ⇒ NOT VERIFIED label. */
  readonly sources?: readonly { readonly label: string; readonly url: string }[];
}

export type ContentBlock =
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'list'; readonly items: readonly string[] }
  | { readonly kind: 'callout'; readonly tone: 'info' | 'warn'; readonly text: string }
  | { readonly kind: 'definition'; readonly term: string; readonly text: string };
```

Structured blocks rather than markdown or HTML strings: no `dangerouslySetInnerHTML` anywhere in the
product (§8.4), the renderer applies the design system, and a missing source is detectable. `sources`
is what keeps clinical copy honest — a claim without one is labelled NOT VERIFIED rather than quietly
asserted.

`demo-cases.ts` follows the same pattern: named synthetic cases as `Record<string, Partial<Record<string,
number | string | null>>>`, values only, no expected outcomes — the prediction comes from the real
backend, so hardcoding an expected result would be a fabricated number (§1.11).

### 6.5 The parity test — the mechanism that makes this safe

One test, run in CI, is what allows the content layer to exist without becoming a second schema:

1. Fetch `/model.feature_schema` (live in the integration run, a recorded fixture in unit runs).
2. Assert `Object.keys(FIELD_CONTENT)` is **set-equal** to `feature_schema`.
3. Assert every `FieldContent.step` is a known `StepId`, and that the union of all steps' fields is
   exactly `feature_schema` — no field is orphaned, no step invents a field.
4. Assert every `relatedFields` entry in `education.ts` is a real field name.
5. Assert no `FieldContent` key is named `min`, `max`, `options`, `type`, or `enum` — a structural
   guard against the C11 regression reappearing.

A backend schema change therefore breaks the frontend build with a message naming the added or removed
field, instead of silently dropping an input the model expects. The fixture used by the unit run is
regenerated by a documented command, never hand-edited (§7 of the test plan).

## 7. API and data architecture

### 7.1 Layers

```text
components            read hooks and normalized errors; never fetch, never touch raw responses
   │
hooks/                useHealth, useModelMetadata, useFieldSchema, usePredict, usePredictBatch
   │                  (TanStack Query — the only place query keys exist)
lib/api/client.ts     transport: URL, headers, JSON, AbortController timeout, error classes
lib/api/errors.ts     APIError | TimeoutError | NetworkError  → normalize()  → NormalizedError
lib/api/schema.ts     /openapi.json reader → FieldSchema[]
lib/api/redact.ts     safeText(): strips path-like substrings from any server string (§8.3)
```

Four responsibilities for the client, and no others: build the URL, set the headers, enforce the
timeout, and throw a typed error. It does not retry, cache, decide user-facing wording, or know what a
patient is. Retry and caching are the query layer's job; wording is `ErrorHandler`'s. That separation
already exists in the Phase 0 code (`APIError.message` stays the raw `"<status> <statusText>"`) and is
preserved.

Changes required to the existing client, all carried forward to Phase 2 (§11):

- accept an external `AbortSignal` and compose it with the timeout signal, so a query can be cancelled;
- add `getOpenApi()`;
- take the content type and the `explain` flag as parameters on `predictBatch` instead of hardcoding
  `text/csv`;
- correct the `getModelMetadata()` return type to the verified `/model` shape (C10);
- delete the DEV `console.info` of request bodies and gate `logError` to DEV without stacks (C15);
- de-duplicate `get`/`post` into one `request()`.

### 7.2 Query keys and caching

```ts
['health']                    // ↻ 60s, staleTime 30s,  retry 1
['model']                     //   staleTime Infinity,  retry 2
['openapi']                   //   staleTime Infinity,  retry 2
['fieldSchema']               //   derived from ['openapi'] + ['model'], never fetched directly
```

Three server reads, all `GET`, all effectively immutable within a session — `/model` and
`/openapi.json` change only when the backend restarts with a new artefact. They are cached for the
session lifetime (`staleTime: Infinity`, `gcTime: Infinity`), which is the honest choice given the
backend sends no `ETag` or `Cache-Control` (§0.3): with no validators there is nothing to revalidate
against, so re-fetching would cost a round trip to receive identical bytes.

`['health']` is the exception: it is a liveness probe, so it refetches on an interval driven by
`VITE_HEALTH_CHECK_INTERVAL` (default 60 000 ms — the variable exists today but nothing reads it,
C14), and additionally on window focus and on reconnect. `refetchIntervalInBackground` is `false`; a
hidden tab does not poll.

`staleTime: Infinity` has one consequence to state plainly: if the backend is restarted with a new
model while a tab is open, that tab keeps the old `version` and metrics until reload. Detecting it is
impossible anyway — `/health` exposes no version or hash (§12, D5) — so the tab shows the version it
loaded with, and the Model Card states that the figures were read at page load.

### 7.3 Request lifecycle

1. **Timeout** — 30 s for every request via `AbortController`, from `VITE_API_TIMEOUT`. A timeout is a
   `TimeoutError`, never a failed prediction.
2. **Cancellation** — queries pass TanStack Query's `signal` into the client, so unmounting cancels an
   in-flight `GET`. The `/predict` mutation is deliberately **not** cancelled on unmount, because it
   cannot be unmounted while submitting (§3.10).
3. **Retry** — network errors and 5xx: 2 retries, exponential backoff (1 s, 2 s). 4xx: **never**, since
   a 422, 415, or 404 will not fix itself. Timeouts: **never automatically** — a 30 s wait already
   happened, and silently repeating it makes the app feel broken; the user gets an explicit *Try again*.
4. **Normalization** — every failure becomes one `NormalizedError { kind, title, message, retryable,
   fieldErrors?, rowErrors? }` before any component sees it (§7.5).

### 7.4 Health and blocking

`useHealth()` returns `ready | degraded | unreachable | checking`. A 200 with
`status: "degraded"` is **not** ready (§0.2). Effects:

- `checking` — nothing is blocked; the assessment CTA shows a brief loading state rather than an error.
- `degraded` / `unreachable` — a non-dismissible `role="status"` banner in the root layout; the
  assessment and batch CTAs disable with the reason stated and a manual *Check again*; `/learn`,
  `/about`, `/multimodal`, `/federated` remain fully usable.
- Recovery is announced politely once, and the banner disappears; nothing auto-navigates.
- `detail` from a degraded response is **never rendered** — it may contain absolute paths (§8.3). The
  banner shows our own copy.

### 7.5 Error normalization

Keyed on the Pydantic **v2** discriminators verified in §0.5 — `type` plus `ctx` — never on message
substrings (C8):

| Condition | `kind` | User message |
|---|---|---|
| 422, `loc[0] === 'body'` | `validation` | per-field, from `type` + `ctx` |
| 422, `typeof loc[0] === 'number'` | `row-validation` | per-row; CSV line = `loc[0] + 2` (C9) |
| 415 (string `detail`) | `unsupported-media` | "Upload a `.csv` file." (C7) |
| 503 | `unavailable` | "The service is temporarily unavailable." |
| 5xx | `server` | "Something went wrong on our side." retryable |
| `TimeoutError` | `timeout` | "This took longer than 30 seconds." retryable |
| `NetworkError` | `offline` | "You appear to be offline." retryable |
| unexpected shape | `contract` | see §7.7 |

Field-level mapping, using the copy fixed by plan R2.7–R2.9 so client-side and server-side wording are
identical for the same fault: `greater_than_equal` → *"Value must be at least `ctx.ge`"*;
`less_than_equal` → *"Value must be at most `ctx.le`"*; `float_parsing` → *"Must be a valid number"*;
`literal_error` → *"Choose one of: `ctx.expected`"*; `extra_forbidden` → a developer-facing contract
error, since a user cannot cause it.
`detail[i].input` echoes the submitted value and is **never** included in a message or a log (§8.3).

### 7.6 Mutations

`usePredict()` — a `useMutation`, not a query: it is a `POST` with a body, it is triggered by a person,
and its result is not cached by URL. On success the response goes into the prediction context (§7.8) and
the router navigates. It is never written to the query cache, because a cached prediction is a stored
health record.

`usePredictBatch()` — a mutation taking `{ body, contentType, explain }`. Client-side steps before the
request: parse the CSV header, compare it against `feature_schema` as a set, and refuse on mismatch with
the specific missing and unexpected columns named (C6). Also enforced client-side: a `.csv` extension, a
size ceiling, and a row ceiling, so an unusable file fails instantly rather than after a 30 s round trip.
Results are held in component state and offered as a download; nothing is persisted.

### 7.7 When the response does not match the contract

Missing `disclaimer`, absent `shap_drivers`, an unknown `risk_band`, or an unreachable
verdict/band pair (§3.11) is a **contract violation**, not a result. The Results screen renders an error
state saying the result could not be displayed and offering *Try again*; it never renders a partial
verdict, and it never fills a gap with a default. Rendering half a health verdict is worse than
rendering none. Zod parses each response at the boundary, so this is a single check rather than defensive
conditionals scattered through the UI.

### 7.8 Session and client state

No global store (ADR-8). Four kinds of state, each in the smallest place that works:

| State | Where | Lifetime | Persisted |
|---|---|---|---|
| `/health`, `/model`, `/openapi.json` | TanStack Query cache | session | no |
| Prediction response | React context above the router outlet | until reload or explicit clear | **no** |
| Assessment draft | React Hook Form + `sessionStorage` mirror | tab | `sessionStorage` only |
| Demo mode flag, UI state | `useState` in the owning component | component | no |

The draft is the only patient data written anywhere, and only to `sessionStorage`: it closes with the
tab, is not shared across tabs, and is cleared on submit-success-plus-navigate-away, on *Start over*, and
on entering or leaving demo mode. It is written debounced (500 ms) as a plain JSON object of the 24 keys
— no metadata, no timestamps, no identifiers. `localStorage` is never used for anything, and a test
asserts the string `localStorage` does not appear in the shipped bundle (§8.8).

TanStack Query earns its place for exactly three things — interval refetching with focus/reconnect
revalidation for `/health`, session-lifetime caching for two immutable documents, and one uniform
loading/error state shape. It is not used for the prediction, which is a mutation whose result must not
be cached. A Redux/Zustand-style store would add a third state location with nothing to put in it.

## 8. Security and privacy architecture

### 8.1 Threat model, briefly

This is a static SPA with no server tier of its own, no accounts, and no database. It holds health data
for the duration of one browser tab. The realistic risks are therefore not authentication bypass or
injection against our own backend — they are **leaking server internals into a page**, **retaining
patient data longer than intended**, and **sending patient data somewhere it was never meant to go**.
Each is addressed below with a chokepoint and a test, because a rule with no test is a comment.

### 8.2 No secrets in the bundle

There is no server tier, so **every `VITE_*` variable is inlined into the shipped JavaScript** and every
`.env*` file that Vite reads is public. Only three variables exist and all three are safe:
`VITE_API_BASE_URL`, `VITE_API_TIMEOUT`, `VITE_HEALTH_CHECK_INTERVAL`. The rule: a `VITE_*` variable may
hold a public URL or a number, never a key, token, or credential. If a future feature needs a secret —
a facilities provider API key is the likely case — it cannot be a frontend variable at all; it requires a
backend route, which is a backend dependency (§12, D8).

`.env.production` currently points at `https://api.ethiockd.example.com`, a placeholder domain, so a
production build today targets nothing (C13). Resolution: the client's default base URL becomes the
relative `/api`, served by the same origin and proxied to FastAPI, which removes CORS from production
entirely and makes the absolute URL an opt-in override (ADR-9).

### 8.3 No server internals in the page

`/model.artifacts[*].path` is an absolute server path — verified live as
`C:\Users\berek\...\saved_models\tabular_model.joblib`. `POST /predict` embeds the same metadata, so the
leak reaches Results and Explainability, not only the Model Card. `/health` in the degraded state and
any 503 put `str(exc)` in `detail`, and `ArtifactLoadError` messages embed the same paths. **Three
surfaces, not one** (C1).

Four layers, so no single omission is sufficient to leak:

1. **Don't ask for it.** `artifacts` is not part of any view model. `/model` is parsed by Zod into a
   `ModelView` that carries `sha256` and drops `path`, so a component cannot render what it never
   receives.
2. **`safeText()` chokepoint.** Every server-supplied free-text string — `detail`, `explanation`,
   `disclaimer`, `limitations[]` — passes through one function that removes path-like substrings
   (`X:\…`, `/usr/…`, `\\host\share`) before rendering. Applied at the boundary, not per call site.
3. **Never render `detail`.** Error copy always comes from `ErrorHandler`. `detail` is used only to
   *select* a message and to map field errors, never displayed.
4. **Tests.** §8.8 T-SEC-01…03.

`sha256` is safe and is the integrity identifier shown on the Model Card. `version` is
`sha256[:12]`, already computed by the backend (C3).

### 8.4 No injection surface of our own

No `dangerouslySetInnerHTML` anywhere, which is why `education.ts` uses structured `ContentBlock`s rather
than HTML or markdown strings (§6.4). External links carry `rel="noopener noreferrer"`. No dynamic
`import()` of a server-supplied string. No `eval`, no `new Function`. A CSP is documented for whoever
hosts the build — `default-src 'self'`, `connect-src 'self'` plus the API origin, `img-src 'self' data:`,
no `unsafe-inline` for scripts — and recorded as a hosting requirement rather than something a static
bundle can enforce for itself.

### 8.5 Patient-data lifecycle

| Data | Written where | Cleared when |
|---|---|---|
| Assessment draft (24 nullable values) | `sessionStorage`, one key | submit + navigate away, *Start over*, demo toggle, tab close |
| Prediction response | memory only (React context) | reload, *Start over*, demo toggle, tab close |
| Batch CSV and results | memory only | leaving `/research/batch`, tab close |

`localStorage` is used for nothing at all — not a theme, not a dismissal flag — so the rule "no patient
data in `localStorage`" cannot be eroded by a later feature that starts using it for something innocuous
(ADR-10). The prediction is never written to the query cache, never to `sessionStorage`, and never to a
URL parameter; §2.4 accepts a non-shareable results URL as the price.

**Logging.** No request or response body is ever logged, in any environment. The current
`api.ts` DEV log prints the full 24-field payload and `errorHandler.logError` prints `error.stack`
unconditionally (C15); both go. What may be logged in DEV only: method, path, status, duration. There is
**no analytics or telemetry in the product**; if any is ever added it must exclude every field value,
score, band, driver, and imputation figure, and it must be stated on `/about`.

### 8.6 Facility search isolation

A future facilities provider is the one place patient data could plausibly escape. The boundaries, fixed
now while the feature is still PLANNED: geolocation is requested only after an explicit in-page consent
action, never on load; the request payload may contain a coarse location or a typed place name and
nothing else — no field value, no score, no band, no driver, no imputation count, no prediction; precise
coordinates are never persisted or logged; a manual text search always exists so the feature works
without location permission; the provider is named on `/about`. Enforced by a test that inspects the
outgoing request (§8.8 T-SEC-06) rather than by review discipline.

### 8.7 Frontend validation is a convenience

Client validation exists to catch typos early. The backend is authoritative: it re-validates every
field, and a server 422 always overrides a client-side "valid" (§3.5). Two corollaries — the frontend
never suppresses a submission the backend would accept (so empty fields always submit), and it never
guarantees a submission the backend will accept. Bounds are read from `/openapi.json` rather than
copied, so the two cannot disagree in the first place (§6.1).

### 8.8 What must be tested to prove these properties

| Id | Property | Method |
|---|---|---|
| T-SEC-01 | `artifacts[*].path` never reaches the DOM | Render Model Card, Results, Explainability with a fixture whose paths contain a sentinel; assert the sentinel is absent from `container.innerHTML` |
| T-SEC-02 | `safeText()` strips Windows and POSIX paths | Unit test over a table of leaky strings |
| T-SEC-03 | A degraded `/health` `detail` is not rendered | Fixture with a path-bearing `detail`; assert absent |
| T-SEC-04 | Nothing patient-related is in `localStorage` | Complete a flow against a `localStorage` spy; assert zero writes, plus a bundle grep |
| T-SEC-05 | Prediction does not survive a reload | Integration: predict, remount the tree, assert the empty state |
| T-SEC-06 | Facility search carries no assessment data | Intercept the request; assert the body and query contain no field name, value, score, or band |
| T-SEC-07 | No request/response body is logged | Spy on `console`; assert no payload appears in any environment |
| T-SEC-08 | No `VITE_*` variable holds a secret | Test asserts the used variable names are exactly the three allowed |
| T-SEC-09 | Draft is `sessionStorage`-only and cleared on the four triggers | Component tests per trigger |
| T-SEC-10 | Server 422 overrides client-valid state | Integration with a 422 fixture |
| T-SEC-11 | No `dangerouslySetInnerHTML` in the source | Lint rule `react/no-danger` set to error |
| T-SEC-12 | Demo results cannot be presented as real | Integration: predict in demo mode, assert the badge travels to results and any export |
| T-SEC-13 | A report export transmits nothing | Trigger the export with `fetch` and `XMLHttpRequest` spied; assert zero calls, and assert the produced `Blob`/print markup contains no filesystem path |

## 9. Accessibility architecture

### 9.1 Target and rationale

WCAG 2.1 AA, treated as the floor rather than the goal. The population this tool is built for includes
older adults with reduced vision and dexterity, people on small low-end phones in bright sunlight, and
health workers using a shared keyboard. The patterns harvested from the Phase 0 components are reused as
**principles**; none of that code returns, because the components were built for a form design the
product no longer has.

### 9.2 Keyboard-only completion

The whole assessment — every field, every *I don't know*, every help disclosure, the review screen, and
submission — is completable with keyboard alone, and that is a tested requirement, not an aspiration
(T-A11Y-01). Supporting decisions: a skip link to `<main>` as the first focusable element; visible
`focus-visible` rings everywhere with `outline: none` never used unaccompanied; tab order equal to visual
order; no positive `tabIndex` anywhere; native `<select>` and `<button>` rather than custom widgets, so
platform keyboard behaviour is inherited (ADR-11); `Enter` in a field advances a step instead of
submitting (§3.13); `Escape` closes any disclosure, dialog, or tooltip and returns focus to its trigger.

### 9.3 Focus management and restoration

| Event | Focus goes to |
|---|---|
| Route change | `<h1>` of the new page, `tabIndex={-1}` |
| Assessment step advance | new step `<h2>`, `tabIndex={-1}` |
| Validation failure on advance/submit | first invalid field |
| Server 422 | first affected field, after navigating to its step |
| Disclosure or dialog close | the trigger that opened it |
| *I don't know* activated | the next field's control |
| Prediction success → `/results` | result headline `<h1>` |
| Error banner appears | stays put; announced instead (§9.6) |

Focus is never moved on a keystroke, never trapped outside a modal, and never left on a removed node —
the last is the most common regression, so it is asserted for the two destructive actions (*Start over*,
clearing a prediction).

### 9.4 Form semantics

Every control has a programmatically associated `<label>`; placeholders are never labels. `aria-invalid`
reflects error state. `aria-describedby` composes in a fixed order — help id, then hint id, then error id
— rather than swapping one for another as the old implementation did, so a screen-reader user hears the
range *and* the error instead of losing the range at the moment it becomes relevant. `role="alert"` on the
error text announces it once when it appears. Unit and accepted range are in the visible help text and
therefore already announced through `aria-describedby`, so `aria-label` is not overloaded with them —
`accessibleLabel` in the content layer exists only for the few fields whose visible label is genuinely
ambiguous in isolation. Fieldsets group each step with a `<legend>`; the *I don't know* button carries
`aria-pressed` so its state is perceivable rather than only visible.

### 9.5 Disclosures over tooltips

Help that a person needs in order to answer a question is a **disclosure** — a real button with
`aria-expanded`/`aria-controls` and a panel in the DOM. Hover tooltips fail on touch, fail on keyboard
without extra work, and vanish under the pointer that summoned them, so they are demoted to short
glossary definitions in prose only. Where a tooltip does appear it keeps the harvested pattern —
`role="tooltip"`, 500 ms open delay, timers cleared on unmount, opens on focus as well as hover,
`Escape` dismisses — and never carries information that exists nowhere else.

### 9.6 Announcements

Two live regions in the root layout, created once so nothing races to insert them: a **polite**
`aria-live` region for status ("Analysing your answers…", "Step 3 of 5", "Result ready", "Connection
restored") and an **assertive** one reserved for errors that interrupt a task. Rules: skeletons are
`aria-hidden` and the live region carries the loading message, so a screen reader is told "loading"
rather than reading placeholder boxes; a completed prediction announces that the result is ready and
where it is; the coverage counter is `aria-live="off"` and read on demand, because announcing it on every
keystroke would be unusable; nothing is announced twice by both a `role="alert"` and a live-region write.

### 9.7 Status labels for screen readers

Covered in §5.5: the visible upper-case word plus a visually hidden expansion sentence, the icon
`aria-hidden`, page-level banners as `role="note"` in the landmark list, figure-level badges bound with
`aria-describedby`. A screen-reader user therefore hears *"Simulation: illustrative content, not a real
computation"* before the content it qualifies, which is the same ordering a sighted user gets.

### 9.8 Motion, targets, readability

`prefers-reduced-motion: reduce` removes all transitions and animations, replaces skeleton shimmer with a
static block, and disables smooth scrolling — implemented as a global token override, not per component.
Touch targets are ≥ 44 × 44 px with ≥ 8 px separation, including *I don't know* and the help trigger.
Body text is 16 px (§4.3), 14 px is the floor for secondary metadata only, and the layout survives 200 %
zoom and a 400 % text-only zoom without horizontal scrolling or clipped content. Contrast floors: 4.5:1
for text, 3:1 for interactive borders and focus rings, verified in both themes.

### 9.9 What must be tested

`jest-axe` on every route in every state (loading, empty, error, success) as the automated floor, plus
targeted tests for the things axe cannot see: keyboard-only completion of the whole assessment, focus
destinations from the §9.3 table, announcement content, the greyscale legibility of the status system,
and 200 % zoom reflow. The full matrix is in [FRONTEND_TEST_PLAN.md](FRONTEND_TEST_PLAN.md) §5.

## 10. Architecture decision records

Format: **context → decision → consequence, including what it costs.** A decision with no stated cost
has not been thought through.

### ADR-1 — Vite + React SPA, not Next.js

`FRONTEND_PLAN.md` originally named Next.js. The code on disk is Vite 8 + React 19, the backend's CORS
already allows `:5173`, and the superseded [design document](docs/archive/frontend-spec/design.md) also
specified Vite. Nothing in the product needs
SSR: there is no SEO-critical content behind data, no server-side session, and the one API is a separate
Python service. **Decision: stay on Vite; the plan was corrected.** Consequences: no server tier, so every
`VITE_*` value is public (§8.2) and any future secret needs a backend route; no progressive enhancement
without JavaScript, so the old spec's "works without JS" requirement was rejected as unsatisfiable rather
than carried as a lie; deployment is a static bundle plus a proxy rule.

### ADR-2 — React Router, client-side, flat route table

Twelve routes plus a 404, four layouts, no authentication, no route-level code ownership questions.
**Decision: `react-router-dom` with a flat `createBrowserRouter` table and nested layout routes.** Chosen
over hand-rolled state switching because history, scroll restoration, and nested layouts are exactly what
it does, and over a file-based router because there is no build integration to justify. Cost: one
dependency, and a hosting requirement that all paths rewrite to `index.html`.

### ADR-3 — Tailwind for the design system

The removed components used hand-written BEM CSS across six files; the design system in §4 is a token
system. **Decision: Tailwind v4 with tokens declared in `@theme`.** The tokens become the contract — a
renamed token fails the build instead of silently falling back — and no component ships a hex value. Cost:
class-heavy JSX, and a rule that arbitrary values (`text-[13px]`) are lint errors, since one escape hatch
defeats the token system. Rejected: CSS modules (no token enforcement), a component library (imposes its
own visual language, which §4.1 explicitly rejects).

### ADR-4 — TanStack Query for the three GETs only

`/model` and `/openapi.json` are immutable within a session and carry no `ETag` or `Cache-Control`;
`/health` must poll on an interval and revalidate on focus and reconnect. **Decision: TanStack Query for
`['health']`, `['model']`, `['openapi']`, and the two mutations; nothing else.** It is justified by the
interval-plus-focus-plus-reconnect behaviour, which is genuinely awkward by hand, and by one uniform
loading/error shape. Cost: a dependency for three reads, and a rule that the prediction never enters the
cache (§7.6). Rejected: `useEffect` fetching (would re-implement the polling and the request
deduplication), and SWR (equivalent, but Query's mutation model fits `/predict` better).

### ADR-5 — React Hook Form + Zod, already installed

24 nullable fields, per-field validation on blur, cross-step error mapping from a server 422, and a review
step that reads the whole form. **Decision: keep `react-hook-form` with `@hookform/resolvers` and Zod.**
RHF keeps re-renders per field rather than per keystroke across the form, which matters on a low-end
phone; Zod is already the response-parsing tool at the API boundary (§7.7), so one schema library covers
both directions. The Zod field schema is **built at runtime from `/openapi.json`**, not authored — that is
what makes ADR-7 real rather than decorative. Cost: the runtime-built schema is harder to read than a
literal one, which the parity test compensates for.

### ADR-6 — Assessment steps are component state, not routes

**Decision: `/assessment` owns a step index; steps are not URLs.** A step URL would let someone deep-link
into step 4 with an empty form, and would make the browser back button destroy a partly answered step.
Cost: no shareable link to a step and no history entry per step; mitigated by the in-flow *Back* control
and by §2.6 documenting the behaviour so it is a decision rather than a bug.

### ADR-7 — The assessment is generated from the backend schema

**Decision: field identity and order from `/model.feature_schema`, constraints from `/openapi.json`,
wording from `content/fields.ts`, joined at runtime, guarded by a parity test (§6.5).** This is what makes
plan rule 6 implementable instead of aspirational. Cost: the assessment cannot render until two GETs
resolve, so it has a real loading state and a real "schema unavailable" state; and a backend schema change
breaks the build — which is the point.

### ADR-8 — No global state store

**Decision: no Redux, Zustand, Jotai, or equivalent.** The four kinds of state in §7.8 each have a natural
owner: server data in the query cache, the prediction in one context provider, the draft in RHF plus a
`sessionStorage` mirror, and UI state in `useState`. A store would be a third place to look for state with
nothing that belongs in it. Cost: the prediction context is a bespoke ~40-line provider that has to be
mounted correctly (above the router outlet, §2.5) — reviewed as part of the routing setup rather than
assumed. Revisit if a feature ever needs cross-area mutable state; none of the thirteen areas does today.

### ADR-9 — Relative `/api` base URL, proxied

Today `vite.config.ts` proxies `/api` → `:8000` while `api.ts` calls the absolute `VITE_API_BASE_URL`, so
the proxy is dead configuration and CORS is load-bearing in dev and would be in production; and
`.env.production` names a placeholder domain (C13). **Decision: the client's default base is the relative
`/api`; the dev proxy becomes the live path; `VITE_API_BASE_URL` remains an opt-in override for a
split-origin deployment.** Consequences: CORS stops mattering in the default deployment, no backend change
is needed (the existing `:5173` allowance still covers the override case), and the production host acquires
a documented requirement to proxy `/api` to the FastAPI service. Cost: same-origin deployment is now a
hosting requirement rather than a convenience.

### ADR-10 — `localStorage` is never used, for anything

**Decision: zero `localStorage` writes across the whole product**, including theme and dismissal flags.
Enforced by a bundle-level assertion (§8.8 T-SEC-04). The rule "no patient data in `localStorage`" is
fragile if the API is otherwise in use, because the next developer stores something innocuous there and the
boundary erodes. Cost: theme preference follows the OS via `prefers-color-scheme` and is not persisted per
device, and dismissible banners reappear in a new tab. Both are acceptable; a persisted health draft is not.

### ADR-11 — Native form controls, no headless UI library

**Decision: native `<select>`, `<input>`, `<button>`; hand-built disclosure and dialog.** Native controls
bring platform keyboard handling, mobile pickers, and screen-reader support for free, which is most of §9.
Only two composite patterns are needed — disclosure and confirm dialog — and both are small and well
specified. Cost: the dialog's focus trap and the disclosure's `Escape` handling are ours to test (§9.9)
rather than inherited. Rejected: Radix or Headless UI, which would be a large dependency for two patterns.

### ADR-12 — Recharts, and never as the only representation

**Decision: `recharts` for the SHAP driver bars, the score position scale, and the research metric charts;
every chart is preceded by the same facts as text or a table.** A bar chart is evidence for a sentence, not
an explanation (§4.1). Cost: a sizeable dependency for a handful of charts, accepted because the research
area needs several and hand-rolled SVG would cost more in accessibility work. Constraint: charts consume
design tokens and never define their own palette, and every chart has a text alternative (§4.7).

### ADR-13 — The prediction is transient by construction

**Decision: the `/predict` response lives only in a React context mounted above the router outlet.** This
satisfies both halves of the requirement simultaneously — ordinary in-app navigation cannot lose it because
no route unmounts the provider, and a reload discards it because nothing persists it. Cost: `/results` is
not a shareable or bookmarkable URL, and a reload shows an empty state; §2.4 makes that an authored screen
rather than an accident. Explicitly rejected: `sessionStorage` for the response, which would put a health
record on disk for the tab's lifetime and buy only reload-survival.

### ADR-14 — Provenance is a component, not prose

**Decision: one `<StatusLabel>` component with a five-value union, its copy in the content layer, and a
`<StatusRegion>` wrapper.** Provenance stated in prose is deleted by the next edit; a component with a
typed union survives refactoring and is testable (§8.8, §5.6). Cost: a discipline requirement — every new
figure must be inside a `VERIFIED` region or carry its own label, which is why it is a test rather than a
convention.

### ADR-15 — Lucide for icons

**Decision: `lucide-react`, tree-shaken, icons imported individually.** Icons are always paired with text
(§4.1), so they are reinforcement, never the sole carrier of meaning; the five status glyphs are chosen for
structural distinctness (§5.4). Cost: one dependency; mitigated because only the imported icons ship.
Rejected: an icon font (accessibility and layout problems) and inline SVG per icon (unmanaged duplication).

### ADR-16 — MSW for integration tests, added when the first one is written

**Decision: `msw` is reinstalled in the phase that writes the first integration test, not before.** Phase 0
removed it precisely because it was declared and unused. Unit tests use recorded fixtures; integration tests
use MSW handlers built from those fixtures; one CI job runs the parity tests against a live backend
(FRONTEND_TEST_PLAN §7). Cost: fixtures must be regenerated by a documented command, or they drift — which
is what the live-backend parity job exists to catch.

### 10.1 Dependency ledger

| Package | Status | Why it is needed | If removed |
|---|---|---|---|
| `react`, `react-dom` | installed | Product framework | — |
| `typescript`, `vite` | installed | Build and type safety | — |
| `zod` | installed | Runtime response parsing at the API boundary (§7.7) + form schema | Contract violations become silent render bugs |
| `react-hook-form` | installed | Per-field re-renders, 24-field form state, 422 error mapping | Re-render the whole form per keystroke |
| `@hookform/resolvers` | installed | Bridges Zod to RHF | Duplicate validation logic |
| `vitest`, RTL, `jsdom`, `jest-dom` | installed | Test runner and DOM assertions | No tests |
| `eslint`, `prettier` | installed | Lint and format gates in CI | Style drift, `react/no-danger` unenforced |
| `react-router-dom` | **Phase 2** | 12 routes, 4 nested layouts, history, scroll restoration (ADR-2) | Hand-rolled routing |
| `tailwindcss`, `@tailwindcss/vite` | **Phase 2** | Token-enforced design system (ADR-3) | Untracked CSS values |
| `@tanstack/react-query` | **Phase 2** | `/health` polling + focus/reconnect revalidation, session caching (ADR-4) | Hand-rolled polling and dedup |
| `lucide-react` | **Phase 2** | Status and UI icons (ADR-15) | Inline SVG duplication |
| `recharts` | **Phase 2** | Driver bars, score scale, research charts (ADR-12) | Hand-rolled SVG plus a11y work |
| `msw` | **Phase 2+** | Integration-test transport (ADR-16) | No integration tier |
| `jest-axe` | **Phase 2** | Automated a11y floor on every route state (§9.9) | Manual-only a11y |

Nothing else. In particular: no date library (no dates are rendered — training date does not exist, §12),
no CSV library (a header check and a line split are sufficient, and a parser would be a dependency for
twenty lines), no HTTP client (`fetch` plus `AbortController` is already in place), no i18n framework yet
(recorded as a deferred question, §12).

## 11. Contradictions found and fixed

Twenty-five problems found while verifying the plan against the running backend and the code on disk. Each row
names the resolution; the ones marked **plan amended** were written back into `FRONTEND_PLAN.md` as part of
this phase. None was resolved by adding a backend capability.

| # | Problem | Resolution |
|---|---|---|
| C1 | Path-leak rule scoped to `/model` only; `/predict.model.artifacts[*].path`, degraded `/health.detail`, and 503 `detail` leak the same absolute paths | Rule broadened to *any* server string; `safeText()` chokepoint + Zod view models + 3 tests (§8.3). **Plan amended** |
| C2 | Requirement told the frontend to sort SHAP drivers by descending impact — the backend already does, and rule 10 forbids recomputation | Render in received order; assert the order instead of imposing it. **Plan amended** |
| C3 | Requirement told the frontend to slice `sha256[:12]` for the version; the backend already exposes `model.version` as exactly that | Read `version`; never touch `artifacts`. **Plan amended** |
| C4 | Verdict and band rendered independently produce "NOT CKD" in green beside "MODERATE" in amber | Four-state result matrix with authored wording; `MODERATE` always means near the boundary (§3.11). **Plan amended** |
| C5 | The plan never mentioned `explanation`, a backend-authored patient sentence that exists in every response | Rendered as the primary plain-language summary, with a defined `null` fallback. **Plan amended** |
| C6 | Batch CSV with missing or misnamed columns returns **200** with silent imputation — verified live, `imputation_count: 22` | Client-side header validation against `feature_schema`, generated template, mandatory imputation disclosure (§1.13). **Plan amended** |
| C7 | `error-handler.ts` has no 415 case, so the required 415 copy cannot be produced; `detail` is a bare string there | 415 added to normalization with string-`detail` handling (§7.5) |
| C8 | `formatValidationMessage` matches Pydantic **v1** wording; v2 emits `literal_error`, `float_parsing`, `less_than_equal`, `extra_forbidden`, so those branches are dead | Normalize on `type` + `ctx`, never on message text (§7.5) |
| C9 | Batch 422 `loc[0]` is a numeric row index, which `handleValidationError` filters out — row errors are unreportable | Separate row mapper; CSV line = `loc[0] + 2` (§7.5) |
| C10 | `ModelInfo` invents `training_date`, `accuracy`, `recall`, `precision` at the top level and omits the 11 real keys; `getModelMetadata()` is typed with it | Replaced by the verified shape (§11.1); all metrics optional because `model_metadata()` copies keys conditionally |
| C11 | `field-metadata.ts` hardcodes `min`, `max`, `options`, `type` — the second hardcoded schema rule 6 forbids | Split into `FieldContent` (prose) + runtime `FieldSchema` from `/openapi.json`; structural guard in the parity test (§6.5) |
| C12 | `bp` is **diastolic**, and a systolic 120 is silently accepted inside the 30–200 range | Label states "diastolic — the lower number"; non-blocking plausibility hint (§3.5). **Plan amended** |
| C13 | `.env.production` targets the placeholder `https://api.ethiockd.example.com`; the `/api` proxy is dead config while the client uses an absolute URL | Relative `/api` default, proxy becomes the live path, absolute URL an override (ADR-9). **Plan amended** |
| C14 | `VITE_HEALTH_CHECK_INTERVAL` is declared in both env files and read by no code, while a 60 s health retry is required | Wired to the `['health']` refetch interval (§7.2) |
| C15 | `api.ts` DEV-logs the full 24-field payload; `logError` logs stacks unconditionally; 422 bodies echo submitted values | No bodies logged in any environment; DEV logs method/path/status/duration only (§8.5). **Plan amended** |
| C16 | `build.sourcemap: true` ships full source maps to production | `sourcemap: false` for production builds; DEV unchanged (§11.2) |
| C17 | The testing tier table names MSW, which Phase 0 removed as unused | MSW returns with the first integration test (ADR-16); stated as sequencing, not a gap |
| C18 | Every `/model.metrics` key is conditional in `model_metadata()`, but the plan treats the metric block as present | All nine metrics typed and rendered optional (§0.3) |
| C19 | `/predict/batch` declares no `requestBody`, so its accepted content types are not discoverable from OpenAPI | Documented constant with a source comment; the only schema fact not read from the backend (§0.6) |
| C20 | Batch items carry no `disclaimer` and no `model`, but hardcoding a disclaimer is forbidden | Batch page shows `/model.limitations` from a separate read and states that provenance (§1.13). **Plan amended** |
| C21 | The plan's thirteenth area is *Reports*, while the phase brief's thirteenth is *Batch research scoring* — two different area lists of the same length | Batch becomes area 13 at `/research/batch` (it has a real endpoint and a distinct user); Reports becomes a cross-cutting capability of `/results` and `/research/batch` rather than a destination, since it renders nothing of its own (§1.17). **Plan amended** |
| C22 | R2.3 names six field groups, two of which would hold one and two fields — six screens for 24 values, three of them nearly empty | Five steps, ordered no-lab-first so the two lab-free steps come before any lab value (§3.2). **Plan amended** |
| C23 | R13.1 requires the report to contain an "assessment id", but `PredictionResponse` returns no identifier of any kind — the field does not exist | The report carries a **locally generated** reference (`crypto.randomUUID()`, first 8 chars), printed as "Report reference — generated on this device", never presented as a backend id and never sent anywhere (§1.17). **Plan amended** |
| C24 | The in-flight copy read "Analyzing patient data…", which addresses the reader in the third person as a clinical record — wrong for a product whose primary user is the patient, and inconsistent with the plan's own patient-first stance | Amended to "Analysing your answers…", with a stated house rule that UI copy uses British spelling (the convention in Ethiopian English) while identifiers and CSS properties keep their own. **Plan amended** |
| C25 | Client-side validation copy and server-derived 422 copy were specified separately, so one mistake could be described in two different ways depending on where it was caught | The architecture adopts the plan's exact strings, and new R2.16 requires string-identity, asserted by `T-ASMT-16`. **Plan amended** |

### 11.1 The corrected `/model` type

Replaces the fabricated `ModelInfo`. Every field below was observed in a live response; nothing is added
for convenience, and the optional markers reflect the backend's conditional copying, not uncertainty about
the contract.

```ts
export interface ModelMetadata {
  name: string;
  version: string;                 // = artifacts.model.sha256.slice(0, 12)
  feature_count: number;
  feature_schema: string[];        // 24 names, model order — the source of field identity
  datasets: string[];
  n_rows: number;
  n_train: number;
  n_test: number;
  metrics: {                       // every key conditional — see §0.3
    accuracy?: number; precision?: number; recall?: number; specificity?: number;
    f1?: number; auc_roc?: number; brier_score?: number;
    confusion_matrix?: number[][];
    intervals?: Record<string, [number, number]>;
  };
  artifacts: Record<string, { path: string; sha256: string }>;  // `path` never rendered
  limitations: string[];
}

/** What components receive. `path` is dropped at the parse boundary. */
export interface ModelView extends Omit<ModelMetadata, 'artifacts'> {
  artifacts: Record<string, { sha256: string }>;
}
```

`HealthResponse.model` is the string `"ready"` and is typed as a status, not a name. `training_date` does
not exist and is not declared (§12, D1).

### 11.2 Config changes recorded for Phase 2

Not applied in this phase — they are code, and this phase writes documents. `vite.config.ts`:
`build.sourcemap: false` for production (C16); keep the `/api` proxy and make it load-bearing (ADR-9).
`package.json`: add an `engines.node` pin and an `.nvmrc` so dev and CI agree — local development is
currently on Node 25.2.1 with no pin, so CI would otherwise validate an interpreter nobody uses
(FRONTEND_TEST_PLAN §8). `api.types.ts`: apply §11.1. `field-metadata.ts`: split per §6. `api.ts` and
`error-handler.ts`: the changes in §7.1 and §7.5.

## 12. Backend dependencies and open questions

### 12.1 Backend dependencies — all PLANNED, none actioned

Each of these is a capability the frontend would use if it existed. **None was built, proposed as a code
change, or worked around by fabricating data.** Every one has a labelled placeholder in the UI naming what
it needs (§5.3).

| Id | Capability | Blocks | Why it cannot be done frontend-side |
|---|---|---|---|
| D1 | Model training / evaluation date | Model Card "trained on", Research Lab provenance | `model_metadata()` returns no date; a file mtime is not a training date |
| D2 | `top_n` override on `/predict` | Showing more than 3 SHAP drivers | `predict_one` fixes `top_n=3`; the route exposes no parameter |
| D3 | A model version or hash on `/health` | Detecting that the served model changed mid-session | `/health` returns component statuses only; polling `/model` cannot distinguish "changed" from "cached" without a validator |
| D4 | Threshold-sweep endpoint | Research Lab threshold analysis | `tabular_model.threshold_sweep` exists but no route reaches it |
| D5 | Federated results endpoint | Turning `/federated` from SIMULATION into VERIFIED | `src/federated/` exists but no route reaches it |
| D6 | Multimodal / imaging inference endpoint | Turning `/multimodal` into a feature | `imaging_model.pt` and `fusion_model.pt` are on disk, unreachable through the API |
| D7 | Model-comparison endpoint | Research Lab comparisons | `/model` describes one model only |
| D8 | Facilities data source, or a proxy route holding a provider key | `/facilities` beyond guidance copy | A provider key cannot live in a `VITE_*` variable (§8.2) |
| D9 | Redaction of `artifacts[*].path`, and of `detail` on degraded `/health` and 503 | Nothing — mitigated frontend-side | Backend is frozen; recorded as a backend issue, mitigated per §8.3 |
| D10 | `FEATURE_PROMPTS` / `FEATURE_PLAIN_LANGUAGE` exposed via an endpoint | Nothing — content layer covers it | Both exist in `config.py` and `shap_utils.py` but no route returns them; good source material for `fields.ts` copy |

D9 is the only one with a security dimension, and it is deliberately left as documentation: the instruction
to protect the backend outranks the convenience of fixing it here, and §8.3 removes the frontend-visible
consequence in four independent ways.

### 12.2 Open questions for the phase brief

1. **Language.** All copy is currently English. Amharic — and plausibly Oromo and Tigrinya — is a real
   requirement for an Ethiopian screening tool, and it changes the content layer's shape (a locale
   dimension on `FieldContent` and `EducationSection`) and the typography stack (Ethiopic script metrics
   and line height). Deciding after the copy is written costs a rewrite. **Recommendation: decide before
   Phase 2 writes `fields.ts`.** No i18n dependency is in the ledger yet for that reason.
2. **Facilities provider.** Until one is chosen, `/facilities` stays PLANNED with guidance copy only. The
   choice determines whether D8 needs a backend route.
3. **Hosting.** ADR-9 makes "same origin, `/api` proxied to FastAPI" a hosting requirement. If the
   deployment must be split-origin, `VITE_API_BASE_URL` covers it but CORS becomes load-bearing again and
   the backend's allowed origins would need to change — which is a backend change, so it needs a decision
   rather than an assumption.
4. **`MODEL_CARD.md`.** `tabular_model.brier_score` references it in a docstring; the file does not exist
   anywhere in the repository. The `/model-card` route is built from `/model` and `limitations`, so nothing
   is blocked, but the reference is dangling and worth resolving on the backend side eventually.
5. **Reports.** No report endpoint exists. Reports are specified as client-side generation from the
   response already in memory (print stylesheet first, since it costs no dependency and no data leaves the
   browser). A server-side report endpoint would be a new backend dependency; it is not requested here.

