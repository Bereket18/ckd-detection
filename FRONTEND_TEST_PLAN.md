# EthioCKD Frontend Test Plan

> **Status — Phase 1 deliverable.** This is a specification of *what* will be tested, at which tier,
> against which double, and why each test exists. **No test code is written in Phase 1.** Phase 2
> implements the suite in the order given in §10.
>
> Authority: [FRONTEND_PLAN.md](FRONTEND_PLAN.md) owns the requirements (R-numbers below refer to it).
> [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) owns the design being tested (§-numbers below
> refer to it). Where the two disagree, the plan wins and the architecture records the amendment.

## Contents

- [0. How to read this](#0-how-to-read-this)
- [1. Test architecture](#1-test-architecture)
- [2. Requirement-to-test matrix](#2-requirement-to-test-matrix)
- [3. Error-handling matrix](#3-error-handling-matrix)
- [4. Security and privacy matrix](#4-security-and-privacy-matrix)
- [5. Accessibility matrix](#5-accessibility-matrix)
- [6. Contract and drift tests](#6-contract-and-drift-tests)
- [7. Fixtures](#7-fixtures)
- [8. Environments, Node pinning, and CI](#8-environments-node-pinning-and-ci)
- [9. Coverage policy and what is deliberately not tested](#9-coverage-policy-and-what-is-deliberately-not-tested)
- [10. Sequencing](#10-sequencing)
- [11. Open questions](#11-open-questions)

## 0. How to read this

**One governing rule: no test may assert a value the model produces.** A test that asserts
"low haemoglobin raises risk" or "this input yields `HIGH`" encodes the model into the frontend suite,
so retraining the model breaks the frontend build for no frontend reason — and it quietly makes the
test suite a second source of clinical truth. Every test here asserts one of three things instead:

1. **Rendering fidelity** — what the backend sent is what the page shows, unaltered and unreordered.
2. **An invariant** — something that must hold for *every* response (a path never appears; the band is
   never recomputed; imputation is always disclosed when the count is non-zero).
3. **Frontend-owned behaviour** — routing, focus, draft persistence, validation copy, export.

Test identifiers are namespaced by area (`T-ASMT-04`) rather than globally numbered, so adding a test
to one area never renumbers another. Namespaces: `DASH`, `ASMT`, `RES`, `XAI`, `LRN`, `MM`, `FED`,
`LAB`, `BATCH`, `MC`, `ABT`, `DEMO`, `FAC`, `RPT`, plus cross-cutting `ERR`, `SEC`, `A11Y`, `CON`.

A requirement with no test row is a defect in this plan, not a requirement exempt from testing. Two
requirement classes get a deliberately narrow test, and the matrix says so: `SIMULATION` areas are
tested for *absence* of numbers and *presence* of the label, and `PLANNED` areas are tested for a
placeholder that contains no figure.

## 1. Test architecture

### 1.1 Six tiers, each with a hard rule about what it may touch

| Tier | Runner and environment | May reach the network? | Data source | Runs in CI |
|---|---|---|---|---|
| **Unit** | Vitest, `node` environment where no DOM is needed | Never — a `fetch` call in a unit test is a design error | Literal inputs in the test | Yes, always |
| **Component** | Vitest + `jsdom` + React Testing Library | Never — components receive data as props or through a seeded query cache | Static fixtures (§7) | Yes, always |
| **Integration** | Vitest + `jsdom` + MSW | Only through MSW handlers | Fixtures replayed by MSW, including error and delay scenarios | Yes, always |
| **Accessibility** | Vitest + `jsdom` + `jest-axe` + `@testing-library/user-event`, plus a computed-contrast unit test over the token table | Never | Fixtures | Yes, always |
| **Contract** | Vitest, opt-in via `VITEST_CONTRACT=1`, against a locally running `api.main:app` | Yes, to `http://127.0.0.1:8000` only | The live backend | No — not a required gate (§8.4) |
| **End-to-end** | Playwright — **PLANNED**, not Phase 2 | Yes, real browser + real backend | Live | No |

The four always-on tiers are the gate. Contract tests are the *drift alarm* and are run deliberately:
on demand, when regenerating fixtures, and before a release. They cannot be a required CI gate because
CI has no model artefacts — `saved_models/*.joblib` is not in the repository, so `/model` and `/predict`
cannot start there. That constraint is the reason fixtures exist at all (§7.1), and it is worth stating
plainly rather than discovering during Phase 2.

### 1.2 Why not a single tier

The tiers exist to make failures diagnostic rather than merely red. A broken bound in the schema
derivation fails one unit test with a one-line message; the same bug reaching a component test would
fail as "the input rejected 1.2", which is three inferences away from the cause. The split is by
*blast radius of the failure message*, not by fashion.

### 1.3 What replaces property-based testing

Kept from the plan's reasoning: the input domain is a fixed 24-field schema with published bounds, so
the interesting cases are enumerable. Instead of generated inputs, the suite uses a **boundary table
derived at test time from `/openapi.json`** (§6.2): for every numeric field, `min`, `min - ε`, `max`,
`max + ε`, a mid value, empty, and a non-numeric string; for every categorical field, each allowed
value, empty, and one disallowed value. That is 24 × 7 and 24-field enum coverage generated from the
real schema, which is both stronger and more legible than a fuzzer, and it cannot drift because the
table is not written down.

### 1.4 File layout

Tests live beside the code they test, which is already the convention on disk
(`services/api.test.ts` sits next to `services/api.ts`). Four directories live centrally because they
are about the system rather than a module:

```text
ckd-frontend/
  src/**/<name>.test.ts(x)        unit + component, colocated
  tests/
    setup.ts                      existing; extended with jest-axe matchers and a fetch guard
    fixtures/                     recorded backend responses (§7)
    msw/handlers.ts               MSW handlers built from fixtures
    integration/                  cross-module flows (§2, tier "I")
    contract/                     opt-in live-backend tests (§6)
    a11y/                         axe + keyboard sweeps (§5)
```

The `fetch` guard in `tests/setup.ts` is itself a testing decision worth naming: the unit, component,
and accessibility tiers install a `globalThis.fetch` that throws *"network access is not permitted in
this tier — use MSW (integration) or props (component)"*. Tier discipline that is only documented
erodes; tier discipline that throws does not.

### 1.5 Deliberately not used

- **Snapshot tests of rendered markup.** A result page is exactly the kind of output where a snapshot
  passes review by being regenerated. Assertions are on roles and text, never on serialized DOM. One
  exception is allowed: the printed report markup (`T-RPT-03`), snapshotted *only* so that a new field
  or a filesystem path cannot appear unnoticed, and reviewed as a security artefact.
- **A separate coverage-only test file.** Coverage is measured, not authored (§9.1).
- **`container.querySelector` as a default query.** Role and label queries only — a test that can find
  an element only by CSS class cannot notice that the element became unreachable to a screen reader.

## 2. Requirement-to-test matrix

Tier codes: **U** unit · **C** component · **I** integration (MSW) · **A** accessibility ·
**CON** contract (live backend, opt-in). A row may carry more than one tier when the requirement has
both a pure-logic half and a rendered half.

### 2.1 Dashboard — R1

| Req | Test | Tier | Asserts |
|---|---|---|---|
| R1.1 | `T-DASH-01` | I | On mount the app issues exactly one `GET /health` and one `GET /model`; a second mount within `staleTime` issues no further `/model` request (§7.2) |
| R1.2 | `T-DASH-02` | I | `status: "ok"` → the primary "Start assessment" control is enabled and navigates to `/assessment` |
| R1.3 | `T-DASH-03` | I | `status: "degraded"` (**HTTP 200**, per §0.2 — not an error status) → warning banner present, primary control disabled, disabled reason rendered as text, not only as a tooltip |
| R1.3 | `T-DASH-04` | I | The degraded response's `detail` string is **not** rendered anywhere (it carries an absolute path) — see `T-SEC-03` |
| R1.4 | `T-DASH-05` | I | Network failure → offline banner; the assessment entry is disabled with the offline reason; Learn and About remain reachable |
| R1.5 | `T-DASH-06` | I | With fake timers, a non-`ok` status refetches at 60 s ± tolerance and stops refetching once `ok`; the interval does not run while the document is hidden (`refetchIntervalInBackground: false`) |
| R1.6 | `T-DASH-07` | C | `feature_count` and headline metrics render from the fixture; changing the fixture changes the rendered numbers (proves nothing is hardcoded) |
| R1.6 | `T-DASH-08` | C | With every optional metric key absent (the conditional-metrics case, C18) the dashboard renders without a crash and without a zero, blank, or `NaN` figure |
| R1.7 | `T-DASH-09` | C | Given `/health` `model: "ready"`, the string `"ready"` never appears in a position labelled as a model name; the model name comes from `/model.name`. Guard: fixture sets `/health.model` to a sentinel and `/model.name` to another, and the assertion is on which sentinel appears where |

### 2.2 Assessment — R2

The largest block, and the one where a silent regression costs most: this is where the schema is
consumed and where patient input lives.

| Req | Test | Tier | Asserts |
|---|---|---|---|
| R2.1 | `T-ASMT-01` | U | `buildAssessmentFields()` returns fields in exactly `/model.feature_schema` order; reversing the fixture's array reverses the output |
| R2.1 | `T-ASMT-02` | U | A name in `feature_schema` but absent from `FIELD_CONTENT` throws at build time with the field name in the message — the parity contract (§6.5), never a silent skip |
| R2.1 | `T-ASMT-03` | U | A name in `FIELD_CONTENT` but absent from `feature_schema` also throws — drift is symmetrical |
| R2.2 | `T-ASMT-04` | U | Numeric `min`/`max` are read from the `/openapi.json` `anyOf` non-null branch, including fields whose bound sits only on that branch |
| R2.2 | `T-ASMT-05` | U | Categorical `options` come from the OpenAPI `enum`; the derived Zod schema accepts every listed value and rejects an unlisted one |
| R2.2 | `T-ASMT-06` | U | Changing a bound in the OpenAPI fixture changes the generated validator — no bound is written in frontend source (the C11 guard) |
| R2.3 | `T-ASMT-07` | U | The five steps (§3.2) partition the 24 fields exactly: the union equals `feature_schema`, any two steps intersect emptily, no field is orphaned |
| R2.3 | `T-ASMT-08` | C | Step order is no-lab-first: steps 1–2 contain no field whose content marks it lab-sourced |
| R2.4 | `T-ASMT-09` | C | Every field may be left empty; a step advances with all fields empty; no error ever appears for an empty field |
| R2.5 | `T-ASMT-10` | C | "I don't know" yields form state identical to never touching the field — asserted by comparing the serialized payloads of both paths, which must match exactly |
| R2.5 | `T-ASMT-11` | C | The per-step "I don't have this report" control nulls every field in the step in one action and is reversible by undo |
| R2.6 | `T-ASMT-12` | C | Submission is blocked only by an invalid value: 24 empty fields submit; 23 empty plus one out-of-range does not |
| R2.7 | `T-ASMT-13` | C | Non-numeric text in a numeric field renders exactly `Must be a valid number` |
| R2.8 | `T-ASMT-14` | C+U | Below-minimum renders exactly `Value must be at least {min}` with the bound interpolated from the schema, across all numeric fields via the §1.3 boundary table |
| R2.9 | `T-ASMT-15` | C+U | Above-maximum renders exactly `Value must be at most {max}`, same coverage |
| R2.7–2.9, R2.16 | `T-ASMT-16` | U | The client message for a fault is **string-identical** to what `normalizeError()` produces from the server's Pydantic `type` + `ctx` for the same fault (§7.5) — a user never sees two wordings for one mistake |
| R2.10 | `T-ASMT-17` | C | Each field renders label, abbreviation, and unit; `bp` renders as diastolic, never as bare "Blood Pressure" (C12) |
| R2.11 | `T-ASMT-18` | C | Per field, all five content facets are reachable: unit and patient explanation visible, the rest behind a `button` disclosure with `aria-expanded` |
| R2.11 | `T-ASMT-19` | U | All 24 `FieldContent` entries have non-empty values for all five facets, so a disclosure can never open onto nothing |
| R2.12 | `T-ASMT-20` | C | The data-quality indicator tracks provided/total accurately as fields are filled and cleared, derived only from live form state |
| R2.13 | `T-ASMT-21` | C | Draft writes to `sessionStorage` (debounced 500 ms, fake timers); written keys are a subset of the 24 schema names |
| R2.13 | `T-ASMT-22` | C | Zero `localStorage` writes during a complete flow — see `T-SEC-04` |
| R2.13 | `T-ASMT-23` | C | A corrupt or foreign-shaped `sessionStorage` payload is discarded rather than merged; the form starts empty |
| R2.14 | `T-ASMT-24` | I | The `POST /predict` body has exactly 24 keys, all schema names, `null` for untouched fields, no `undefined`, no UI-only key, no extra key (`extra="forbid"`, C13) |
| R2.14 | `T-ASMT-25` | I | The request carries `?explain=true` and the returned drivers are consumed without reordering |
| R2.15 | `T-ASMT-26` | I | In flight: all inputs disabled, spinner on submit, and the amended copy `Analysing your answers…` (C24) both rendered and announced politely |
| R2.15 | `T-ASMT-27` | I | A second submit while one is in flight issues no second request |

### 2.3 Results — R3

| Req | Test | Tier | Asserts |
|---|---|---|---|
| R3.1 | `T-RES-01` | C | The verdict and band render as **one composed statement**, not two independent badges, and it is the most prominent element by heading level and reading order — asserted structurally (it is the first `h1`/`h2` in the result region), not by measuring pixels |
| R3.1 | `T-RES-14` | C | All four reachable verdict × band states render their authored composed sentence (§3.11), asserted one test case per state |
| R3.1 | `T-RES-15` | C | The two unreachable states (`ckd`+`LOW`, `notckd`+`HIGH`) render the contract-violation state rather than a plausible-looking result |
| R3.2 | `T-RES-02` | C | `risk_band` renders from the response for each of the three band values, with the colour role from the token table and a non-colour channel present (word + shape, §5.4) |
| R3.2 | `T-RES-03` | U | **The band is never recomputed.** A fixture whose `risk_band` deliberately contradicts its `ckd_score` (e.g. score 0.9 with band `LOW`) renders `LOW`. This is the strongest available proof that no threshold lives in the frontend (plan must-have test 6) |
| R3.2 | `T-RES-04` | U | `RISK_BAND_BOUNDS`, `0.35`, `0.65`, and `0.5` appear nowhere in `src/` — a source-level grep test, because the numbers are easy to reintroduce as "just a helper" |
| R3.3 | `T-RES-16` | C | The response's `explanation` is the first prose a reader meets after the composed statement, rendered verbatim; altering the fixture's `explanation` alters the page, and no paraphrase of it exists in `src/` |
| R3.3 | `T-RES-17` | C | WHEN `explanation` is absent or empty, the composed statement from R3.1 stands in — the region does not collapse, and no invented sentence appears |
| R3.4 | `T-RES-05` | C | `ckd_score` is rendered without a `%` sign, never multiplied by 100, and never labelled "probability", "chance", "likelihood", or "confidence" — asserted as a banned-substring check over the score region's text |
| R3.4 | `T-RES-06` | C | The non-calibration wording is present and sourced from `model.limitations`, not from a frontend literal |
| R3.5 | `T-RES-07` | C | `imputation_count > 0` → every `imputed_fields` entry is listed by its human label, with the estimation explained; `imputation_count: 0` → no imputation region at all |
| R3.5 | `T-RES-08` | U | The rendered imputed list equals `imputed_fields` exactly — no addition, no omission, no reordering, and never derived by diffing the submitted payload |
| R3.6 | `T-RES-09` | C | `disclaimer` renders verbatim; changing the fixture's disclaimer changes the output; no disclaimer literal exists in `src/` |
| R3.7 | `T-RES-10` | C | `model.limitations` from the embedded prediction response renders as a list, with no second `/model` request issued by Results |
| R3.8 | `T-RES-11` | C | Both readings of one result are present, cover the same facts, and the technical reading contradicts nothing in the patient reading — asserted by both drawing from the same composed state object, plus a rendered-text check |
| R3.9 | `T-RES-12` | I | "Start a new assessment" clears the prediction context, clears the `sessionStorage` draft, clears any demo state, and lands on step 1 empty; the previous result is unreachable by back navigation (§2.6) |
| R3.9 | `T-RES-13` | I | The clear action requires confirmation, and cancelling it leaves the result intact |

### 2.4 Explainable AI — R4

| Req | Test | Tier | Asserts |
|---|---|---|---|
| R4.1 | `T-XAI-01` | C | Every driver in `shap_drivers` is rendered — count in equals count out, for fixtures of length 1, 3, and 5, so raising the backend's `top_n` needs no frontend change |
| R4.1 | `T-XAI-02` | U | No frontend constant caps the driver count; `3` and `top_n` appear nowhere in the explainability source |
| R4.2 | `T-XAI-03` | C | Rendered order equals received order, element for element. The component test asserts **only** that — whether the array is sorted by descending `abs(shap_value)` is the backend's rule and is checked once, in the contract tier (`T-CON-06`). A fixture arriving unsorted must therefore render unsorted rather than be silently re-sorted (C2) |
| R4.3 | `T-XAI-04` | C | `raises_risk` / `lowers_risk` / `neutral` each render their colour role **plus** a distinct arrow glyph and a text label, so meaning survives greyscale (`T-A11Y-06`) |
| R4.4 | `T-XAI-05` | U | Direction and contribution are read, never computed: a fixture whose `direction` contradicts the sign of its `shap_value` renders the stated `direction` |
| R4.4 | `T-XAI-06` | U | `Math.abs`, comparison against zero, and any sign inspection of `shap_value` are absent from the rendering path — a source-level assertion, since this is the exact regression rule 10 forbids |
| R4.5 | `T-XAI-07` | C | Each driver shows the human field label (content layer) and the person's own submitted value, taken from the submitted payload held in the prediction context and not re-derived |
| R4.5 | `T-XAI-08` | C | A driver whose value was imputed is marked as estimated rather than shown as if measured |
| R4.6 | `T-XAI-09` | C | The SHAP explanation is present, and the association-not-causation statement is present in both the patient and the technical reading |
| R4.6 | `T-XAI-10` | A | The explanation is a disclosure (`button`, `aria-expanded`), never hover-only (§9.5) |

### 2.5 Learn — R5

| Req | Test | Tier | Asserts |
|---|---|---|---|
| R5.1 | `T-LRN-01` | U | `education.ts` contains a section for each of the eight required topics, keyed and non-empty |
| R5.2 | `T-LRN-02` | U | Every section has both a simple and a technical body, and neither is a copy of the other |
| R5.3 | `T-LRN-03` | U | Every block flagged as a clinical claim carries at least one `sources` entry with a resolvable URL shape; a claim without a source fails the test. Target: zero `NOT VERIFIED` claims |
| R5.4 | `T-LRN-04` | C | The page renders the `PROVISIONAL` badge at page level, in a `role="note"` banner above the content |
| R5.4 | `T-LRN-05` | I | Learn renders fully with every endpoint failing — it is the one area with no backend dependency, and that is worth proving rather than assuming |
| §6.4 | `T-LRN-06` | U | No `ContentBlock` renders through `dangerouslySetInnerHTML`; the block union covers every shape used by the content file (see `T-SEC-11`) |
| §1.8 | `T-LRN-07` | I | A field's "learn more" link lands on the matching section for that field name, for all 24 fields |

### 2.6 Multimodal AI — R6 (SIMULATION)

The whole point of testing a simulated page is proving it cannot be mistaken for a real one. These tests
assert absence, which is unusual and deliberate.

| Req | Test | Tier | Asserts |
|---|---|---|---|
| R6.1 | `T-MM-01` | C | The `SIMULATION` banner is present, is the first content after the page title, and is not dismissible |
| R6.1 | `T-MM-02` | C | The banner remains in the DOM after scrolling and after any interaction on the page — it cannot be scrolled out of the accessibility tree or conditionally unmounted |
| R6.2 | `T-MM-03` | C | The pipeline diagram renders its stages as text-and-structure, readable with images and CSS unavailable |
| R6.3 | `T-MM-04` | C | **No numeral that could read as a metric appears on the page.** Implementation: scan the rendered text for percentage patterns, decimals in `[0,1]`, and any of the metric words (accuracy, AUC, F1, precision, recall, sensitivity, specificity); allow only numbers inside explicitly labelled illustrative examples, which must themselves carry a per-figure `SIMULATION` badge |
| R6.3 | `T-MM-05` | I | The page issues no request to any endpoint — there is nothing to request |
| R6.4 | `T-MM-06` | C | No copy asserts patient-level pairing; the banned-phrase list (`your scan`, `patient's image`, `paired with your`) does not appear |

### 2.7 Federated AI — R7 (SIMULATION)

| Req | Test | Tier | Asserts |
|---|---|---|---|
| R7.1 | `T-FED-01` | C | `SIMULATION` banner present, first, non-dismissible |
| R7.2 | `T-FED-02` | C | The Hospital A/B/C → local training → server → FedAvg → global model stages all render, each labelled as illustrative |
| R7.3 | `T-FED-03` | C | Banned-phrase list for deployment claims (`deployed at`, `real hospital`, `live sites`, `patient records from`) does not appear |
| R7.4 | `T-FED-04` | C | No federated accuracy figure appears — same numeral scan as `T-MM-04`; the `PLANNED` placeholder appears in its place |
| R7.4 | `T-FED-05` | I | The page issues no request |

### 2.8 Research Lab — R8

| Req | Test | Tier | Asserts |
|---|---|---|---|
| R8.1 | `T-LAB-01` | C | Every displayed metric traces to a `/model.metrics` key; a fixture with altered numbers alters every figure on the page |
| R8.1 | `T-LAB-02` | C | With each optional metric key absent in turn (C18), the page renders the field as unavailable rather than as `0`, `—`, `NaN`, or a blank cell that reads as zero |
| R8.2 | `T-LAB-03` | C | The confusion matrix renders from `metrics.confusion_matrix` with correct row/column labelling, and is exposed as a `table` with headers rather than as a picture only (§9.4) |
| R8.2 | `T-LAB-04` | U | Derived cells (totals, rates) are computed only from the supplied matrix, and the page never presents a derived rate as a backend metric |
| R8.3 | `T-LAB-05` | C | `metrics.intervals` render where present, each carrying the `PROVISIONAL` badge (§5.3); absent intervals render nothing at all rather than a point estimate dressed as an interval |
| R8.4 | `T-LAB-06` | C | Comparisons, threshold analysis, and federated results each render a `NOT VERIFIED` / `PLANNED` placeholder containing **no numeral** (numeral scan as `T-MM-04`) and naming the missing endpoint |
| R8.5 | `T-LAB-07` | C | The held-out-test-performance statement and the `model.limitations` caveats render beside the metrics, read from the response — no metric caveat is authored in the frontend |

### 2.9 Batch scoring — R8.6, area 13

Batch is the only place a person can hand the system a file, and the verified behaviour is dangerous:
a CSV containing only `age,bp` returns **200** with `imputation_count: 22` (§0.6, C6). Silence there is
a clinical hazard, so most of these tests exist to make the backend's silence loud.

| Req | Test | Tier | Asserts |
|---|---|---|---|
| R8.6a | `T-BATCH-01` | C | A CSV file is accepted through both the file input and drag-and-drop, and the input is reachable and operable by keyboard |
| R8.6a | `T-BATCH-02` | C | Header validation against `/model.feature_schema` **before** upload: missing columns, misspelled columns, and extra columns are each reported by name, with the count of affected columns |
| R8.6a | `T-BATCH-03` | C | The generated template's header row equals `feature_schema` joined by commas, in order — derived, never written down |
| R8.6b | `T-BATCH-04` | I | The request goes to `POST /predict/batch` with `Content-Type: text/csv` and the raw file body, not `multipart/form-data` (§0.6 — the endpoint declares no `requestBody`, so this is pinned by the documented constant, `C19`) |
| R8.6c | `T-BATCH-05` | C | A progress indicator is shown during upload, with a determinate value where the browser reports one and an indeterminate state otherwise |
| R8.6d | `T-BATCH-06` | C | The summary table renders `count` and, per row, `prediction`, `ckd_score`, `risk_band`, and `imputation_count`, each read from the response |
| R8.6d | `T-BATCH-07` | C | A row with `imputation_count > 0` is visibly marked in the table, not only in a detail view — the hazard has to be visible in the overview |
| R8.6d | `T-BATCH-08` | C | The aggregate imputation disclosure states how many rows and how many cells were estimated, both derived from the response's own counts |
| R8.6e | `T-BATCH-09` | U | CSV export appends prediction columns to the original rows without reordering or rewriting input columns; values containing commas, quotes, and newlines round-trip correctly |
| R8.6e | `T-BATCH-10` | U | The exported file contains no filesystem path and no `detail` string (`T-SEC-13`) |
| R8.6f | `T-BATCH-11` | I | A 422 with numeric-first `loc` (`[rowIndex, field]`) renders per-row errors with **CSV line numbers** — `loc[0] + 2`, accounting for the header row (C9) — and names the offending field per row |
| R8.6f | `T-BATCH-12` | U | `handleValidationError`'s field mapper and the row mapper are separate functions, and the row mapper does not drop numeric `loc[0]` (the C9 regression) |
| R8.6g | `T-BATCH-13` | I | A 415 renders copy stating the file must be CSV, produced from the **string** `detail` shape rather than the array shape (C7) |
| C6 | `T-BATCH-14` | I | A two-column CSV that the backend accepts with `imputation_count: 22` is **blocked client-side before upload**, with the missing columns named. If the upload proceeds anyway (override path, if one exists), the imputation disclosure is mandatory and cannot be dismissed |
| C20 | `T-BATCH-15` | I | The batch page renders `/model.limitations` from its own `/model` read and states that provenance, since batch items carry neither `disclaimer` nor `model` |

### 2.10 Model Card — R9

| Req | Test | Tier | Asserts |
|---|---|---|---|
| R9.1 | `T-MC-01` | C | Name, feature count, datasets, `n_rows`, `n_train`, `n_test`, metrics, and `limitations` all render from `/model`; altering the fixture alters the page |
| R9.2 | `T-MC-02` | C | The version rendered is `model.version` **as supplied**. The frontend performs no `slice(0, 12)` and never reads `artifacts.*.sha256` — verified `version === sha256[:12]` already (§0.3, C3) |
| R9.2 | `T-MC-03` | U | `slice(0, 12)`, `substring(0, 12)`, and `sha256` do not appear in the Model Card source |
| R9.3 | `T-MC-04` | C | `artifacts[*].path` never reaches the DOM — the sentinel test, `T-SEC-01` |
| R9.3 | `T-MC-05` | U | The `ModelView` mapper strips `path` at the boundary, so the value is not merely unrendered but absent from the object the components receive (§11.1) |
| R9.4 | `T-MC-06` | C | No training date is rendered, and no field labelled as a date appears; the `PLANNED` placeholder appears instead (dependency D1) |
| R9.4 | `T-MC-07` | U | `training_date` appears nowhere in `src/` — the fabricated field from the old `ModelInfo` type (C10) cannot creep back |
| R9.5 | `T-MC-08` | C | Every `metrics` key is treated as conditional: with each absent in turn, the Model Card renders "not reported" and never `0`, `—`, or `NaN` — the same absence sweep as `T-LAB-02`, run against this page because the two read the same block through different components |

### 2.11 About — R10

| Req | Test | Tier | Asserts |
|---|---|---|---|
| R10.1 | `T-ABT-01` | C | The screening-support-not-diagnostic statement is present, above the fold in reading order, and is not inside a collapsed disclosure |
| R10.2 | `T-ABT-02` | C | Links to the Model Card route and to the plan and reconciliation documents are present and resolve — for repository documents, asserted against the file existing on disk, so a renamed document fails the suite (the `MODEL_CARD.md` dangling-reference class of bug, §12 open question 4) |
| §5.5 | `T-ABT-03` | C | The permanent status-label legend renders all five labels with their full definitions, and every badge disclosure links to it |

### 2.12 Demo Mode — R11

| Req | Test | Tier | Asserts |
|---|---|---|---|
| R11.1 | `T-DEMO-01` | I | While demo mode is active, the banner is present on **every** route — asserted by visiting each route in one test rather than trusting the layout |
| R11.1 | `T-DEMO-02` | C | The banner is not dismissible and survives re-render and route change |
| R11.2 | `T-DEMO-03` | U | Demo values live in state separate from real input: entering demo mode does not mutate the real draft, and leaving it restores the draft byte-for-byte |
| R11.3 | `T-DEMO-04` | I | A prediction produced in demo mode carries the `SIMULATION` label into Results, Explainability, and any export — `T-SEC-12` |
| R11.3 | `T-DEMO-05` | I | There is no state sequence that yields a demo-derived result rendered without the label: exercised by toggling demo mode at each stage of the flow (before, mid-form, after submit, on the results page) and asserting the label in every case |
| R11.4 | `T-DEMO-06` | U | Exiting demo mode discards every demo value from memory and from `sessionStorage` |

### 2.13 Nearby facilities — R12 (PLANNED)

No provider is chosen, so the page itself is a placeholder. The four constraints are nonetheless
testable now, against the placeholder and against the seam a provider will later plug into — which is
the point of testing them now rather than after a provider arrives.

| Req | Test | Tier | Asserts |
|---|---|---|---|
| R12 preamble | `T-FAC-01` | C | The page renders the `PLANNED` badge and no facility data, real or illustrative |
| R12.1 | `T-FAC-02` | C | `navigator.geolocation` is not called on mount; it is called only after an explicit consent action, verified with a spy |
| R12.2 | `T-FAC-03` | U | The request builder, given a full assessment and prediction in context, produces a request whose URL, query, headers, and body contain no field name, field value, score, band, or verdict — `T-SEC-06` |
| R12.3 | `T-FAC-04` | U | Coordinates are not written to `localStorage` or `sessionStorage`, and are held only for the lifetime of the query |
| R12.4 | `T-FAC-05` | C | Copy presents the list as navigation; the banned-phrase list (`referral`, `we recommend this clinic`, `book`) does not appear |

### 2.14 Reports — R13

| Req | Test | Tier | Asserts |
|---|---|---|---|
| R13.1 | `T-RPT-01` | C | The report contains every required element: local reference, date and time, `model.version`, prediction, score, band, data quality, imputed fields, drivers, both interpretations, limitations, and the response's `disclaimer` — one assertion per element, so a dropped field fails by name |
| R13.2 | `T-RPT-02` | U | The reference is generated locally (`crypto.randomUUID`) and labelled as device-generated; no response field is presented as an id, because none exists (C23) |
| R13.3 | `T-RPT-03` | C | The print markup contains no filesystem path — sentinel fixture plus the reviewed snapshot from §1.5 |
| R13.4 | `T-RPT-04` | U | Generating a report issues no network call of any kind — `fetch` and `XMLHttpRequest` both spied (`T-SEC-13`) |
| §1.17 | `T-RPT-05` | C | A demo-mode report reproduces the `SIMULATION` badge inside the printed output, not merely in the surrounding page chrome |
| §1.17 | `T-RPT-06` | C | Export is offered on `/results` and `/research/batch` and nowhere else |

### 2.15 Coverage of the plan's ten must-have tests

The plan names ten tests that guard properties which can silently stop being true. Each maps here:

| Plan must-have | Covered by |
|---|---|
| 1. Field ranges and enums match `/openapi.json` | `T-ASMT-04`, `T-ASMT-05`, `T-ASMT-06`, `T-CON-02` |
| 2. Content keys are exactly `feature_schema` | `T-ASMT-02`, `T-ASMT-03`, `T-CON-01` |
| 3. The 422 / 415 / 500 / 503 / timeout / offline mapping | §3, `T-ERR-01`…`T-ERR-08` |
| 4. SHAP order as received, and per-direction rendering | `T-XAI-03`, `T-XAI-04`, `T-XAI-05`, `T-XAI-06`, `T-CON-06` |
| 5. `artifacts[*].path` is never rendered, from any of its four sources | `T-SEC-01`, `T-SEC-02`, `T-SEC-03`, `T-MC-04`, `T-MC-05` |
| 6. `risk_band` is never recomputed, and `0.35` / `0.65` / `0.5` appear nowhere in `src/` | `T-RES-03`, `T-RES-04` |
| 7. Imputation disclosed when `imputation_count > 0` | `T-RES-07`, `T-RES-08`, `T-BATCH-07`, `T-BATCH-08` |
| 8. The assessment completes keyboard-only | `T-A11Y-01`, `T-A11Y-02` |
| 9. Contrast ratios meet AA | `T-A11Y-05` |
| 10. Demo data cannot be submitted as real | `T-DEMO-04`, `T-DEMO-05`, `T-SEC-12` |

## 3. Error-handling matrix

Every row is an integration test against an MSW handler replaying a **recorded** error body (§7), because
the shapes differ in ways that are easy to get wrong from memory: single-prediction 422 uses
`loc: ["body", field]`, batch 422 uses `loc: [rowIndex, field]` numeric-first, and 415 and 503 send
`detail` as a bare **string** rather than an array.

| Condition | Test | Asserts |
|---|---|---|
| 422 single | `T-ERR-01` | Each `detail` entry maps to its field's inline error; focus moves to the first offending field; the form is not cleared; the server message wins over any client-side "valid" state (`T-SEC-10`) |
| 422 single, unknown field | `T-ERR-02` | A `loc` naming a field the form does not have surfaces as a form-level error rather than being dropped silently |
| 422 batch | `T-ERR-03` | Row errors render with CSV line numbers (`loc[0] + 2`) and field names (C9) |
| 415 | `T-ERR-04` | Copy states the upload must be CSV, produced from a **string** `detail` (C7) |
| 500 | `T-ERR-05` | Generic message plus a retry control; retry re-issues exactly one request; the raw body is never rendered |
| 503 | `T-ERR-06` | "Temporarily unavailable — the model is not loaded", and the `detail` string is **not** rendered (it is `str(exc)` and carries a path) |
| Timeout at 30 s | `T-ERR-07` | With fake timers, the `AbortController` fires at 30 s, a timeout message with retry appears, and **no automatic retry** occurs (§7.3 — a duplicate prediction is worse than a slow one) |
| Offline | `T-ERR-08` | Network failure yields the offline message; recovery restores the page without a reload and re-enables the primary action |
| Unexpected shape | `T-ERR-09` | A response that parses as JSON but fails the Zod view model renders the contract-violation state (§7.7), and no partial result is shown |
| Non-JSON body | `T-ERR-10` | An HTML error page from a proxy does not throw a parse error into the UI; it normalizes to the generic message |
| Layering | `T-ERR-11` | `APIError.message` remains the raw `"<status> <statusText>"`; every user-visible string comes from the handler. Asserted by rendering with an error whose raw message is a sentinel and checking the sentinel is absent from the DOM |
| Boundary | `T-ERR-12` | An ErrorBoundary per route catches a thrown render error, keeps the shell and navigation usable, and offers recovery without a full reload |

Two things this matrix deliberately does **not** test: that the backend emits these codes (that is the
backend's own 242-test suite), and that `ErrorHandler`'s copy reads well (that is review, not assertion).
What is asserted is the mapping, the layering, and the absence of server internals.

## 4. Security and privacy matrix

Canonical numbering; the architecture's §8.8 table is the same list. Tier and fixture are added here.

| Id | Property | Tier | Method |
|---|---|---|---|
| `T-SEC-01` | `artifacts[*].path` never reaches the DOM | C | Render Model Card, Results, and Explainability from a fixture whose paths contain the sentinel `__LEAK_SENTINEL__`; assert absence from `container.innerHTML` |
| `T-SEC-02` | `safeText()` strips Windows and POSIX paths | U | Table of leaky strings: `C:\Users\…`, `/home/…`, `/usr/local/…`, `\\host\share\…`, and a path embedded mid-sentence |
| `T-SEC-03` | A degraded `/health` `detail` is never rendered | C | Fixture with a path-bearing `detail`; assert absence while the degraded banner is present |
| `T-SEC-04` | Nothing patient-related is in `localStorage` | C | Complete a flow with a `localStorage` spy; assert zero `setItem` calls, plus a source-level assertion that `localStorage` is referenced nowhere in `src/` |
| `T-SEC-05` | A prediction does not survive a reload | I | Predict, remount the tree from scratch, assert the `/results` empty state rather than a restored result |
| `T-SEC-06` | Facility search carries no assessment data | U | Intercept the built request; assert URL, query, headers, and body contain no field name, value, score, band, or verdict |
| `T-SEC-07` | No request or response body is logged | U | `console` spy across DEV and PROD builds; assert only method, path, status, and duration appear (C15) |
| `T-SEC-08` | No `VITE_*` variable holds a secret | U | Assert the set of `import.meta.env` keys read by `src/` is exactly the three allowed, and that none is named like a credential |
| `T-SEC-09` | The draft is `sessionStorage`-only and cleared on all four triggers | C | One test per trigger: submit, new assessment, explicit clear, tab close |
| `T-SEC-10` | A server 422 overrides client-valid state | I | 422 fixture for a value the client accepted; assert the server error is shown |
| `T-SEC-11` | No `dangerouslySetInnerHTML` in the source | U | ESLint `react/no-danger` set to `error`, asserted by linting a fixture file that uses it |
| `T-SEC-12` | Demo results cannot be presented as real | I | Predict in demo mode; assert the badge travels to Results, Explainability, and export |
| `T-SEC-13` | A report export transmits nothing | U | `fetch` and `XMLHttpRequest` spied; assert zero calls and no path in the produced `Blob` or print markup |

### 4.1 The sentinel technique, and why it is used throughout

Several rows assert that something is *absent*. Asserting absence is weak when the value is realistic —
`expect(html).not.toContain('/home/user')` passes on a page that renders a different path. So every
absence test uses a fixture value that exists nowhere else in the product (`__LEAK_SENTINEL__`) and
asserts on that. The test then fails if and only if the value from that specific field reached the page,
which is the property actually wanted.

The same reasoning applies to `T-DASH-09`: two distinct sentinels, one in `/health.model` and one in
`/model.name`, so the test proves *which* source fed the rendered name rather than merely that a name
appeared.

## 5. Accessibility matrix

Referenced from architecture §9.9. Automated coverage is a floor, not a ceiling: `jest-axe` catches
missing labels and broken ARIA relationships, not whether the announcement makes sense. The split below
is honest about which is which.

### 5.1 Automated

| Id | Property | Method |
|---|---|---|
| `T-A11Y-01` | The assessment completes keyboard-only | `user-event` only, no `fireEvent`, no direct `.focus()`: tab from the page start, fill every step, reach and activate submit. Fails if any control is unreachable or requires a pointer |
| `T-A11Y-02` | Keyboard-only completion including the null affordances | Same traversal exercising "I don't know" and the per-step control, which sit at `tabIndex={-1}` and must therefore be reachable by their documented alternative route |
| `T-A11Y-03` | Zero axe violations per route | `jest-axe` on every route in its default, loading, empty, and error states — four passes per route, because a skeleton and an error panel are exactly where labelling is forgotten |
| `T-A11Y-04` | Form semantics | Every input has an accessible name; `aria-invalid` appears only with an error; `aria-describedby` points at the error id when an error exists and at the hint id otherwise, never both |
| `T-A11Y-05` | Contrast meets AA | Compute the ratio for every foreground/background pair in the token table (§4 tokens) and assert ≥ 4.5:1 for body text and ≥ 3:1 for large text and non-text indicators. A unit test over tokens, not a screenshot |
| `T-A11Y-06` | Meaning survives greyscale | For every status label and every SHAP direction, assert the word and the distinct glyph are both present, so colour is never the only channel (§5.4) |
| `T-A11Y-07` | Focus management on navigation | Route change moves focus to the new page's heading; a modal traps focus and restores it to the invoking control on close |
| `T-A11Y-08` | Announcements | The polite region announces step changes, submission, and result readiness; the assertive region is used only for task-interrupting errors; neither is created more than once |
| `T-A11Y-09` | Reduced motion | With `prefers-reduced-motion: reduce`, no transition or animation is applied — asserted on the computed style of the animated elements |
| `T-A11Y-10` | Text scaling | At 200 % text size no content is clipped or overlapped and no horizontal scroll appears at 320 px width |
| `T-A11Y-11` | Target size | Every interactive control meets the minimum touch target from §9.8 |
| `T-A11Y-12` | Body text floor | No rendered text token resolves below 14 px (plan accessibility 3) |
| `T-A11Y-13` | Landmarks and headings | One `main` per route, no skipped heading levels, and the status-label banners are reachable as `role="note"` landmarks |
| `T-A11Y-14` | Skip link | A skip-to-content link is the first focusable element and moves focus into `main` |

### 5.2 Manual, on a written checklist

Automation cannot judge these, and pretending otherwise is how inaccessible products pass audits:

1. **Screen-reader phrasing** — NVDA on Windows and VoiceOver on iOS, reading a complete assessment and
   result aloud. The question is whether a result is *understandable*, not whether it is labelled.
2. **Status-label expansions** — do the visually hidden sentences read as sentences in context?
3. **The four-state result wording** — does each composed sentence say what it means when heard rather
   than seen, especially `notckd` + `MODERATE`?
4. **Real device sweep** — a low-end Android phone at 320 px in bright light, which is the stated target
   condition and cannot be simulated in `jsdom`.
5. **Zoom and reflow at 400 %**, per WCAG 1.4.10, which needs a real viewport.

The checklist lives with the suite and is run before a release, with the date and reader versions
recorded. Phase 2 creates it; Phase 1 only specifies it.

## 6. Contract and drift tests

### 6.1 What these are for

The kept data layer was hand-copied from `api/schemas.py`. Nothing currently fails if the backend
changes — that is risk 7 from Phase 0, and it is the only risk in this project that gets *worse* with
time, because the frontend suite goes on passing while being wrong. Contract tests are the alarm.

They run against a live `api.main:app` on `127.0.0.1:8000`, are skipped unless `VITEST_CONTRACT=1`, and
are not a required CI gate (§8.4). Being opt-in is not a weakness here: their job is to be run
deliberately — when regenerating fixtures, before a release, and after any backend change — and a gate
that cannot run in CI would otherwise have to be deleted.

### 6.2 The tests

| Id | Asserts | Fails when |
|---|---|---|
| `T-CON-01` | `/model.feature_schema` has exactly the keys of `FIELD_CONTENT`, in the same set | A field is added, removed, or renamed in `config.py` |
| `T-CON-02` | Every numeric field in `/openapi.json` still exposes `minimum`/`maximum`, and every categorical still exposes `enum`, on the non-null `anyOf` branch | Pydantic or FastAPI changes how constraints are emitted, or a `Field(ge=…)` is dropped |
| `T-CON-03` | `/model` returns all 11 documented keys, and `version === artifacts.model.sha256.slice(0,12)` | The metadata shape changes, or `version` stops being derived that way (the assumption C3 rests on) |
| `T-CON-04` | `/health` returns `status` in `{ok, degraded}` and `model` as a status string, not a name | `/health` grows a version field (dependency D3 — a *welcome* failure, and the test message says so) |
| `T-CON-05` | A `/predict` response validates against the frontend's Zod view model, with no unknown key and no missing key | A response field is added or renamed |
| `T-CON-06` | `shap_drivers` arrive sorted by descending `abs(shap_value)`, and each `direction` agrees with the sign of its value | The backend stops sorting, at which point `T-XAI-03` becomes a real bug rather than a passing assumption |
| `T-CON-07` | `/predict` with all-null input returns 200 with `imputation_count: 24` | The backend stops accepting fully-missing input, which would invalidate the entire missing-data-first design |
| `T-CON-08` | 422 `detail[i]` uses Pydantic **v2** discriminators (`greater_than_equal`, `less_than_equal`, `literal_error`, `float_parsing`, `extra_forbidden`) with `ctx.ge` / `ctx.le` / `ctx.expected` present | A Pydantic major upgrade changes the error vocabulary, silently killing the mapping in §7.5 (the C8 regression) |
| `T-CON-09` | `POST /predict/batch` accepts `Content-Type: text/csv` and rejects a non-CSV type with 415 and a **string** `detail` | The accepted content type changes — undiscoverable from OpenAPI, since the endpoint declares no `requestBody` (C19) |
| `T-CON-10` | A batch CSV missing columns still returns 200 with a non-zero `imputation_count` | The backend starts rejecting incomplete CSVs, which would let the client-side guard in `T-BATCH-14` relax |
| `T-CON-11` | Recorded fixtures are byte-identical to fresh responses, modulo documented volatile fields | Any of the above drifts in a way the specific tests missed — the catch-all (§7.3) |

`T-CON-04`, `T-CON-07`, and `T-CON-10` are *expectation* tests rather than *requirement* tests: they
encode assumptions this architecture depends on, so that a backend improvement announces itself instead
of arriving unnoticed. Each carries a failure message naming the dependency (D-number) it would satisfy.

### 6.3 What contract tests must never do

They must not assert model behaviour. `T-CON-07` asserts the *shape and count* of an all-null response,
never its `prediction`, `ckd_score`, or `risk_band` — those legitimately change when the model is
retrained, and a frontend suite that breaks on retraining is a frontend suite that gets deleted.

## 7. Fixtures

Referenced from architecture §6.5 and ADR-16.

### 7.1 Why fixtures exist at all

`saved_models/*.joblib` is not in the repository, so CI cannot start the API: `/model` and `/predict`
both require a loaded model, and without one the app's dependency provider returns 503. Every non-contract
tier therefore needs recorded responses. This is a constraint of the environment, not a preference, and it
is the reason §7.3 exists — a recorded fixture is a copy of a contract, and copies rot.

### 7.2 Inventory

| File | Source | Notes |
|---|---|---|
| `health.ok.json` | `GET /health` | `status: "ok"` |
| `health.degraded.json` | `GET /health` with the model unloaded | **HTTP 200**, path-bearing `detail`, sentinel-substituted |
| `model.json` | `GET /model` | Full 11 keys; `artifacts[*].path` replaced with `__LEAK_SENTINEL__` |
| `model.minimal.json` | hand-derived from `model.json` | Every optional metric key removed — the C18 case |
| `openapi.json` | `GET /openapi.json` | Whole document, not a trimmed copy, so `anyOf` walking is exercised for real |
| `predict.ckd-high.json` | `POST /predict?explain=true` | One of the four reachable states |
| `predict.ckd-moderate.json` | same | |
| `predict.notckd-moderate.json` | same | |
| `predict.notckd-low.json` | same | |
| `predict.all-null.json` | all-null body | `imputation_count: 24` |
| `predict.contradictory.json` | hand-edited | Band contradicts score, and one `direction` contradicts its sign — for `T-RES-03` and `T-XAI-05`. **Marked in-file as deliberately impossible** |
| `errors/422.single.json` | live | `loc: ["body", field]` |
| `errors/422.batch.json` | live | `loc: [rowIndex, field]` |
| `errors/415.json` | live | string `detail` |
| `errors/503.json` | live | string `detail`, sentinel-substituted |
| `batch/response.json` | `POST /predict/batch` | Multi-row, mixed imputation counts |
| `batch/two-column.csv` | authored | The C6 hazard input |
| `batch/valid.csv` | generated from `feature_schema` | Round-trip source for `T-BATCH-09` |

### 7.3 Regeneration is a command, never an edit

```bash
# backend must be running: venv/Scripts/python.exe -m uvicorn api.main:app --port 8000
cd ckd-frontend
npm run fixtures:record        # scripts/record-fixtures.ts — writes tests/fixtures/, then runs T-CON-11
```

Rules, each one a lesson from how fixture sets usually decay:

1. **Recorded fixtures are never hand-edited.** The four hand-derived files (`model.minimal.json`,
   `predict.contradictory.json`, and the two CSVs) are the only exceptions, they live in a `derived/`
   subdirectory, and each carries a header comment naming the test that needs it and why the backend
   cannot produce it.
2. **The recorder substitutes sentinels.** Absolute paths in `artifacts[*].path` and in any `detail` are
   replaced with `__LEAK_SENTINEL__` at record time, so a developer's real home directory never enters
   the repository — a privacy property of the fixture set itself, and the reason recording is scripted
   rather than manual.
3. **Volatile fields are normalized**, and the recorder writes the list it normalized into
   `fixtures/README.md` so `T-CON-11` knows what to ignore.
4. **A staleness stamp.** The recorder writes `fixtures/recorded.json` with the backend's OpenAPI
   `info.version`, the `/model.version`, and the record date. `T-CON-11` compares it against live values;
   the always-on tiers assert only that the file exists and parses, so no test fails merely from age.
5. **Regenerating a fixture is a reviewable diff.** A fixture change in a pull request means the contract
   moved, and the diff is the evidence. This is the whole mechanism by which drift becomes visible.

### 7.4 MSW handlers are built from fixtures, never written by hand

`tests/msw/handlers.ts` imports the fixture files and returns them. A handler that constructs a response
inline is a third copy of the contract, so the rule is: handlers may choose *which* fixture and *what
status and delay* to return, never what a body contains.

## 8. Environments, Node pinning, and CI

Referenced from architecture §11.2. This section specifies Deliverable 11; **no workflow file is created
in Phase 1**, because a CI job that runs before the suite it gates exists would be red from its first
commit, and a red-from-birth pipeline teaches the team to ignore it. Phase 2 creates it as its first act,
when there is a passing suite to protect.

### 8.1 Node pinning — decide once, in two places

Local development is Node **v25.2.1** with npm **11.19.0**, and nothing in the repository pins either, so
CI would silently use whatever the runner's `node-version` resolved to. The supported range is not a
matter of taste — it is the intersection of what the installed toolchain declares:

| Package | Declared `engines.node` |
|---|---|
| `vite@8.2.2` | `^20.19.0 \|\| >=22.12.0` |
| `eslint@10.9.1` | `^20.19.0 \|\| ^22.13.0 \|\| >=24` |
| `jsdom@29.1.1` | `^20.19.0 \|\| ^22.13.0 \|\| >=24` |
| `vitest@4.1.11` | `^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0` |

Intersecting those leaves `20.19.x`, `22.13.x+`, and `>=24` — **Node 23 is excluded**, by ESLint and
jsdom rather than by Vite, which is exactly the kind of thing that is discovered on a CI runner at the
worst moment. Dropping the Node 20 branch as well (it is the oldest line and nothing here needs it):

```json
// ckd-frontend/package.json
"engines": { "node": "^22.13.0 || >=24.0.0" }
```

```text
# ckd-frontend/.nvmrc
25.2.1
```

Two files with two different jobs: `engines` states the range the project *supports* and makes an
unsupported install fail loudly, while `.nvmrc` pins the one version that is *recommended* and actually
exercised. CI reads `.nvmrc`, so the version CI proves is the version a contributor runs.

### 8.2 The workflow — a new file, not an edit

`.github/workflows/tests.yml` runs `pytest` and **must not be modified** (backend protection). The Node
job is a separate file, `.github/workflows/frontend.yml`:

- **Triggers.** `push` and `pull_request`, with `paths: ['ckd-frontend/**', '.github/workflows/frontend.yml']`
  so backend-only commits do not queue a Node job — and, equally, so a frontend commit cannot skip it.
- **`defaults.run.working-directory: ckd-frontend`**, since every command is scoped there.
- **Setup.** `actions/setup-node` with `node-version-file: ckd-frontend/.nvmrc`, `cache: 'npm'`, and
  `cache-dependency-path: ckd-frontend/package-lock.json`. Both cache settings are needed: without the
  dependency path the action looks for a lockfile at the repository root and silently caches nothing.
- **Install.** `npm ci`, never `npm install` — the lockfile is the point.
- **Steps, in this order:** `npx tsc --noEmit -p tsconfig.app.json` → `npx eslint .` →
  `npx vitest run` → `npm run build`. Order is cheapest-and-most-diagnostic first: a type error should
  not be reported as a test failure.
- **`vitest run --coverage`** with the §9.1 thresholds, uploading the report as an artefact.
- **No `continue-on-error` anywhere.** A step that may fail is not a gate.
- **Concurrency group** per ref with `cancel-in-progress: true`.
- **Permissions** `contents: read` only.
- Actions pinned by major version (`actions/checkout@v4`), which is the convention already used by
  `tests.yml`, so both workflows age the same way.

### 8.3 The build step is a test

`npm run build` earns its place in the gate for a reason specific to this repository: Phase 0 found a file
with 50 syntax errors sitting committed and green, because nothing in CI ever compiled the frontend.
`tsc --noEmit` would have caught that one; `vite build` additionally catches what type-checking cannot —
an unresolvable import, a missing asset, a Tailwind entry that does not compile, an environment variable
referenced but undefined at build time. The build output is discarded, not deployed; `dist/` is
gitignored and CI keeps no artefact from it.

### 8.4 What CI does not run, and why that is stated rather than hidden

- **Contract tests (§6).** CI has no model artefacts, so the API cannot start. Documented in the workflow
  as a comment naming this section, so the next person does not "fix" it by adding a step that cannot pass.
- **End-to-end tests.** None exist; `PLANNED`.
- **The manual accessibility checklist (§5.2).** Run before a release, recorded by hand.
- **`npm audit` as a gate.** Advisory only — a transitive advisory with no fix available must not be able
  to block an unrelated pull request. Run it on a schedule instead, where a finding gets read rather than
  worked around.

### 8.5 A quiet failure mode worth pre-empting

The frontend `README` records a stale-`.tsbuildinfo` false out-of-memory failure from Phase 0, fixed with
`rm -rf node_modules/.tmp`. CI is immune (it starts clean), so this is a local-only trap: if `tsc` reports
an OOM after a branch switch, clear the cache before believing the error. Worth naming here because the
symptom looks like a real memory problem and sends people to `--max-old-space-size`.

## 9. Coverage policy and what is deliberately not tested

### 9.1 Coverage as a floor on the parts that matter

A single global percentage is a poor instrument: it can be satisfied by testing the easiest code and it
says nothing about whether the dangerous paths are covered. Thresholds are therefore per area, and they
are floors that ratchet upward, never targets to hit exactly:

| Path | Statements | Rationale |
|---|---|---|
| `src/lib/api/**`, `src/content/**`, schema derivation | 95 % | Pure, cheap to test, and every consumer depends on it |
| `src/features/assessment/**`, `src/features/results/**` | 90 % | Where a defect reaches a person's health decision |
| `src/components/ui/**` | 85 % | Reused everywhere, so a defect is systemic |
| Everything else | 75 % | |

Uncovered lines in the first two rows must be explained in the pull request. Coverage is reported, not
enforced, for the `SIMULATION` pages — they are largely static content, and a percentage there measures
nothing.

### 9.2 Not tested, on purpose

Each of these is a decision, not an omission:

- **Model behaviour.** Whether the prediction is clinically right is the backend's 242-test suite and the
  model's own evaluation. The frontend suite asserts fidelity, never correctness of the science.
- **The backend's status codes.** Tested there. Here they are *replayed*.
- **Editorial quality.** Whether the copy is clear is review; only the presence, structure, and sourcing
  of content is asserted (`T-LRN-01`…`T-LRN-03`).
- **Exact pixel layout and visual regression.** No screenshot baseline: it would need a hosted runner for
  stability, and the properties actually worth guarding — contrast, target size, reflow, focus order — are
  asserted directly in §5, which is both cheaper and more meaningful.
- **Third-party library internals.** React Router routing, TanStack Query caching, and Zod parsing are
  assumed to work. What is tested is *our configuration* of them: the query keys, the retry policy, the
  derived schema.
- **The facilities provider.** No provider is chosen (§2.13); only the request-builder seam is tested.
- **Performance budgets.** Worth having for a low-bandwidth audience, but a budget asserted before a
  single component exists would be invented. Recorded as an open question (§11, question 3).

## 10. Sequencing

Tests are written with the code they guard, in the Phase 2 build order — not as a suite bolted on at the
end. Four of them are written *before* the code, because each one defines a contract that is easier to
state than to retrofit.

| When | Tests | Note |
|---|---|---|
| Phase 2, step 1 | Repair the three existing suites: fix the four wrong `api.test.ts` assertions to route through `errorHandler.handleAPIError()`, and confirm `validation.schema.test.ts` now collects its 466 lines | Phase 0 fixed the corruption; the suite has not yet been re-pointed at the correct layer |
| Phase 2, step 1 | `npm run fixtures:record` and `T-CON-01`…`T-CON-11` | **Written first.** Everything downstream consumes fixtures, and the contract tests are what make them trustworthy |
| Phase 2, step 2 | `T-ASMT-01`…`T-ASMT-06`, `T-ASMT-19` | **Written before the form.** The three-source schema join is the architecture's load-bearing idea; if it cannot be tested in isolation it is wrong |
| Phase 2, step 2 | `T-SEC-02`, `T-SEC-04`, `T-SEC-07`, `T-SEC-08`, `T-SEC-11` | **Written before the UI.** Each is a source-level or boundary-level invariant; they cost minutes now and are unpleasant to introduce once violations exist |
| Phase 2, step 3 | `T-A11Y-05`, `T-A11Y-12` | **Written with the tokens**, before any component consumes them — a failing contrast ratio is trivial to fix in a token file and expensive to fix across fifty components |
| Phase 3 | Assessment component and integration tests; `T-ERR-01`…`T-ERR-12` | MSW is added here, per ADR-16, when the first test genuinely needs it |
| Phase 4 | Results, explainability, four-state matrix, report tests | |
| Phase 5 | Research Lab, batch, Model Card | |
| Phase 6 | `SIMULATION` and `PLANNED` page tests, demo mode, facilities seam | The absence-assertions in §2.6–2.7 and §2.13 |
| Phase 7 | Full `T-A11Y` sweep, manual checklist, coverage ratchet | |
| Phase 2, step 1 | `.github/workflows/frontend.yml` | Created once the repaired suite is green, so the gate is green from its first run (§8) |

### 10.1 The four tests that would have caught Phase 0's defects

Worth naming, because a test plan should be able to show it would have prevented the last failure rather
than only the imagined next one:

1. `npx tsc --noEmit` in CI — the 50-error file (`validation.schema.ts`) was committed and green.
2. `T-ASMT-16` — the four wrong `api.test.ts` assertions targeted `APIError.message` instead of the
   handler, so the layering was asserted backwards and passed for the wrong reason.
3. `T-CON-08` — the Pydantic v1 wording in `formatValidationMessage` has been dead code all along, and no
   test noticed because nothing compared it to a real v2 error.
4. `T-MC-07` and `T-ASMT-06` — the fabricated `training_date` and the hardcoded bounds in
   `field-metadata.ts` are precisely the drift the parity and source-level tests exist to catch.

## 11. Open questions

These need a decision before the phase that depends on them, and each names that phase.

1. **Language.** If Amharic or another language is in scope, every string assertion in §2 and §3 must go
   through a translation key rather than a literal, and the copy-identity test `T-ASMT-16` becomes a
   per-locale test. This changes roughly thirty test rows. **Needed before Phase 2 writes `fields.ts`** —
   it is the same decision flagged as architecture §12 open question 1, and it is cheaper to answer than
   to reverse.
2. **Contract tests in CI.** They cannot run today because `saved_models/*.joblib` is absent (§7.1). If a
   small artefact or a fixture-backed test model were ever published for CI, `T-CON-*` should become a
   required gate. Recorded as the single highest-value future CI improvement; **not requested here**, since
   it would touch backend territory.
3. **Performance budgets.** A bundle-size and time-to-interactive budget matters for a 320 px phone on a
   slow connection, but any number chosen now would be guesswork. **Decide at the end of Phase 2**, from a
   first real build, then enforce in CI.
4. **Visual regression.** Deliberately excluded (§9.2). Revisit only if a token change ever ships a
   contrast defect that §5's computed checks did not catch — that would be evidence, and nothing else is.
5. **`e2e` runner.** Playwright is the assumption, but the choice should be made when e2e is actually
   scheduled, against whatever hosting exists then (architecture §12 open question 3).

---

**Phase 1 status.** This document specifies the suite; it contains no test code, and no test file, fixture,
recorder script, or workflow file was created. Counts, for the Phase 2 estimate: the plan's 75 numbered
area criteria (plus the seven batch sub-criteria of R8.6) map to **181 specified tests** across 14 area
sections — 131 area tests in §2, 12 error-mapping tests in §3, 13 security tests in §4, 14 automated
accessibility tests plus 5 manual checks in §5, and 11 contract tests in §6.
