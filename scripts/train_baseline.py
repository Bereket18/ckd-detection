"""
Sprint 2 entry point: trains the tabular baseline model and saves it
to config.TABULAR_MODEL_PATH, where src/agent/chatbot.py already
expects to find it.

Usage:
    python scripts/train_baseline.py                     # UCI only (the default)
    python scripts/train_baseline.py --list-datasets
    python scripts/train_baseline.py --dataset uci,ethiopian --out-suffix combined
    python scripts/train_baseline.py --dataset uci,ethiopian --features all --force

This is the ONLY script that trains the tabular model, and adding datasets is a
flag on it rather than a second script. That is a deliberate response to
AUDIT.md (P0-3): the train/test leakage bug spread to four scripts precisely
because each one re-implemented preprocessing, so the fix must not create a
fifth copy. Everything below goes through the one prepare_tabular() call.

Two things make "the model learned from new data" checkable rather than
asserted:
  - every run appends to saved_models/metrics_history.jsonl, including runs
    that were rejected -- an append-only log means a disappointing result
    cannot quietly disappear;
  - the saved model is not overwritten if recall falls below
    config.MIN_ACCEPTABLE_RECALL, unless --force.
"""

import argparse
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
import joblib  # noqa: E402
import config  # noqa: E402
from src.data.datasets import (  # noqa: E402
    SchemaMismatchError, available_datasets, combine_datasets,
)
from src.data.preprocess import prepare_tabular  # noqa: E402
from src.models import tabular_model  # noqa: E402


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Train the tabular CKD baseline.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Registered datasets: " + ", ".join(available_datasets()),
    )
    parser.add_argument(
        "--dataset", default="uci",
        help="Comma-separated dataset names to train on (default: uci). "
             "Multiple datasets are concatenated -- see --features.",
    )
    parser.add_argument(
        "--features", default="intersect", choices=["intersect", "all"],
        help="intersect (default): train on the features every named dataset "
             "actually provides. all: use the full 24-feature canonical set, "
             "which is refused if any dataset is missing columns (see --force).",
    )
    parser.add_argument(
        "--out-suffix", default="",
        help="Suffix for the output artifacts, e.g. --out-suffix combined writes "
             "tabular_model_combined.joblib. Without it, the default bundle the "
             "agent loads is overwritten.",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Override both safety checks: train on wholly-imputed absent columns "
             "under --features all, and save a model whose recall is below "
             f"{config.MIN_ACCEPTABLE_RECALL:.0%}. Both are reported loudly.",
    )
    parser.add_argument(
        "--list-datasets", action="store_true",
        help="Print the registered datasets with their coverage and exit.",
    )
    return parser.parse_args(argv)


def list_datasets():
    """Report what is registered AND what is actually on disk -- a spec whose
    CSV has not arrived is registered but unusable, and conflating the two is
    how a stub gets mistaken for a working feature."""
    from src.data.datasets import get_spec, load_dataset

    print("Registered datasets:\n")
    for name in available_datasets():
        spec = get_spec(name)
        try:
            _, coverage = load_dataset(name)
            print(f"  {coverage.summary()}")
        except FileNotFoundError:
            print(f"  [{name}] NOT ON DISK -- expected at {spec.resolve_path()}")
        except SchemaMismatchError as exc:
            print(f"  [{name}] PRESENT BUT UNMAPPED -- {exc}")
        if spec.license:
            print(f"    license: {spec.license}")
    print()


def format_metric(results, name):
    """One metric line with its 95% Wilson interval, e.g.

        recall       1.0000   95% CI [0.9295, 1.0000]

    The interval is the point of this format. On 80 test rows a bare "1.0000"
    reads as certainty the sample size cannot support -- one extra missed case
    moves recall by two points. See tabular_model.wilson_interval().
    """
    value = results[name]
    interval = results.get("intervals", {}).get(name)
    line = f"  {name:12s} {value:.4f}"
    if interval:
        low, high = interval
        line += f"   95% CI [{low:.4f}, {high:.4f}]"
    return line


