"""
Tests for the tabular cleaning/preprocessing pipeline.

The most important test in this file is
test_preprocessor_is_fit_on_train_split_only -- it is the regression guard
for the train/test leakage bug described in AUDIT.md (P0-3), where the
imputer and scaler were fit on all 400 rows before the split and every
reported metric was consequently optimistic. That class of bug is silent:
nothing crashes, the numbers just quietly get better than they should be.
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import numpy as np
import pandas as pd
import pytest
import config
from src.data.preprocess import (
    encode_binary_column, clean_target, encode_tabular,
    TabularPreprocessor, split_train_test, prepare_tabular,
)
from src.data.load_tabular import fetch_uci_ckd


def test_encode_binary_column_yes_no():
    result = encode_binary_column(pd.Series(["yes", "no", " yes", "No"]))
    assert result.tolist() == [1, 0, 1, 0]


def test_encode_binary_column_normal_abnormal():
    result = encode_binary_column(pd.Series(["normal", "abnormal"]))
    assert result.tolist() == [1, 0]


def test_encode_binary_column_present_notpresent():
    result = encode_binary_column(pd.Series(["present", "notpresent"]))
    assert result.tolist() == [1, 0]


def test_encode_binary_column_good_poor():
    # appet column uses good/poor — missed in the first pass, caught by
    # inspecting real unique values (Sprint 1).
    result = encode_binary_column(pd.Series(["good", "poor", "\tno"]))
    assert result.iloc[0] == 1
    assert result.iloc[1] == 0
    assert result.iloc[2] == 0  # "no" isn't good/poor's pair, but the yes/no pair still applies


def test_encode_binary_column_unrecognized_becomes_nan():
    result = encode_binary_column(pd.Series(["yes", "??", ""]))
    assert result.iloc[0] == 1
    assert pd.isna(result.iloc[1])
    assert pd.isna(result.iloc[2])


def test_clean_target_strips_whitespace():
    result = clean_target(pd.Series(["ckd", "ckd\t", "notckd", " notckd "]))
    assert result.tolist() == ["ckd", "ckd", "notckd", "notckd"]


def test_load_raw_tabular_drops_id_and_has_expected_shape():
    df = fetch_uci_ckd()
    assert config.ID_COLUMN not in df.columns
    assert df.shape[0] == 400
    assert set(config.FEATURE_COLUMNS + [config.TARGET_COLUMN]).issubset(df.columns)


def test_encode_tabular_is_row_independent():
    """
    encode_tabular must not learn anything from the dataset as a whole --
    that is the property that makes it safe to run before splitting.
    Encoding a single row alone must give the same result as encoding it
    as part of the full frame.
    """
    raw = fetch_uci_ckd()
    full = encode_tabular(raw)
    single = encode_tabular(raw.iloc[[7]])
    # check_dtype=False: a lone fully-observed row encodes to int64 while the
    # full frame is float64 (because other rows carry NaN). That is a pandas
    # dtype-inference detail, not a dependence on other rows — the claim being
    # tested is that the VALUES are identical.
    pd.testing.assert_frame_equal(full.iloc[[7]], single, check_dtype=False)


def test_encode_tabular_leaves_missing_values_for_the_preprocessor():
    """Imputation is a *learned* step, so it must not happen here."""
    raw = fetch_uci_ckd()
    encoded = encode_tabular(raw)
    assert encoded[config.FEATURE_COLUMNS].isna().sum().sum() > 0
    assert set(encoded[config.TARGET_COLUMN].unique()) == {"ckd", "notckd"}


def test_prepare_tabular_produces_no_missing_values():
    X_train, X_test, y_train, y_test, _ = prepare_tabular(fetch_uci_ckd())
    assert X_train.isna().sum().sum() == 0
    assert X_test.isna().sum().sum() == 0
    assert set(pd.concat([y_train, y_test]).unique()) == {"ckd", "notckd"}


def test_prepare_tabular_preserves_columns_and_row_counts():
    X_train, X_test, y_train, y_test, _ = prepare_tabular(fetch_uci_ckd())
    assert list(X_train.columns) == config.FEATURE_COLUMNS
    assert list(X_test.columns) == config.FEATURE_COLUMNS
    assert len(X_train) + len(X_test) == 400
    assert len(X_train) == len(y_train)
    assert len(X_test) == len(y_test)


def test_preprocessor_is_fit_on_train_split_only():
    """
    REGRESSION GUARD for the leakage bug (AUDIT.md P0-3).

    The scaler's learned mean must equal the mean of the TRAINING split,
    and must NOT equal the mean of the full 400-row dataset. Before the
    fix, the saved scaler's mean for `age` was 51.5625 -- exactly the
    full-dataset mean -- rather than the train-only 51.15625.
    """
    raw = fetch_uci_ckd()
    encoded = encode_tabular(raw)
    X_train, X_test, _, _ = split_train_test(encoded)

    _, _, _, _, preprocessor = prepare_tabular(raw)

    # What the scaler actually saw: the train split, after imputation.
    expected_train_mean = np.nanmean(
        preprocessor.numeric_imputer.transform(X_train[config.NUMERIC_COLUMNS]), axis=0
    )
    full_mean = np.nanmean(
        preprocessor.numeric_imputer.transform(encoded[config.NUMERIC_COLUMNS]), axis=0
    )

    np.testing.assert_allclose(preprocessor.scaler.mean_, expected_train_mean, rtol=1e-9)
    # And it must genuinely differ from the full-dataset statistic, or this
    # test would pass trivially and prove nothing.
    assert not np.allclose(expected_train_mean, full_mean)


def test_test_split_is_not_centered_on_itself():
    """
    Complementary check: because the scaler was fit on train only, the
    transformed TEST split should not have mean ~0 / std ~1. If it does,
    the scaler saw the test data.
    """
    _, X_test, _, _, _ = prepare_tabular(fetch_uci_ckd())
    test_means = X_test[config.NUMERIC_COLUMNS].mean().abs()
    assert test_means.max() > 1e-6


def test_preprocessor_transform_before_fit_raises():
    with pytest.raises(RuntimeError, match="before fit"):
        TabularPreprocessor().transform(pd.DataFrame({c: [0.0] for c in config.FEATURE_COLUMNS}))


def test_preprocessor_is_deterministic_across_transforms():
    """Same input twice -> identical output. Required for the agent to be trustworthy."""
    raw = fetch_uci_ckd()
    X_train, _, _, _, preprocessor = prepare_tabular(raw)
    first = preprocessor.transform(X_train.head(5))
    second = preprocessor.transform(X_train.head(5))
    pd.testing.assert_frame_equal(first, second)


def test_split_train_test_is_stratified_and_correct_size():
    encoded = encode_tabular(fetch_uci_ckd())
    X_train, X_test, y_train, y_test = split_train_test(encoded)
    assert len(X_test) == round(400 * config.TEST_SIZE)
    # stratification: class proportion in test set should roughly match full data
    full_ckd_ratio = (encoded[config.TARGET_COLUMN] == "ckd").mean()
    test_ckd_ratio = (y_test == "ckd").mean()
    assert abs(full_ckd_ratio - test_ckd_ratio) < 0.05
