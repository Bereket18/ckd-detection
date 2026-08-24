import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import joblib
import numpy as np
import pandas as pd
import pytest
import config
from src.data.load_tabular import fetch_uci_ckd
from src.data.preprocess import prepare_tabular
from src.agent.chatbot import (
    validate_numeric, validate_binary, answers_to_feature_row, load_background_data,
    BINARY_ACCEPTED, SKIP_ANSWERS,
)


@pytest.fixture(scope="module")
def preprocessor():
    """The real fitted preprocessor, shared -- fitting it per test dominated runtime."""
    *_, fitted = prepare_tabular(fetch_uci_ckd())
    return fitted


def healthy_answers():
    """A complete, valid, unremarkable set of answers for all 24 features."""
    answers = {col: "no" for col in config.BINARY_COLUMNS}
    answers.update({"rbc": "normal", "pc": "normal", "pcc": "notpresent",
                    "ba": "notpresent", "appet": "good"})
    answers.update({"age": 50.0, "bp": 80.0, "sg": 1.020, "al": 0.0, "su": 0.0,
                    "bgr": 100.0, "bu": 30.0, "sc": 1.0, "sod": 140.0, "pot": 4.0,
                    "hemo": 14.0, "pcv": 42.0, "wc": 7000.0, "rc": 5.0})
    return answers


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


def test_answers_to_feature_row_rejects_an_unrecognized_binary_value():
    """
    The agent's encoding now reuses encode_binary_column() instead of
    keeping a private copy of the mapping (AUDIT.md P1-8). That function
    maps unknown text to NaN, which the imputer would silently fill with
    the population mode -- substituting a value the patient never gave.
    A clinical tool must fail loudly here instead.
    """
    _, _, _, _, preprocessor = prepare_tabular(fetch_uci_ckd())

    answers = {col: "no" for col in config.BINARY_COLUMNS}
    answers.update({"rbc": "normal", "pc": "normal", "pcc": "notpresent",
                    "ba": "notpresent", "appet": "good"})
    answers.update({"age": 50.0, "bp": 80.0, "sg": 1.020, "al": 0.0, "su": 0.0,
                    "bgr": 100.0, "bu": 30.0, "sc": 1.0, "sod": 140.0, "pot": 4.0,
                    "hemo": 14.0, "pcv": 42.0, "wc": 7000.0, "rc": 5.0})
    answers["htn"] = "probably"  # not a valid option pair member

    with pytest.raises(ValueError, match="Unrecognized value"):
        answers_to_feature_row(answers, preprocessor)


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


# ---------------------------------------------------------------------------
# "I don't know" (AUDIT.md P2-3)
#
# The imputer has always handled missing values -- 38% of the UCI rbc column is
# missing -- but the interface never exposed that, so a patient without a full
# lab panel had to invent a number. An imputed population value is a documented
# estimate; a guessed one is silent fiction.
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("answer", sorted(SKIP_ANSWERS))
def test_validate_numeric_accepts_every_documented_skip_word(answer):
    ok, result = validate_numeric(answer, "age")
    assert ok is True
    assert result is None


@pytest.mark.parametrize("answer", sorted(SKIP_ANSWERS))
def test_validate_binary_accepts_every_documented_skip_word(answer):
    ok, result = validate_binary(answer, BINARY_ACCEPTED["htn"])
    assert ok is True
    assert result is None


def test_skip_words_are_case_and_whitespace_insensitive():
    assert validate_numeric("  UNKNOWN ", "age") == (True, None)
    assert validate_binary(" Skip", BINARY_ACCEPTED["htn"]) == (True, None)


def test_a_skipped_field_is_imputed_rather_than_rejected(preprocessor):
    """
    The distinction that matters: None means "deliberately not answered" and
    must flow through to the imputer, whereas a malformed answer must still
    raise. Conflating the two would either block honest patients or silently
    fabricate values.
    """
    answers = healthy_answers()
    answers["sc"] = None      # numeric skip
    answers["rbc"] = None     # binary skip
    answers["hemo"] = None

    row = answers_to_feature_row(answers, preprocessor)

    assert list(row.columns) == config.FEATURE_COLUMNS
    # Nothing NaN survives: the imputer filled all three.
    assert row.isna().sum().sum() == 0
    # And "sc" holds the standardized train-split median -- the imputer's
    # learned value -- not a zero and not one of the patient's other answers.
    index = preprocessor.numeric_columns.index("sc")
    median = preprocessor.numeric_imputer.statistics_[index]
    expected = (median - preprocessor.scaler.mean_[index]) / preprocessor.scaler.scale_[index]
    assert row["sc"].iloc[0] == pytest.approx(expected)


def test_every_field_may_be_skipped_at_once(preprocessor):
    """The degenerate case must not crash: a row of all-None is entirely
    imputed. It is a useless prediction, but it must be a prediction and not a
    dtype error."""
    answers = {field: None for field in config.FEATURE_COLUMNS}
    row = answers_to_feature_row(answers, preprocessor)
    assert row.isna().sum().sum() == 0
    assert len(row) == 1


