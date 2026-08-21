import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import numpy as np
from sklearn.preprocessing import StandardScaler
from src.agent.chatbot import validate_numeric, validate_binary, answers_to_feature_row, BINARY_ACCEPTED
import config


def test_validate_numeric_accepts_valid_number():
    ok, result = validate_numeric("62", "age")
    assert ok is True
    assert result == 62.0


def test_validate_numeric_rejects_non_numeric():
    ok, result = validate_numeric("sixty-two", "age")
    assert ok is False
    assert "age" in result


def test_validate_binary_accepts_correct_options():
    ok, result = validate_binary("yes", BINARY_ACCEPTED["htn"])
    assert ok is True
    assert result == "yes"


def test_validate_binary_rejects_wrong_options():
    ok, result = validate_binary("maybe", BINARY_ACCEPTED["htn"])
    assert ok is False
    assert "yes/no" in result


def test_validate_binary_is_case_insensitive():
    ok, result = validate_binary("YES", BINARY_ACCEPTED["htn"])
    assert ok is True
    assert result == "yes"


def test_answers_to_feature_row_encodes_binaries_and_scales_numerics():
    toy_data = np.tile(np.arange(len(config.NUMERIC_COLUMNS), dtype=float), (10, 1))
    scaler = StandardScaler().fit(toy_data)

    answers = {col: 0.0 if col in config.NUMERIC_COLUMNS else "no" for col in config.FEATURE_COLUMNS}
    for i, col in enumerate(config.NUMERIC_COLUMNS):
        answers[col] = float(i)
    for col in ["rbc", "pc"]:
        answers[col] = "normal"
    for col in ["pcc", "ba"]:
        answers[col] = "notpresent"
    answers["appet"] = "good"

    row = answers_to_feature_row(answers, scaler)
    assert list(row.columns) == config.FEATURE_COLUMNS
    assert row["htn"].iloc[0] == 0
    assert row["appet"].iloc[0] == 1
    assert row["rbc"].iloc[0] == 1
    assert not np.allclose(row[config.NUMERIC_COLUMNS].values[0], list(range(len(config.NUMERIC_COLUMNS))))