def main(argv=None):
    args = parse_args(argv)
    if args.list_datasets:
        list_datasets()
        return None

    names = [n.strip() for n in args.dataset.split(",") if n.strip()]
    paths = config.artifact_paths(args.out_suffix)

    print(f"Loading and cleaning data (datasets: {', '.join(names)})...")
    try:
        raw, numeric_columns, binary_columns, coverages = combine_datasets(
            names, features=args.features, force=args.force
        )
    except SchemaMismatchError as exc:
        print(f"\nRefusing to train: {exc}")
        return None
    except FileNotFoundError as exc:
        print(f"\n{exc}")
        return None

    for coverage in coverages:
        print(f"  {coverage.summary()}")
    feature_columns = numeric_columns + binary_columns
    print(f"  training on {len(feature_columns)} features, {len(raw)} rows total")

    # prepare_tabular splits BEFORE fitting the imputers/scaler, so the
    # test set contributes nothing to them. Metrics below are therefore a
    # genuine held-out estimate. See AUDIT.md (P0-3) for what this replaced.
    X_train, X_test, y_train, y_test, preprocessor = prepare_tabular(
        raw, numeric_columns=numeric_columns, binary_columns=binary_columns
    )
    print(f"  train: {len(X_train)} rows, test: {len(X_test)} rows\n")

    print("Comparing candidate models (5-fold cross-validation, accuracy)...")
    comparison = tabular_model.compare_candidates(X_train, y_train)
    for name, (mean, std) in sorted(comparison.items(), key=lambda kv: -kv[1][0]):
        print(f"  {name:20s} {mean:.4f} (+/- {std:.4f})")

    best_name = max(comparison, key=lambda k: comparison[k][0])
    # Plain ASCII in printed output: this runs on the Windows console for
    # demos, where cp1252 renders an em-dash as a replacement character.
    print(f"\nBest candidate: {best_name} - tuning with GridSearchCV (scoring=recall)...")
    best_model, best_params = tabular_model.tune_model(best_name, X_train, y_train)
    print(f"  best params: {best_params}")

    print(f"\nEvaluating on held-out test set ({len(X_test)} rows)...")
    results = tabular_model.evaluate(best_model, X_test, y_test)
    for metric in ["accuracy", "precision", "recall", "specificity", "f1", "auc_roc"]:
        print(format_metric(results, metric))
    print(f"\n  confusion matrix [[TN, FP], [FN, TP]]: {results['confusion_matrix']}")
    print(f"\n{results['classification_report']}")

    provenance = {
        "datasets": names,
        "features_mode": args.features,
        "forced": bool(args.force),
        "n_rows": int(len(raw)),
        "n_train": int(len(X_train)),
        "n_features": len(feature_columns),
        "feature_columns": feature_columns,
        "coverage": {c.dataset: {"n_rows": c.n_rows, "absent": c.absent} for c in coverages},
    }

    # The history line is written whether or not the model is kept, so a
    # rejected run leaves a trace instead of vanishing.
    passed_gate = results["recall"] >= config.MIN_ACCEPTABLE_RECALL
    tabular_model.append_metrics_history(
        {
            "model": best_name,
            "best_params": {k: str(v) for k, v in best_params.items()},
            "out_suffix": args.out_suffix,
            **{k: results[k] for k in
               ("accuracy", "precision", "recall", "specificity", "f1", "auc_roc")},
            "intervals": results["intervals"],
            "n_test": results["n_test"],
            "provenance": provenance,
            "saved": bool(passed_gate or args.force),
        },
        config.METRICS_HISTORY_PATH,
    )

    if not passed_gate and not args.force:
        print(
            f"\nNOT SAVED. Recall {results['recall']:.4f} is below the PRD bar of "
            f"{config.MIN_ACCEPTABLE_RECALL:.2f}, so the existing model at\n"
            f"  {paths['model']}\nwas left untouched -- a screening tool that misses "
            f"more cases than the one it replaces is not an improvement.\n"
            f"The run was still logged to {config.METRICS_HISTORY_PATH}.\n"
            f"Re-run with --force to save anyway, or with --out-suffix to keep it "
            f"separately without touching the model in use."
        )
        return best_name, comparison, results

    if not passed_gate:
        print(
            f"\nWARNING: saving despite recall {results['recall']:.4f} < "
            f"{config.MIN_ACCEPTABLE_RECALL:.2f} because --force was given."
        )

    config.SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    tabular_model.save_model(best_model, paths["model"])
    joblib.dump(preprocessor, paths["preprocessor"])
    # The SHAP background, saved here rather than recomputed per consultation.
    # The reason is correctness, not latency: it guarantees the background
    # matches the data this model was actually trained on. The agent used to
    # rebuild it from UCI unconditionally, which would silently produce wrong
    # attributions for a model trained on anything else. (AUDIT.md P1-5 also
    # claimed ~10s of saved latency; measured, it is 0.31s -- see the correction
    # recorded in that entry.)
    joblib.dump(X_train, paths["shap_background"])
    # Sprints 4/5 compare themselves against this baseline; writing the
    # measured numbers here stops them from quoting a stale literal.
    tabular_model.save_metrics(best_name, results, paths["metrics"], provenance=provenance)
    print(f"Saved preprocessor to {paths['preprocessor']}")
    print(f"Saved final model ({best_name}) to {paths['model']}")
    print(f"Saved SHAP background ({X_train.shape[0]} rows) to {paths['shap_background']}")
    print(f"Saved baseline metrics to {paths['metrics']}")
    print(f"Appended run to {config.METRICS_HISTORY_PATH}")

    return best_name, comparison, results


if __name__ == "__main__":
    main()
