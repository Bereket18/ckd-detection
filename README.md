# EthioCKD-Agent

[![tests](https://github.com/Bereket18/ckd-detection/actions/workflows/tests.yml/badge.svg)](https://github.com/Bereket18/ckd-detection/actions/workflows/tests.yml)
[![frontend](https://github.com/Bereket18/ckd-detection/actions/workflows/frontend.yml/badge.svg)](https://github.com/Bereket18/ckd-detection/actions/workflows/frontend.yml)

**Explainable federated multimodal learning for early detection of Chronic Kidney Disease**

An end-to-end research engineering system: a Python ML pipeline, a conversational CLI agent, a FastAPI inference backend, and a React web frontend — all honest about what is verified, what is provisional, and what is a simulation.

---

## What EthioCKD is

Chronic Kidney Disease affects an estimated 10% of the global population and is often diagnosed late, when treatment options are limited. In Ethiopia, a documented lack of specialist capacity and screening infrastructure makes early detection especially difficult.

This project builds a complete CKD risk-screening system with three goals:

1. **Accuracy with honesty** — every reported metric is measured on a clean held-out test set, with confidence intervals, and labelled ✅ VERIFIED / ⚠️ PROVISIONAL / SIMULATION as appropriate.
2. **Explainability** — every prediction is accompanied by the three features that most influenced it and the direction of each, so a patient or clinician understands *why*.
3. **Extensibility** — the system is designed to ingest new datasets (Ethiopian hospital data, when available) without rewriting the model.

---

## Results at a glance

All figures are from an 80-row held-out test set with Wilson 95% confidence intervals. On 80 rows, one misclassified patient moves accuracy by 1.25 points — the intervals are not decoration.

| Component | Result | Status |
|---|---|---|
| Tabular baseline (random forest) | **97.50%** accuracy `[91.3, 99.3]` · **100% recall** `[92.9, 100]` · 93.33% specificity `[78.7, 98.2]` — 0 false negatives in 50 CKD cases | ✅ VERIFIED |
| Federated learning (3 simulated hospitals, FedAvg) | **98.75%** `[93.3, 99.8]` federated vs **100%** `[95.4, 100]` centralized (same logistic regression, same split) — federating cost one patient in 80, within noise at this sample size | ✅ VERIFIED |
| Conversational agent | End-to-end working; two real bugs found and fixed via live testing before demo | ✅ VERIFIED |
| Imaging classifier (ResNet-18) | 83.9% test accuracy after fixing a class-imbalance bug (52% → correct tumor recall) | ⚠️ PROVISIONAL — pre-fix pipeline; requires Kaggle CT dataset to re-run |
| Multimodal fusion | **88.75%** — a **negative result vs baseline, correctly diagnosed**: synthetic tabular-imaging pairing carries no real per-patient signal | ⚠️ PROVISIONAL — same caveat |

> **Leakage bug fixed.** The earlier reported baseline (98.75% / 98%) was inflated because the imputer and scaler were fit on all 400 rows before splitting. Full details and every fix are in [AUDIT.md](AUDIT.md).

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Interfaces                           │
│                                                          │
│  CLI Agent (Python)          Web Frontend (React)        │
│  src/agent/chatbot.py        ckd-frontend/src/           │
│  Conversational Q&A,         Assessment form, results,   │
│  SHAP explanations           explainability views        │
└────────────────┬────────────────────┬───────────────────┘
                 │                    │ HTTP /api/*
                 │              ┌─────▼──────────┐
                 │              │  FastAPI (*)    │
                 │              │  api/           │
                 │              │  /health        │
                 │              │  /model         │
                 │              │  /predict       │
                 │              │  /predict/batch │
                 └──────────────┴────────┬────────┘
                                         │
                        ┌────────────────▼────────────────┐
                        │    ClinicalPredictionService     │
                        │    src/services/                 │
                        │    Loads artifacts, scores,      │
                        │    explains via SHAP             │
                        └────────────────┬────────────────┘
                                         │
              ┌──────────────────────────▼──────────────────────────┐
              │                  ML Pipeline                         │
              │                                                      │
              │  src/data/          src/models/      src/explain/   │
              │  preprocess.py      tabular_model    shap_utils.py  │
              │  datasets.py        imaging_model    (SHAP v0.51)   │
              │  load_tabular.py    text_model                      │
              │  pair_modalities.py fusion_model                    │
              │                                                      │
              │  src/federated/     src/agent/                      │
              │  Flower FedAvg      dialogue_fsm.py                 │
              │  simulation         DFA-driven Q&A                  │
              └──────────────────────────────────────────────────────┘
```

`(*)` The FastAPI backend and React frontend are on the `feat/api-and-frontend-foundation` branch, pending merge. The CLI agent is on `main`.

---

## Key capabilities

### Tabular ML pipeline

Classical ML baseline (logistic regression / random forest / XGBoost candidates) over the 24-feature UCI CKD dataset. Train/test split and preprocessing are strictly leak-free — the `TabularPreprocessor` is fit on training data only and the learned transforms are saved alongside the model so training and inference cannot drift.

```bash
python scripts/train_baseline.py    # trains, evaluates, saves model + metrics
python scripts/train_baseline.py --list-datasets
python scripts/train_baseline.py --dataset uci,ethiopian --out-suffix combined
```

### SHAP explainability

Every prediction includes the top-3 features and the **direction** of each (raising or lowering risk). The explainer is selected by model capability (`LinearExplainer` / `TreeExplainer` / `KernelExplainer`) — a bug in the original code used `LinearExplainer` for all three candidates, producing `InvalidModelError` when the random forest won cross-validation. Fixed.

### Conversational agent (DFA-driven)

The questionnaire is a formally specified deterministic finite automaton — not a while loop that happens to work. Four machine properties are checked at runtime and tested independently: totality (δ defined for every state × input), determinism, reachability, and termination.

```bash
python -m src.agent.chatbot           # run a consultation
python -m src.agent.chatbot --show-fsm  # print the DFA: Q, Σ, δ table, accepted language
```

Patients can answer `unknown` for any field — it is imputed by the trained preprocessor, and the result names which fields were estimated.

### Federated learning (SIMULATION)

Three simulated hospital clients using [Flower](https://flower.ai/) FedAvg. The simulation runs locally — there is no real multi-hospital deployment. This is stated explicitly, not implied otherwise.

```bash
python scripts/train_federated.py   # runs 10 rounds; prints per-round accuracy + like-for-like central comparison
```

### Multimodal pipeline (SIMULATION)

Tabular + imaging (ResNet-18 on Kaggle CT data) + text (synthetic clinical notes, TF-IDF). The tabular-imaging pairing is synthetic (label-consistent, not real per-patient correspondence). The fusion result (88.75%) underperforms the tabular baseline, and the reason is diagnosed and documented — not buried.

### Dataset ingestion layer

New CKD datasets can be registered without rewriting the model. Map column names and value translations into a `DatasetSpec`, and the pipeline handles combination, reduced-feature training, and schema integrity checks.

```bash
# data/README.md — full walkthrough
python scripts/train_baseline.py --list-datasets
```

### Batch scoring and external validation

```bash
python scripts/predict.py --input patients.csv --output scored.csv
python scripts/predict.py --input patients.csv --explain    # add top-3 SHAP per row
python scripts/predict.py --input clinic.csv --dataset clinic
```

Appends `prediction`, `p_ckd`, `risk_band`, and `n_imputed` to every row. Warns explicitly about rows where over half the features were imputed.

### FastAPI inference backend *(pending merge)*

Four endpoints verified against a live server:

| Endpoint | Description |
|---|---|
| `GET /health` | Component status: model, preprocessor, SHAP, schema compatibility |
| `GET /model` | Model metadata, version, feature schema, performance metrics |
| `POST /predict` | Single patient assessment with optional SHAP explanation |
| `POST /predict/batch` | CSV or JSON batch scoring |

### React frontend *(in progress — `feat/api-and-frontend-foundation`)*

Vite 8 · React 19 · TypeScript (strict) · Tailwind · React Router 7 · Zod validation · React Query

- Schema-driven assessment form (field definitions read from `/openapi.json` — no hardcoded field list)
- Results page with risk band, CKD score, confidence caveat, SHAP explanation
- Provenance system: VERIFIED / PROVISIONAL / SIMULATION / PLANNED badges throughout the UI
- WCAG 2.1 AA accessibility: skip links, ARIA landmarks, focus management, keyboard navigation
- Security: path filter blocks server-supplied filesystem paths from ever rendering in the browser
- 475 Vitest tests across 20 suites

---

## Verified results detail

### Tabular baseline

Measured on an 80-row held-out test set after the train/test leakage bug was fixed.

| Metric | Value | 95% CI (Wilson) |
|---|---|---|
| Accuracy | 97.50% | [91.3, 99.3] |
| Recall (sensitivity) | 100% | [92.9, 100] |
| Specificity | 93.33% | [78.7, 98.2] |
| False negatives | 0 / 50 CKD cases | — |
| False positives | 2 / 30 non-CKD cases | — |

Winning model: random forest (cross-validation on training set). The leakage fix changed the winner from logistic regression — the two are coupled findings; see [AUDIT.md](AUDIT.md) P0-3 and P0-5.

### Federated learning

| Configuration | Accuracy | 95% CI |
|---|---|---|
| Federated (FedAvg, 3 clients, 10 rounds) | 98.75% | [93.3, 99.8] |
| Centralized (same logistic regression, same split) | 100% | [95.4, 100] |
| Cost of federating | 1 patient / 80 | within noise |

The earlier claim that federation cost *no* accuracy compared federated logistic regression against the *random forest* baseline — a different model family. AUDIT.md P1-9.

---

## Provisional results (require Kaggle CT dataset to re-run)

| Component | Result | Caveat |
|---|---|---|
| Imaging (ResNet-18, 3 epochs + class weights) | 83.9% test accuracy | Measured pre-fix; will change when re-run on the corrected pipeline |
| Multimodal fusion | 88.75% | Measured pre-fix; synthetic pairing means this will move when the tabular pipeline is re-run |

Both require the ~12,446-image Kaggle "CT Kidney Dataset" which is not committed to this repository.

---

## Data sources

| Dataset | Role | License | Status |
|---|---|---|---|
| UCI CKD (400 records) | Primary training/test data | CC BY 4.0 | Committed to `data/raw/uci_ckd.csv` |
| Kaggle CT Kidney Dataset (~12,446 images) | Imaging modality substitute | CC BY-SA 4.0 | Not committed; download separately |
| St. Paul's Hospital MMC CKD study (1,718 records) | Ethiopian validation target | Pending | Request sent; not yet received |

Real patient data is permanently blocked by `.gitignore`. The ingestion code is in place and tested — adding a new dataset is a `DatasetSpec` entry and one command, not a refactor.

---

## Quick start

```bash
git clone https://github.com/Bereket18/ckd-detection.git
cd ckd-detection

# Core setup (data + classical ML + agent)
make setup                          # creates venv, installs requirements.txt
python scripts/train_baseline.py    # trains the model, saves preprocessor + metrics
python -m src.agent.chatbot         # run a consultation

# Heavier dependencies (imaging, federated learning, SHAP)
make setup-advanced

# Test suite (134 tests)
make test
```

Three other entry points:

```bash
python -m src.agent.chatbot --show-fsm          # inspect the DFA
python scripts/predict.py --input patients.csv --output scored.csv
python scripts/make_model_card.py               # regenerate MODEL_CARD.md from metrics
```

### FastAPI backend *(after feat/api-and-frontend-foundation is merged)*

```bash
pip install -r requirements.txt
uvicorn api.main:app --port 8000
# → http://localhost:8000/docs
```

### React frontend *(after merge)*

```bash
cd ckd-frontend
cp .env.development.example .env.development
npm ci
npm run dev
# → http://localhost:5173
```

---

## Project structure

```
config.py                    # single source of truth: paths, feature list, prompts, seeds
src/
  data/
    datasets.py              # dataset registry: maps any CKD CSV onto the canonical features
    load_tabular.py          # UCI CKD dataset loader
    preprocess.py            # encoding, imputation, scaling, splitting (leak-free)
    load_imaging.py          # Kaggle CT dataset fetch + train/val/test split
    pair_modalities.py       # synthetic tabular-imaging pairing (SIMULATION — documented)
  models/
    tabular_model.py         # baseline: candidate comparison, tuning, evaluation, Wilson CIs
    imaging_model.py         # ResNet-18 transfer learning
    text_model.py            # synthetic clinical notes + TF-IDF
    fusion_model.py          # multimodal fusion (tabular MLP + imaging encoder + text encoder)
  federated/
    client.py                # Flower client wrapping the tabular model
    server.py                # FedAvg simulation runner
  explain/
    shap_utils.py            # explainer dispatch, sign-correct sentence generation
  agent/
    chatbot.py               # conversational interface — the CLI user-facing layer
    dialogue_fsm.py          # DFA specification; chatbot.py executes the table
  services/
    clinical_prediction.py   # framework-independent inference service (used by API)
api/                         # FastAPI application (pending merge)
  main.py
  schemas.py                 # Pydantic models for all 24 fields + response types
  routes/
    health.py · model.py · assessment.py
ckd-frontend/                # React web frontend (pending merge)
  src/
    components/              # layout, UI primitives, provenance labels
    routes/                  # page-level components
    lib/                     # API client, query hooks, state, storage
    types/                   # TypeScript types mirroring backend contract
    utils/                   # field metadata, validation schemas
  tests/                     # Vitest suite (475 tests)
scripts/                     # one entry point per training/data task
  train_baseline.py · train_federated.py · train_fusion.py
  predict.py · make_model_card.py · prepare_data.py
notebooks/                   # executed EDA (missingness, class balance, distributions)
tests/                       # pytest suite (134 tests)
data/
  raw/uci_ckd.csv            # UCI CKD dataset (committed, CC BY 4.0)
  README.md                  # data sourcing, licensing, how to add a dataset
```

---

## Model limitations

- **80 test rows.** Every confidence interval is 4–20 points wide. Differences of one or two patients between components are not distinguishable at this sample size.
- **`p_ckd` is not a calibrated probability.** It is the fraction of random-forest trees voting for CKD. 0.80 does not mean 80% of such patients have CKD. The agent and frontend both state this every time they display the score.
- **Fusion underperforms the tabular baseline** because the tabular-imaging pairing is synthetic. This is documented, not hidden.
- **The multi-dataset ingestion path is tested but not yet exercised on real foreign data.** The registered `ethiopian` spec is a placeholder whose column mapping has never been checked against the actual file — because the file has not arrived.
- **Federated learning is a local simulation.** Three clients on one machine. No real network, no real institution separation.

---

## Clinical safety disclaimer

This system is a **research prototype**, not a clinically validated diagnostic tool. It has not been evaluated in a clinical setting, has not been reviewed by medical professionals for this use case, and must not be used to make or influence clinical decisions. Any clinical application would require prospective validation, regulatory approval, and integration with clinical workflows by qualified professionals.

---

## Research integrity

Every number in this repository is from an actual executed run. Results are labelled with their verification status. The train/test leakage bug that inflated earlier results is documented in full in [AUDIT.md](AUDIT.md) alongside every other finding. Negative results (fusion underperformance) are reported and diagnosed, not buried. The federated accuracy comparison was corrected when it was found to be model-for-model inconsistent.

[AUDIT.md](AUDIT.md) is the authoritative record of what was wrong and what was fixed.
[MODEL_CARD.md](MODEL_CARD.md) is the single place to look before quoting any figure.

---

## Documentation index

| Document | Purpose |
|---|---|
| [README.md](README.md) | This file — project overview |
| [AUDIT.md](AUDIT.md) | Engineering audit: 23 findings, all closed, with evidence |
| [MODEL_CARD.md](MODEL_CARD.md) | Model card: intended use, metrics, limitations, calibration caveat |
| [FRONTEND_PLAN.md](FRONTEND_PLAN.md) | Frontend requirements (authoritative) |
| [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) | Frontend design, routes, ADRs |
| [FRONTEND_TEST_PLAN.md](FRONTEND_TEST_PLAN.md) | Frontend test matrix |
| [data/README.md](data/README.md) | Data sourcing, licensing, ingestion walkthrough |
| [REPOSITORY_GOVERNANCE.md](REPOSITORY_GOVERNANCE.md) | Development conventions |
| [GITHUB_REPOSITORY_AUDIT.md](GITHUB_REPOSITORY_AUDIT.md) | Repository professionalization audit |

---

## Development workflow

```
git checkout main && git pull
git checkout -b feat/my-feature
# implement + test
git add <specific files>
git commit -m "feat(scope): description"
git push -u origin feat/my-feature
# open PR → CI passes → merge → delete branch
```

See [REPOSITORY_GOVERNANCE.md](REPOSITORY_GOVERNANCE.md) for the full conventions: branch naming, Conventional Commits, PR checklist, CI architecture, secrets policy, and research integrity rules.

---

## License

MIT — see [License.txt](License.txt).
