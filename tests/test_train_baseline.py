"""
Tests for the training entry point's flags and safety gates
(scripts/train_baseline.py).

These matter because train_baseline.py is now the *update* path, not just the
initial-training path: "feed the model a new dataset" runs through here, so an
untested gate is how a model silently rots.

Every test that trains writes to an --out-suffix bundle, so none of them can
overwrite the model the agent actually loads. Training is genuinely slow
(compare_candidates + GridSearchCV), so the tests below are deliberately
arranged to invoke it three times in total rather than once per assertion.
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import joblib
import pandas as pd
import pytest

import config
from scripts import train_baseline
from src.data import datasets
from src.data.datasets import DatasetSpec
from src.models import tabular_model
from src.models.tabular_model import load_metrics, load_metrics_history

SUFFIX = "pytest_tmp"


@pytest.fixture
def clinic_spec(tmp_path):
    """
    A registered 10-of-24-feature dataset derived from real UCI rows at test
    time -- the same shape as tests/test_datasets.py's fixture, for the same
    reason: no fake clinical data is committed or implied.

    It exists to exercise the multi-dataset code path. Its *metrics* are
    meaningless (the rows are UCI rows), so nothing below asserts on them.
    """
    raw = pd.read_csv(config.DATA_RAW_DIR / "uci_ckd.csv")
    label = raw["class"].astype(str).str.strip()
    # Both classes, or the stratified split cannot run.
    mixed = pd.concat([raw[label == "ckd"].head(40), raw[label == "notckd"].head(40)])
    mixed_label = mixed["class"].astype(str).str.strip()

    def yesno(column):
        return mixed[column].astype(str).str.strip().str.capitalize()

    path = tmp_path / "clinic.csv"
    pd.DataFrame({
        "Age_Years": mixed["age"], "BloodPressure": mixed["bp"],
        "Albumin": mixed["al"], "Blood_Urea": mixed["bu"],
        "Serum_Creatinine": mixed["sc"], "Haemoglobin": mixed["hemo"],
        "Hypertension": yesno("htn"), "Diabetes": yesno("dm"),
        "PedalOedema": yesno("pe"), "Anaemia": yesno("ane"),
        "Diagnosis": (mixed_label == "ckd").astype(int),
    }).to_csv(path, index=False)

    datasets.register(DatasetSpec(
        name="clinic", filename=str(path),
        column_map={
            "Age_Years": "age", "BloodPressure": "bp", "Albumin": "al",
            "Blood_Urea": "bu", "Serum_Creatinine": "sc", "Haemoglobin": "hemo",
            "Hypertension": "htn", "Diabetes": "dm", "PedalOedema": "pe",
            "Anaemia": "ane", "Diagnosis": "class",
        },
        target_map={"1": "ckd", "0": "notckd"},
        license="derived from UCI at test time; not a real dataset",
    ))
    yield
    datasets.unregister("clinic")


@pytest.fixture(autouse=True)
def clean_artifacts():
    """Remove the test bundle before and after, so no assertion can pass on a
    file that an earlier run left behind."""
    def remove():
        for path in config.artifact_paths(SUFFIX).values():
            path.unlink(missing_ok=True)
    remove()
    yield
    remove()


@pytest.fixture
def isolated_history(monkeypatch, tmp_path):
    """Redirect the append-only log, so tests neither read nor pollute the real
    training history in saved_models/."""
    path = tmp_path / "history.jsonl"
    monkeypatch.setattr(config, "METRICS_HISTORY_PATH", path)
    return path


@pytest.fixture
def cheap_sweep(monkeypatch):
    """
    Narrow the candidate sweep to one model with a one-point grid.

    Unnarrowed, each main() call costs ~55s: 15 cross-validation fits to compare
    three candidates, then up to 30 more inside GridSearchCV. That is the model
    selection being tested directly in tests/test_tabular_model.py; what the
    tests below are about is the CLI around it -- the flags, the provenance
    record, and the save gate, none of which depend on which candidate wins.

    What this gives up is stated plainly: these tests do not check that
    random_forest is selected, or that the tuned hyperparameters are sensible.
    """
    monkeypatch.setattr(
        tabular_model, "CANDIDATES",
        {"logistic_regression": tabular_model.CANDIDATES["logistic_regression"]},
    )
    monkeypatch.setattr(tabular_model, "PARAM_GRIDS", {"logistic_regression": {"C": [1]}})


# ---------------------------------------------------------------------------
# Argument handling -- cheap, no training
# ---------------------------------------------------------------------------

def test_parse_args_defaults_to_uci_and_intersect():
    """The default invocation must stay exactly what it was before the flags
    existed -- the reported baseline numbers depend on it."""
    args = train_baseline.parse_args([])
    assert args.dataset == "uci"
    assert args.features == "intersect"
    assert args.out_suffix == ""
    assert args.force is False


def test_an_unknown_features_mode_is_rejected_by_the_parser():
    with pytest.raises(SystemExit):
        train_baseline.parse_args(["--features", "everything"])


def test_format_metric_includes_the_confidence_interval():
    results = {"recall": 1.0, "intervals": {"recall": (0.9286, 1.0)}}
    line = train_baseline.format_metric(results, "recall")
    assert "1.0000" in line
    assert "95% CI [0.9286, 1.0000]" in line


def test_format_metric_omits_the_interval_for_metrics_that_have_none():
    """f1 and auc_roc are not proportions of the kind wilson_interval covers,
    so their lines must print bare rather than borrowing another metric's band."""
    line = train_baseline.format_metric({"f1": 0.9804, "intervals": {}}, "f1")
    assert "0.9804" in line
    assert "CI" not in line


