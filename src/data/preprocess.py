"""
Data cleaning utilities for the tabular (clinical/lab) modality.

Sprint 1 owns this file. `encode_binary_column` below is implemented
now (Sprint 0) as a working example + proof the environment/test setup
is correct — everything else is a stub for Sprint 1 to fill in.
"""

from __future__ import annotations
import pandas as pd


def encode_binary_column(series: pd.Series) -> pd.Series:
    """
    Map the UCI CKD dataset's binary text categories to 0/1.

    Handles the three label pairs that appear in this dataset:
    yes/no, normal/abnormal, present/notpresent. Strips whitespace
    first, since the raw CSV has some stray leading spaces (e.g. " yes").
    Unrecognized or missing values are returned as NaN so they can be
    handled explicitly by the missing-value strategy in Sprint 1,
    rather than silently becoming 0.
    """
    mapping = {
        "yes": 1, "no": 0,
        "normal": 1, "abnormal": 0,
        "present": 1, "notpresent": 0,
    }
    cleaned = series.astype(str).str.strip().str.lower()
    return cleaned.map(mapping)


def load_raw_tabular(path) -> pd.DataFrame:
    """
    TODO (Sprint 1): load the raw UCI CKD CSV from data/raw/, replace
    the "?" missing-value marker with proper NaN, and return the
    resulting DataFrame. Use config.NUMERIC_COLUMNS / BINARY_COLUMNS /
    TARGET_COLUMN as the source of truth for expected columns.
    """
    raise NotImplementedError("Sprint 1: implement raw data loading")


def clean_tabular(df: pd.DataFrame) -> pd.DataFrame:
    """
    TODO (Sprint 1): apply encode_binary_column() to all BINARY_COLUMNS,
    impute or drop missing numeric values, and scale numeric features.
    Return a fully model-ready DataFrame.
    """
    raise NotImplementedError("Sprint 1: implement cleaning pipeline")


def split_train_test(df: pd.DataFrame):
    """
    TODO (Sprint 1): stratified train/test split using
    config.TEST_SIZE and config.RANDOM_SEED, stratified on
    config.TARGET_COLUMN so both classes are represented fairly
    in each split.
    """
    raise NotImplementedError("Sprint 1: implement train/test split")
