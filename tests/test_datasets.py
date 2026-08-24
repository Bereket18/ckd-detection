"""
Tests for the dataset-ingestion layer (src/data/datasets.py).

The point of these tests is to prove the ingestion path works on a dataset that
is NOT the UCI file it was built around -- otherwise "the pipeline accepts new
datasets" is an untested claim, which is what it was before.

No fake Ethiopian data is committed or implied. The fixture below derives a
deliberately awkward CSV from the real UCI file at test time, in tmp_path:
  - 10 of the 24 canonical features, so the schema is genuinely incomplete
  - renamed headers ("sc" -> "Serum_Creatinine"), so column_map is exercised
  - "Yes"/"No" binaries, so the vocabulary path is exercised
  - a 1/0 target, so target_map is exercised
  - both classes present, so a stratified split is possible
That is the realistic shape of a hospital extract, and it is the shape the
St. Paul's dataset is described as having (19 features, not 24).
"""

import sys
import warnings
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import pandas as pd
import pytest

import config
from src.data import datasets
from src.data.datasets import (
    DatasetSpec, SchemaMismatchError, combine_datasets, load_dataset,
    shared_features,
)
from src.data.load_tabular import fetch_ethiopian_ckd
from src.data.preprocess import prepare_tabular
from src.models.tabular_model import evaluate, tune_model

# The 10 canonical features the fixture provides, in canonical order.
FIXTURE_NUMERIC = ["age", "bp", "al", "bu", "sc", "hemo"]
FIXTURE_BINARY = ["htn", "dm", "pe", "ane"]
FIXTURE_FEATURES = FIXTURE_NUMERIC + FIXTURE_BINARY

COLUMN_MAP = {
    "Age_Years": "age", "BloodPressure": "bp", "Albumin": "al",
    "Blood_Urea": "bu", "Serum_Creatinine": "sc", "Haemoglobin": "hemo",
    "Hypertension": "htn", "Diabetes": "dm", "PedalOedema": "pe",
    "Anaemia": "ane", "Diagnosis": "class",
}


@pytest.fixture
def awkward_csv(tmp_path):
    """A reduced, renamed, differently-encoded CSV derived from real UCI rows."""
    raw = pd.read_csv(config.DATA_RAW_DIR / "uci_ckd.csv")
    label = raw["class"].astype(str).str.strip()
    # Both classes, or the stratified split downstream cannot run. The UCI file
    # is ordered ckd-first, so a plain head() would be single-class.
    mixed = pd.concat([raw[label == "ckd"].head(40), raw[label == "notckd"].head(40)])
    mixed_label = mixed["class"].astype(str).str.strip()

    def yesno(column):
        return mixed[column].astype(str).str.strip().str.capitalize()

    frame = pd.DataFrame({
        "Age_Years": mixed["age"], "BloodPressure": mixed["bp"],
        "Albumin": mixed["al"], "Blood_Urea": mixed["bu"],
        "Serum_Creatinine": mixed["sc"], "Haemoglobin": mixed["hemo"],
        "Hypertension": yesno("htn"), "Diabetes": yesno("dm"),
        "PedalOedema": yesno("pe"), "Anaemia": yesno("ane"),
        "Diagnosis": (mixed_label == "ckd").astype(int),
    })
    path = tmp_path / "awkward_ckd.csv"
    frame.to_csv(path, index=False)
    return path


@pytest.fixture
def awkward_spec(awkward_csv):
    """Registers the fixture dataset, and removes it again so no test leaks state."""
    spec = DatasetSpec(
        name="awkward",
        filename=str(awkward_csv),
        column_map=COLUMN_MAP,
        target_map={"1": "ckd", "0": "notckd"},
        citation="derived from UCI at test time; not a real dataset",
    )
    datasets.register(spec)
    yield spec
    datasets.unregister("awkward")


# ---------------------------------------------------------------------------
# The canonical dataset still loads through the new path
# ---------------------------------------------------------------------------

def test_uci_loads_with_full_canonical_coverage():
    """The registry must reproduce the contract the rest of the project relies on."""
    df, coverage = load_dataset("uci")
    assert coverage.n_rows == 400
    assert coverage.absent == []
    assert coverage.numeric_present == config.NUMERIC_COLUMNS
    assert coverage.binary_present == config.BINARY_COLUMNS
    # The stray-tab values in the raw CSV are cleaned, not passed through.
    assert set(df[config.TARGET_COLUMN].unique()) == {"ckd", "notckd"}
    # pcv/wc/rc carry "\t?" and "\t43" artifacts; they must arrive numeric.
    for column in ("pcv", "wc", "rc"):
        assert pd.api.types.is_numeric_dtype(df[column])


def test_unknown_dataset_name_is_rejected_with_the_registered_names():
    with pytest.raises(KeyError, match="Unknown dataset"):
        load_dataset("no_such_dataset")


# ---------------------------------------------------------------------------
# A foreign schema loads correctly
# ---------------------------------------------------------------------------

