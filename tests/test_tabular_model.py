"""
Real tests for Sprint 2's model training/evaluation pipeline. Runs
against the actual cleaned dataset (small — 320/80 rows — so this
stays fast) rather than a mock, since the whole point is confirming
the pipeline produces a genuinely usable, accurate model.

The split and the tuned model are module-scoped fixtures: previously each
test re-ran the full pipeline, and three of them re-ran GridSearchCV, which
dominated the suite's runtime for no added coverage.
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import joblib
import pytest
import config
from src.data.load_tabular import fetch_uci_ckd
from src.data.preprocess import prepare_tabular
from src.models import tabular_model


@pytest.fixture(scope="module")
def split():
    """(X_train, X_test, y_train, y_test) — preprocessor fit on train only."""
    X_train, X_test, y_train, y_test, _ = prepare_tabular(fetch_uci_ckd())
    return X_train, X_test, y_train, y_test


@pytest.fixture(scope="module")
def tuned_model(split):
    X_train, _, y_train, _ = split
    model, _ = tabular_model.tune_model("logistic_regression", X_train, y_train)
    return model


def test_compare_candidates_returns_all_three_with_valid_scores(split):
    X_train, _, y_train, _ = split
    results = tabular_model.compare_candidates(X_train, y_train)
    assert set(results.keys()) == {"logistic_regression", "random_forest", "xgboost"}
    for mean, std in results.values():
        assert 0.0 <= mean <= 1.0
        assert std >= 0.0


def test_tune_model_returns_fitted_estimator(split):
    X_train, _, y_train, _ = split
    model, params = tabular_model.tune_model("logistic_regression", X_train, y_train)
    assert hasattr(model, "predict")
    assert isinstance(params, dict) and len(params) > 0


def test_evaluate_returns_all_expected_metrics_in_valid_range(split, tuned_model):
    _, X_test, _, y_test = split
    results = tabular_model.evaluate(tuned_model, X_test, y_test)
    for metric in ["accuracy", "precision", "recall", "f1", "auc_roc"]:
        assert 0.0 <= results[metric] <= 1.0
    assert len(results["confusion_matrix"]) == 2
    assert len(results["confusion_matrix"][0]) == 2


def test_evaluate_meets_prd_success_metrics(split, tuned_model):
    """
    The PRD sets accuracy >= 90% and recall >= 90% as MVP success
    metrics — this test guards against a future change silently
    regressing below that bar.

    Note: these are now measured against a genuinely held-out test set
    (the preprocessor is fit on train only), so the bar is met on an
    honest estimate rather than a leaked one. See AUDIT.md (P0-3).
    """
    _, X_test, _, y_test = split
    results = tabular_model.evaluate(tuned_model, X_test, y_test)
    assert results["accuracy"] >= 0.90
    assert results["recall"] >= 0.90


def test_save_and_reload_model_predicts_consistently(split, tuned_model, tmp_path):
    _, X_test, _, _ = split
    original_predictions = tuned_model.predict(X_test)

    save_path = tmp_path / "test_model.joblib"
    tabular_model.save_model(tuned_model, save_path)
    reloaded = joblib.load(save_path)
    reloaded_predictions = reloaded.predict(X_test)

    assert list(original_predictions) == list(reloaded_predictions)


def test_saved_metrics_roundtrip_and_omit_unserializable_report(split, tuned_model, tmp_path):
    """
    Sprints 4/5 read the baseline's metrics from disk instead of hardcoding
    them (AUDIT.md P1-1), so the write/read pair has to actually work --
    and must not choke on the sklearn classification_report string.
    """
    _, X_test, _, y_test = split
    results = tabular_model.evaluate(tuned_model, X_test, y_test)

    path = tmp_path / "metrics.json"
    tabular_model.save_metrics("logistic_regression", results, path)
    loaded = tabular_model.load_metrics(path)

    assert loaded["model"] == "logistic_regression"
    for metric in ["accuracy", "precision", "recall", "f1", "auc_roc"]:
        assert loaded[metric] == pytest.approx(results[metric])
    assert loaded["confusion_matrix"] == results["confusion_matrix"]
    # the human-only report string is deliberately not persisted
    assert "classification_report" not in loaded


def test_load_metrics_returns_none_when_baseline_not_trained(tmp_path):
    """The consumer scripts branch on this to print a helpful message instead of crashing."""
    assert tabular_model.load_metrics(tmp_path / "does_not_exist.json") is None


def test_saved_preprocessor_roundtrips_through_joblib(tmp_path):
    """
    The preprocessor is now a project-defined class rather than a bare
    sklearn object, so confirm it actually survives serialization — the
    agent depends on loading it back at inference time.
    """
    from src.data.preprocess import encode_tabular

    raw = fetch_uci_ckd()
    *_, preprocessor = prepare_tabular(raw)
    # Transform *encoded* (not already-transformed) rows, so this exercises
    # the same path the agent uses on live patient input.
    encoded_rows = encode_tabular(raw)[config.FEATURE_COLUMNS].head(5)

    path = tmp_path / "preproc.joblib"
    joblib.dump(preprocessor, path)
    reloaded = joblib.load(path)

    before = preprocessor.transform(encoded_rows)
    after = reloaded.transform(encoded_rows)
    assert list(before.columns) == config.FEATURE_COLUMNS
    assert (before.values == after.values).all()
