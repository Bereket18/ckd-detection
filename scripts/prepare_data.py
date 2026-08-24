"""
Sprint 1 entry point: loads the raw CKD dataset(s), encodes them, splits
(stratified), fits imputation/scaling on the TRAIN SPLIT ONLY, and writes
the two resulting splits to data/processed/ for inspection.

Note: this script is an inspection/reporting aid, not a required build
step — the training scripts each call prepare_tabular() themselves rather
than reading these CSVs. See AUDIT.md (P2-5).

Usage:
    python scripts/prepare_data.py
    python scripts/prepare_data.py --dataset uci,ethiopian
"""

import argparse
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
import pandas as pd  # noqa: E402
from src.data.datasets import (  # noqa: E402
    SchemaMismatchError, available_datasets, combine_datasets,
)
from src.data.preprocess import prepare_tabular  # noqa: E402


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Inspect the cleaned/split data for one or more datasets.",
        epilog="Registered datasets: " + ", ".join(available_datasets()),
    )
    parser.add_argument(
        "--dataset", default="uci",
        help="Comma-separated dataset names (default: uci). Several are combined "
             "on their shared features, matching train_baseline.py's default.",
    )
    parser.add_argument(
        "--features", default="intersect", choices=["intersect", "all"],
        help="Feature set policy -- see scripts/train_baseline.py --features.",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    names = [n.strip() for n in args.dataset.split(",") if n.strip()]

    print(f"Loading raw data (datasets: {', '.join(names)}) ...")
    try:
        raw, numeric_columns, binary_columns, coverages = combine_datasets(
            names, features=args.features
        )
    except (SchemaMismatchError, FileNotFoundError) as exc:
        print(f"\n{exc}")
        return
    for coverage in coverages:
        print(f"  {coverage.summary()}")
    print(f"  {raw.shape[0]} rows, {len(numeric_columns) + len(binary_columns)} features")

    print("Encoding, splitting (stratified), then imputing + scaling on the train split only...")
    X_train, X_test, y_train, y_test, _ = prepare_tabular(
        raw, numeric_columns=numeric_columns, binary_columns=binary_columns
    )
    missing_after = X_train.isna().sum().sum() + X_test.isna().sum().sum()
    print(f"  missing values remaining after preprocessing: {missing_after}")
    print(f"  train: {len(X_train)} rows, test: {len(X_test)} rows")

    # A suffix when combining, so a multi-dataset inspection run does not
    # overwrite the UCI splits that the EDA notebook and the README refer to.
    suffix = "" if names == ["uci"] else "_" + "_".join(names)
    config.DATA_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    X_train.assign(**{config.TARGET_COLUMN: y_train}).to_csv(
        config.DATA_PROCESSED_DIR / f"train{suffix}.csv", index=False
    )
    X_test.assign(**{config.TARGET_COLUMN: y_test}).to_csv(
        config.DATA_PROCESSED_DIR / f"test{suffix}.csv", index=False
    )
    print(f"Saved train{suffix}.csv and test{suffix}.csv to {config.DATA_PROCESSED_DIR}")

    class_balance = pd.concat([y_train, y_test]).value_counts()
    print(f"\nClass balance (full cleaned dataset): {dict(class_balance)}")
    print("\nNote: train.csv/test.csv are written scaled, using a preprocessor fit on\n"
          "the train split only. Do NOT re-fit a scaler on them.")


if __name__ == "__main__":
    main()
