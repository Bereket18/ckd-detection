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


# ---------------------------------------------------------------------------
# Risk bands
#
# The agent now shows a probability, and these bands are how it is qualified.
# The boundaries are the whole content of the function, so they are pinned
# exactly -- including the two boundary values themselves, where an off-by-one
# comparison would put a patient in the wrong band and nothing else would notice.
# ---------------------------------------------------------------------------

def _band_just_above(value: float) -> str:
    """The band of the smallest float above `value` -- used to show the lower
    boundary is inclusive on the LOW side and nowhere else."""
    import math
    return tabular_model.risk_band(math.nextafter(value, 1.0))


def test_risk_band_partitions_zero_to_one_into_exactly_three_bands():
    low, high = config.RISK_BAND_BOUNDS
    assert tabular_model.risk_band(0.0) == "LOW"
    assert tabular_model.risk_band(low) == "LOW"            # inclusive lower edge
    assert _band_just_above(low) == "MODERATE"
    assert tabular_model.risk_band((low + high) / 2) == "MODERATE"
    assert tabular_model.risk_band(high) == "HIGH"          # inclusive upper edge
    assert tabular_model.risk_band(1.0) == "HIGH"


def test_risk_band_never_returns_anything_outside_the_three_labels():
    """Totality: every probability the model can produce lands in one band, so
    the agent and predict.py never have to handle a fourth case."""
    for step in range(0, 101):
        assert tabular_model.risk_band(step / 100) in {"LOW", "MODERATE", "HIGH"}


def test_risk_band_reads_the_config_bounds_rather_than_its_own_copy(monkeypatch):
    """
    The bounds must come from config, not from literals inside the function:
    the agent, scripts/predict.py and MODEL_CARD.md all describe the same bands,
    and a private copy here is the one-definition failure AUDIT.md P1-8 records.
    """
    monkeypatch.setattr(config, "RISK_BAND_BOUNDS", (0.10, 0.20))
    assert tabular_model.risk_band(0.15) == "MODERATE"
    assert tabular_model.risk_band(0.40) == "HIGH"      # HIGH under the new bounds
    assert tabular_model.risk_band(0.05) == "LOW"


def test_a_moderate_band_can_sit_on_either_side_of_the_verdict():
    """
    MODERATE means "near the decision boundary", not "predicted ckd weakly".
    A notckd verdict at P(CKD) = 0.42 is as close to flipping as a ckd verdict at
    0.58, and the patient is told so in both cases.
    """
    low, high = config.RISK_BAND_BOUNDS
    assert low < 0.5 < high
    assert tabular_model.risk_band(0.42) == "MODERATE"   # verdict would be notckd
    assert tabular_model.risk_band(0.58) == "MODERATE"   # verdict would be ckd


# ---------------------------------------------------------------------------
# Brier score
# ---------------------------------------------------------------------------

def test_brier_score_matches_a_hand_computed_value():
    """
    Checked against arithmetic done by hand rather than against the function's
    own output: mean of (0.9-1)^2, (0.2-0)^2, (0.6-1)^2, (0.3-0)^2
             = mean of 0.01, 0.04, 0.16, 0.09 = 0.30/4 = 0.075.
    """
    y_true = [1, 0, 1, 0]
    y_proba = [0.9, 0.2, 0.6, 0.3]
    assert tabular_model.brier_score(y_true, y_proba) == pytest.approx(0.075)


def test_brier_score_accepts_the_string_labels_the_pipeline_actually_carries():
    """
    y_test is 'ckd'/'notckd' strings everywhere in this project. Silently
    comparing those against 1 would score every patient as a negative and still
    return a plausible-looking number -- see _as_binary.
    """
    strings = ["ckd", "notckd", "ckd", "notckd"]
    numbers = [1, 0, 1, 0]
    proba = [0.9, 0.2, 0.6, 0.3]
    assert tabular_model.brier_score(strings, proba) == pytest.approx(
        tabular_model.brier_score(numbers, proba)
    )


def test_brier_score_of_a_perfect_and_of_a_useless_predictor():
    """The two reference points MODEL_CARD.md quotes, so the card's claim that
    0.25 is the no-information score is checked rather than asserted."""
    assert tabular_model.brier_score([1, 0, 1], [1.0, 0.0, 1.0]) == pytest.approx(0.0)
    assert tabular_model.brier_score([1, 0, 1, 0], [0.5] * 4) == pytest.approx(0.25)
    # Confidently wrong is the worst case, and it is worse than saying 0.5.
    assert tabular_model.brier_score([1, 0], [0.0, 1.0]) == pytest.approx(1.0)


def test_evaluate_reports_a_brier_score_better_than_no_information(split, tuned_model):
    _, X_test, _, y_test = split
    results = tabular_model.evaluate(tuned_model, X_test, y_test)
    assert 0.0 <= results["brier_score"] < 0.25


