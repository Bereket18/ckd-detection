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


# ---------------------------------------------------------------------------
# Confidence intervals
#
# AUDIT.md's most valuable open recommendation: every metric here is measured on
# 80 rows, so a bare "97.50%" implies a precision the sample size cannot
# support. These tests pin the properties that make the interval trustworthy.
# ---------------------------------------------------------------------------

def test_wilson_interval_stays_finite_at_a_perfect_proportion():
    """
    THE reason Wilson was chosen over the textbook Wald interval: the tuned
    model's measured recall is exactly 100%. At p = 1.0 the Wald half-width is
    sqrt(p(1-p)/n) = 0, so Wald would report [100%, 100%] from 50 positive
    cases -- a claim of certainty that is simply false. Wilson must not.
    """
    low, high = tabular_model.wilson_interval(50, 50)
    assert high == 1.0
    assert low < 1.0
    # 50/50 successes supports roughly "at least 93%", not "exactly 100%".
    assert 0.90 < low < 0.95


def test_wilson_interval_stays_finite_at_a_zero_proportion():
    """The mirror case: 0/50 is not proof of impossibility."""
    low, high = tabular_model.wilson_interval(0, 50)
    assert low == 0.0
    assert 0.0 < high < 0.10


def test_wilson_interval_is_centred_and_symmetric_at_one_half():
    low, high = tabular_model.wilson_interval(40, 80)
    assert low < 0.5 < high
    assert (0.5 - low) == pytest.approx(high - 0.5, abs=1e-9)


def test_wilson_interval_narrows_as_the_sample_grows():
    """The whole claim of the interval: more data, less uncertainty."""
    small = tabular_model.wilson_interval(78, 80)
    large = tabular_model.wilson_interval(780, 800)
    assert (large[1] - large[0]) < (small[1] - small[0])


def test_wilson_interval_never_escapes_zero_to_one():
    for successes, n in [(0, 1), (1, 1), (1, 2), (3, 4), (99, 100)]:
        low, high = tabular_model.wilson_interval(successes, n)
        assert 0.0 <= low <= high <= 1.0


def test_wilson_interval_with_no_observations_claims_nothing():
    """An empty denominator carries no information, so the interval is the
    whole range rather than a spurious point at zero."""
    assert tabular_model.wilson_interval(0, 0) == (0.0, 1.0)


def test_evaluate_brackets_every_point_estimate_with_its_interval(split, tuned_model):
    """
    The intervals are derived from the confusion matrix rather than recomputed,
    so they cannot drift out of sync with the numbers they qualify. Each point
    estimate must fall inside its own interval.
    """
    _, X_test, _, y_test = split
    results = tabular_model.evaluate(tuned_model, X_test, y_test)

    assert set(results["intervals"]) == {
        "accuracy", "recall", "precision", "specificity"
    }
    for metric, (low, high) in results["intervals"].items():
        assert low <= results[metric] <= high, metric
    assert results["n_test"] == len(y_test)


def test_evaluate_denominators_match_the_confusion_matrix(split, tuned_model):
    """
    Each rate has a different denominator -- recall is measured only on actual
    CKD patients, precision only on predicted-positive ones -- so a shared
    denominator would silently understate precision's uncertainty.
    """
    _, X_test, _, y_test = split
    results = tabular_model.evaluate(tuned_model, X_test, y_test)
    (tn, fp), (fn, tp) = results["confusion_matrix"]

    assert results["intervals"]["recall"] == tabular_model.wilson_interval(tp, tp + fn)
    assert results["intervals"]["precision"] == tabular_model.wilson_interval(tp, tp + fp)
    assert results["intervals"]["specificity"] == tabular_model.wilson_interval(tn, tn + fp)
    assert results["specificity"] == pytest.approx(tn / (tn + fp))


def test_saved_metrics_carry_intervals_and_provenance(split, tuned_model, tmp_path):
    """
    A metrics file that does not say which data produced it is a number with no
    claim attached -- and that matters now that a model can be trained on
    something other than UCI. See scripts/train_baseline.py --dataset.
    """
    _, X_test, _, y_test = split
    results = tabular_model.evaluate(tuned_model, X_test, y_test)
    provenance = {"datasets": ["uci"], "n_features": 24}

    path = tmp_path / "metrics.json"
    tabular_model.save_metrics("logistic_regression", results, path, provenance=provenance)
    loaded = tabular_model.load_metrics(path)

    assert loaded["provenance"] == provenance
    assert loaded["n_test"] == len(y_test)
    for metric, bounds in loaded["intervals"].items():
        assert bounds == list(results["intervals"][metric])


# ---------------------------------------------------------------------------
# Training history
# ---------------------------------------------------------------------------

def test_metrics_history_is_append_only(tmp_path):
    """
    "Did feeding the model more data help?" is only answerable if earlier runs
    survive later ones -- including the disappointing runs, which is why
    train_baseline.py logs rejected runs too.
    """
    path = tmp_path / "history.jsonl"
    assert tabular_model.load_metrics_history(path) == []

    tabular_model.append_metrics_history({"run": 1, "recall": 0.98}, path)
    tabular_model.append_metrics_history({"run": 2, "recall": 0.80, "saved": False}, path)
    history = tabular_model.load_metrics_history(path)

    assert [entry["run"] for entry in history] == [1, 2]
    assert history[1]["saved"] is False

