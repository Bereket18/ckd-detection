import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import numpy as np
import config
from src.data.load_tabular import fetch_uci_ckd
from src.data.preprocess import prepare_tabular
from src.agent.chatbot import (
    validate_numeric, validate_binary, answers_to_feature_row, BINARY_ACCEPTED,
)


def test_validate_numeric_accepts_valid_number():
    ok, result = validate_numeric("62", "age")
    assert ok is True
    assert result == 62.0


def test_validate_numeric_rejects_non_numeric():
    ok, result = validate_numeric("sixty-two", "age")
    assert ok is False
    assert "age" in result


def test_validate_numeric_rejects_out_of_scale_value():
    """
    su is a 0-5 urinalysis scale. "23" is numeric but impossible, and it
    used to pass the numeric-only check and distort the prediction -- a
    real bug found by live testing (commit b8c5ee8).

    This test and the one below lived at the bottom of
    src/agent/chatbot.py, AFTER its __main__ block, so pytest never
    collected them and this guard was inactive. See AUDIT.md (P0-6).
    """
    ok, result = validate_numeric("23", "su")
    assert ok is False
    assert "range" in result.lower()


def test_validate_numeric_accepts_in_range_value():
    ok, result = validate_numeric("3", "su")
    assert ok is True
    assert result == 3.0


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
    """
    Uses the REAL fitted preprocessor rather than a synthetic one. The
    previous version fit a StandardScaler on np.tile(np.arange(14)), which
    gives every column zero variance -- sklearn then substitutes scale_=1.0
    and the "did scaling happen" assertion passed for a degenerate reason.
    """
    _, _, _, _, preprocessor = prepare_tabular(fetch_uci_ckd())

    answers = {col: "no" for col in config.BINARY_COLUMNS}
    answers.update({"rbc": "normal", "pc": "normal", "pcc": "notpresent",
                    "ba": "notpresent", "appet": "good"})
    raw_numeric = {"age": 62.0, "bp": 90.0, "sg": 1.010, "al": 3.0, "su": 0.0,
                   "bgr": 150.0, "bu": 60.0, "sc": 3.2, "sod": 135.0, "pot": 4.5,
                   "hemo": 9.5, "pcv": 30.0, "wc": 8000.0, "rc": 3.6}
    answers.update(raw_numeric)

    row = answers_to_feature_row(answers, preprocessor)

    assert list(row.columns) == config.FEATURE_COLUMNS
    assert len(row) == 1
    assert row["htn"].iloc[0] == 0
    assert row["appet"].iloc[0] == 1
    assert row["rbc"].iloc[0] == 1
    assert row["pcc"].iloc[0] == 0
    # Numerics must be standardized, not passed through raw.
    assert not np.allclose(
        row[config.NUMERIC_COLUMNS].values[0],
        [raw_numeric[c] for c in config.NUMERIC_COLUMNS],
    )
    # Standardized values live in roughly [-5, 5]; raw age=62 / wc=8000 do not.
    assert np.abs(row[config.NUMERIC_COLUMNS].values[0]).max() < 10


def test_answers_to_feature_row_matches_the_training_pipeline_exactly():
    """
    The consistency guard the project was missing. A patient whose raw
    answers equal a known raw training row must be transformed into
    exactly the row the model was trained on. This is the invariant the
    original standalone-scaler design broke once already.
    """
    raw = fetch_uci_ckd()
    X_train, _, _, _, preprocessor = prepare_tabular(raw)

    # Pick a training row with no missing values, so raw answers can
    # reproduce it exactly (imputation would otherwise be involved).
    complete = raw.loc[X_train.index].dropna(subset=config.FEATURE_COLUMNS)
    assert len(complete) > 0, "expected at least one fully-observed training row"
    source = complete.iloc[0]

    # raw binary columns already hold the exact text the agent accepts
    answers = {}
    for col in config.NUMERIC_COLUMNS:
        answers[col] = float(source[col])
    for col in config.BINARY_COLUMNS:
        answers[col] = str(source[col]).strip().lower()

    rebuilt = answers_to_feature_row(answers, preprocessor)
    expected = X_train.loc[[source.name]]

    np.testing.assert_allclose(
        rebuilt[config.FEATURE_COLUMNS].values.astype(float),
        expected[config.FEATURE_COLUMNS].values.astype(float),
        rtol=1e-9, atol=1e-9,
    )


def test_agent_predicts_higher_risk_for_a_clinically_sick_profile():
    """
    End-to-end smoke test of the inference path (encode -> transform ->
    predict) using a profile that is unambiguously CKD-like: heavy
    albuminuria, high creatinine and urea, low hemoglobin, hypertension,
    anemia, oedema. If this ever returns lower risk, something in the
    transform chain has broken -- which is exactly how the original
    missing-scaler bug manifested.
    """
    from src.models.tabular_model import CANDIDATES, _to_binary_target

    raw = fetch_uci_ckd()
    X_train, _, y_train, _, preprocessor = prepare_tabular(raw)
    model = CANDIDATES["logistic_regression"].fit(X_train, _to_binary_target(y_train))

    answers = {
        "age": 62.0, "bp": 100.0, "sg": 1.005, "al": 4.0, "su": 2.0,
        "bgr": 250.0, "bu": 150.0, "sc": 7.5, "sod": 130.0, "pot": 5.5,
        "hemo": 7.5, "pcv": 24.0, "wc": 12000.0, "rc": 2.8,
        "rbc": "abnormal", "pc": "abnormal", "pcc": "present", "ba": "present",
        "htn": "yes", "dm": "yes", "cad": "no", "appet": "poor",
        "pe": "yes", "ane": "yes",
    }
    row = answers_to_feature_row(answers, preprocessor)
    assert model.predict(row)[0] == 1  # 1 == "ckd"
