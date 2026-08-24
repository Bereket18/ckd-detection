# Engineering Audit & Change Log

Senior-level engineering review of **EthioCKD-Agent**, plus a complete record
of every change applied as a result.

This document is deliberately separate from [README.md](README.md). The README
describes what the project *is*; this describes what was *wrong with it*, what
was fixed, what remains, and why. Code comments throughout the repository
reference the `P0-x` / `P1-x` / `P2-x` identifiers defined here.

| | |
|---|---|
| **Audit date** | 2026-08-23 |
| **Reviewed at commit** | `ca41bbd` (all 7 sprints reported complete) |
| **Scope** | Full repository: architecture, correctness, security, performance, testing, dependencies, documentation, production-readiness |
| **Method** | Static inspection of every source file, plus executed verification (test suite, `make -n`, PowerShell parse check, retraining, live agent runs) |
| **Test suite** | 31 tests passing before → **134 tests passing after** |

**How to read this**

- [Part I — Audit findings](#part-i--audit-findings) — what was found, with evidence
- [Part II — Change log](#part-ii--change-log) — what was changed, file by file
- [Part III — Verification](#part-iii--verification) — proof the changes work
- [Part IV — Remaining work](#part-iv--remaining-work) — the honest backlog
- [Part V — Dataset assessment](#part-v--dataset-assessment) — is 400 rows enough, and how to add Ethiopian data
- [Part VI — The dataset-ingestion layer](#part-vi--the-dataset-ingestion-layer) — how a new dataset gets fed in, and what it refuses to do
- [Part VII — Findings from the second round](#part-vii--findings-from-the-second-round) — four findings that reviewing the fixes exposed

Severity meanings:

| | |
|---|---|
| **P0** | Broken or wrong. Ships incorrect behaviour to a user, or blocks a fresh contributor entirely. |
| **P1** | Real engineering debt with a concrete failure mode. Not currently producing a wrong answer. |
| **P2** | Polish, clarity, and consistency. |

---

## Part I — Audit findings

### Summary

The project's **substance is genuinely good**. It is honest about negative
results (the fusion model underperforming is documented, not buried), the
sprint structure is real, the modality separation is clean, and the decision to
avoid a web stack is correct for the stated constraints. The tabular pipeline,
the SHAP layer, and the agent were all built with real care.

The problems were concentrated in three places:

1. **Both setup paths were completely broken.** No new contributor could run
   `make` *or* `setup.ps1`. This is invisible to the original author, whose
   environment already exists.
2. **A train/test leakage bug inflated every reported metric.** Silent by
   nature: nothing crashes, the numbers just quietly get better than they
   should be.
3. **The two worst user-facing bugs were in the one module with zero tests.**
   Not a coincidence.

Nothing in this audit contradicts the project's own claims about *effort*. What
it contradicts is some of the claims about *numbers*, and those have now been
re-measured.

### Findings table

| ID | Severity | Area | Finding | Status |
|---|---|---|---|---|
| P0-1 | P0 | Build | `Makefile` did not parse — every target failed | **Fixed** |
| P0-2 | P0 | Build | `setup.ps1` referenced a venv path that is never created | **Fixed** |
| P0-3 | P0 | Correctness | Train/test leakage: imputer + scaler fit on all 400 rows before splitting | **Fixed** |
| P0-4 | P0 | Correctness | SHAP explanations told patients the *opposite* of the truth for mixed-sign cases | **Fixed** |
| P0-5 | P0 | Correctness | `LinearExplainer` hardcoded; incompatible with 2 of the 3 selectable models | **Fixed** |
| P0-6 | P0 | Testing | Two tests sat after `__main__` and were never collected | **Fixed** |
| P1-1 | P1 | Correctness | Baseline accuracy hardcoded in 3 files; became false when the pipeline changed | **Fixed** |
| P1-2 | P1 | Dependencies | All requirements unpinned (`>=`); installed versions have drifted far above the floors | **Fixed** |
| P1-3 | P1 | Process | No CI — nothing runs the test suite on push | **Fixed** |
| P1-4 | P1 | Dependencies | 5 declared dependencies are never imported, 3 of them heavy | **Fixed** |
| P1-5 | P1 | Performance | Agent re-runs the entire data pipeline on every consultation | **Fixed** — but see the [severity correction](#p1-5--the-agent-re-runs-the-whole-data-pipeline-per-consultation): this entry's own "~10 s" claim was wrong |
| P1-6 | P1 | Security | `torch.load` without `weights_only=True` | **Fixed** (static review only — see Part IV) |
| P1-7 | P1 | Docs | README stated metrics, test count and a licence filename that did not match the repo | **Fixed** |
| P1-8 | P1 | Correctness | Agent kept a private duplicate of the binary encoding map, independent of the training pipeline | **Fixed** |
| P2-1 | P2 | Clarity | `FEATURE_PROMPTS` defined twice in `config.py`; the first is dead | **Fixed** |
| P2-2 | P2 | Polish | Em-dash in console output renders as `�` on the Windows console | **Fixed** |
| P2-3 | P2 | UX | Agent cannot accept "I don't know" although the pipeline can impute | **Fixed** |
| P2-4 | P2 | Polish | No `argparse`/`--help` on any script | **Fixed** |
| P2-5 | P2 | Docs | `scripts/prepare_data.py` docstring overstated its role in the pipeline | **Fixed** |

**All 19 first-round findings are now closed.** Two carry qualifications that are
stated rather than buried: P1-6 was verified by static review only (the fusion
pipeline cannot run without the absent Kaggle images), and P1-5's severity as
originally written was wrong by roughly 30×. Both are detailed in their entries.

Four findings were opened *by this second round* and are recorded in
[Part VII](#part-vii--findings-from-the-second-round):

| ID | Severity | Area | Finding | Status |
|---|---|---|---|---|
| P1-9 | P1 | Metric integrity | The federated-vs-centralized comparison was not model-for-model, making "federating cost no accuracy" an artifact | **Fixed** |
| P1-10 | P1 | Metric integrity | A federated run whose clients crashed reported its accuracy as an intact federation, exit code 0 | **Fixed** |
| P2-6 | P2 | Metric integrity | `evaluate()` reported recall without specificity, although tuning optimizes recall | **Fixed** |
| P2-7 | P2 | Audit accuracy | P1-5's "~10 s" impact figure was an unmeasured estimate; the real cost is 0.31 s | **Fixed** (corrected in place) |

Three of the four are the same species as P1-1, which is worth naming: a number
that is *correct arithmetic on the wrong comparison* survives review far longer
than a number that is simply wrong, because nothing about it looks broken.

---

### P0-1 — `Makefile` did not parse

**Evidence.** `make` failed immediately with:

```
Makefile:30: *** missing separator.  Stop.
```

Line 30 was the bare text `//Linux and MacOS` — C++-style comment syntax in a
Makefile, which is not a comment. Below it sat a second, duplicate block of all
five targets, evidently a hand-written POSIX variant of the Windows block above
it.

**Impact.** Every documented entry point was dead. All five targets — `setup`,
`setup-advanced`, `test`, `train`, `run-agent` — failed, because a Makefile that
does not parse has no targets at all. The README's Quick Start begins with
`make setup`, so a new contributor was blocked at step one.

**Root cause.** Someone tried to add cross-platform support by pasting a second
copy of the targets, rather than by extending the `ifeq ($(OS),Windows_NT)`
block that already existed directly above.

---

### P0-2 — `setup.ps1` referenced a venv that is never created

**Evidence.** The script creates the virtual environment at `venv`:

```powershell
python -m venv venv
```

and then, in nine separate places, invokes it as `.env\Scripts\...`. `.env` is
not `venv`; worse, `.env` is the filename this project's `.gitignore` reserves
for secrets. Separately, the script used
`-ForegroundColor BrightWhite`, which is not a member of
`System.ConsoleColor` and throws at runtime.

**Impact.** Every task in the Windows setup path failed — on the project's own
primary development platform.

**Root cause.** The venv path was spelled out literally nine times. One
divergence out of nine is a near-certainty; the design invited the bug.

---

### P0-3 — Train/test leakage inflated every reported metric

**This was the most important finding in the audit.**

**Evidence.** The original `clean_tabular` in `src/data/preprocess.py` fit the
imputers and the `StandardScaler` on the **entire 400-row dataset**, and
`split_train_test` was called on the already-transformed frame afterwards.

Confirmed numerically: the saved scaler's learned mean for `age` was
`51.5625` — exactly the mean of all 400 rows — rather than the train-split mean
of `51.15625`.

**Impact.** Information from the held-out test set reached the model in two
ways:

1. **Imputation** — missing values in the training set were filled using
   medians computed partly from test rows.
2. **Scaling** — the centering and scaling constants encoded the test set's
   distribution.

Every metric the project reported for the tabular baseline was therefore
optimistic, and the README presented those numbers as held-out estimates. This
class of bug is silent: no exception, no warning, just numbers that are better
than they should be.

**Consequences once fixed** (see [Part III](#part-iii--verification)):

- Baseline accuracy moved **98.75% → 97.50%**.
- Recall moved **98% → 100%** (0 false negatives out of 50).
- **The winning model changed** from logistic regression to random forest —
  which in turn made P0-5 fire for real.

---

### P0-4 — SHAP explanations stated the opposite of the truth

**Evidence.** `explanation_to_sentence` derived a *single* direction for the
whole sentence from the predicted label, then applied that one direction to all
three top features — ignoring the sign of each individual SHAP value.

For test-set patient 9, predicted `notckd`, the real SHAP values were:

| Feature | SHAP value | Actual direction |
|---|---|---|
| `sg` (urine specific gravity) | **+2.681** | pushed **toward** CKD |
| `pcv` (packed cell volume) | −2.051 | pushed away from CKD |
| `hemo` (hemoglobin) | −0.857 | pushed away from CKD |

The agent told this patient that **all three** answers lowered their risk. The
single strongest factor in their result was raising it.

**Impact.** This is the worst category of bug available to this project. The
explanation is the entire user-facing justification for a health-risk verdict,
and it was confidently wrong. A sweep of all 80 held-out patients found the
sentence misdescribed at least one feature's direction for **15 of them** —
19% of consultations.

**Root cause.** The predicted label and a feature's contribution direction are
different things. A patient can be classified `notckd` *and* have a factor
pushing toward CKD; that combination is the normal case, not an edge case.

---

### P0-5 — The SHAP explainer only worked for one of three selectable models

**Evidence.** `get_explainer` hardcoded `shap.LinearExplainer`.
`scripts/train_baseline.py` saves **whichever of the three candidates wins
cross-validation** — `logistic_regression`, `random_forest`, or `xgboost`. For
the two tree models, `LinearExplainer` raises
`shap.utils._exceptions.InvalidModelError`.

**Impact at audit time.** Latent. Logistic regression happened to be winning,
so the agent worked.

**Impact now.** **Live.** Fixing P0-3 changed the cross-validation winner to
`random_forest`. Had P0-3 been fixed without P0-5, the agent would crash with
`InvalidModelError` at the final step of *every* consultation — after the
patient answered all 24 questions. Two independent findings turned out to be
coupled, and the coupling was only visible because both were examined.

---

### P0-6 — Two tests were never collected

**Evidence.** `src/agent/chatbot.py` ended with:

```python
if __name__ == "__main__":
    run_agent()

def test_validate_numeric_rejects_out_of_scale_value(): ...
def test_validate_numeric_accepts_in_range_value(): ...
```

Two `test_`-prefixed functions, in `src/` rather than `tests/`, positioned after
the `__main__` block. pytest never collected them.

**Impact.** Worse than having no test. Commit `b8c5ee8` records that the
out-of-range input bug (`su=23` on a 0–5 scale) was a *real bug found by live
testing*. A guard was then written for it and silently never ran — so the
project believed it was protected against a regression it was not protected
against.

---

### P1-1 — Baseline accuracy hardcoded in three files

**Evidence.** The measured baseline appeared as a literal in seven places
across `README.md`, `scripts/train_federated.py` (`0.9875`, twice, including
inside the gap arithmetic), `scripts/train_fusion.py`, and the module docstring
of `src/agent/chatbot.py`.

Meanwhile `scripts/train_baseline.py` **computed and returned** the real
metrics — and discarded them.

**Impact.** All seven became false the moment P0-3 was fixed, including the
arithmetic that computes the federated-vs-centralized gap. Sprints 4 and 5
would each have reported a wrong comparison against a baseline that no longer
existed.

---

### P1-2 — Dependencies are entirely unpinned

**Evidence.** Every line of both requirements files uses `>=` with no upper
bound. The installed environment has drifted far above the stated floors:

| Package | Declared floor | Actually installed | Major versions ahead |
|---|---|---|---|
| pandas | `>=2.0` | 3.0.5 | 1 |
| numpy | `>=1.24` | 2.4.6 | 1 |
| scikit-learn | `>=1.3` | 1.9.0 | — |
| xgboost | `>=2.0` | 3.2.0 | 1 |
| torch | `>=2.1` | 2.13.0+cpu | — |
| pytest | `>=7.4` | 9.1.1 | 2 |
| shap | `>=0.44` | 0.51.0 | — |
| flwr | `>=1.7` | 1.33.0 | — |

**Impact.** "It works on my machine" is currently the only reproducibility
guarantee. `pip install -r requirements.txt` today resolves to a materially
different environment than the one the reported results were produced in, and
a pandas or numpy major release can change behaviour. For a project whose
deliverable is a set of measured numbers, this is a genuine reproducibility
gap — not a theoretical one.

---

### P1-3 — No continuous integration

**Evidence.** No `.github/workflows/` directory; no CI configuration of any
kind.

**Impact.** 62 tests existed at audit time and nothing enforced them (134 now).
P0-1 (a Makefile that does not parse) and P0-6 (tests that are never collected)
are both exactly the class of breakage a 20-line CI workflow catches on the
first push.

---

### P1-4 — Five declared dependencies are never imported

**Evidence.** Verified by searching all `.py` and `.ipynb` files:

| Package | Declared in | Usages found |
|---|---|---|
| `mlflow>=2.9` | requirements-advanced | 0 |
| `anthropic>=0.34` | requirements-advanced | 0 |
| `sentence-transformers>=2.2` | requirements-advanced | 0 |
| `seaborn>=0.13` | requirements | 0 |
| `python-dotenv>=1.0` | requirements | 0 |

**Impact.** `make setup-advanced` installs three heavy unused packages
(`sentence-transformers` alone pulls a second transformer stack). The comments
honestly mark some as "optional" upgrade paths, which is fair — but they are in
the install set, not in a comment, so they cost every contributor install time
and disk.

---

### P1-5 — The agent re-runs the whole data pipeline per consultation

**Evidence.** `load_background_data()` calls `fetch_uci_ckd()` and
`prepare_tabular()` on every run, purely to obtain a SHAP background sample.

**Impact, as originally written.** "~10 seconds of avoidable latency at the exact
moment the patient is waiting for their result."

**Impact, measured.** That figure was wrong, and it was mine. It was an estimate
written from reading the code, not from timing it — exactly the kind of unchecked
number this audit exists to catch. Measured on the working machine:

```text
import chatbot (shap/xgboost/rich/sklearn): 12.23s   <- one-time, before the first question
load preprocessor:                          0.00s
load SHAP background from disk:             0.01s  (320 rows)
the OLD recompute path, for comparison:     0.31s  (320 rows)

predict:               0.024s
load background:       0.009s
explain_prediction:    0.036s
total analyze block:   0.069s
```

So the recompute cost **0.31 s, not ~10 s** — off by roughly 30×. The real
multi-second cost is importing shap/xgboost/sklearn at startup, which happens
before the questionnaire and which this change does not touch. Recorded as
[P2-7](#part-vii--findings-from-the-second-round).

**Why the fix was still made.** Because the latency was never the strongest
argument. The recompute rebuilt the background from **UCI unconditionally**,
regardless of what the loaded model was trained on. Once a model can be trained
on another dataset (Part VI), that produces SHAP attributions computed against
the wrong reference distribution — plausible-looking and wrong, with nothing to
signal it. Saving the background beside the model makes the mismatch impossible,
and two tests now turn a mismatched pair into an error rather than a wrong
answer. The 0.3 s is a rounding error; the correctness guarantee is the point.

The lesson generalizes: a severity claim stated without a measurement is a guess
wearing the costume of a finding, whichever direction it errs in.

---

### P1-6 — `torch.load` without `weights_only=True`

**Evidence.** `src/models/fusion_model.py:71`:

```python
model.load_state_dict(torch.load(weights_path, map_location=device))
```

**Assessment — stated precisely.** `torch.load` without `weights_only=True`
unpickles arbitrary objects and can execute code during deserialization. In
*this* repository the file being loaded is generated locally by the project's
own training script and `saved_models/` is gitignored, so **there is no
exploitable path today.** I am not claiming this is currently vulnerable.

It is listed because it is a latent footgun: the moment anyone shares a
pre-trained `.pt` so a teammate can skip a slow training run — an entirely
natural thing to do on this project, whose own comments recommend training on
Colab and which produces a 44 MB imaging checkpoint — the pattern becomes a
real code-execution risk. `weights_only=True` is a one-word fix that is
sufficient for `load_state_dict`.

---

### P1-7 — README claims that did not match the repository

**Evidence.**

| Claim | Reality |
|---|---|
| "98.75% accuracy, 98% recall" | Leaked estimate; true held-out figure is 97.50% / 100% |
| "logistic regression" baseline | Random forest, after P0-3 |
| Federated "97.50% — quantifies a 1.25-point accuracy cost" | 98.75%; federating cost *no* accuracy |
| "Fusion and federated results are both below the baseline" | Federated is now above it |
| "25+ tests across every module" | 62 — and `shap_utils.py` had **zero** |
| "MIT — see LICENSE" | The file is `License.txt` |
| "trains the model + saves the scaler" | Saves a preprocessor; the standalone scaler no longer exists |

The "25+ tests across every module" phrasing is the one worth calling out:
`src/explain/shap_utils.py` had no tests at all, and it contained P0-4 and
P0-5.

---

### P1-8 — The agent kept a private duplicate of the binary encoding map

**Found during the second review pass, not the first.** Recording that
honestly: the first pass fixed how the agent *scales* values and missed that it
also independently *encodes* them.

**Evidence.** `src/data/preprocess.py` defines the authoritative mapping inside
`encode_binary_column`:

```python
mapping = {"yes": 1, "no": 0, "normal": 1, "abnormal": 0,
           "present": 1, "notpresent": 0, "good": 1, "poor": 0}
```

`src/agent/chatbot.py` carried a byte-identical second copy as a local
`binary_map` inside `answers_to_feature_row`.

**Impact.** Two definitions of "how a binary answer becomes a number", which
have to be kept in sync by hand. This is the *same class of defect* as P0-2's
nine-times-spelled venv path and P1-1's seven-times-spelled accuracy figure —
and it sits in the inference path, which is exactly where this project has
already been bitten once by training/inference drift (the missing-scaler bug in
commit `b8c5ee8`). Adding a fifth label pair to the dataset would have silently
produced `KeyError` in the agent while training carried on fine.

The values agreed at audit time, so this was latent, not active.

**Fix and a subtlety worth recording.** `answers_to_feature_row` now calls
`encode_binary_column`, leaving one definition. But that swapped the failure
mode: the old `binary_map[value]` raised `KeyError` on an unknown value, whereas
`encode_binary_column` returns `NaN` — which the preprocessor's imputer would
then have silently filled with the population mode, **substituting a value the
patient never gave**. Deduplicating naively would have traded a loud bug for a
quiet one, which is the wrong direction for a clinical tool. So an explicit
check was added:

```python
unencoded = [f for f in config.BINARY_COLUMNS if pd.isna(df[f].iloc[0])]
if unencoded:
    raise ValueError(f"Unrecognized value(s) for binary field(s) {unencoded}. ...")
```

`validate_binary()` should make this unreachable from the CLI; the guard exists
for programmatic callers that bypass it. Covered by
`test_answers_to_feature_row_rejects_an_unrecognized_binary_value`.

---

### P2-1 — `FEATURE_PROMPTS` defined twice

`config.py` assigns `FEATURE_PROMPTS` to a generated placeholder dict, then ~10
lines later reassigns it to the real hand-written prompts. The first assignment
is dead code that reads like the live one. Left in place deliberately: it is
cosmetic, and P0 scope was the priority.

### P2-2 — Em-dash mojibake in console output

`scripts/train_baseline.py` printed a literal `—`, which the Windows console
(cp1252) renders as `�`. Visible in the demo path this project is graded on.

### P2-3 — The agent cannot accept "I don't know"

`collect_patient_data()` loops over all 24 features and will not advance until
each receives a valid value. `sg`, `rc`, `pcv`, `wc` and others require lab
work a patient may simply not have.

This is not a bug — but it is an odd gap, because the pipeline **already has a
fitted imputer for exactly this situation**. The capability exists and the
interface does not expose it. Worth noting: the original UCI data is itself
substantially incomplete, so the model was trained on imputed values anyway.

### P2-4 — No `argparse` on any script

Every script in `scripts/` takes zero arguments and has no `--help`. Round
counts, client counts and epochs are module-level constants requiring a source
edit.

### P2-5 — `prepare_data.py` docstring overstated its role

Its docstring implied it was a required pipeline build step. It writes nothing
and is purely an inspection aid — the training scripts call `prepare_tabular`
directly.

---

## Part II — Change log

Every change below was applied after the audit was reviewed and approved.
Constraints honoured throughout: **no new dependencies**, no unnecessary
complexity, no silent removal of functionality, and the project's existing
technology choices preserved.

### Build system

**`Makefile`** — P0-1

- Deleted lines 30–49: the `//Linux and MacOS` pseudo-comment and the duplicate
  target block beneath it.
- Rather than discard the POSIX block's behaviour, folded its one distinct
  contribution — `python3` as the bootstrap interpreter — into the existing
  `ifeq` as a new `SYS_PYTHON` variable:

  ```makefile
  ifeq ($(OS),Windows_NT)
      SYS_PYTHON = python
      PYTHON = venv\Scripts\python.exe
  else
      SYS_PYTHON = python3
      PYTHON = ./venv/bin/python
  endif

  setup:
  	$(SYS_PYTHON) -m venv venv
  ```

  This matters: `python` is not guaranteed to exist on Linux/macOS, so simply
  deleting the duplicate block would have broken POSIX bootstrapping. Deleting
  functionality was not an option, so it was merged instead.

**`setup.ps1`** — P0-2

Rewritten to fix the root cause rather than the nine symptoms. The path is now
defined once:

```powershell
$VenvDir    = "venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$VenvPip    = Join-Path $VenvDir "Scripts\pip.exe"
$VenvPytest = Join-Path $VenvDir "Scripts\pytest.exe"
```

- All nine `.env\Scripts\...` references replaced by these variables, so the
  divergence class is structurally impossible.
- Added a `Test-Venv` guard that gives an actionable message instead of a raw
  PowerShell error when the venv is missing, and called it inside
  `Invoke-Setup` after creation so a failed `python -m venv` is caught at
  source.
- Switched executable invocations to the call operator (`& $VenvPython ...`).
- `-ForegroundColor BrightWhite` → `White` (a real `ConsoleColor`).

### Correctness

**`src/data/preprocess.py`** — P0-3, the central fix

The leaky `clean_tabular` was removed and the module restructured around a
single distinction: **operations that depend only on the current row, versus
operations that must learn from data.**

```python
def encode_tabular(df) -> pd.DataFrame:
    """Row-independent: target cleanup + binary encoding. NaNs are left in."""

class TabularPreprocessor:
    """The learned steps: median/most-frequent imputers + StandardScaler."""
    def fit(self, X): ...
    def transform(self, X): ...   # raises RuntimeError if called before fit

def prepare_tabular(df):
    encoded = encode_tabular(df)
    X_train, X_test, y_train, y_test = split_train_test(encoded)
    pp = TabularPreprocessor().fit(X_train)          # TRAIN ONLY
    return pp.transform(X_train), pp.transform(X_test), y_train, y_test, pp
```

Design notes:

- Row-independent work stays *outside* the class, so it can safely run before
  the split. Only genuinely learned state lives inside it. The leak becomes
  hard to reintroduce because the fit/transform boundary is now explicit.
- Both imputers use `keep_empty_features=True`, guaranteeing a stable column
  count even if a split contains a fully-empty column.
- `transform` before `fit` raises `RuntimeError` rather than failing obscurely
  deeper in sklearn.
- The imputers **and** the scaler are returned together as one object, because
  the previous design saved only the scaler — which is what allowed training
  and inference to drift apart in the first place.
- A stale "Sprint 1 owns this file… stub" docstring was replaced.

**`src/explain/shap_utils.py`** — P0-4, P0-5

Explainer dispatch now matches the model actually loaded:

```python
def get_explainer(model, background_df):
    if hasattr(model, "coef_"):                 return shap.LinearExplainer(model, background_df)
    if hasattr(model, "feature_importances_"):  return shap.TreeExplainer(model)
    return shap.KernelExplainer(model.predict_proba, background_df)
```

Capability-based (`hasattr`) rather than `isinstance`, so it keeps working if a
candidate is swapped for another linear or tree model.

The three explainers return three different shapes, normalized in one place:

```python
def _positive_class_row(shap_output) -> np.ndarray:
    if isinstance(shap_output, list):                     # per-class list
        shap_output = shap_output[-1] if len(shap_output) > 1 else shap_output[0]
    row = np.asarray(shap_output)[0]
    if row.ndim > 1: row = row[:, -1]                     # (features, classes)
    return np.asarray(row, dtype=float).ravel()
```

The sentence builder now derives direction from **each feature's own sign**:

```python
raising  = [f for f, v in impacts if v > 0]
lowering = [f for f, v in impacts if v < 0]
```

Mixed-sign cases produce both clauses joined with `", while "`. When every
impact is zero it says so honestly rather than inventing a driver:
*"No single answer stood out as the main driver of this … result."*

**`src/agent/chatbot.py`** — P0-3, P0-6

- `load_scaler` → `load_preprocessor`, reading `TABULAR_PREPROCESSOR_PATH`.
- `answers_to_feature_row(answers, preprocessor)` now ends with
  `return preprocessor.transform(df)` — one code path defines "model-ready", so
  training and inference cannot drift.
- The two orphaned `test_*` functions were **moved** to `tests/test_chatbot.py`,
  not deleted. They were rescued, and they pass.
- Removed an unused `from rich.table import Table`.
- Module docstring no longer quotes a hardcoded accuracy figure (see P1-1).
- **P1-8:** the private `binary_map` duplicate was removed in favour of
  `encode_binary_column`, with an explicit `ValueError` guard so that
  deduplication did not convert a loud failure into a silent imputation. Full
  reasoning in [P1-8](#p1-8--the-agent-kept-a-private-duplicate-of-the-binary-encoding-map).
  Verified behaviour-preserving: the live agent produced byte-identical output
  before and after.

**`config.py`**

- `TABULAR_SCALER_PATH` → `TABULAR_PREPROCESSOR_PATH`, with a comment
  explaining why the imputers must be saved alongside the scaler.
- Added `TABULAR_METRICS_PATH`.

### Metric integrity — P1-1

Root-caused rather than patched. `train_baseline.py` already computed the true
metrics, so it now writes them:

```python
def save_metrics(model_name, results, path):   # src/models/tabular_model.py
def load_metrics(path):                        # returns None if not yet trained
```

- `scripts/train_baseline.py` writes `saved_models/tabular_metrics.json`.
- `scripts/train_federated.py` and `scripts/train_fusion.py` **read** it, and
  print an actionable message if the baseline hasn't been trained yet instead
  of crashing or quoting a literal.
- The federated gap arithmetic uses the loaded value, so it can no longer
  compute a gap against a baseline that no longer exists.
- The four remaining prose copies (README, chatbot docstring, two script
  docstrings) were removed or corrected.

Uses `json` from the standard library — no new dependency.

### Documentation — P1-7, P2-5

- **`README.md`**: results table corrected to the re-measured figures; the
  federated row rewritten (see the honesty note below); test count 25+ → 62;
  `LICENSE` → `License.txt`; "saves the scaler" → "saves the preprocessor";
  a prominent note explaining that the numbers were re-measured after the
  leakage fix, linking here.
- **Known limitations** updated: the claim "fusion and federated results are
  both below the baseline" was now false and was corrected, and two new honest
  caveats were added (the confounded comparison, and the flat per-round curve).
- **`scripts/prepare_data.py`**: docstring corrected to state it is an
  inspection aid, not a build step.

### Polish — P2-2

Em-dash in `train_baseline.py`'s console output replaced with ASCII, with a
comment recording why (cp1252 on the Windows demo console).

### Tests: 31 → 62

| File | Before | After | Change |
|---|---|---|---|
| `tests/test_preprocess.py` | leak-blind | rewritten | Added the leakage regression guard |
| `tests/test_shap_utils.py` | **did not exist** | new | The module with both worst bugs now has coverage |
| `tests/test_chatbot.py` | degenerate scaler | rewritten | Uses the real fitted preprocessor |
| `tests/test_tabular_model.py` | 3× GridSearchCV | rewritten | Module-scoped fixtures; metrics round-trip |

The guards that matter most:

**Leakage cannot come back silently.** The scaler's learned mean must equal the
*train-split* mean and must differ from the full-dataset mean:

```python
np.testing.assert_allclose(preprocessor.scaler.mean_, expected_train_mean, rtol=1e-9)
assert not np.allclose(expected_train_mean, full_mean)   # or the test proves nothing
```

That second assertion is deliberate. Without it the test would pass trivially
if the two statistics happened to coincide.

**Sign fidelity, on the real failing case.** Patient 9's actual SHAP values are
pinned as a regression test, asserting each feature lands in the correct clause
— plus an end-to-end sweep over all 80 held-out patients asserting **zero**
direction violations (this is the check that originally found 15).

**Every saveable model must be explainable.** Parametrized over all three
entries in `CANDIDATES`, because `train_baseline.py` is free to save any of
them. This is the guard that would have caught P0-5 before it went live.

**Training and inference cannot drift.** A patient whose raw answers equal a
known fully-observed training row must transform to exactly that row
(`rtol=1e-9`). This is the invariant the standalone-scaler design broke once
already.

Also added: `transform`-before-`fit` raises; `encode_tabular` is row-independent
and leaves NaNs; the preprocessor and the metrics file both round-trip through
serialization; `load_metrics` returns `None` when untrained.

Notes on test hygiene:

- `test_encode_tabular_is_row_independent` needs `check_dtype=False`. A lone
  fully-observed row encodes to `int64` while the full frame is `float64`
  (because other rows carry NaN). That is pandas dtype inference, not a
  dependence on other rows; the claim under test is value equality, and the
  comment says so.
- `test_tabular_model.py` previously re-ran `GridSearchCV` in three separate
  tests. Module-scoped fixtures removed that duplication — which is why the
  suite roughly doubled in size while getting *faster*.

---

## Part III — Verification

Everything below was executed, not assumed.

### Build paths

```
$ make -n setup setup-advanced test train run-agent
setup            OK
setup-advanced   OK
test             OK
train            OK
run-agent        OK
```

All five real targets expand correctly, and `.PHONY` lists exactly those five —
no missing or stale declarations. (Note for anyone re-verifying: the targets are
`setup-advanced` and `run-agent`; there is no `agent` or `clean` target, so
`make -n agent` correctly reports "No rule to make target".)

(`powershell` is unusable in this sandbox —
`System.Net.ServicePointManager` throws on init — so `pwsh` (PowerShell 7) was
used instead.) `setup.ps1` parses, and `help` and `test` were run against it.

### Test suite

```
62 passed, 3 warnings in ~28s
```

The 3 remaining warnings are third-party `PendingDeprecationWarning`s from
`shap`'s matplotlib colormap setup — not from this project's code.

A side effect worth recording: the pre-existing
`UserWarning: X has feature names, but StandardScaler was fitted without
feature names` **disappeared**. The preprocessor now fits and transforms
DataFrames consistently, so the warning's cause is gone rather than suppressed.

### Retraining on the leak-free pipeline

```
Comparing candidate models (5-fold cross-validation, accuracy)...
  random_forest        0.9906 (+/- 0.0187)
  logistic_regression  0.9875 (+/- 0.0117)
  xgboost              0.9844 (+/- 0.0171)
Best candidate: random_forest - tuning with GridSearchCV (scoring=recall)...
  best params: {'max_depth': 3, 'n_estimators': 100}

Evaluating on held-out test set...
  accuracy   0.9750
  precision  0.9615
  recall     1.0000
  f1         0.9804
  auc_roc    0.9993
  confusion matrix [[TN, FP], [FN, TP]]: [[28, 2], [0, 50]]
```

**Reading this honestly.** Accuracy fell 1.25 points, because the previous
figure was inflated. Recall rose to **100% — zero false negatives out of 50
CKD cases**, which for a disease *screening* tool is the metric that matters
most: the model missed nobody, at a cost of 2 false positives. The tuning
objective is `scoring="recall"`, so this is the trade-off the project asked
for, and it is now measured honestly.

### Live agent run — the P0-5 path

Confirmed loaded: `RandomForestClassifier`, `TabularPreprocessor`, and
`TreeExplainer` — the branch that did not exist before the fix.

| Profile | Verdict | Explanation produced |
|---|---|---|
| Clinically sick | HIGHER RISK | "Your urine specific gravity, hemoglobin level, and serum creatinine pushed your risk up." |
| Clinically healthy | LOWER RISK | "Your hemoglobin level, packed cell volume, and red blood cell count pushed your risk down." |

Correct verdicts in both directions, with every feature in the correct clause.

### Federated re-run

The Sprint 5 number was produced by the leaky pipeline, so it was re-run:

```
Final federated accuracy: 0.9875
Sprint 2 centralized baseline (random_forest) was: 0.9750
Gap: -0.0125 (federation matched or beat the centralized baseline)
```

**This reverses the project's previous federated finding**, and the reversal
must be reported carefully. The old claim was a "1.25-point accuracy cost of
federating." The new measurement shows no cost at all.

But the comparison is **not model-for-model**: the Flower client wraps
`LogisticRegression`, while the centralized baseline now selects a
recall-tuned `RandomForest`. Reading this as "federation improves accuracy"
would overclaim. Two defensible statements:

1. Federating cost **no** accuracy on this dataset.
2. Federated LR (98.75%) matches centralized LR's cross-validation score
   (98.75%) — the apples-to-apples comparison, and the cleanest evidence that
   FedAvg lost nothing here.

Also recorded honestly: per-round accuracy is **flat at 98.75% from round 1**.
The simulation demonstrates that FedAvg *converges* on this data; it does not
show a learning trajectory.

### Repository hygiene

- `saved_models/*` is gitignored (only `.gitkeep` tracked), so regenerating
  artifacts touched no tracked files.
- The stale `saved_models/tabular_scaler.joblib` was deleted; it was superseded
  and would otherwise sit there looking loadable.
- Verified by search that **zero** code references to the removed
  `clean_tabular`, `TABULAR_SCALER_PATH`, or `load_scaler` survive — the only
  remaining mention is one intentional explanatory comment in `config.py`.
- `git status` was clean before this work began, so the diff is attributable.

### Process notes on the commit itself

Two observations about how this work landed, neither affecting correctness but
both affecting the repository's legibility:

**1. The commit message undersells the change.** The work was committed as
`27dc15b feat(explainability): implement SHAP explainability layer and tests`,
on branch `feat/shap-explainability`. That commit actually contains 16 files
including the `Makefile` repair, the `setup.ps1` rewrite, and — most
significantly — the train/test leakage fix that changed the project's headline
results and its selected model.

Anyone reading `git log --oneline` would have no way to know that this is the
commit where the reported accuracy changed. The body line "Refactor test suite
with fixtures and data leakage prevention" also describes the leak as a *test*
concern, when it was in `src/data/preprocess.py` — production code.

The commit is already pushed, so amending would rewrite shared history and is
not recommended. This document is the durable record instead; a follow-up commit
noting "see AUDIT.md for the metric change in 27dc15b" would make the history
self-explanatory at near-zero cost.

**2. A README merge conflict is pending.** `origin/main` has advanced by one
commit (`c791679 Update README to remove team information`) which this branch
does not contain, while this branch's commit rewrote 24 lines of the same file.
Merging will conflict in `README.md`. Worth resolving deliberately rather than
discovering it mid-merge — particularly because the two changes have different
intents (one removes the team table, the other corrects the results table).

---

## Part IV — Remaining work

The nine items below were the backlog left open at the end of the first round.
All nine are now closed; the table is kept as the record, with what was actually
done in place of the estimate.

| Priority | Item | Estimate | Outcome |
|---|---|---|---|
| 1 | **Pin dependencies** (P1-2) | 30 min | Done. Direct dependencies pinned with `==` in both requirements files. Deliberately **not** a full `pip freeze` lockfile: the installed torch is `2.13.0+cpu`, and a local-version tag like `+cpu` is not resolvable from PyPI on Linux CI — a lockfile CI cannot install is worse than the floors it replaces. |
| 2 | **Add CI** (P1-3) | 1 h | Done. `.github/workflows/tests.yml`, ubuntu-latest + Python 3.11, installs **both** requirements files and runs `pytest -v`. Installing both is deliberate: no test imports torch, so a torch-free CI would be faster, but CI would then validate an install path the README never documents — and that divergence is exactly how P0-1 survived. |
| 3 | **`weights_only=True`** (P1-6) | 2 min | Done, **static review only.** `scripts/train_fusion.py` cannot run here (see the limitation below), so the change is reasoned rather than executed: the call loads a `state_dict`, which is precisely the case `weights_only=True` supports. |
| 4 | **Cache the SHAP background** (P1-5) | 1 h | Done — and the stated impact was **corrected**. The latency claim was wrong by ~30× (0.31 s, not ~10 s); the fix stands on the correctness argument instead. See [P1-5](#p1-5--the-agent-re-runs-the-whole-data-pipeline-per-consultation). |
| 5 | **Drop unused dependencies** (P1-4) | 15 min | Done. `seaborn`, `python-dotenv`, `mlflow`, `anthropic`, `sentence-transformers` removed after grepping every `.py` **and** `notebooks/01_eda.ipynb` for imports. |
| 6 | **Report intervals, not point estimates** | 2 h | Done, and it was worth the priority Part V gave it. `wilson_interval()` in `src/models/tabular_model.py` — ~6 lines of stdlib `math`, **no new dependency**. Wilson rather than Wald specifically because measured recall is exactly 100%, where the Wald half-width collapses to zero and would claim `[100%, 100%]` from 50 cases. Intervals are derived from the confusion matrix, so they cannot drift out of sync with the point estimates they qualify. |
| 7 | Remove dead `FEATURE_PROMPTS` (P2-1) | 2 min | Done. |
| 8 | Allow "I don't know" in the agent (P2-3) | 2 h | Done. The care point was keeping a *deliberate skip* distinguishable from a *malformed answer*: the guard inspects the raw answer, so skips reach the imputer while unparseable input still raises. The result names which fields were estimated — which matters, because a live run confirmed the explanation can cite an imputed field as a top driver. |
| 9 | `argparse` on scripts (P2-4) | 1 h | Done, on the two scripts where flags carry real meaning (`train_baseline.py`, `prepare_data.py`). |

### Known limitations of this audit

These are stated rather than resolved, and they are the honest boundary of what
the two rounds verified.

1. **The imaging and fusion pipelines were never re-run.** `data/raw/` holds only
   `uci_ckd.csv`; the ~12,446-image Kaggle CT dataset is **not on disk**, so
   `build_image_pairing` raises `FileNotFoundError` and neither
   `scripts/train_imaging.py` nor `scripts/train_fusion.py` can execute here at
   all. Their numbers (83.9% imaging, 88.75% fusion) were measured under the
   **pre-fix** pipeline and are marked **not re-verified** in the README results
   table. The imaging model does not consume `prepare_tabular`, so 83.9% should
   be unaffected; the fusion figure does consume it and **will** move when re-run.
2. **`weights_only=True` (P1-6) was reviewed statically, not executed** — same
   root cause as (1).
3. **The dataset-ingestion layer has never seen real foreign data.** Its 21 tests
   run against a deliberately awkward CSV derived from UCI rows at test time. See
   [Part VI](#part-vi--the-dataset-ingestion-layer) for exactly what that does
   and does not establish.
4. **Every headline figure rests on 80 test rows.** The intervals now published
   alongside them are 4–20 points wide. No result in this project distinguishes a
   one-or-two-patient difference, and Part V's argument that distribution matters
   more than modelling follows directly from that.

---

## Part V — Dataset assessment

> *"Do you think the dataset I got is enough? I want to add more Ethiopian-based
> dataset to feed the AI."*

Short answer: **it is enough to have built this project on, and not enough to
support the precision the current numbers imply.** More Ethiopian data is the
right instinct — but for a different reason than row count, and there is a
technical trap worth knowing about before you start collecting.

### Is 400 rows enough?

**What it is genuinely enough for.** A working, honest, well-engineered
prototype with a defensible pipeline. It has already delivered that. Nothing
below undoes that.

**Where it stops being enough** — measured, not asserted. The 95% confidence
intervals on the reported held-out metrics, computed from the actual 80-row
test set:

| Metric | Reported | 95% CI | Interval width |
|---|---|---|---|
| Accuracy | 97.50% | **[91.3%, 99.3%]** | 8.0 points |
| Recall | 100% | **[92.9%, 100%]** | 7.1 points |
| Precision | 96.2% | **[87.0%, 98.9%]** | 11.9 points |

With 80 test rows, **one** additional error moves accuracy by 1.25 points. So
"97.50%" carries roughly ±4 points of genuine uncertainty. The honest statement
is *"about 97%, somewhere in the low-90s to high-90s"*, not "97.50%".

Two further measured findings:

**1. The model-selection result is inside the noise.** Repeated stratified
5-fold CV × 10 repeats, with preprocessing refit inside every fold:

| Model | Accuracy |
|---|---|
| logistic_regression | 0.9940 ± 0.0094 |
| random_forest | 0.9922 ± 0.0093 |

The two are separated by 0.0018 with a standard deviation of ~0.009. **The
"random forest wins" result is not statistically meaningful** — it is a
coin-flip that this particular random seed happened to resolve one way. Worth
stating plainly in the report, because "we compared three models and picked the
best" implies more signal than 400 rows can provide. (Note also the single
80-row held-out estimate, 0.9750, is the *minimum* of the random forest's
repeated-CV range — that split was a pessimistic draw.)

**2. The class balance is not the real world.** The dataset is **250 CKD / 150
non-CKD = 62.5% positive.** Population CKD prevalence is roughly 10%. Precision
depends on prevalence, so holding the measured sensitivity (100%) and
specificity (28/30 = 93.3%) fixed and re-deriving:

| Setting | Positive predictive value |
|---|---|
| On this dataset (62.5% prevalence) | **96.2%** |
| At ~10% population prevalence | **≈62.5%** |

In realistic screening use, **roughly 4 in 10 positive flags would be false
alarms** — not 1 in 25. That is not a bug, it is what happens when a
case-control-style dataset is used to estimate a screening metric. It is the
single most important caveat to state in the report, and it costs nothing to
state.

**Other limits of this dataset, briefly:** it is ~400 rows from Apollo
Hospitals in India (c. 2015); it requires a full 24-field lab panel including
specific gravity, packed cell volume and red cell count; and it is itself
substantially incomplete, so the model is trained largely on imputed values.

### So is more Ethiopian data worth getting? Yes — but chase *distribution*, not *rows*

This is the key framing. Going from 400 → 2,000 rows of *the same Indian
distribution* would tighten the confidence intervals and change little else.
Adding Ethiopian records does something categorically more valuable: it tests
whether the model works on **the population it is named after**.

Right now the project is called EthioCKD-Agent and has been validated entirely
on non-Ethiopian data. Closing that gap is worth more than any amount of
additional accuracy on UCI. Concretely, Ethiopian data would let you report
**external validation** — the single most credible number a clinical ML project
can produce, and one almost no student project has.

Your README already documents the groundwork: 14 Ethiopian sources audited, one
(St. Paul's Hospital Millennium Medical College, 1,718 records) identified as
genuine patient-level data, a request sent, no reply. That audit is the hard
part and it is already done. What follows is what to do next.

### The trap to plan for: feature overlap, not row count

**This is the most important practical warning in this section.** A real
Ethiopian hospital dataset will almost certainly *not* have the same 24 fields
as UCI. Expect creatinine, urea, hemoglobin, blood pressure, age, hypertension
and diabetes status; do **not** expect urine specific gravity, packed cell
volume, red cell count, or the pus-cell/bacteria urinalysis fields.

The consequence is concrete: **a 1,718-row Ethiopian dataset with only 12
overlapping features cannot simply be concatenated with UCI's 24.** You get one
of three options, and it is much cheaper to decide now than after collection:

| Option | What it means | Cost |
|---|---|---|
| **Intersect** | Retrain on only the features both sources have | Lose features; get one clean combined model. **Usually the right choice.** |
| **Two models** | Keep the 24-feature UCI model; train a separate reduced-feature Ethiopian model | Two models to maintain; no combined training |
| **Impute the gap** | Treat missing Ethiopian columns as missing and impute | Cheap, but imputing an entire absent column invents signal. **Not defensible for a reported result.** |

Ask any data holder for their **field list / data dictionary before** you ask
for the data. If the overlap is thin, you know immediately that you are
building a reduced-feature model, and you can design for it.

### Practical next steps

**On acquisition.** An unanswered email to a paper's corresponding author is
the expected outcome, not a failure — authors rarely control data release. The
route that works is institutional:

- Go through the **hospital's research directorate / IRB**, not the author, with
  a formal letter from your university department stating purpose, scope,
  retention and de-identification.
- Ask explicitly for a **de-identified extract of specific fields**, not "the
  dataset". A narrow, concrete request is far easier to approve.
- Approach several institutions in parallel. Ethiopian teaching hospitals with
  nephrology or dialysis services include Tikur Anbessa Specialized Hospital
  (Addis Ababa University), St. Paul's Hospital Millennium Medical College,
  Jimma University Medical Center, University of Gondar Comprehensive
  Specialized Hospital, Ayder Comprehensive Specialized Hospital (Mekelle
  University), and Hawassa University Comprehensive Specialized Hospital. Even
  a few hundred records from one of these would be scientifically valuable.
- Verify current Ethiopian personal-data-protection and health-research
  requirements with your institution's IRB before collection — do not rely on
  this document for the legal specifics.

**Your federated architecture is the answer to the most likely refusal.** If an
institution will not export patient records — the common case, and a reasonable
position — Sprint 5's Flower setup means you may still be able to train
*on-site* and share only model weights. That is the project's own thesis, and
being able to say "we hit a real data-sharing barrier and our architecture was
built for exactly that" is a stronger result than a larger CSV. It converts the
federated component from a simulation exercise into a justified design choice.

**Non-negotiable, and already enforced by your repo.** `.gitignore` excludes
`data/raw/*` with a documented exception for the public UCI CSV. Real Ethiopian
patient data **must** stay out of git — de-identify before it reaches the
machine, never commit it, and keep `data/README.md` as the record of
provenance. Your repository is already set up correctly for this; just don't
add an exception.

**What to add in code when data arrives:**

1. `src/data/load_ethiopian.py`, mirroring `load_tabular.py`'s interface, so
   the rest of the pipeline is unchanged.
2. An explicit feature-intersection step, with the retained column list
   recorded in `config.py` — not decided ad hoc at load time.
3. A **domain-shift evaluation**: train on UCI, test on Ethiopian data, and
   report that number separately. If it drops sharply, that is a genuine
   finding about geographic transferability and one of the more interesting
   results this project could produce.

### What to do right now, with the data you already have

These cost hours, need no new data, and would strengthen the report more than
another 1,000 rows:

1. **Report confidence intervals** alongside every metric. The numbers are in
   the table above; adding them converts an overclaim into a defensible
   result.
2. **Report repeated-CV results** instead of one 80-row split. Already computed
   above: 0.9922 ± 0.0093. A single split on 80 rows is noise-dominated.
3. **State the prevalence caveat** — that ~62.5% PPV figure. It is the
   difference between a class project and a report that shows real
   understanding of clinical metrics.
4. **Say plainly that LR and RF are statistically tied.** Claiming a winner
   here is unsupported by 400 rows, and acknowledging that is a stronger
   position than defending the choice.

### Bottom line

The dataset is sufficient for the prototype you have built, and insufficient
for the precision your current numbers imply. The most valuable additional
data is not *more* data — it is *Ethiopian* data, because it converts an
unvalidated claim in the project's own name into a measured one. Ask for field
lists before datasets, plan for a reduced feature set, and treat your federated
architecture as the fallback for institutions that cannot export records.

And regardless of whether any new data arrives: report intervals rather than
point estimates. That change costs an afternoon and is the single biggest
credibility improvement available to this project.

---

## Part VI — The dataset-ingestion layer

Added in response to "I want the AI to be able to learn and feed new datasets."
This part records what was built, the one thing it deliberately refuses to do,
and what remains unproven for lack of real data.

### The problem it solves

Before this change the project could not load a second dataset at all. Not
"badly" — at all. `fetch_uci_ckd()` was called directly by five scripts, and
`preprocess.py` read its column lists from `config.NUMERIC_COLUMNS` /
`config.BINARY_COLUMNS` module globals, so `load_raw_tabular` raised `KeyError`
on the first UCI column a new file happened not to have.

That is a structural problem for a project whose name is *Ethiopian* CKD
detection. The St. Paul's Hospital dataset described in
[Part V](#part-v--dataset-assessment) has 19 features, not 24. No realistic
hospital extract will have all 24, and the failure mode was not a poor result —
it was an exception.

### The design

New [src/data/datasets.py](src/data/datasets.py). A frozen `DatasetSpec`
dataclass says how one source CSV maps onto the canonical UCI contract:

| Field | Purpose |
|---|---|
| `column_map` | source column → canonical name; empty means already canonical |
| `value_map` | per-column source vocabulary → the words `encode_binary_column()` knows |
| `target_map` | source label → `ckd` / `notckd` |
| `citation`, `license` | provenance travels with the data, not in someone's memory |

Four functions on top: `load_dataset` (→ frame + `Coverage`), `shared_features`
(the intersection), `combine_datasets` (concatenate, restricted, with a `source`
provenance column), and `register`/`unregister` for adding a spec at runtime
without editing the module.

Three decisions inside are worth defending:

1. **`value_map` normalizes into the existing vocabulary rather than generalizing
   the encoder.** A source storing `1`/`0` is mapped to `yes`/`no`, and
   `encode_binary_column` in [src/data/preprocess.py](src/data/preprocess.py) is
   reused untouched. The alternative — teaching the encoder every dialect —
   recreates the two competing definitions of "how a binary answer becomes a
   number" that P1-8 was filed to remove.
2. **Unmapped values raise instead of becoming NaN.** A binary field that
   silently turns NaN is filled by the imputer with the population mode, which
   fabricates a clinical observation. Genuinely blank entries are exempt: those
   are real missingness and the imputer is the correct place for them. The
   distinction is the same one P2-3 drew in the agent between a deliberate skip
   and a malformed answer.
3. **Canonical order comes from `config`, not from the CSVs.** So the feature
   order a model trains on does not depend on the order datasets were named on
   the command line.

### The refusal

Combining datasets with unequal schemas has exactly three options, and only one
of them is a trap:

| Option | Result |
|---|---|
| Intersect | Train on shared features. Loses features, gains one clean model. |
| Two models | Keep them separate. Supported by simply not combining. |
| Impute the gap | Treat an absent column as missing and let the imputer fill it. |

`features="all"` implements the third and then **refuses to run it**. Every row
from the source lacking a column receives an identical fabricated value, so the
model can learn to read that column as a dataset ID rather than as clinical
signal — and part of the accuracy it buys is the accuracy of guessing which
hospital a record came from. Part V called this out in prose; this makes it a
`SchemaMismatchError` naming the shared-feature count to use instead.

`--force` overrides with a `UserWarning` stating that any metric from that run
must disclose the wholesale imputation. "Never" is not a decision a library gets
to make on the operator's behalf — but the default has to be the defensible one.

### The consequence nobody asks for and everybody needs

Threading optional `numeric_columns` / `binary_columns` through `preprocess.py`
means `TabularPreprocessor` now **carries its own column list**, and it is
already serialized next to the model. So the saved artifact became
self-describing, and two things followed for free:

- the agent asks however many questions the loaded model actually uses, because
  `collect_patient_data` in [src/agent/chatbot.py](src/agent/chatbot.py) reads
  `preprocessor.feature_columns` instead of `config.FEATURE_COLUMNS`. A
  reduced-feature model would otherwise have been untouchable through the only
  interface this project has;
- a SHAP background saved from a different feature set is now a detectable
  mismatch rather than a plausible-looking wrong answer — which is the
  correctness half of P1-5.

All five pre-existing scripts and every pre-existing test kept working unchanged,
because the new parameters default to the config globals.

### Making "it learned" checkable rather than asserted

Two additions to [scripts/train_baseline.py](scripts/train_baseline.py), which
remains the *only* script that trains the tabular model:

- **`saved_models/metrics_history.jsonl`** — every run appends, including runs
  that were rejected. An append-only log means a disappointing result cannot
  quietly disappear.
- **A regression gate** — the saved model is not overwritten when recall falls
  below `config.MIN_ACCEPTABLE_RECALL`, unless `--force`. An update path with no
  gate is how a model silently rots.

Adding a second `update_model.py` script was rejected: P0-3 records that the
leakage bug reached four scripts precisely because each re-implemented
preprocessing, so the fix must not create a fifth copy. Flags on the single
`prepare_tabular` caller is the fix that does not recreate the disease.

### What this establishes, and what it does not

**Tested** — 21 tests in [tests/test_datasets.py](tests/test_datasets.py), plus 9
in [tests/test_train_baseline.py](tests/test_train_baseline.py). The fixture
derives a deliberately awkward CSV from real UCI rows in `tmp_path`: 10 of 24
columns, renamed (`sc` → `Serum_Creatinine`), binaries as `Yes`/`No`, target as
`1`/`0`. Covered: canonical renaming, target and value normalization, coverage
reporting of absent features, the intersection, the `features="all"` refusal and
its `--force` warning, a reduced-feature model trained and predicted end to end,
an agent consultation against a 10-feature preprocessor, the history log, and the
recall gate in both directions.

**No fake Ethiopian data is committed or implied.** The fixture is UCI rows with
renamed headers, generated at test time.

**Not established.** Four things, stated plainly:

1. **The `ethiopian` spec's `column_map` is empty and unverified.** It is a
   placeholder, not a mapping. The real CSV's headers have never been seen. It
   must be checked against the actual file before any result is reported from it;
   `load_dataset` raises a clear `FileNotFoundError` until the file exists, so
   nothing can silently train on a wrong mapping — but nothing validates the
   mapping either, because there is nothing to validate it against.
2. **No real second dataset has been ingested.** The mechanism is exercised
   against a synthetic reduced schema derived from UCI. Real hospital data brings
   problems a derived fixture cannot simulate: units, locale decimal separators,
   free-text lab values, duplicated patients.
3. **A combined model's accuracy is unmeasured.** Every number in this repository
   comes from UCI alone.
4. **Unit conversion is not implemented.** `value_map` translates vocabularies,
   not scales. A source recording creatinine in µmol/L rather than mg/dL would
   load without complaint and train a quietly wrong model. This is the most
   likely way the first real ingestion goes wrong, and the spec has no field for
   it.

---

## Part VII — Findings from the second round

Reviewing the fixes surfaced four findings the first pass missed. Three share a
shape worth naming: **correct arithmetic on the wrong comparison**. None of them
looked broken, which is why they survived.

### P1-9 — The federated comparison was not model-for-model

**Severity:** P1 · **Status:** Fixed

`train_federated.py` compared the federated model's test accuracy against the
saved Sprint 2 baseline. The federated client wraps `LogisticRegression`; the
saved baseline is a recall-tuned `RandomForestClassifier`. So the printed gap
mixed the effect of federating with the effect of changing model family, and
could not answer the question the sprint exists to ask.

AUDIT.md itself had described the comparison as apples-to-apples, comparing the
federated *test* accuracy against a centralized LR *cross-validation* score.
Those are computed on different data. That was wrong too.

**Fix.** The script now fits the same `LogisticRegression` centrally on the same
split at runtime and prints that as the like-for-like line — computed, not
quoted, for the same reason P1-1 stopped hardcoding the baseline accuracy. The
saved-baseline gap is still printed, with a note naming the model-family
confound and the patient count.

**What it changed.** The previous claim was that federating cost **no** accuracy.
Measured like-for-like: centralized LR scores 1.0000, federated 0.9875.
Federating cost **one test patient out of 80**. At this sample size that is
inside the interval — the honest word is "approximately lossless," which is a
real and adequate result. The stronger claim was an artifact of the mismatched
comparison.

### P1-10 — A crashed federation reported itself as an intact one

**Severity:** P1 · **Status:** Fixed

Found by running the `--clients` flag added for P2-4. With `--clients 5`, Flower
logged:

```text
aggregate_fit: received 3 results and 2 failures
aggregate_evaluate: received 3 results and 2 failures
```

Two of five clients died — Windows paging-file exhaustion, since every Ray actor
imports its own copy of scipy/sklearn. The script printed a clean
`round 1: 0.9875`, a `Final federated accuracy`, and **exited 0**. A
three-hospital average was reported as a five-hospital result with no indication
that anything had gone wrong.

The cause is `FedAvg`'s `accept_failures=True` default, which is a reasonable
default for real federated learning — a hospital going offline should not abort
the round. What is not reasonable is reporting the outcome without saying so.

**Why `accept_failures=False` is not the fix.** In Flower that makes the round
return no aggregate at all, so the global model silently fails to update. That is
harder to notice, not easier. The defect is in the *reporting*, so that is what
was fixed.

**Fix.** A `Participation` recorder in
[src/federated/server.py](src/federated/server.py) attaches to both
`fit_metrics_aggregation_fn` and `evaluate_metrics_aggregation_fn`. Flower
invokes those with exactly one entry per client that returned a result, so the
count is a measurement, not an inference. `run_simulation` now returns
`(history, participation)`, and the script prints a warning naming each degraded
round and its client count before any figure is quoted.

Two details that took care:

- a round in which *every* client fails never reaches the callback, so it is
  absent from the counts rather than recorded as a zero. Positional round numbers
  then no longer line up, so in that case the count is reported and the numbering
  is dropped rather than guessed;
- the warning must not fire on healthy runs. A warning that cries wolf is one a
  reader learns to skip, so there is a test asserting silence on an intact run.

**Coverage.** 4 → 11 tests in [tests/test_federated.py](tests/test_federated.py).
The reporting path is exercised by stubbing `run_simulation` with the exact
counts Flower logged in the real degraded run, so the guard is verified without
needing a crash to reproduce. This also added the first test of
`weighted_accuracy_average`, which had none and is now wrapped by the recorder.

### P2-6 — Recall was reported without specificity

**Severity:** P2 · **Status:** Fixed

`tune_model` optimizes `scoring="recall"`, and `evaluate()` reported recall,
precision, F1 and AUC — but not specificity. Recall is the metric being
*maximized*, so quoting it alone describes the axis the model was tuned to win.
A model that predicts "ckd" for everyone scores 100% recall. Specificity is the
number that distinguishes that degenerate case from a useful classifier, and it
was the one absent.

**Fix.** `evaluate()` computes specificity from the confusion matrix it already
builds; it is saved to the metrics JSON and printed by `train_baseline.py`.
Measured: **93.33%** — 2 false positives out of 30 true negatives. The model is
genuinely useful, not degenerate. But that had been unstated.

### P2-7 — P1-5's impact figure was an unmeasured estimate

**Severity:** P2 · **Status:** Fixed (corrected in place)

P1-5 claimed the agent's per-consultation pipeline re-run cost "~10 s". That
number was never measured. Measured: **0.31 s** to rebuild the SHAP background,
and 0.069 s for the entire post-questionnaire analysis. The estimate was wrong by
roughly 30×. The ~12 s a user actually waits is `import shap` / `xgboost` /
`sklearn` at startup, which the fix does not affect.

The figure had propagated into five files before it was checked.

**Fix.** Corrected in `config.py`, `chatbot.py`, `train_baseline.py`,
`test_chatbot.py` and the P1-5 entry itself, which now carries the original claim
and the measurement side by side. The fix was kept, on the correctness argument
that was always the stronger half: the agent rebuilt the background from UCI
regardless of what the loaded model was trained on, which for a model trained on
any other dataset produces attributions that look plausible and are wrong.

Recorded as a finding rather than edited away quietly, because a severity claim
stated without a measurement is a guess wearing the costume of a finding —
whichever direction it errs in.

### A verification limitation, not a finding

The default `python scripts/train_federated.py` could not be re-run after the
P1-10 fix. `ray.init()` aborts with *"the amount of memory on this node
available for tasks and actors (0.01 GB) is less than 0% of total"*. Measured
with `GlobalMemoryStatusEx`: 0.08 GB available of 7.75 GB physical, 98% memory
load. PowerShell could not initialize .NET on the same machine at the same time.

This is environmental and pre-existing. The traceback terminates inside the
`ray.init()` block, which this round did not modify, and the `FedAvg` object
carrying the new hooks is constructed *before* that line — so invalid kwargs
would have raised earlier and elsewhere. The hooks were verified directly
instead, and the reporting path was verified by stub. What remains unverified is
one thing only: an end-to-end Ray run of the current code on a machine with free
memory. It should be re-run before the numbers are presented.
