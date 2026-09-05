<!-- GENERATED FILE -- DO NOT EDIT BY HAND.
     Produced by scripts/make_model_card.py from tabular_metrics.json.
     Edit the prose constants in that script, or re-run training, and regenerate:
         python scripts/make_model_card.py
     AUDIT.md P1-1 is why: hand-copied metrics in this project went stale in
     three files at once. -->

# Model Card: CKD Tabular Baseline

**Model:** `random_forest` (selected by 5-fold cross-validated
accuracy from logistic regression / random forest / XGBoost, then tuned with
`GridSearchCV` scoring **recall**)

**Generated from:** `tabular_metrics.json`, written by the training run that
produced the model at `tabular_model.joblib`.

## Intended use

An informal, non-diagnostic CKD risk screening aid, run offline as a
command-line questionnaire (`python -m src.agent.chatbot`) or over a CSV
(`python scripts/predict.py`). Its purpose is to suggest that a laboratory
follow-up may be worthwhile, and to say which of the answers given drove that
suggestion.

Intended users are the developers and reviewers of this project, and clinicians
evaluating whether the approach is worth pursuing on real data. It is a course
and research prototype.

## Out-of-scope use

- **Not a diagnosis.** The output is a screening signal, not a clinical finding.
  No output of this model should be recorded in a patient record or used to
  start, stop, or withhold treatment.
- **Not validated on Ethiopian patients**, which is the population the project
  is ultimately aimed at. It is trained on the UCI dataset (India, 2015). CKD
  prevalence, comorbidity patterns, and laboratory reference ranges differ
  between populations, and nothing here measures that gap. See `data/README.md`.
- **Not for triage without a lab test.** Several of the features it relies on
  are themselves laboratory results. A patient who can answer every question
  has already had the tests that matter most.
- **Not a calibrated probability source.** See the calibration section below.
- **Not for use on paediatric patients or on populations with acute kidney
  injury**; neither is represented in the training data in any identifiable way.

## Training data and provenance

