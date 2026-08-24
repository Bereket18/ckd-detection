"""
Generate MODEL_CARD.md from the measured metrics on disk.

Usage:
    python scripts/make_model_card.py
    python scripts/make_model_card.py --model-suffix combined --output CARD_combined.md
    python scripts/make_model_card.py --check      # exit 1 if the card is stale

Why this is GENERATED rather than written by hand. AUDIT.md P1-1 records what
hand-copied metrics do in this project: the baseline accuracy was pasted into
three files, and all three became false the moment the leakage fix changed the
pipeline. A model card is the single document where a stale number is least
defensible -- it is the artifact someone quotes. So every figure below is read
from config.TABULAR_METRICS_PATH, which scripts/train_baseline.py writes at the
end of the run that produced the model, and no number is typed into this file.

The qualitative sections ARE written here, as constants: intended use, the
out-of-scope list, and the limitations are judgements about the model, and they
do not belong in a JSON file. What matters is that they contain no figures.

A metrics file from an older run may lack brier_score or threshold_sweep. Those
sections then say the field is absent and name the command that produces it,
rather than printing a plausible-looking substitute.
"""

import argparse
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
from src.models import tabular_model  # noqa: E402

# --- prose. No numbers in this section, by rule. ----------------------------

INTENDED_USE = """\
An informal, non-diagnostic CKD risk screening aid, run offline as a
command-line questionnaire (`python -m src.agent.chatbot`) or over a CSV
(`python scripts/predict.py`). Its purpose is to suggest that a laboratory
follow-up may be worthwhile, and to say which of the answers given drove that
suggestion.

Intended users are the developers and reviewers of this project, and clinicians
evaluating whether the approach is worth pursuing on real data. It is a course
and research prototype.
"""

OUT_OF_SCOPE_USE = """\
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
"""

CALIBRATION_NOTE = """\
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
"""

THRESHOLD_NOTE = """\
The table below is **reported, not used for selection.** It is measured on the
held-out test set, so choosing an operating point by reading down the recall
column would be selecting a parameter using test data, and every metric in this
card would then be optimistic. That is the same class of error as the leakage
recorded in AUDIT.md P0-3, arrived at from a different direction.

The deployed threshold is therefore 0.5 -- plain `model.predict` -- which is what
every figure in the Performance section describes. Choosing a threshold properly
would require a validation split carved out of the training data, which at this
sample size would cost more than it buys.
"""

LIMITATIONS = """\
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
"""


def format_interval(intervals: dict, name: str) -> str:
    """`95% CI [0.9134, 0.9931]`, or a blank cell when the metric has none."""
    bounds = (intervals or {}).get(name)
    if not bounds:
        return "--"
    return f"[{bounds[0]:.4f}, {bounds[1]:.4f}]"


def performance_table(metrics: dict) -> str:
    """
    The measured rates, each beside its own interval.

    f1 and auc_roc print with `--` in the interval column on purpose: they are
    not proportions of the kind wilson_interval() covers, and borrowing another
    metric's band for them would be a fabricated number in the one document that
    must not contain one.
    """
    intervals = metrics.get("intervals", {})
    rows = [
        "| Metric | Value | 95% CI (Wilson) |",
        "|---|---|---|",
    ]
    for name in ("accuracy", "precision", "recall", "specificity", "f1", "auc_roc"):
        if metrics.get(name) is None:
            continue
        rows.append(f"| {name} | {metrics[name]:.4f} | {format_interval(intervals, name)} |")

    brier = metrics.get("brier_score")
    if brier is None:
        rows.append("| brier | not in this metrics file | -- |")
    else:
        rows.append(f"| brier | {brier:.4f} | -- |")
    return "\n".join(rows)


def confusion_section(metrics: dict) -> str:
    """The confusion matrix spelled out, because TN/FP/FN/TP order is the thing
    readers most often get backwards -- and because for a screening tool the FN
    cell is the one that matters."""
    matrix = metrics.get("confusion_matrix")
    if not matrix:
        return "_No confusion matrix in the metrics file._"
    (tn, fp), (fn, tp) = matrix
    return (
        "| | predicted notckd | predicted ckd |\n"
        "|---|---|---|\n"
        f"| **actual notckd** | {tn} (TN) | {fp} (FP) |\n"
        f"| **actual ckd** | {fn} (FN) | {tp} (TP) |\n"
        f"\n{fn} of the {fn + tp} CKD patients in the test set were missed, and "
        f"{fp} of the {tn + fp} healthy patients were flagged. For a screening "
        f"tool the FN cell is the costly one, which is why "
        f"`scripts/train_baseline.py` tunes for recall and refuses to save a "
        f"model whose recall falls below `config.MIN_ACCEPTABLE_RECALL`."
    )


def threshold_table(metrics: dict) -> str:
    sweep = metrics.get("threshold_sweep")
    if not sweep:
        return (
            "_This metrics file predates the threshold sweep. Re-run "
            "`python scripts/train_baseline.py` to produce it._"
        )
    rows = [
        "| threshold | recall | specificity | precision | accuracy | FN | FP |",
        "|---|---|---|---|---|---|---|",
    ]
    for row in sweep:
        deployed = " **(deployed)**" if row["threshold"] == 0.5 else ""
        rows.append(
            f"| {row['threshold']:.2f}{deployed} | {row['recall']:.4f} | "
            f"{row['specificity']:.4f} | {row['precision']:.4f} | "
            f"{row['accuracy']:.4f} | {row['n_fn']} | {row['n_fp']} |"
        )
    return "\n".join(rows)


