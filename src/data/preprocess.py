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

    Handles the four label pairs that appear in this dataset: yes/no,
    normal/abnormal, present/notpresent, and good/poor (used only by
    the appet column — found by inspecting real unique values in
    Sprint 1; missing this pair silently turned the entire appet
    column to NaN). Strips whitespace first, since the raw CSV has
    stray leading spaces and tabs (e.g. " yes", "\\tno").
    Unrecognized or missing values are returned as NaN so they can be
    handled explicitly by the missing-value strategy in Sprint 1,
    rather than silently becoming 0.
    """
    mapping = {
        "yes": 1, "no": 0,
        "normal": 1, "abnormal": 0,
        "present": 1, "notpresent": 0,
        "good": 1, "poor": 0,
    }
    cleaned = series.astype(str).str.strip().str.lower()
    return cleaned.map(mapping)


def load_raw_tabular(path) -> pd.DataFrame:
    """
    Load the raw UCI CKD CSV and drop the non-feature id column.

    Most missing values in this CSV are genuinely blank/NaN. But three
    numeric columns (pcv, wc, rc) were found by inspection (Sprint 1) to
    contain stray artifacts from how the source file was assembled —
    values like "\\t?" (a literal tab + question mark, meaning missing)
    and "\\t43" (a valid number with a leading tab). Both are handled
    here: strip whitespace, then coerce to numeric with errors="coerce"
    so anything still unparseable (like a bare "?") becomes NaN rather
    than silently crashing the imputer downstream.
    """
    import config
    df = pd.read_csv(path)
    if config.ID_COLUMN in df.columns:
        df = df.drop(columns=[config.ID_COLUMN])

    for col in config.NUMERIC_COLUMNS:
        # Note: pandas 3.x infers a native "str" dtype for mixed columns
        # by default (not the old "object" dtype), so check numeric-ness
        # directly rather than comparing dtype == object — the latter
        # silently misses these columns on pandas >= 3.0.
        if not pd.api.types.is_numeric_dtype(df[col]):
            df[col] = pd.to_numeric(df[col].astype(str).str.strip(), errors="coerce")

    return df


def clean_target(series: pd.Series) -> pd.Series:
    """
    The raw target column has a couple of dirty values (e.g. "ckd\t"
    with a stray tab character, found by inspecting real value counts).
    Strip whitespace so "ckd" and "notckd" are the only two values.
    """
    return series.astype(str).str.strip()


def clean_tabular(df: pd.DataFrame) -> pd.DataFrame:
    """
    Full cleaning pipeline: clean the target, encode binary columns,
    impute missing values (median for numeric, most-frequent for
    binary), and scale numeric features. Returns a fully model-ready
    DataFrame plus the fitted scaler (needed to transform new patient
    input the same way at inference time).
    """
    import config
    from sklearn.impute import SimpleImputer
    from sklearn.preprocessing import StandardScaler

    df = df.copy()
    df[config.TARGET_COLUMN] = clean_target(df[config.TARGET_COLUMN])

    for col in config.BINARY_COLUMNS:
        df[col] = encode_binary_column(df[col])

    numeric_imputer = SimpleImputer(strategy="median")
    df[config.NUMERIC_COLUMNS] = numeric_imputer.fit_transform(df[config.NUMERIC_COLUMNS])

    binary_imputer = SimpleImputer(strategy="most_frequent")
    df[config.BINARY_COLUMNS] = binary_imputer.fit_transform(df[config.BINARY_COLUMNS])

    scaler = StandardScaler()
    df[config.NUMERIC_COLUMNS] = scaler.fit_transform(df[config.NUMERIC_COLUMNS])

    return df, scaler


def split_train_test(df: pd.DataFrame):
    """
    Stratified train/test split using config.TEST_SIZE and
    config.RANDOM_SEED, stratified on config.TARGET_COLUMN so both
    classes are represented fairly in each split.
    """
    import config
    from sklearn.model_selection import train_test_split

    X = df[config.FEATURE_COLUMNS]
    y = df[config.TARGET_COLUMN]
    return train_test_split(
        X, y,
        test_size=config.TEST_SIZE,
        random_state=config.RANDOM_SEED,
        stratify=y,
    )