- **Datasets:** uci
- **Rows:** 400 total, 320 used for training, 80 held out for the figures below
- **Features:** 24 (`age`, `bp`, `sg`, `al`, `su`, `bgr`, `bu`, `sc`, `sod`, `pot`, `hemo`, `pcv`, `wc`, `rc`, `rbc`, `pc`, `pcc`, `ba`, `htn`, `dm`, `cad`, `appet`, `pe`, `ane`)
- **Feature-set mode:** `intersect` -- `intersect` means only the features every named dataset actually provides were used, never padded with imputed absent columns
- **uci:** 400 rows
- **Source (uci):** Rubini, L., Soundarapandian, P., & Eswaran, P. (2015). Chronic Kidney Disease [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5G020
- **License (uci):** CC BY 4.0

## Performance

Measured on the held-out test rows counted above. The preprocessor's imputers and
scaler are fit on the training split only, so these are a genuine held-out
estimate -- see AUDIT.md P0-3 for the leakage bug this replaced, and the earlier
inflated figures it produced.

Intervals are Wilson score intervals rather than the textbook normal
approximation, because the measured recall sits at or near 1.0, where the normal
approximation collapses to zero width and would claim certainty the sample size
cannot support.

| Metric | Value | 95% CI (Wilson) |
|---|---|---|
| accuracy | 0.9750 | [0.9134, 0.9931] |
| precision | 0.9615 | [0.8702, 0.9894] |
| recall | 1.0000 | [0.9286, 1.0000] |
| specificity | 0.9333 | [0.7868, 0.9815] |
| f1 | 0.9804 | -- |
| auc_roc | 0.9993 | -- |
| brier | 0.0214 | -- |

### Confusion matrix

| | predicted notckd | predicted ckd |
|---|---|---|
| **actual notckd** | 28 (TN) | 2 (FP) |
| **actual ckd** | 0 (FN) | 50 (TP) |

0 of the 50 CKD patients in the test set were missed, and 2 of the 30 healthy patients were flagged. For a screening tool the FN cell is the costly one, which is why `scripts/train_baseline.py` tunes for recall and refuses to save a model whose recall falls below `config.MIN_ACCEPTABLE_RECALL`.

## Probability calibration

The reported `p_ckd` is the model's raw `predict_proba` output. For the
tree-ensemble candidates this is the fraction of trees voting for the CKD class.
**It is a confidence score, not a calibrated probability**: a score of 0.80 does
not mean that 80% of patients scoring 0.80 have CKD.

This project measures that gap rather than hiding or removing it. The decision
was deliberate and is recorded here so it can be challenged:

- Wrapping the selected model in `CalibratedClassifierCV` would change the saved
  model, and with it the headline recall, which is gated at
  `config.MIN_ACCEPTABLE_RECALL`. Trading measured recall for better-shaped
  probabilities is a real trade-off, not a free improvement, and it was not made.
- The Brier score below is reported instead. It is the mean squared error of the
  predicted probabilities: lower is better, and 0.2500 is what predicting 0.5 for
  every patient scores.
- A reliability diagram is **not** reported, because the test set is too small
  for one: ten bins over this many rows leaves a handful of patients per bin, and
  the resulting curve would be mostly noise.
- Brier conflates calibration with discrimination, so a low score is not proof of
  calibration on its own. The caveat above stands regardless of the number.

The interfaces reflect this. The agent prints the score with the caveat attached,
and qualifies it as LOW / MODERATE / HIGH via `config.RISK_BAND_BOUNDS`, where
MODERATE means "near the decision boundary, on either side" -- the case where the
verdict would have flipped on a small change in one answer.

## Decision threshold

The table below is **reported, not used for selection.** It is measured on the
held-out test set, so choosing an operating point by reading down the recall
column would be selecting a parameter using test data, and every metric in this
card would then be optimistic. That is the same class of error as the leakage
recorded in AUDIT.md P0-3, arrived at from a different direction.

The deployed threshold is therefore 0.5 -- plain `model.predict` -- which is what
every figure in the Performance section describes. Choosing a threshold properly
would require a validation split carved out of the training data, which at this
sample size would cost more than it buys.

| threshold | recall | specificity | precision | accuracy | FN | FP |
|---|---|---|---|---|---|---|
| 0.10 | 1.0000 | 0.5000 | 0.7692 | 0.8125 | 0 | 15 |
| 0.20 | 1.0000 | 0.8333 | 0.9091 | 0.9375 | 0 | 5 |
| 0.30 | 1.0000 | 0.9000 | 0.9434 | 0.9625 | 0 | 3 |
| 0.40 | 1.0000 | 0.9000 | 0.9434 | 0.9625 | 0 | 3 |
| 0.50 **(deployed)** | 1.0000 | 0.9333 | 0.9615 | 0.9750 | 0 | 2 |
| 0.60 | 1.0000 | 0.9667 | 0.9804 | 0.9875 | 0 | 1 |
| 0.70 | 0.9800 | 1.0000 | 1.0000 | 0.9875 | 1 | 0 |
| 0.80 | 0.9200 | 1.0000 | 1.0000 | 0.9500 | 4 | 0 |
| 0.90 | 0.8600 | 1.0000 | 1.0000 | 0.9125 | 7 | 0 |

## Limitations

- **Every figure in this card rests on the held-out test rows counted above.**
  The confidence intervals are wide, and differences of one or two patients are
  not distinguishable at this sample size. This is the single biggest reason more
  data matters more than more modelling here.
- **Missing values are imputed with population medians.** A patient may skip any
  question; the agent then names the fields it estimated, and
  `scripts/predict.py` reports an `n_imputed` count per row. A prediction made
  mostly from imputed values describes the training population more than the
  patient, and the tooling says so rather than hiding it.
- **The model is trained on one dataset.** The multi-dataset ingestion path
  (`src/data/datasets.py`) is implemented and tested, but tested against a CSV
  derived from UCI rows at test time -- not against real foreign data. The
  registered `ethiopian` spec is a placeholder whose column mapping has never
  been checked against a real file.
- **Feature availability is assumed.** Training rows come from patients who had a
  full lab panel. A screening setting where those values are absent is a
  different problem than the one measured here.
- **SHAP explanations are local approximations.** They describe how this model
  responded to these inputs relative to a training-set baseline. They are not
  causal statements about kidney disease.
- The imaging and multimodal-fusion components of the wider project are **not**
  part of this model and were not re-verified after the leakage fix; see
  `README.md` and `AUDIT.md`.

## How to reproduce

```bash
python scripts/train_baseline.py          # trains, evaluates, writes the metrics file
python scripts/make_model_card.py         # regenerates this card from that file
python -m pytest -q                       # the test suite
python -m src.agent.chatbot --show-fsm    # the dialogue automaton
```

## Ethical considerations

The failure mode that matters here is a false negative presented with
confidence: a patient told "LOWER RISK" who has CKD, and who therefore does not
seek a test. The design responses are the recall-weighted tuning above, the
explicit non-diagnostic disclaimer on every result, the uncalibrated-score
caveat, the MODERATE band that says outright when a result is too close to the
boundary to rely on, and the reporting of imputed fields so a result built from
population medians is not mistaken for one built from the patient.

None of that makes the model safe to deploy. It makes its limits legible.
