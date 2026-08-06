# EthioCKD-Agent

**Federated Multimodal Learning for Early Detection of Chronic Kidney
Disease** — CoSc 3101 (Automata and Computability Theory), Group 1

An AI agent (Python-only, no web frontend/backend) that collects
patient data conversationally and predicts CKD risk using a model
trained on clinical/lab data, with imaging, text, and federated
learning layered on as the project advances.

## Team
| Name | ID |
|---|---|
| Adamaki Adugna | 16/140/23 |
| Alemtsehay Girma | 16/082/23 |
| Bereket Adamseged | 16/083/23 |
| Eyerusalem Elias | 16/097/23 |
| Zenebech Wenbito | 16/098/23 |

## Quick start
```bash
git clone <your-repo-url>
cd ckd-federated-agent
make setup          # creates venv, installs core requirements
make test            # confirms the environment is working
make run-agent        # runs the chatbot (will say "no model yet" until Sprint 2)
```

Heavier dependencies (torch, flwr, shap — needed from Sprint 3 on)
are kept separate so early sprints stay fast to set up:
```bash
make setup-advanced
```

## Project structure
```
config.py                  # single source of truth: paths, feature list, seeds
src/
  data/                    # Sprint 1: loading + cleaning (tabular, imaging)
  models/                  # Sprint 2-4: tabular baseline, imaging CNN,
                            #   text encoder, multimodal fusion
  federated/                # Sprint 5: Flower simulation (client + server)
  explain/                  # Sprint 6: SHAP-based explanations
  agent/                    # Sprint 6: the chatbot interface itself
scripts/train_baseline.py    # Sprint 2 entry point
notebooks/                   # exploratory analysis only
tests/                        # pytest — run before every commit
data/README.md                # data sourcing plan + known limitations
```

## Roadmap
| Sprint | Weeks | Goal |
|---|---|---|
| 0 | 1 | Setup — this commit |
| 1 | 2-3 | Data pipeline (all 3 modalities) |
| 2 | 4-5 | Tabular baseline model (the accuracy benchmark) |
| 3 | 6-7 | Imaging CNN + text encoder |
| 4 | 8-9 | Multimodal fusion |
| 5 | 10-11 | Federated learning (Flower simulation) |
| 6 | 12 | Agent interface + explainability |
| 7 | 13 | Testing, docs, defense prep |

## Known data limitation
The St. Paul's Hospital (Addis Ababa) CKD dataset referenced in our
concept note has no public download — see `data/README.md`. The
baseline model is trained on the public UCI CKD dataset first;
Ethiopian data integration is a parallel, best-effort track.

## Design decisions
- **Classical ML over deep learning for the tabular baseline** — the
  dataset is small (hundreds of rows); tree-based models (Random
  Forest/XGBoost) are more reliable and easier to get right than a
  neural net here.
- **Guided Q&A agent, not free-form LLM parsing** — accuracy is the
  priority, and a scripted question flow can't misread an answer the
  way natural-language extraction could. An LLM-based free-form
  front end is a documented optional upgrade on top of the same
  `predict()` call, not a replacement for it.
