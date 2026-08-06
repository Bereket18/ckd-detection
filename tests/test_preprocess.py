"""
Real, passing tests for the one function Sprint 0 actually implements
(encode_binary_column). This exists mainly to prove the environment
and test setup work end-to-end before Sprint 1 starts adding real
data logic — run `pytest` and this should pass immediately.
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import pandas as pd
import config
from src.data.preprocess import encode_binary_column, clean_target, load_raw_tabular, clean_tabular, split_train_test
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


def test_clean_tabular_produces_no_missing_values():
    raw = fetch_uci_ckd()
    cleaned, scaler = clean_tabular(raw)
    assert cleaned[config.FEATURE_COLUMNS].isna().sum().sum() == 0
    assert set(cleaned[config.TARGET_COLUMN].unique()) == {"ckd", "notckd"}


def test_split_train_test_is_stratified_and_correct_size():
    raw = fetch_uci_ckd()
    cleaned, _ = clean_tabular(raw)
    X_train, X_test, y_train, y_test = split_train_test(cleaned)
    assert len(X_test) == round(400 * config.TEST_SIZE)
    # stratification: class proportion in test set should roughly match full data
    full_ckd_ratio = (cleaned[config.TARGET_COLUMN] == "ckd").mean()
    test_ckd_ratio = (y_test == "ckd").mean()
    assert abs(full_ckd_ratio - test_ckd_ratio) < 0.05