def provenance_section(metrics: dict) -> str:
    """
    What the model was trained on, read from the provenance the training run
    recorded. A metrics file that does not say which data produced it is a number
    with no claim attached -- see save_metrics().
    """
    provenance = metrics.get("provenance")
    if not provenance:
        return (
            "_This metrics file carries no provenance record, so what it was "
            "trained on cannot be stated here. Re-run "
            "`python scripts/train_baseline.py`._"
        )

    lines = [
        f"- **Datasets:** {', '.join(provenance.get('datasets', [])) or 'unrecorded'}",
        f"- **Rows:** {provenance.get('n_rows', '?')} total, "
        f"{provenance.get('n_train', '?')} used for training, "
        f"{metrics.get('n_test', '?')} held out for the figures below",
        f"- **Features:** {provenance.get('n_features', '?')} "
        f"(`{'`, `'.join(provenance.get('feature_columns', []))}`)",
        f"- **Feature-set mode:** `{provenance.get('features_mode', '?')}` "
        f"-- `intersect` means only the features every named dataset actually "
        f"provides were used, never padded with imputed absent columns",
    ]
    if provenance.get("forced"):
        lines.append(
            "- **WARNING: this run used `--force`**, so at least one safety check "
            "(the recall gate, or the refusal to impute wholly-absent columns) was "
            "overridden. Any figure below must be read with that in mind."
        )
    coverage = provenance.get("coverage") or {}
    for name, detail in coverage.items():
        absent = detail.get("absent") or []
        line = f"- **{name}:** {detail.get('n_rows', '?')} rows"
        if absent:
            line += f"; canonical features absent from this source: `{'`, `'.join(absent)}`"
        lines.append(line)

    # Citations come from the dataset registry rather than being retyped, for the
    # same reason the metrics do.
    from src.data.datasets import get_spec
    for name in provenance.get("datasets", []):
        try:
            spec = get_spec(name)
        except KeyError:
            continue
        if spec.citation:
            lines.append(f"- **Source ({name}):** {spec.citation}")
        if spec.license:
            lines.append(f"- **License ({name}):** {spec.license}")
    return "\n".join(lines)


def build_card(metrics: dict, metrics_path: Path) -> str:
    """Assemble the card. Every figure comes from `metrics`; every judgement is a
    constant above."""
    return f"""<!-- GENERATED FILE -- DO NOT EDIT BY HAND.
     Produced by scripts/make_model_card.py from {metrics_path.name}.
     Edit the prose constants in that script, or re-run training, and regenerate:
         python scripts/make_model_card.py
     AUDIT.md P1-1 is why: hand-copied metrics in this project went stale in
     three files at once. -->

# Model Card: CKD Tabular Baseline

**Model:** `{metrics.get('model', 'unknown')}` (selected by 5-fold cross-validated
accuracy from logistic regression / random forest / XGBoost, then tuned with
`GridSearchCV` scoring **recall**)

**Generated from:** `{metrics_path.name}`, written by the training run that
produced the model at `{config.artifact_paths()['model'].name}`.

## Intended use

{INTENDED_USE}
## Out-of-scope use

{OUT_OF_SCOPE_USE}
## Training data and provenance

{provenance_section(metrics)}

## Performance

Measured on the held-out test rows counted above. The preprocessor's imputers and
scaler are fit on the training split only, so these are a genuine held-out
estimate -- see AUDIT.md P0-3 for the leakage bug this replaced, and the earlier
inflated figures it produced.

Intervals are Wilson score intervals rather than the textbook normal
approximation, because the measured recall sits at or near 1.0, where the normal
approximation collapses to zero width and would claim certainty the sample size
cannot support.

{performance_table(metrics)}

### Confusion matrix

{confusion_section(metrics)}

## Probability calibration

{CALIBRATION_NOTE}
## Decision threshold

{THRESHOLD_NOTE}
{threshold_table(metrics)}

## Limitations

{LIMITATIONS}
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
"""


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Generate MODEL_CARD.md from the measured metrics on disk.",
    )
    parser.add_argument(
        "--model-suffix", default="",
        help="Which bundle's metrics to read, matching train_baseline.py "
             "--out-suffix. Default is the bundle the agent loads.",
    )
    parser.add_argument(
        "--output", default=None,
        help=f"Where to write the card (default: {config.MODEL_CARD_PATH.name}).",
    )
    parser.add_argument(
        "--check", action="store_true",
        help="Do not write. Exit 1 if the card on disk differs from what the "
             "current metrics would generate -- i.e. if it is stale.",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    metrics_path = config.artifact_paths(args.model_suffix)["metrics"]
    metrics = tabular_model.load_metrics(metrics_path)
    if metrics is None:
        print(
            f"No metrics at {metrics_path}, so there is nothing to generate a card "
            f"from. Run scripts/train_baseline.py"
            + (f" --out-suffix {args.model_suffix}" if args.model_suffix else "")
            + " first."
        )
        return None

    card = build_card(metrics, metrics_path)
    output_path = Path(args.output) if args.output else config.MODEL_CARD_PATH

    if args.check:
        current = output_path.read_text(encoding="utf-8") if output_path.exists() else ""
        if current == card:
            print(f"{output_path.name} is up to date with {metrics_path.name}.")
            return card
        print(
            f"{output_path.name} is STALE relative to {metrics_path.name}. "
            f"Regenerate with:\n  python scripts/make_model_card.py"
            + (f" --model-suffix {args.model_suffix}" if args.model_suffix else "")
        )
        raise SystemExit(1)

    output_path.write_text(card, encoding="utf-8")
    print(f"Wrote {output_path} from {metrics_path.name} "
          f"({metrics.get('model')}, {metrics.get('n_test')} test rows).")
    return card


if __name__ == "__main__":
    main()
