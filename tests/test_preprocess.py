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
from src.data.preprocess import encode_binary_column


def test_encode_binary_column_yes_no():
    result = encode_binary_column(pd.Series(["yes", "no", " yes", "No"]))
    assert result.tolist() == [1, 0, 1, 0]


def test_encode_binary_column_normal_abnormal():
    result = encode_binary_column(pd.Series(["normal", "abnormal"]))
    assert result.tolist() == [1, 0]


def test_encode_binary_column_present_notpresent():
    result = encode_binary_column(pd.Series(["present", "notpresent"]))
    assert result.tolist() == [1, 0]


def test_encode_binary_column_unrecognized_becomes_nan():
    result = encode_binary_column(pd.Series(["yes", "??", ""]))
    assert result.iloc[0] == 1
    assert pd.isna(result.iloc[1])
    assert pd.isna(result.iloc[2])