def test_awkward_csv_is_renamed_to_canonical_columns(awkward_spec):
    df, coverage = load_dataset("awkward")
    assert coverage.numeric_present == FIXTURE_NUMERIC
    assert coverage.binary_present == FIXTURE_BINARY
    # None of the source's own header names survive.
    assert not set(COLUMN_MAP).intersection(df.columns)


def test_coverage_names_the_absent_features_rather_than_inventing_them(awkward_spec):
    """
    The 14 canonical features this source lacks must be reported as absent and
    NOT silently created as empty columns -- a fabricated all-NaN column is
    indistinguishable from a real one further down the pipeline.
    """
    df, coverage = load_dataset("awkward")
    assert coverage.n_present == 10
    assert sorted(coverage.absent) == sorted(
        set(config.FEATURE_COLUMNS) - set(FIXTURE_FEATURES)
    )
    for column in coverage.absent:
        assert column not in df.columns


def test_numeric_target_is_mapped_to_the_canonical_labels(awkward_spec):
    df, _ = load_dataset("awkward")
    assert set(df[config.TARGET_COLUMN].unique()) == {"ckd", "notckd"}


def test_an_unmapped_target_value_raises_instead_of_becoming_nan(tmp_path):
    """
    A row whose label cannot be resolved is not training data. Silently dropping
    or imputing it would change the class balance without saying so.
    """
    path = tmp_path / "bad_target.csv"
    pd.DataFrame({"age": [50, 60], "Diagnosis": ["Stage 3", "Healthy"]}).to_csv(
        path, index=False
    )
    spec = DatasetSpec(
        name="bad_target", filename=str(path),
        column_map={"Diagnosis": "class"}, target_map={"Healthy": "notckd"},
    )
    with pytest.raises(SchemaMismatchError, match="target column"):
        load_dataset(spec)


def test_a_value_outside_the_value_map_raises_instead_of_becoming_nan(tmp_path):
    """
    A binary field that quietly turns to NaN gets filled with the population
    mode, fabricating a clinical observation -- the same failure AUDIT.md P1-8
    fixed in the agent. Loading must refuse rather than impute silently.
    """
    path = tmp_path / "bad_value.csv"
    pd.DataFrame({
        "Hypertension": ["1", "0", "MAYBE"],
        "class": ["ckd", "notckd", "ckd"],
    }).to_csv(path, index=False)
    spec = DatasetSpec(
        name="bad_value", filename=str(path),
        column_map={"Hypertension": "htn"},
        value_map={"htn": {"1": "yes", "0": "no"}},
    )
    with pytest.raises(ValueError, match="value_map does not cover"):
        load_dataset(spec)


def test_a_value_map_targeting_an_unknown_vocabulary_raises(tmp_path):
    """
    A value_map that produces something encode_binary_column() does not
    understand would turn the whole column to NaN later, far from the cause.
    Catch it at load time.
    """
    path = tmp_path / "bad_vocab.csv"
    pd.DataFrame({"Hypertension": ["1"], "class": ["ckd"]}).to_csv(path, index=False)
    spec = DatasetSpec(
        name="bad_vocab", filename=str(path),
        column_map={"Hypertension": "htn"},
        value_map={"htn": {"1": "affirmative"}},
    )
    with pytest.raises(ValueError, match="does not understand"):
        load_dataset(spec)


def test_a_missing_file_names_the_expected_path(tmp_path):
    spec = DatasetSpec(name="absent", filename=str(tmp_path / "nope.csv"))
    with pytest.raises(FileNotFoundError, match="nope.csv"):
        load_dataset(spec)


def test_fetch_ethiopian_ckd_reports_a_missing_file_not_a_missing_feature():
    """
    This used to raise NotImplementedError, which said "nobody wrote this".
    The mapping now exists; only the data is missing, and the error must say so
    -- naming the path someone can drop the file at.
    """
    with pytest.raises(FileNotFoundError, match="ethiopian_ckd.csv"):
        fetch_ethiopian_ckd()


# ---------------------------------------------------------------------------
# Combining datasets
# ---------------------------------------------------------------------------

def test_shared_features_is_the_intersection_in_canonical_order(awkward_spec):
    numeric, binary = shared_features(["uci", "awkward"])
    assert numeric == FIXTURE_NUMERIC
    assert binary == FIXTURE_BINARY
    # Canonical order, not the order the datasets happened to list them in.
    assert numeric == [c for c in config.NUMERIC_COLUMNS if c in numeric]


def test_shared_features_does_not_depend_on_argument_order(awkward_spec):
    assert shared_features(["uci", "awkward"]) == shared_features(["awkward", "uci"])


def test_combine_intersect_keeps_every_row_and_only_shared_columns(awkward_spec):
    df, numeric, binary, coverages = combine_datasets(["uci", "awkward"])
    assert len(df) == 400 + 80
    assert numeric + binary == FIXTURE_FEATURES
    assert set(df.columns) == set(FIXTURE_FEATURES + [config.TARGET_COLUMN, "source"])
    assert dict(df["source"].value_counts()) == {"uci": 400, "awkward": 80}
    assert [c.dataset for c in coverages] == ["uci", "awkward"]


