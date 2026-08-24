"""
Tests for the SHAP explainability layer.

This module previously had ZERO tests, and it is where the two worst
user-facing bugs in the project lived (AUDIT.md P0-4 and P0-5). That is
not a coincidence, so the guards here are deliberately specific:

  - sign fidelity: a feature that pushed a prediction one way must never
    be described as having pushed it the other way
  - explainer/model compatibility: every candidate model that
    train_baseline.py is allowed to save must be explainable
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import numpy as np
import pytest
import shap
import config
from src.data.load_tabular import fetch_uci_ckd
from src.data.preprocess import prepare_tabular
from src.models.tabular_model import CANDIDATES, _to_binary_target
from src.explain.shap_utils import (
    explain_prediction, explanation_to_sentence, get_explainer, _positive_class_row,
    FEATURE_PLAIN_LANGUAGE,
)


@pytest.fixture(scope="module")
def split():
    return prepare_tabular(fetch_uci_ckd())


# ---------------------------------------------------------------------------
# P0-4: sign fidelity in the plain-language sentence
# ---------------------------------------------------------------------------

def test_all_positive_impacts_are_described_as_raising_risk():
    sentence = explanation_to_sentence([("al", 1.5), ("sc", 0.9), ("bu", 0.4)], "ckd")
    assert "pushed your risk up" in sentence
    assert "pushed your risk down" not in sentence
    assert "albumin level" in sentence


def test_all_negative_impacts_are_described_as_lowering_risk():
    sentence = explanation_to_sentence([("hemo", -1.5), ("pcv", -0.9)], "notckd")
    assert "pushed your risk down" in sentence
    assert "pushed your risk up" not in sentence


def test_mixed_signs_place_each_feature_in_the_correct_clause():
    """
    THE regression guard for P0-4. These are the real SHAP values for
    test-set patient 9, who was predicted "notckd". Urine specific gravity
    was the single strongest factor and it pushed *toward* CKD -- but the
    old code derived one direction from the predicted label and told the
    patient all three answers lowered their risk.
    """
    impacts = [("sg", 2.681), ("pcv", -2.051), ("hemo", -0.857)]
    sentence = explanation_to_sentence(impacts, "notckd")

    assert ", while " in sentence, "mixed-sign explanations must report both directions"
    up_clause, down_clause = sentence.split(", while ")

    assert "pushed your risk up" in up_clause
    assert "urine specific gravity" in up_clause
    # The two negatives must NOT be in the "up" clause...
    assert "packed cell volume" not in up_clause
    assert "hemoglobin level" not in up_clause
    # ...and the positive must NOT be in the "down" clause.
    assert "urine specific gravity" not in down_clause
    assert "packed cell volume" in down_clause
    assert "hemoglobin level" in down_clause


def test_no_feature_is_ever_described_in_both_directions():
    impacts = [("al", 2.0), ("hemo", -1.0), ("sg", 0.5)]
    sentence = explanation_to_sentence(impacts, "ckd")
    up_clause, down_clause = sentence.split(", while ")
    for plain_name in ["albumin level", "urine specific gravity"]:
        assert plain_name in up_clause and plain_name not in down_clause
    assert "hemoglobin level" in down_clause and "hemoglobin level" not in up_clause


def test_sign_fidelity_holds_for_every_real_test_patient(split):
    """
    End-to-end version of the guard: for all 80 held-out patients, check
    that no feature with a negative SHAP value is reported in the
    risk-raising clause (and vice versa). This is the exact check that
    found the bug in 15 of 80 patients before the fix.
    """
    X_train, X_test, y_train, _, _ = split
    model = CANDIDATES["logistic_regression"].fit(X_train, _to_binary_target(y_train))

    violations = 0
    for i in range(len(X_test)):
        row = X_test.iloc[i]
        prediction = model.predict(row.to_frame().T)[0]
        impacts = explain_prediction(
            model, row.values, config.FEATURE_COLUMNS, X_train.values, top_n=3
        )
        sentence = explanation_to_sentence(impacts, "ckd" if prediction == 1 else "notckd")

        clauses = sentence.split(", while ")
        up = next((c for c in clauses if "risk up" in c), "")
        down = next((c for c in clauses if "risk down" in c), "")
        for feature, value in impacts:
            name = FEATURE_PLAIN_LANGUAGE[feature]
            if value > 0 and name in down:
                violations += 1
            if value < 0 and name in up:
                violations += 1

    assert violations == 0, f"{violations} feature(s) described in the wrong direction"


def test_zero_impacts_fall_back_to_an_honest_message():
    sentence = explanation_to_sentence([("al", 0.0), ("sc", 0.0)], "ckd")
    assert "No single answer stood out" in sentence
    assert "higher risk" in sentence


def test_sentence_is_capitalized_and_terminated():
    sentence = explanation_to_sentence([("al", 1.0)], "ckd")
    assert sentence[0].isupper()
    assert sentence.endswith(".")


# ---------------------------------------------------------------------------
# P0-5: the explainer must match whichever model training picked
# ---------------------------------------------------------------------------

def test_get_explainer_picks_linear_for_logistic_regression(split):
    X_train, _, y_train, _, _ = split
    model = CANDIDATES["logistic_regression"].fit(X_train, _to_binary_target(y_train))
    assert isinstance(get_explainer(model, X_train), shap.LinearExplainer)


@pytest.mark.parametrize("name", ["random_forest", "xgboost"])
def test_get_explainer_picks_tree_for_tree_models(split, name):
    X_train, _, y_train, _, _ = split
    model = CANDIDATES[name].fit(X_train, _to_binary_target(y_train))
    assert isinstance(get_explainer(model, X_train), shap.TreeExplainer)


@pytest.mark.parametrize("name", list(CANDIDATES))
def test_explain_prediction_works_for_every_saveable_candidate(split, name):
    """
    REGRESSION GUARD for P0-5. train_baseline.py saves whichever candidate
    wins cross-validation, so every entry in CANDIDATES must be
    explainable. Before the fix, LinearExplainer was hardcoded and 2 of
    these 3 raised shap.utils._exceptions.InvalidModelError -- meaning a
    retrain that changed the winner would crash the agent at the last
    step of every consultation.
    """
    X_train, X_test, y_train, _, _ = split
    model = CANDIDATES[name].fit(X_train, _to_binary_target(y_train))

    impacts = explain_prediction(
        model, X_test.iloc[0].values, config.FEATURE_COLUMNS, X_train.values, top_n=3
    )
    assert len(impacts) == 3
    for feature, value in impacts:
        assert feature in config.FEATURE_COLUMNS
        assert np.isfinite(value)
    # sorted by descending absolute impact
    magnitudes = [abs(v) for _, v in impacts]
    assert magnitudes == sorted(magnitudes, reverse=True)


# ---------------------------------------------------------------------------
# Shape normalization across explainer return formats
# ---------------------------------------------------------------------------

def test_positive_class_row_handles_2d_output():
    """LinearExplainer / XGBoost binary: (n_samples, n_features)."""
    out = _positive_class_row(np.array([[1.0, -2.0, 3.0]]))
    np.testing.assert_allclose(out, [1.0, -2.0, 3.0])


def test_positive_class_row_handles_3d_output():
    """TreeExplainer on a sklearn forest: (n_samples, n_features, n_classes)."""
    values = np.array([[[0.1, 0.9], [0.2, -0.8], [0.3, 0.7]]])  # 1 sample, 3 features, 2 classes
    out = _positive_class_row(values)
    np.testing.assert_allclose(out, [0.9, -0.8, 0.7])


def test_positive_class_row_handles_list_per_class_output():
    """KernelExplainer / older shap: one array per class."""
    values = [np.array([[0.1, 0.2, 0.3]]), np.array([[0.9, -0.8, 0.7]])]
    out = _positive_class_row(values)
    np.testing.assert_allclose(out, [0.9, -0.8, 0.7])