# ---------------------------------------------------------------------------
# Refusals -- also cheap, because refusing happens before training
# ---------------------------------------------------------------------------

def test_a_missing_dataset_file_is_reported_without_crashing():
    """The 'ethiopian' spec is registered but its CSV has not arrived. The CLI
    must say so and stop, not raise a traceback at the user."""
    assert train_baseline.main(["--dataset", "ethiopian"]) is None


def test_features_all_refuses_a_schema_mismatch_instead_of_training(clinic_spec):
    """The honesty guard reached through the CLI: nothing is trained or saved."""
    assert train_baseline.main(
        ["--dataset", "uci,clinic", "--features", "all", "--out-suffix", SUFFIX]
    ) is None
    assert not config.artifact_paths(SUFFIX)["model"].exists()


# ---------------------------------------------------------------------------
# The three tests that actually train
# ---------------------------------------------------------------------------

def test_combining_datasets_trains_on_shared_features_and_saves_a_whole_bundle(
    monkeypatch, clinic_spec, isolated_history, cheap_sweep
):
    """
    The end-to-end "feed the AI a new dataset" path. Asserts on the shape and
    provenance of what was produced, deliberately NOT on its accuracy -- the
    fixture's rows are UCI rows, so its metrics carry no information. The recall
    gate is lowered out of the way for the same reason: it has its own two tests
    below, and a gate trip here would fail this test for an unrelated reason.

    Also checks that --out-suffix isolation holds, since this run is already
    paid for: the default bundle the agent loads must be untouched.
    """
    monkeypatch.setattr(config, "MIN_ACCEPTABLE_RECALL", 0.0)
    default_model = config.artifact_paths("")["model"]
    before = default_model.stat().st_mtime if default_model.exists() else None

    outcome = train_baseline.main(["--dataset", "uci,clinic", "--out-suffix", SUFFIX])
    assert outcome is not None

    paths = config.artifact_paths(SUFFIX)
    for path in paths.values():
        assert path.exists(), path
    if before is not None:
        assert default_model.stat().st_mtime == before

    metrics = load_metrics(paths["metrics"])
    assert metrics["provenance"]["datasets"] == ["uci", "clinic"]
    assert metrics["provenance"]["n_rows"] == 480
    assert metrics["provenance"]["n_features"] == 10
    assert metrics["provenance"]["features_mode"] == "intersect"
    assert metrics["provenance"]["coverage"]["clinic"]["n_rows"] == 80
    assert "intervals" in metrics

    # The saved background must match the model's feature set, or the agent's
    # SHAP explanations would be computed against the wrong distribution.
    background = joblib.load(paths["shap_background"])
    preprocessor = joblib.load(paths["preprocessor"])
    assert list(background.columns) == preprocessor.feature_columns == \
        metrics["provenance"]["feature_columns"]

    # One line of valid JSONL, carrying the same provenance as the metrics file.
    logged = load_metrics_history(isolated_history)
    assert len(logged) == 1
    assert logged[0]["saved"] is True
    assert logged[0]["provenance"]["datasets"] == ["uci", "clinic"]


def test_the_recall_gate_refuses_to_save_and_still_logs_the_run(
    monkeypatch, isolated_history, cheap_sweep
):
    """
    The regression gate. Exercised by raising the bar above what any model can
    reach, rather than by contriving a bad model -- the gate's behaviour is what
    is under test, not the classifier's, and a deliberately-bad model would make
    the test's outcome depend on the fit.

    Two things must hold: the bundle is NOT written (so the model in use
    survives a bad retrain), and the run IS logged with saved=false (so a
    disappointing result leaves a trace instead of vanishing).
    """
    monkeypatch.setattr(config, "MIN_ACCEPTABLE_RECALL", 1.01)  # unreachable

    outcome = train_baseline.main(["--out-suffix", SUFFIX])
    assert outcome is not None  # it did train and evaluate

    assert not config.artifact_paths(SUFFIX)["model"].exists()
    assert not config.artifact_paths(SUFFIX)["metrics"].exists()

    logged = load_metrics_history(isolated_history)
    assert len(logged) == 1
    assert logged[0]["saved"] is False
    assert logged[0]["recall"] < 1.01


def test_force_overrides_the_recall_gate_and_records_that_it_did(
    monkeypatch, isolated_history, cheap_sweep
):
    """--force must stay available, but the history has to show it was used --
    otherwise a forced run is indistinguishable from a passing one later."""
    monkeypatch.setattr(config, "MIN_ACCEPTABLE_RECALL", 1.01)

    train_baseline.main(["--out-suffix", SUFFIX, "--force"])

    assert config.artifact_paths(SUFFIX)["model"].exists()
    logged = load_metrics_history(isolated_history)
    assert logged[0]["saved"] is True
    assert logged[0]["provenance"]["forced"] is True