def test_a_malformed_answer_still_raises_even_though_skipping_is_allowed(preprocessor):
    """
    The regression guard for P1-8. Allowing skips must not have widened into
    "anything unparseable becomes NaN", which is exactly the silent-imputation
    bug that guard exists to prevent.
    """
    answers = healthy_answers()
    answers["htn"] = "probably"  # given, but not a valid option
    with pytest.raises(ValueError, match="Unrecognized value"):
        answers_to_feature_row(answers, preprocessor)


def test_a_malformed_numeric_answer_also_raises(preprocessor):
    answers = healthy_answers()
    answers["sc"] = "quite high"
    with pytest.raises(ValueError, match="Unrecognized value"):
        answers_to_feature_row(answers, preprocessor)


def test_an_omitted_field_is_reported_rather_than_a_keyerror(preprocessor):
    """A programmatic caller that forgets a field should learn which one."""
    answers = healthy_answers()
    del answers["sc"]
    with pytest.raises(ValueError, match="No answer supplied"):
        answers_to_feature_row(answers, preprocessor)


# ---------------------------------------------------------------------------
# The agent adapts to the loaded model's feature set
# ---------------------------------------------------------------------------

def test_the_feature_row_follows_the_preprocessor_not_the_config():
    """
    A model trained on a reduced feature set -- the intersection of two
    datasets, see src/data/datasets.py -- must be usable through the agent.
    That only works if the row is built from the preprocessor's own column
    list rather than from config.FEATURE_COLUMNS.
    """
    numeric = ["age", "bp", "sc", "hemo"]
    binary = ["htn", "dm"]
    small_preprocessor = prepare_tabular(
        fetch_uci_ckd(), numeric_columns=numeric, binary_columns=binary
    )[-1]
    assert small_preprocessor.feature_columns == numeric + binary

    complete = healthy_answers()
    answers = {field: complete[field] for field in numeric + binary}
    row = answers_to_feature_row(answers, small_preprocessor)

    assert list(row.columns) == numeric + binary
    assert row.isna().sum().sum() == 0


def test_a_reduced_model_needs_no_new_prompt_text():
    """config.FEATURE_PROMPTS covers all 24 canonical names, so any subset is
    already answerable -- collect_patient_data needs no per-dataset prompts."""
    for field in config.FEATURE_COLUMNS:
        assert field in config.FEATURE_PROMPTS
        assert field in config.NUMERIC_COLUMNS or field in BINARY_ACCEPTED


# ---------------------------------------------------------------------------
# The cached SHAP background (AUDIT.md P1-5)
#
# The point of the cache is that the background matches the model's own training
# data -- not the latency P1-5 claimed. Measured, the recompute cost 0.31s, not
# the "~10s" that entry estimated. The two mismatch tests below are the ones
# that carry the real value.
# ---------------------------------------------------------------------------

def test_background_is_loaded_from_disk_when_present(tmp_path, preprocessor):
    """The saved sample is used as-is, rather than being rebuilt from UCI."""
    saved = pd.DataFrame(
        [[0.0] * len(preprocessor.feature_columns)],
        columns=preprocessor.feature_columns,
    )
    path = tmp_path / "shap_background.joblib"
    joblib.dump(saved, path)

    loaded = load_background_data(preprocessor, path=path)
    assert list(loaded.columns) == preprocessor.feature_columns
    assert len(loaded) == 1  # the file, not a 320-row recompute


def test_a_background_from_a_different_feature_set_is_refused(tmp_path, preprocessor):
    """
    The correctness bug the caching also fixes. The agent used to rebuild the
    background from UCI regardless of what the model was trained on, which for a
    non-UCI model would yield attributions that looked plausible and were wrong.
    A mismatch has no safe silent handling, so it must raise.
    """
    stale = pd.DataFrame([[0.0, 0.0]], columns=["age", "bp"])
    path = tmp_path / "shap_background.joblib"
    joblib.dump(stale, path)

    with pytest.raises(ValueError, match="different training runs"):
        load_background_data(preprocessor, path=path)


def test_a_missing_background_falls_back_for_uci_but_not_for_a_reduced_model(tmp_path):
    """
    The fallback keeps an older saved_models/ working, but it can only rebuild
    the UCI feature set -- so for a reduced-feature model it must say to
    retrain rather than hand back a wrongly-shaped background.
    """
    absent = tmp_path / "not_written.joblib"

    small = prepare_tabular(
        fetch_uci_ckd(), numeric_columns=["age", "bp"], binary_columns=["htn"]
    )[-1]
    with pytest.raises(FileNotFoundError, match="reduced feature set"):
        load_background_data(small, path=absent)

    # For the canonical feature set the fallback still works.
    full = prepare_tabular(fetch_uci_ckd())[-1]
    background = load_background_data(full, path=absent)
    assert list(background.columns) == config.FEATURE_COLUMNS
    assert len(background) == 320

