# EthioCKD-Agent

**Federated Multimodal Learning for Early Detection of Chronic Kidney
Disease**

A fully offline, Python command-line AI agent that collects patient
data conversationally, predicts Chronic Kidney Disease (CKD) risk,
and explains the prediction in plain language. No web frontend, no
backend server deliberately, so it runs anywhere without a
persistent internet connection.

**Status: all 7 planned sprints complete.** See Results below.

## Results at a glance

| Component | Result |
|---|---|
| Structured-data baseline (logistic regression) | **98.75% accuracy, 98% recall** on held-out test data |
| Imaging classifier (ResNet-18 transfer learning) | 83.9% test accuracy (after fixing a class-imbalance bug that had one class's recall at only 52%) |
| Multimodal fusion | 88.75% — a **negative result vs. the baseline, correctly diagnosed**: caused by synthetic tabular-imaging pairing (no real shared patients across the two source datasets), not a training flaw |
| Federated learning (3 simulated hospitals, FedAvg) | 97.50% — quantifies a 1.25-point accuracy cost of federating training |
| Agent interface | Working end-to-end; live testing caught and fixed two real bugs (a feature-scaling bug and a missing input-range validation bug) before they could reach a demo |

Every number above is from an actual executed run, not a projected or planned figure.

## Quick start

```bash
git clone https://github.com/Bereket18/ckd-detection.git
cd ckd-detection
make setup              # creates venv, installs core requirements
make test                 # runs the test suite
python scripts/train_baseline.py    # trains the model + saves the scaler
python -m src.agent.chatbot           # talk to it
```

Heavier dependencies (torch, flwr, shap — needed for imaging, federated learning, and explanations) are kept separate so basic setup stays fast:

```bash
make setup-advanced
```

## Project structure

```
config.py                    # single source of truth: paths, feature list, prompts, seeds
src/
  data/
    load_tabular.py            # loads the UCI CKD dataset
    preprocess.py               # cleaning, encoding, imputation, scaling, splitting
    load_imaging.py              # Kaggle CT dataset fetch + train/val/test organization
    pair_modalities.py            # synthetic tabular-imaging pairing for fusion (documented simulation)
  models/
    tabular_model.py              # baseline: candidate comparison, tuning, evaluation
    imaging_model.py               # ResNet-18 transfer learning (CNN)
    text_model.py                   # synthetic clinical notes + TF-IDF encoding
    fusion_model.py                  # multimodal fusion architecture
  federated/
    client.py                        # Flower client wrapping the tabular model
    server.py                         # FedAvg simulation runner
  explain/
    shap_utils.py                     # SHAP-based prediction explanations
  agent/
    chatbot.py                         # the conversational interface — the only user-facing layer
scripts/                                # one entry point per training/data task
notebooks/                              # executed exploratory data analysis
tests/                                  # pytest — 25+ tests across every module
saved_models/                           # trained models (regenerable, not committed — see .gitignore)
data/README.md                          # data sourcing, licensing, and known limitations
```

## Data sources

- **Primary (used):** UCI Chronic Kidney Disease dataset (400 records, public, CC BY 4.0).
- **Imaging (used):** Kaggle "CT Kidney Dataset: Normal-Cyst-Tumor and Stone" (~12,446 images), used as a documented substitute since no public Ethiopian imaging dataset exists.
- **Ethiopian data (pending):** a direct request was sent to the authors of a published St. Paul's Hospital Millennium Medical College CKD study (1,718 records); no reply yet. A systematic audit of 14 Ethiopian CKD-related sources found only this one to be genuine patient-level data — the rest are epidemiological summary papers, reviews, or aggregate statistics, not usable for model training. Full audit in the project report.

## Design decisions

- **Classical ML over deep learning for the tabular baseline** — the dataset is small (hundreds of rows); tree-based/linear models are more reliable and easier to get right than a neural net here.
- **Guided Q&A agent, not free-form LLM parsing** — accuracy is the priority, and a scripted question flow can't misread an answer the way natural-language extraction could.
- **Federated learning simulated locally (Flower), not deployed across real institutions** — no real multi-hospital access was available; this is stated explicitly rather than implied otherwise.
- **Sprint-based git history** — one commit per meaningful step, a git tag at the end of every completed sprint (`sprint-0` through `sprint-6`).

## Known limitations

- Fusion and federated results are both honestly below the tabular-only baseline; the report documents why, rather than hiding it.
- The imaging model's class-imbalance fix trades some normal-class recall for much better stone/tumor recall — an intentional, documented trade-off.
- Multimodal fusion pairing is synthetic (label-consistent, not real per-patient correspondence) since the tabular and imaging datasets share no real patients.
- This is a research/course prototype, not a clinically validated diagnostic tool.

## License

MIT — see LICENSE.
