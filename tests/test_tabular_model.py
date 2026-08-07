"""
Real tests for Sprint 2's model training/evaluation pipeline. Runs
against the actual cleaned dataset (small — 320/80 rows — so this
stays fast) rather than a mock, since the whole point is confirming
the pipeline produces a genuinely usable, accurate model.
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import joblib
import config
from src.data.load_tabular import fetch_uci_ckd
from src.data.preprocess import clean_tabular, split_train_test
from src.models import tabular_model


def _get_split():
    raw = fetch_uci_ckd()
    cleaned, _ = clean_tabular(raw)
    return split_train_test(cleaned)


def test_compare_candidates_returns_all_three_with_valid_scores():
    X_train, X_test, y_train, y_test = _get_split()
    results = tabular_model.compare_candidates(X_train, y_train)
    assert set(results.keys()) == {"logistic_regression", "random_forest", "xgboost"}
    for mean, std in results.values():
        assert 0.0 <= mean <= 1.0
        assert std >= 0.0


def test_tune_model_returns_fitted_estimator():
    X_train, X_test, y_train, y_test = _get_split()
    model, params = tabular_model.tune_model("logistic_regression", X_train, y_train)
    assert hasattr(model, "predict")
    assert isinstance(params, dict) and len(params) > 0


def test_evaluate_returns_all_expected_metrics_in_valid_range():
    X_train, X_test, y_train, y_test = _get_split()
    model, _ = tabular_model.tune_model("logistic_regression", X_train, y_train)
    results = tabular_model.evaluate(model, X_test, y_test)
    for metric in ["accuracy", "precision", "recall", "f1", "auc_roc"]:
        assert 0.0 <= results[metric] <= 1.0
    assert len(results["confusion_matrix"]) == 2
    assert len(results["confusion_matrix"][0]) == 2


def test_evaluate_meets_prd_success_metrics():
    """
    The PRD sets accuracy >= 90% and recall >= 90% as MVP success
    metrics — this test guards against a future change silently
    regressing below that bar.
    """
    X_train, X_test, y_train, y_test = _get_split()
    model, _ = tabular_model.tune_model("logistic_regression", X_train, y_train)
    results = tabular_model.evaluate(model, X_test, y_test)
    assert results["accuracy"] >= 0.90
    assert results["recall"] >= 0.90


def test_save_and_reload_model_predicts_consistently(tmp_path):
    X_train, X_test, y_train, y_test = _get_split()
    model, _ = tabular_model.tune_model("logistic_regression", X_train, y_train)
    original_predictions = model.predict(X_test)

    save_path = tmp_path / "test_model.joblib"
    tabular_model.save_model(model, save_path)
    reloaded = joblib.load(save_path)
    reloaded_predictions = reloaded.predict(X_test)

    assert list(original_predictions) == list(reloaded_predictions)