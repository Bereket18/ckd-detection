"""
Batch scoring: run the trained tabular model over a CSV instead of over 24
interactive questions.

Usage:
    python scripts/predict.py --input patients.csv --output scored.csv
    python scripts/predict.py --input clinic_export.csv --dataset clinic
    python scripts/predict.py --dataset ethiopian --output scored.csv --explain
    python scripts/predict.py --input patients.csv --model-suffix combined

Why this exists. Until now the only way to get a prediction was to answer every
question in src/agent/chatbot.py, one patient at a time. That made two things
impossible: scoring a cohort, and -- the more important one -- evaluating the
model on a dataset it was not trained on. src/data/datasets.py can ingest a
foreign CSV, but without this script there was nothing to point a trained model
at, so "train on UCI, test on St. Paul's" could not be run at all.

If the input carries a label column, this script therefore also EVALUATES,
reusing tabular_model.evaluate() unchanged so the numbers are computed by the
same code that produced the reported baseline metrics.

Nothing here re-implements preprocessing. Encoding goes through
preprocess.encoded_feature_frame() and the learned transforms through the saved
preprocessor -- the same two calls the agent makes. AUDIT.md (P0-3) records what
happened when four scripts each had their own copy.
"""

import argparse
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
import joblib  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

import config  # noqa: E402
from src.agent.chatbot import load_background_data  # noqa: E402
from src.data.datasets import (  # noqa: E402
    DatasetSpec, SchemaMismatchError, available_datasets, load_dataset,
)
from src.data.preprocess import encoded_feature_frame  # noqa: E402
from src.explain.shap_utils import explain_prediction  # noqa: E402
from src.models import tabular_model  # noqa: E402

# Columns this script appends. Named as a constant so the tests and the README
# cannot describe a set of columns the code does not actually produce.
OUTPUT_COLUMNS = ("prediction", "p_ckd", "risk_band", "n_imputed")


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Score a CSV of patients with the trained tabular model.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Registered datasets (for --dataset): " + ", ".join(available_datasets()),
    )
    parser.add_argument(
        "--input",
        help="CSV to score. Columns must be the canonical feature names unless "
             "--dataset supplies a mapping. Blank cells are imputed and counted "
             "in the n_imputed output column.",
    )
    parser.add_argument(
        "--dataset",
        help="Apply a registered DatasetSpec's column_map/value_map to the input, "
             "so a foreign CSV can be scored without renaming it by hand. Without "
             "--input, the spec's own file under data/raw/ is scored.",
    )
    parser.add_argument(
        "--output",
        help="Where to write the scored CSV. Omit to print a summary only.",
    )
    parser.add_argument(
        "--model-suffix", default="",
        help="Which saved bundle to use, matching train_baseline.py --out-suffix. "
             "Default is the bundle the agent loads.",
    )
    parser.add_argument(
        "--explain", action="store_true",
        help="Add a top_drivers column with the 3 largest SHAP attributions per "
             "row. Opt-in because it costs one explainer call per row.",
    )
    parser.add_argument(
        "--top-n", type=int, default=3,
        help="How many drivers --explain reports per row (default: 3).",
    )
    return parser.parse_args(argv)


def load_bundle(suffix: str):
    """
    Load the (model, preprocessor, paths) triple for one bundle, or None if it is
    incomplete.

    Both files are required and are checked together: a model without its
    matching preprocessor cannot transform input, and using a mismatched one
    would produce numbers that look fine and mean nothing.
    """
    paths = config.artifact_paths(suffix)
    for key in ("model", "preprocessor"):
        if not paths[key].exists():
            print(
                f"No {key} found at {paths[key]}.\n"
                f"Run scripts/train_baseline.py"
                + (f" --out-suffix {suffix}" if suffix else "")
                + " first."
            )
            return None
    return joblib.load(paths["model"]), joblib.load(paths["preprocessor"]), paths