def test_combine_all_refuses_a_schema_mismatch(awkward_spec):
    """
    The core honesty guard. Imputing a wholly-absent column gives every row from
    that source the same fabricated value, which the model can use to identify
    the dataset rather than the patient. AUDIT.md Part V calls this
    indefensible for a reported result, so it is an error, not a footnote.
    """
    with pytest.raises(SchemaMismatchError, match="features='intersect'"):
        combine_datasets(["uci", "awkward"], features="all")


def test_combine_all_with_force_warns_loudly_and_proceeds(awkward_spec):
    """--force must remain possible, but never quiet."""
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        df, numeric, binary, _ = combine_datasets(
            ["uci", "awkward"], features="all", force=True
        )
    assert len(caught) == 1
    assert issubclass(caught[0].category, UserWarning)
    assert "imputed wholesale" in str(caught[0].message)
    assert numeric + binary == config.FEATURE_COLUMNS
    # The absent columns exist but are entirely empty for the awkward rows,
    # which is exactly what the warning is about.
    assert df.loc[df["source"] == "awkward", "sg"].isna().all()


def test_combine_all_is_fine_when_every_dataset_has_the_full_schema():
    df, numeric, binary, _ = combine_datasets(["uci"], features="all")
    assert numeric + binary == config.FEATURE_COLUMNS
    assert len(df) == 400


def test_combine_rejects_an_unknown_features_mode(awkward_spec):
    with pytest.raises(ValueError, match="intersect"):
        combine_datasets(["uci"], features="everything")


def test_combine_rejects_an_empty_dataset_list():
    with pytest.raises(ValueError, match="at least one"):
        combine_datasets([])


def test_datasets_with_no_shared_features_are_refused(tmp_path):
    """Two sources that overlap in nothing produce no trainable frame, and the
    error should say that rather than handing back an empty feature list."""
    sod_path = tmp_path / "sod_only.csv"
    pd.DataFrame({"Sodium": [140, 141], "class": ["ckd", "notckd"]}).to_csv(
        sod_path, index=False
    )
    age_path = tmp_path / "age_only.csv"
    pd.DataFrame({"Age": [50, 60], "class": ["ckd", "notckd"]}).to_csv(
        age_path, index=False
    )
    sod_only = DatasetSpec(name="sod_only", filename=str(sod_path),
                           column_map={"Sodium": "sod"})
    age_only = DatasetSpec(name="age_only", filename=str(age_path),
                           column_map={"Age": "age"})
    datasets.register(sod_only)
    datasets.register(age_only)
    try:
        with pytest.raises(SchemaMismatchError, match="share no canonical features"):
            combine_datasets(["sod_only", "age_only"])
    finally:
        datasets.unregister("sod_only")
        datasets.unregister("age_only")


# ---------------------------------------------------------------------------
# The reduced feature set actually trains and predicts
# ---------------------------------------------------------------------------

def test_a_reduced_feature_set_trains_end_to_end(awkward_spec):
    """
    The claim being tested is the whole point of this layer: a combined dataset
    with a 10-feature intersection goes through the existing, unmodified
    prepare_tabular -> tune -> evaluate path and produces a usable model.
    """
    df, numeric, binary, _ = combine_datasets(["uci", "awkward"])
    X_train, X_test, y_train, y_test, preprocessor = prepare_tabular(
        df, numeric_columns=numeric, binary_columns=binary
    )

    assert list(X_train.columns) == FIXTURE_FEATURES
    assert preprocessor.feature_columns == FIXTURE_FEATURES
    # The preprocessor must still eliminate every NaN, on the reduced set too.
    assert X_train.isna().sum().sum() == 0
    assert X_test.isna().sum().sum() == 0

    model, _ = tune_model("logistic_regression", X_train, y_train)
    results = evaluate(model, X_test, y_test)
    assert 0.0 <= results["accuracy"] <= 1.0
    assert results["n_test"] == len(X_test)


def test_the_saved_preprocessor_is_self_describing(awkward_spec):
    """
    src/agent/chatbot.py reads the question list off the preprocessor, so the
    preprocessor carrying its own column list is what makes a reduced-feature
    model usable through the agent at all.
    """
    df, numeric, binary, _ = combine_datasets(["uci", "awkward"])
    *_, preprocessor = prepare_tabular(
        df, numeric_columns=numeric, binary_columns=binary
    )
    assert preprocessor.numeric_columns == FIXTURE_NUMERIC
    assert preprocessor.binary_columns == FIXTURE_BINARY
    assert preprocessor.feature_columns == FIXTURE_FEATURES
    # Every reduced feature still has prompt text, so no new copy is needed.
    for field in preprocessor.feature_columns:
        assert field in config.FEATURE_PROMPTS