# ---------------------------------------------------------------------------
# Threshold sweep
#
# Reported, not used for selection -- see threshold_sweep's docstring. These
# tests pin the shape a reader relies on when reading the table, and the tie to
# evaluate()'s own numbers at the deployed operating point.
# ---------------------------------------------------------------------------

def test_threshold_sweep_covers_every_requested_threshold_in_order(split, tuned_model):
    _, X_test, _, y_test = split
    sweep = tabular_model.threshold_sweep(tuned_model, X_test, y_test)
    assert [row["threshold"] for row in sweep] == list(tabular_model.DEFAULT_THRESHOLDS)
    for row in sweep:
        assert set(row) == {
            "threshold", "recall", "specificity", "precision", "accuracy",
            "n_fn", "n_fp",
        }
        for rate in ("recall", "specificity", "precision", "accuracy"):
            assert 0.0 <= row[rate] <= 1.0


def test_raising_the_threshold_trades_recall_for_specificity(split, tuned_model):
    """
    The monotonicity that makes the table meaningful: a higher bar for calling
    CKD can only catch fewer CKD patients and can only clear more healthy ones.
    If this ever failed, the table would be arithmetic rather than a trade-off,
    and the "what would a different threshold cost?" reading of it would be wrong.
    """
    _, X_test, _, y_test = split
    sweep = tabular_model.threshold_sweep(tuned_model, X_test, y_test)

    recalls = [row["recall"] for row in sweep]
    specificities = [row["specificity"] for row in sweep]
    false_negatives = [row["n_fn"] for row in sweep]

    assert recalls == sorted(recalls, reverse=True)          # non-increasing
    assert specificities == sorted(specificities)            # non-decreasing
    assert false_negatives == sorted(false_negatives)        # non-decreasing


def test_the_deployed_row_of_the_sweep_matches_evaluate(split, tuned_model):
    """
    The 0.5 row must agree with the headline metrics, because 0.5 IS what
    model.predict does and what every reported figure describes. A sweep that
    disagreed there would mean the table and the card describe two different
    models.

    (A probability of exactly 0.5 would split these two -- `>= 0.5` here versus
    argmax in predict, which breaks the tie the other way. With this model on
    these rows it does not occur; a tie-prone model would show up as a failure
    here rather than silently.)
    """
    _, X_test, _, y_test = split
    results = tabular_model.evaluate(tuned_model, X_test, y_test)
    deployed = next(r for r in results["threshold_sweep"] if r["threshold"] == 0.5)
    (tn, fp), (fn, tp) = results["confusion_matrix"]

    assert deployed["recall"] == pytest.approx(results["recall"])
    assert deployed["specificity"] == pytest.approx(results["specificity"])
    assert deployed["precision"] == pytest.approx(results["precision"])
    assert deployed["accuracy"] == pytest.approx(results["accuracy"])
    assert (deployed["n_fn"], deployed["n_fp"]) == (fn, fp)


def test_an_extreme_threshold_does_not_crash_on_a_one_class_prediction(split, tuned_model):
    """
    At a threshold near 1.0 the model may predict no positives at all, which
    makes sklearn's confusion_matrix return a 1x1 unless labels are pinned -- an
    unpacking error at the far end of the table rather than a row. labels=[0, 1]
    is why this passes.

    The 0.0 row is asserted exactly (every probability is >= 0.0, so everyone is
    called CKD); the 1.0 row is asserted only relative to it, because whether a
    saturated probability of exactly 1.0 occurs is a floating-point detail of the
    fitted model and not a property worth pinning.
    """
    _, X_test, _, y_test = split
    at_zero, at_one = tabular_model.threshold_sweep(
        tuned_model, X_test, y_test, thresholds=(0.0, 1.0)
    )
    # Threshold 0.0 calls everyone CKD: perfect recall, zero specificity.
    assert at_zero["recall"] == 1.0
    assert at_zero["specificity"] == 0.0
    assert at_zero["n_fn"] == 0
    # Threshold 1.0 is the other end of the same trade-off, and still a row.
    assert at_one["recall"] <= at_zero["recall"]
    assert at_one["specificity"] >= at_zero["specificity"]
    assert at_one["n_fp"] <= at_zero["n_fp"]


def test_saved_metrics_carry_the_brier_score_and_the_sweep(split, tuned_model, tmp_path):
    """
    scripts/make_model_card.py reads both out of the JSON, so a run that
    computed them and did not persist them would produce a card that says the
    fields are absent -- which is exactly what an older metrics file does.
    """
    _, X_test, _, y_test = split
    results = tabular_model.evaluate(tuned_model, X_test, y_test)

    path = tmp_path / "metrics.json"
    tabular_model.save_metrics("logistic_regression", results, path)
    loaded = tabular_model.load_metrics(path)

    assert loaded["brier_score"] == pytest.approx(results["brier_score"])
    assert len(loaded["threshold_sweep"]) == len(tabular_model.DEFAULT_THRESHOLDS)
    assert loaded["threshold_sweep"][0]["threshold"] == pytest.approx(0.1)