def read_input(input_path, dataset_name):
    """
    Read the CSV into the canonical schema, returning (df, coverage).

    Routed through datasets.load_dataset() even when no --dataset is given: an
    ad-hoc DatasetSpec with no maps means "this file is already canonical", and
    reusing that path gets the id-column drop, the target cleaning and the messy
    numeric coercion for free rather than as a fourth copy.

    require_target=False because scoring data legitimately has no labels. When
    labels ARE present they are still validated strictly -- see load_dataset.
    """
    if dataset_name:
        spec = dataset_name
    elif input_path:
        # name="input" only affects the coverage line that gets printed; a bare
        # spec with no maps applies no renaming at all.
        spec = DatasetSpec(name="input", filename=str(input_path))
    else:
        raise ValueError("either --input or --dataset is required")

    return load_dataset(spec, path=input_path, require_target=False)


def score(df: pd.DataFrame, model, preprocessor, explain=False, top_n=3,
          background=None) -> pd.DataFrame:
    """
    Append the prediction columns to `df` and return a new frame.

    The verdict is model.predict(), i.e. the 0.5 boundary, so it means exactly
    what the reported accuracy and recall describe. p_ckd is the model's raw
    confidence for the CKD class -- an uncalibrated score, not a calibrated
    probability (see MODEL_CARD.md for the measured Brier score) -- and
    risk_band qualifies it via config.RISK_BAND_BOUNDS, the same function the
    agent calls.

    n_imputed is the count of this row's feature cells that had no usable value
    and were filled by the imputer. It is not optional bookkeeping: a nearly
    empty row otherwise gets a confident-looking score with nothing to signal
    how little of it came from the patient. It is the batch analogue of the
    agent's "you skipped N field(s)" note.
    """
    encoded = encoded_feature_frame(df, preprocessor)
    features = preprocessor.transform(encoded)

    probabilities = model.predict_proba(features)[:, 1]
    out = df.copy()
    out["prediction"] = np.where(model.predict(features) == 1, "ckd", "notckd")
    out["p_ckd"] = probabilities.round(4)
    out["risk_band"] = [tabular_model.risk_band(p) for p in probabilities]
    # .to_numpy() so the count aligns positionally: encoded carries df's index,
    # but assigning a Series would realign on it, which silently produces NaN if
    # the input had duplicate index labels.
    out["n_imputed"] = encoded.isna().sum(axis=1).to_numpy()

    if explain:
        feature_names = list(preprocessor.feature_columns)
        drivers = []
        for row in features.to_numpy():
            impacts = explain_prediction(
                model, row, feature_names, background.to_numpy(), top_n=top_n
            )
            # Signed values kept: the sign is the direction (positive pushes
            # toward ckd), and dropping it would misstate the explanation the
            # same way AUDIT.md P0-4 records.
            drivers.append("; ".join(f"{name}({value:+.3f})" for name, value in impacts))
        out["top_drivers"] = drivers

    return out


def print_summary(scored: pd.DataFrame, n_features: int) -> None:
    """What was scored and how confident it was, in the shape a reader can check."""
    counts = scored["prediction"].value_counts()
    print(f"\nScored {len(scored)} rows on {n_features} features.")
    print(f"  predicted ckd:    {int(counts.get('ckd', 0))}")
    print(f"  predicted notckd: {int(counts.get('notckd', 0))}")

    bands = scored["risk_band"].value_counts()
    print("  bands: " + ", ".join(
        f"{band}={int(bands.get(band, 0))}" for band in ("LOW", "MODERATE", "HIGH")
    ))

    imputed = scored["n_imputed"]
    print(f"  imputed feature cells: {int(imputed.sum())} total, "
          f"max {int(imputed.max())} in one row (of {n_features})")
    # A row that is mostly imputed is being scored on population medians rather
    # than on the patient, so it is called out rather than left in the average.
    heavy = scored.index[imputed > n_features / 2].tolist()
    if heavy:
        print(f"  WARNING: {len(heavy)} row(s) had over half their features imputed "
              f"(index {heavy[:10]}{'...' if len(heavy) > 10 else ''}). Their scores "
              f"reflect population medians more than the patients.")


