"""
Sprint 1 entry point: loads the raw UCI CKD dataset, encodes it, splits it
(stratified), fits imputation/scaling on the TRAIN SPLIT ONLY, and writes
the two resulting splits to data/processed/ for inspection.

Note: this script is an inspection/reporting aid, not a required build
step — the training scripts each call prepare_tabular() themselves rather
than reading these CSVs. See AUDIT.md (P2-5).

Usage:
    python scripts/prepare_data.py
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
import pandas as pd  # noqa: E402
from src.data.load_tabular import fetch_uci_ckd  # noqa: E402
from src.data.preprocess import prepare_tabular  # noqa: E402


def main():
    print(f"Loading raw data from {config.DATA_RAW_DIR / 'uci_ckd.csv'} ...")
    raw = fetch_uci_ckd()
    print(f"  {raw.shape[0]} rows, {raw.shape[1]} columns")

    print("Encoding, splitting (stratified), then imputing + scaling on the train split only...")
    X_train, X_test, y_train, y_test, _ = prepare_tabular(raw)
    missing_after = X_train.isna().sum().sum() + X_test.isna().sum().sum()
    print(f"  missing values remaining after preprocessing: {missing_after}")
    print(f"  train: {len(X_train)} rows, test: {len(X_test)} rows")

    config.DATA_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    X_train.assign(**{config.TARGET_COLUMN: y_train}).to_csv(
        config.DATA_PROCESSED_DIR / "train.csv", index=False
    )
    X_test.assign(**{config.TARGET_COLUMN: y_test}).to_csv(
        config.DATA_PROCESSED_DIR / "test.csv", index=False
    )
    print(f"Saved train.csv and test.csv to {config.DATA_PROCESSED_DIR}")

    class_balance = pd.concat([y_train, y_test]).value_counts()
    print(f"\nClass balance (full cleaned dataset): {dict(class_balance)}")
    print("\nNote: train.csv/test.csv are written scaled, using a preprocessor fit on\n"
          "the train split only. Do NOT re-fit a scaler on them.")


if __name__ == "__main__":
    main()
