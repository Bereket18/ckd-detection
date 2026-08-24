# EthioCKD-Agent

[![tests](https://github.com/Bereket18/ckd-detection/actions/workflows/tests.yml/badge.svg)](https://github.com/Bereket18/ckd-detection/actions/workflows/tests.yml)

**Federated Multimodal Learning for Early Detection of Chronic Kidney
Disease**

A fully offline, Python command-line AI agent that collects patient
data conversationally, predicts Chronic Kidney Disease (CKD) risk,
and explains the prediction in plain language. No web frontend, no
backend server deliberately, so it runs anywhere without a
persistent internet connection.

**Status: all 7 planned sprints complete.** See Results below.

## Results at a glance

All figures are measured on an 80-row held-out test set, so each is reported
with a 95% confidence interval (Wilson). The interval is not decoration: on 80
rows a single extra misclassified patient moves accuracy by 1.25 points, so a
bare point estimate implies a precision the sample size cannot support.

| Component | Result | Verified |
|---|---|---|
| Structured-data baseline (random forest) | **97.50% accuracy** `[91.3, 99.3]`, **100% recall** `[92.9, 100]`, 93.33% specificity `[78.7, 98.2]` — 0 false negatives out of 50 CKD cases, at the cost of 2 false positives | ✅ re-run |
| Imaging classifier (ResNet-18 transfer learning) | 83.9% test accuracy (after fixing a class-imbalance bug that had one class's recall at only 52%) | ⚠️ **not re-verified** |
| Multimodal fusion | 88.75% — a **negative result vs. the baseline, correctly diagnosed**: caused by synthetic tabular-imaging pairing (no real shared patients across the two source datasets), not a training flaw | ⚠️ **not re-verified** |
| Federated learning (3 simulated hospitals, FedAvg) | 98.75% `[93.3, 99.8]`. Like-for-like, the same logistic regression trained centrally on the same split scores 100% `[95.4, 100]` — so **federating cost one test patient out of 80**, which at this sample size is within noise | ✅ re-run |
| Agent interface | Working end-to-end; live testing caught and fixed two real bugs (a feature-scaling bug and a missing input-range validation bug) before they could reach a demo | ✅ re-run |

Every number above is from an actual executed run, not a projected or planned
figure — but the two rows marked ⚠️ were measured under the **pre-fix**
pipeline and have not been re-measured since. The reason is concrete rather than
discretionary: those pipelines need the ~12,446-image Kaggle CT download, which
is not present in this working copy, so `scripts/train_imaging.py` and
`scripts/train_fusion.py` cannot run here at all. The fusion figure in
particular consumes `prepare_tabular`, whose behaviour changed when the leakage
bug was fixed, so it **will** move when re-run. Treat both as provisional. See
[AUDIT.md](AUDIT.md).

> **These figures were re-measured after a train/test leakage bug was fixed.**
> The earlier reported baseline (98.75% / 98%) was inflated because the
> imputer and scaler were fit on all 400 rows before the train/test split.
> Removing the leak also changed which model wins cross-validation
> (logistic regression → random forest). Full detail, and every other fix,
> is documented in [AUDIT.md](AUDIT.md).

## Quick start

```bash
git clone https://github.com/Bereket18/ckd-detection.git
cd ckd-detection
make setup              # creates venv, installs core requirements
make test                 # runs the test suite
python scripts/train_baseline.py    # trains the model + saves the preprocessor
python -m src.agent.chatbot           # talk to it
```

Three other entry points, all offline:

```bash
python -m src.agent.chatbot --show-fsm            # print the dialogue automaton, ask nothing
python scripts/predict.py --input patients.csv --output scored.csv
python scripts/make_model_card.py                 # regenerate MODEL_CARD.md from the metrics
```

Heavier dependencies (torch, flwr, shap — needed for imaging, federated learning, and explanations) are kept separate so basic setup stays fast:

```bash
make setup-advanced
```

## What the model is, and is not

[MODEL_CARD.md](MODEL_CARD.md) is the single place to look before quoting any
figure: intended use, out-of-scope use, the measured performance with intervals,
the confusion matrix, the calibration caveat, the threshold sweep, and the
limitations. It is **generated** by `scripts/make_model_card.py` from
`saved_models/tabular_metrics.json` — no number in it is typed by hand, and
`python scripts/make_model_card.py --check` exits non-zero if it has gone stale.
[AUDIT.md](AUDIT.md) P1-1 is why: a hand-copied accuracy figure in this project
went false in three files at once.

Two things that card says which are easy to miss:

- **`p_ckd` is a confidence score, not a calibrated probability.** For the random
  forest it is the fraction of trees voting for CKD; 0.80 does not mean 80% of
  such patients have CKD. The project **measures** that gap (a Brier score) rather
  than removing it — wrapping the model in `CalibratedClassifierCV` would change
  the saved model and the recall it is gated on, which is a trade-off, not a free
  improvement. The agent prints the caveat next to the number every time.
- **The threshold sweep is reported, not used for selection.** It is measured on
  the held-out test set, so choosing an operating point by reading down its recall
  column would be picking a parameter with test data — the same class of error as
  the leakage in AUDIT.md P0-3. The deployed threshold stays 0.5.

## Feeding it a new dataset

The model is not hard-wired to the UCI file. Any CKD table can be mapped onto
the same 24-feature contract by registering a `DatasetSpec` in
[src/data/datasets.py](src/data/datasets.py) — column renames, value
translations (`1`/`0` → `yes`/`no`), and target labels are all declarative. See
[data/README.md](data/README.md) for the step-by-step.

```bash
python scripts/train_baseline.py --list-datasets        # what is registered, and what is on disk
python scripts/train_baseline.py                       # UCI only (the default)
python scripts/train_baseline.py --dataset uci,ethiopian --out-suffix combined
```

Two behaviours are worth knowing before you rely on the output:

- **Datasets are combined on their shared features, not padded.** If a second
  source provides 19 of the 24 columns, training uses those 19. Requesting
  `--features all` across sources with different schemas is **refused**, because
  imputing a wholly-absent column gives every row from that source the same
  fabricated value — which lets the model identify the dataset instead of the
  patient. `--force` overrides it and says so loudly, in the warning and in the
  saved provenance.
- **A retrain cannot silently make the model worse.** Every run appends to
  `saved_models/metrics_history.jsonl` — including rejected runs — and the saved
  model is not overwritten if recall drops below `config.MIN_ACCEPTABLE_RECALL`
  (0.90, the PRD bar). Every metrics file records which datasets, rows, and
  features produced it.

The agent adapts automatically: it reads its question list off the fitted
preprocessor, so a model trained on 19 features asks 19 questions. Patients who
don't have a lab value can answer `unknown` and it is imputed, with the result
naming which fields were estimated.

## The dialogue as a deterministic finite automaton

The questionnaire in [src/agent/chatbot.py](src/agent/chatbot.py) always *was* a
finite automaton — a `for` over the feature list wrapping a `while True` that
re-asked on invalid input and re-asked on `help`, which is a chain of states with
two self-loops and one forward edge. Written that way the control flow is correct
but **unverifiable**: there is no object to ask "is a transition defined for every
input in every state?", and no way to show the dialogue can always terminate.

[src/agent/dialogue_fsm.py](src/agent/dialogue_fsm.py) writes the machine down as
data, and `collect_patient_data` now **executes that table** rather than
re-implementing it. That direction matters: a formal description sitting beside
code that hand-rolls the same logic is two definitions that drift — the exact
defect [AUDIT.md](AUDIT.md) P1-1 records.

**M = (Q, Σ, δ, q₀, F)**

| | |
|---|---|
| **Q** | `{ASK_0, …, ASK_{n-1}, DONE}` — `n` comes from the *loaded* model's `preprocessor.feature_columns`, so the canonical model gives 25 states and a 10-feature model gives 11, with no code change |
| **Σ** | `{VALID, SKIP, HELP, INVALID}` |
| **q₀** | `ASK_0` (`DONE` for the degenerate zero-field machine, which is already complete) |
| **F** | `{DONE}` |

**δ** (total over Q × Σ — every cell is defined):

| state | VALID | SKIP | HELP | INVALID |
|---|---|---|---|---|
| `ASK_i` (i < n-1) | `ASK_{i+1}` | `ASK_{i+1}` | `ASK_i` | `ASK_i` |
| `ASK_{n-1}` | `DONE` | `DONE` | `ASK_{n-1}` | `ASK_{n-1}` |
| `DONE` | `DONE` | `DONE` | `DONE` | `DONE` |

`SKIP` and `VALID` are indistinguishable to δ on purpose: answering `unknown` is
a *documented* answer (the imputer fills the field and the result names it), not
a failure, so it must advance. `HELP` and `INVALID` are the two self-loops.

### Why the alphabet is four symbols and not raw text

A patient types arbitrary strings, and that set is infinite — a machine over raw
input would not be finite-state in any useful sense. `classify()` maps each raw
answer to exactly one of four symbols *first*, delegating to the existing
`validate_numeric` / `validate_binary` rather than re-deriving what counts as
valid. An unbounded input stream reduced to a finite token alphabet, then a
finite-state recognizer over those tokens, is the standard lexer/parser
separation, and it is what makes the DFA claim true rather than decorative.

### The accepted language

```
((HELP | INVALID)* (VALID | SKIP)){n}
```

Any number of help requests and mistakes per field, then exactly one answer,
repeated for all `n` fields — a regular language, which is the formal statement
that no counter or stack is needed.

### Why a DFA suffices, and a PDA is not required

δ depends only on the current state and the input symbol. There is no auxiliary
storage: the machine never needs to recall *how* it reached `ASK_i`, only that it
is there. The collected answers accumulate in a dict outside the machine — that
is the transducer's output tape, not state, and it influences no transition.

A pushdown automaton becomes necessary when a dialogue **nests** ("for each
medication, ask its dose, then return to where you were"), because the return
point must be stacked and the language of well-nested transcripts is not regular.
This questionnaire is flat: `n` independent questions in a fixed order. A PDA here
would carry a stack that is provably always empty. Choosing the weakest machine
that suffices, and being able to say why, is the point.

### The four properties, checked rather than claimed

| property | meaning | where |
|---|---|---|
| **total** | δ is defined for every `(state, symbol)` in Q × Σ, so no input sequence reaches an undefined configuration | `test_delta_is_total_over_q_cross_sigma` |
| **deterministic** | exactly one target per `(state, symbol)`; δ is a function | `test_delta_is_deterministic` |
| **reachable** | every state is reachable from q₀ (BFS closure) — a state outside it would be dead code in machine form | `test_every_state_is_reachable_from_q0` |
| **terminating** | `DONE` is reachable from every state, so whatever a patient has typed, some continuation finishes the consultation | `test_done_is_reachable_from_every_state` |

`describe()` recomputes all four at call time, so the report cannot claim a
machine is total after an edit that made it partial:

```bash
python -m src.agent.chatbot --show-fsm
```

prints Q, Σ, q₀, F, the field list, the full δ table, the accepted-language
regex, and those properties for the machine a consultation would actually run.
[tests/test_dialogue_fsm.py](tests/test_dialogue_fsm.py) asserts them
independently, including on a reduced-feature machine and on the degenerate
zero-field one.

## Batch scoring and external validation

The agent answers one patient at a time, which made the most important question
unanswerable: *how does this model do on data it was not trained on?*
[scripts/predict.py](scripts/predict.py) closes that.

```bash
python scripts/predict.py --input patients.csv --output scored.csv
python scripts/predict.py --input clinic_export.csv --dataset clinic   # apply a DatasetSpec's mapping
python scripts/predict.py --input patients.csv --explain               # top-3 SHAP drivers per row
```

It appends `prediction`, `p_ckd`, `risk_band`, and **`n_imputed`** to every input
row. That last column is not bookkeeping: a nearly empty row otherwise gets a
confident-looking score with nothing to signal how little of it came from the
patient, and the summary warns outright about rows with over half their features
imputed. An entirely **absent** column is refused rather than imputed, for the
same reason `--features all` is refused across mismatched schemas.

**If the input carries a `class` column it also evaluates**, reusing
`tabular_model.evaluate()` unchanged so the numbers mean what the reported
baseline numbers mean. That is what turns this into an external-validation tool:
train on UCI, test on St. Paul's becomes one command the day that file arrives.
The output states every time that these are held-out metrics *only* if none of
those rows were training rows — a CSV cannot say which, so the script does not
guess.

Nothing here re-implements preprocessing. Encoding goes through
`preprocess.encoded_feature_frame()` and the learned transforms through the saved
preprocessor — the same two calls the agent makes, so a batch score and an
interactive consultation on the same answers produce the same number (asserted in
[tests/test_predict.py](tests/test_predict.py)).

## Project structure

```
config.py                    # single source of truth: paths, feature list, prompts, seeds
src/
  data/
    datasets.py                # dataset registry: maps any CKD CSV onto the canonical features
    load_tabular.py            # loads the UCI CKD dataset
    preprocess.py               # cleaning, encoding, imputation, scaling, splitting
    load_imaging.py              # Kaggle CT dataset fetch + train/val/test organization
    pair_modalities.py            # synthetic tabular-imaging pairing for fusion (documented simulation)
  models/
    tabular_model.py              # baseline: candidate comparison, tuning, evaluation, Wilson intervals
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
tests/                                  # pytest — 134 tests across every module
saved_models/                           # trained models + measured metrics (regenerable, not committed — see .gitignore)
data/README.md                          # data sourcing, licensing, and how to add a dataset
AUDIT.md                                # engineering audit + full record of every fix applied
```

## Data sources

- **Primary (used):** UCI Chronic Kidney Disease dataset (400 records, public, CC BY 4.0).
- **Imaging (used):** Kaggle "CT Kidney Dataset: Normal-Cyst-Tumor and Stone" (~12,446 images), used as a documented substitute since no public Ethiopian imaging dataset exists.
- **Ethiopian data (pending):** a direct request was sent to the authors of a published St. Paul's Hospital Millennium Medical College CKD study (1,718 records); no reply yet. A systematic audit of 14 Ethiopian CKD-related sources found only this one to be genuine patient-level data — the rest are epidemiological summary papers, reviews, or aggregate statistics, not usable for model training. Full audit in the project report. **The ingestion code is in place and tested**, so if the file arrives, adding it is a `DatasetSpec` entry and one command — not a refactor. What cannot be written in advance is the column mapping itself, which depends on their actual headers.

## Design decisions

- **Classical ML over deep learning for the tabular baseline** — the dataset is small (hundreds of rows); tree-based/linear models are more reliable and easier to get right than a neural net here.
- **Guided Q&A agent, not free-form LLM parsing** — accuracy is the priority, and a scripted question flow can't misread an answer the way natural-language extraction could.
- **Federated learning simulated locally (Flower), not deployed across real institutions** — no real multi-hospital access was available; this is stated explicitly rather than implied otherwise.
- **Sprint-based git history** — one commit per meaningful step, a git tag at the end of every completed sprint (`sprint-0` through `sprint-6`).

## Known limitations

- Fusion is honestly below the tabular-only baseline; the report documents why, rather than hiding it.
- **Federating cost one test patient, not nothing.** The earlier claim that it
  cost *no* accuracy compared federated logistic regression against the
  *random forest* baseline — a different model family, so that comparison
  measures the estimator change, not the federation. Trained centrally on the
  same split, the same logistic regression scores 100% against the federated
  98.75%. `scripts/train_federated.py` now computes and prints both numbers.
  At n=80 the two intervals overlap almost entirely, so the defensible claim is
  that federation was **approximately** lossless here — not exactly lossless,
  and certainly not an improvement.
- The federated per-round accuracy curve is flat (98.75% from round 1), so the simulation demonstrates that FedAvg *converges* on this data, not a gradual learning trajectory.
- **All headline figures rest on 80 test rows.** Every interval in the results
  table is 4–20 points wide. Differences of one or two patients between
  components are not distinguishable at this sample size, which is the single
  biggest reason more data matters more than more modelling here.
- The imaging model's class-imbalance fix trades some normal-class recall for much better stone/tumor recall — an intentional, documented trade-off.
- Multimodal fusion pairing is synthetic (label-consistent, not real per-patient correspondence) since the tabular and imaging datasets share no real patients.
- **The multi-dataset ingestion path is tested but not yet exercised on real
  foreign data.** Its tests build a deliberately awkward CSV (renamed columns,
  `Yes`/`No` binaries, a `1`/`0` target, 10 of 24 features) derived from UCI rows
  at test time. That proves the mapping, refusal, and reduced-feature training
  logic work; it cannot prove the Ethiopian schema maps cleanly, because that
  file has not arrived. The registered `ethiopian` spec is a placeholder whose
  `column_map` has never been checked against a real file.
- This is a research/course prototype, not a clinically validated diagnostic tool.

## License

MIT — see [License.txt](License.txt).