def print_evaluation(model, df: pd.DataFrame, preprocessor) -> dict:
    """
    Evaluate on the labels the input file carried.

    This is the external-validation path, and it reuses tabular_model.evaluate()
    unchanged so these numbers are produced by exactly the code that produced the
    reported baseline metrics -- a second evaluation function is how two "recall"
    figures come to mean different things.

    The leakage warning below is not boilerplate: if the input is the same UCI
    file the model trained on, most of these rows were training rows and the
    metrics are meaningless as a generalization estimate. The script cannot tell
    from a CSV whether that is the case, so it says so every time rather than
    guessing.
    """
    features = preprocessor.transform(encoded_feature_frame(df, preprocessor))
    results = tabular_model.evaluate(model, features, df[config.TARGET_COLUMN])

    print(f"\nEvaluation against the {config.TARGET_COLUMN!r} column in the input "
          f"({results['n_test']} rows):")
    for metric in ("accuracy", "precision", "recall", "specificity", "f1", "auc_roc"):
        value = results[metric]
        interval = results.get("intervals", {}).get(metric)
        line = f"  {metric:12s} {value:.4f}"
        if interval:
            line += f"   95% CI [{interval[0]:.4f}, {interval[1]:.4f}]"
        print(line)
    print(f"  {'brier':12s} {results['brier_score']:.4f}   (lower is better)")
    print(f"\n  confusion matrix [[TN, FP], [FN, TP]]: {results['confusion_matrix']}")
    print(
        "\n  NOTE: these are held-out metrics ONLY if none of these rows were used\n"
        "  to train this model. Scoring the training file reports the model's fit,\n"
        "  not its generalization. Check the provenance in\n"
        f"  {config.artifact_paths()['metrics'].name} against this input."
    )
    return results


def main(argv=None):
    args = parse_args(argv)

    if not args.input and not args.dataset:
        print("Nothing to score: pass --input <csv>, or --dataset <name> to score "
              "a registered dataset's own file.")
        return None

    bundle = load_bundle(args.model_suffix)
    if bundle is None:
        return None
    model, preprocessor, paths = bundle

    try:
        df, coverage = read_input(args.input, args.dataset)
    except FileNotFoundError as exc:
        print(f"\n{exc}")
        return None
    except (SchemaMismatchError, ValueError) as exc:
        print(f"\nRefusing to score: {exc}")
        return None

    print(f"  {coverage.summary()}")
    feature_columns = list(preprocessor.feature_columns)
    absent = [c for c in feature_columns if c not in df.columns]
    if absent:
        # Refused, not imputed. Every row would get the same fabricated value for
        # an entirely absent column, which is the same argument datasets.py makes
        # for refusing features="all" on a partial source.
        print(
            f"\nRefusing to score: this model needs {len(feature_columns)} features "
            f"and the input has no column for {absent}. An entirely absent column "
            f"would be filled with one identical value for every row, which is a "
            f"fabricated measurement rather than a prediction from the data.\n"
            f"Either add the column(s), or use a model trained on the features this "
            f"file has (train_baseline.py --dataset ... --features intersect)."
        )
        return None

    background = None
    if args.explain:
        try:
            background = load_background_data(preprocessor, paths["shap_background"])
        except (FileNotFoundError, ValueError) as exc:
            print(f"\nCannot explain: {exc}")
            return None

    scored = score(
        df, model, preprocessor,
        explain=args.explain, top_n=args.top_n, background=background,
    )
    print_summary(scored, len(feature_columns))

    if config.TARGET_COLUMN in df.columns:
        print_evaluation(model, df, preprocessor)
    else:
        print(f"\nNo {config.TARGET_COLUMN!r} column in the input, so nothing to "
              f"evaluate against -- predictions only.")

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        scored.to_csv(output_path, index=False)
        print(f"\nWrote {len(scored)} scored rows to {output_path}")
    else:
        print("\nNo --output given; here are the first rows:\n")
        columns = [c for c in ("prediction", "p_ckd", "risk_band", "n_imputed",
                               "top_drivers") if c in scored.columns]
        print(scored[columns].head(10).to_string())

    return scored


if __name__ == "__main__":
    main()
