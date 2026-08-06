"""
Sprint 1 entry point: loads the raw UCI CKD dataset, cleans it, splits
it, and saves the processed data to data/processed/ so Sprint 2 doesn't
need to re-run this pipeline every time a model is trained.

Usage:
    python scripts/prepare_data.py
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
from src.data.load_tabular import fetch_uci_ckd  # noqa: E402
from src.data.preprocess import clean_tabular, split_train_test  # noqa: E402


def main():
    print(f"Loading raw data from {config.DATA_RAW_DIR / 'uci_ckd.csv'} ...")
    raw = fetch_uci_ckd()
    print(f"  {raw.shape[0]} rows, {raw.shape[1]} columns")

    print("Cleaning (encoding binaries, imputing missing values, scaling)...")
    cleaned, scaler = clean_tabular(raw)
    missing_after = cleaned[config.FEATURE_COLUMNS].isna().sum().sum()
    print(f"  missing values remaining after cleaning: {missing_after}")

    print("Splitting into train/test (stratified)...")
    X_train, X_test, y_train, y_test = split_train_test(cleaned)
    print(f"  train: {len(X_train)} rows, test: {len(X_test)} rows")

    config.DATA_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    X_train.assign(**{config.TARGET_COLUMN: y_train}).to_csv(
        config.DATA_PROCESSED_DIR / "train.csv", index=False
    )
    X_test.assign(**{config.TARGET_COLUMN: y_test}).to_csv(
        config.DATA_PROCESSED_DIR / "test.csv", index=False
    )
    print(f"Saved train.csv and test.csv to {config.DATA_PROCESSED_DIR}")

    class_balance = cleaned[config.TARGET_COLUMN].value_counts()
    print(f"\nClass balance (full cleaned dataset): {dict(class_balance)}")


if __name__ == "__main__":
    main()
