"""
Tests for batch scoring (scripts/predict.py).

The feature this file guards is external validation. Until predict.py existed
the only way to get a prediction was to answer 24 questions interactively, so
"train on UCI, test on St. Paul's" could not be run at all -- the ingestion layer
in src/data/datasets.py had nowhere to send a loaded frame. These tests therefore
concentrate on the properties that make a batch number trustworthy:

  - the same patient scores identically here and in a consultation
  - n_imputed counts what was actually filled in, so a nearly-empty row cannot
    present a confident-looking score with nothing to signal how little of it
    came from the patient
  - a wholly-absent feature column is refused rather than fabricated
  - the evaluation branch fires only when the input really carries labels

Everything runs against a model trained on real UCI rows at test time, in
tmp_path. No fixture data is committed, and no saved_models/ bundle is required
-- the tests build their own, so they pass on a clean checkout.
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import joblib
import pandas as pd
import pytest

import config
import scripts.predict as predict
from src.agent.chatbot import answers_to_feature_row
from src.data import datasets
from src.data.datasets import DatasetSpec
from src.data.load_tabular import fetch_uci_ckd
from src.data.preprocess import encode_tabular, prepare_tabular
from src.models.tabular_model import CANDIDATES, _to_binary_target


@pytest.fixture(scope="module")
def bundle():
    """A real trained (model, preprocessor) pair on the canonical feature set."""
    X_train, _, y_train, _, preprocessor = prepare_tabular(fetch_uci_ckd())
    model = CANDIDATES["logistic_regression"].fit(X_train, _to_binary_target(y_train))
    return model, preprocessor


@pytest.fixture(scope="module")
def patients():
    """
    Eight real UCI rows, four of each class, in raw (unencoded) form -- the shape
    a clinic CSV would arrive in.
    """
    raw = fetch_uci_ckd()
    label = raw[config.TARGET_COLUMN].astype(str).str.strip()
    return pd.concat([raw[label == "ckd"].head(4), raw[label == "notckd"].head(4)])


@pytest.fixture
def labelled_csv(patients, tmp_path):
    path = tmp_path / "patients.csv"
    patients.to_csv(path, index=False)
    return path


@pytest.fixture
def unlabelled_csv(patients, tmp_path):
    path = tmp_path / "unlabelled.csv"
    patients.drop(columns=[config.TARGET_COLUMN]).to_csv(path, index=False)
    return path


# ---------------------------------------------------------------------------
# score(): the columns, and what they mean
# ---------------------------------------------------------------------------

def test_score_appends_one_row_of_output_per_input_row(bundle, patients):
    model, preprocessor = bundle
    scored = predict.score(patients, model, preprocessor)

    assert len(scored) == len(patients)
    for column in predict.OUTPUT_COLUMNS:
        assert column in scored.columns
    # The input columns survive, so the output is the input plus a verdict --
    # a reviewer can see which patient each score belongs to.
    for column in patients.columns:
        assert column in scored.columns


def test_the_verdict_is_the_same_0_5_boundary_the_metrics_describe(bundle, patients):
    """
    prediction must be model.predict, not a re-derivation from p_ckd. If the two
    ever disagreed, the accuracy in MODEL_CARD.md would describe something other
    than the column a reader is looking at.
    """
    model, preprocessor = bundle
    scored = predict.score(patients, model, preprocessor)

    from src.data.preprocess import encoded_feature_frame
    features = preprocessor.transform(encoded_feature_frame(patients, preprocessor))
    expected = ["ckd" if p == 1 else "notckd" for p in model.predict(features)]
    assert list(scored["prediction"]) == expected


def test_the_band_agrees_with_the_probability_it_qualifies(bundle, patients):
    from src.models.tabular_model import risk_band

    model, preprocessor = bundle
    scored = predict.score(patients, model, preprocessor)
    for probability, band in zip(scored["p_ckd"], scored["risk_band"]):
        assert band == risk_band(probability)
        assert 0.0 <= probability <= 1.0


def test_a_batch_score_equals_the_interactive_score_for_the_same_patient(bundle, patients):
    """
    The cross-check the plan calls for, done in code rather than by hand: one row
    scored through predict.score must equal the same answers scored through the
    agent's own path. Two interfaces that disagree on one patient are two models
    as far as a user is concerned.
    """
    model, preprocessor = bundle
    scored = predict.score(patients, model, preprocessor)

    source = patients.iloc[0]
    answers = {}
    for column in preprocessor.numeric_columns:
        answers[column] = None if pd.isna(source[column]) else float(source[column])
    for column in preprocessor.binary_columns:
        value = str(source[column]).strip().lower()
        answers[column] = None if value in {"nan", "?", ""} else value

    row = answers_to_feature_row(answers, preprocessor)
    interactive_probability = float(model.predict_proba(row)[0][1])
    assert scored["p_ckd"].iloc[0] == pytest.approx(interactive_probability, abs=5e-5)


def test_n_imputed_counts_exactly_the_cells_that_had_no_usable_value(bundle, patients):
    """
    The column that keeps a nearly-empty row honest. It is the batch analogue of
    the agent's "you skipped N field(s)" note, and it must count blanks in the
    input rather than anything the imputer decided afterwards.
    """
    model, preprocessor = bundle
    frame = patients.copy().reset_index(drop=True)
    # Blank three cells in the second row and none in the first.
    blanked = ["sc", "hemo", "rbc"]
    frame.loc[1, blanked] = None

    scored = predict.score(frame, model, preprocessor)

    # The expected counts come from encode_tabular -- the TRAINING side's stage-1
    # encoder -- rather than from encoded_feature_frame, so this cross-checks the
    # two definitions of "no usable value" instead of comparing score() to itself.
    # The delta is computed rather than assumed at 3: rbc is ~38% missing in UCI,
    # so one of the cells blanked above may well have been blank already.
    encoded = encode_tabular(patients)[config.FEATURE_COLUMNS].reset_index(drop=True)
    already_blank = int(encoded.loc[1, blanked].isna().sum())
    assert scored["n_imputed"].iloc[0] == int(encoded.iloc[0].isna().sum())
    assert scored["n_imputed"].iloc[1] == (
        int(encoded.iloc[1].isna().sum()) + (len(blanked) - already_blank)
    )
    # Still a real prediction: blanks are imputed, not fatal.
    assert scored["prediction"].iloc[1] in {"ckd", "notckd"}


def test_an_entirely_blank_row_is_scored_and_flagged_rather_than_dropped(bundle, patients):
    """
    Refusing would lose the row silently; scoring it without saying so would
    present population medians as a patient's result. It is scored, and
    n_imputed says the score is about the training population.
    """
    model, preprocessor = bundle
    frame = patients.copy().reset_index(drop=True)
    frame.loc[0, config.FEATURE_COLUMNS] = None

    scored = predict.score(frame, model, preprocessor)
    assert scored["n_imputed"].iloc[0] == len(preprocessor.feature_columns)
    assert scored["prediction"].iloc[0] in {"ckd", "notckd"}


def test_n_imputed_is_correct_even_with_duplicate_index_labels(bundle, patients):
    """
    A real pandas footgun rather than a hypothetical: assigning a Series would
    realign on the index, and a CSV read with duplicate labels would then get
    NaN counts. predict.score uses .to_numpy() so the count stays positional.
    """
    model, preprocessor = bundle
    frame = patients.copy()
    frame.index = [0] * len(frame)

    scored = predict.score(frame, model, preprocessor)
    assert scored["n_imputed"].notna().all()
    assert scored["n_imputed"].dtype.kind in "iu"


def test_explain_adds_signed_drivers_and_is_off_by_default(bundle, patients):
    """
    The sign is the direction -- positive pushes toward ckd -- and dropping it
    would misstate the explanation the same way AUDIT.md P0-4 records. --explain
    is opt-in because it costs an explainer call per row.
    """
    model, preprocessor = bundle
    X_train, *_ = prepare_tabular(fetch_uci_ckd())

    plain = predict.score(patients.head(2), model, preprocessor)
    assert "top_drivers" not in plain.columns

    explained = predict.score(
        patients.head(2), model, preprocessor,
        explain=True, top_n=3, background=X_train,
    )
    for drivers in explained["top_drivers"]:
        parts = drivers.split("; ")
        assert len(parts) == 3
        for part in parts:
            name = part.split("(")[0]
            assert name in preprocessor.feature_columns
            assert ("+" in part) or ("-" in part)   # the sign is carried


# ---------------------------------------------------------------------------
# read_input(): canonical files, and foreign ones through a spec
# ---------------------------------------------------------------------------

def test_a_canonical_csv_loads_without_a_dataset_spec(labelled_csv):
    df, coverage = predict.read_input(labelled_csv, None)
    assert len(df) == 8
    assert coverage.n_present == len(config.FEATURE_COLUMNS)
    assert config.TARGET_COLUMN in df.columns


def test_an_unlabelled_csv_loads_because_scoring_data_has_no_labels(unlabelled_csv):
    df, _ = predict.read_input(unlabelled_csv, None)
    assert config.TARGET_COLUMN not in df.columns
    assert len(df) == 8


def test_a_foreign_csv_is_renamed_through_its_registered_spec(patients, tmp_path):
    """
    The reason --dataset exists: a clinic's own headers are mapped by the spec
    that already describes that clinic, rather than by renaming the file by hand
    or by a second copy of the mapping inside this script.
    """
    frame = pd.DataFrame({
        "Age_Years": patients["age"],
        "Serum_Creatinine": patients["sc"],
        "Hypertension": patients["htn"].astype(str).str.strip().str.capitalize(),
    })
    path = tmp_path / "clinic.csv"
    frame.to_csv(path, index=False)

    spec = DatasetSpec(
        name="clinic_fixture", filename=str(path),
        column_map={"Age_Years": "age", "Serum_Creatinine": "sc",
                    "Hypertension": "htn"},
    )
    datasets.register(spec)
    try:
        df, coverage = predict.read_input(path, "clinic_fixture")
    finally:
        datasets.unregister("clinic_fixture")

    assert list(df.columns) == ["age", "sc", "htn"]
    assert coverage.n_present == 3
    assert sorted(coverage.absent) == sorted(set(config.FEATURE_COLUMNS) - {"age", "sc", "htn"})


def test_read_input_requires_something_to_read():
    with pytest.raises(ValueError, match="either --input or --dataset"):
        predict.read_input(None, None)


# ---------------------------------------------------------------------------
# main(): the refusals, and the evaluation branch
# ---------------------------------------------------------------------------

@pytest.fixture
def saved_bundle(bundle, tmp_path, monkeypatch):
    """
    Write the fixture model to a temporary saved_models/ and point config at it,
    so main() can be exercised end to end without depending on whatever the
    developer last trained.
    """
    model, preprocessor = bundle
    directory = tmp_path / "saved_models"
    directory.mkdir()
    joblib.dump(model, directory / "tabular_model.joblib")
    joblib.dump(preprocessor, directory / "tabular_preprocessor.joblib")
    joblib.dump(
        prepare_tabular(fetch_uci_ckd())[0],
        directory / "shap_background.joblib",
    )
    monkeypatch.setattr(config, "SAVED_MODELS_DIR", directory)
    return directory


def test_main_scores_a_csv_and_writes_every_row(saved_bundle, labelled_csv, tmp_path, capsys):
    output = tmp_path / "scored.csv"
    scored = predict.main(["--input", str(labelled_csv), "--output", str(output)])

    assert scored is not None and len(scored) == 8
    written = pd.read_csv(output)
    assert len(written) == 8
    for column in predict.OUTPUT_COLUMNS:
        assert column in written.columns
    assert "Wrote 8 scored rows" in capsys.readouterr().out


def test_main_evaluates_when_the_input_carries_labels(saved_bundle, labelled_csv, capsys):
    """
    The highest-value half of this feature: with labels present, batch scoring
    becomes external validation, and it reuses tabular_model.evaluate unchanged
    so the numbers mean what the reported baseline numbers mean.
    """
    predict.main(["--input", str(labelled_csv)])
    output = capsys.readouterr().out

    assert "Evaluation against" in output
    for metric in ("accuracy", "recall", "specificity", "brier"):
        assert metric in output
    assert "95% CI" in output
    # The leakage caveat is printed every time, because a CSV cannot say whether
    # its rows were training rows.
    assert "held-out metrics ONLY if" in output


def test_main_does_not_invent_an_evaluation_without_labels(saved_bundle, unlabelled_csv, capsys):
    predict.main(["--input", str(unlabelled_csv)])
    output = capsys.readouterr().out
    assert "nothing to evaluate against -- predictions only" in output
    assert "Evaluation against" not in output
    # The scoring itself still happened; only the evaluation is withheld.
    assert "Scored 8 rows" in output


def test_main_refuses_a_csv_missing_a_feature_column_rather_than_fabricating_it(
    saved_bundle, patients, tmp_path, capsys
):
    """
    An entirely absent column would be filled with one identical value for every
    row -- a fabricated measurement, and the same argument datasets.py makes for
    refusing features='all' on a partial source. It must refuse, and name the
    columns and the fix.
    """
    path = tmp_path / "short.csv"
    patients.drop(columns=["sc", "hemo"]).to_csv(path, index=False)

    assert predict.main(["--input", str(path)]) is None
    output = capsys.readouterr().out
    assert "Refusing to score" in output
    assert "'sc'" in output and "'hemo'" in output
    assert "fabricated measurement" in output


def test_main_reports_a_missing_bundle_instead_of_crashing(labelled_csv, tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(config, "SAVED_MODELS_DIR", tmp_path / "empty")
    assert predict.main(["--input", str(labelled_csv)]) is None
    assert "train_baseline.py" in capsys.readouterr().out


def test_main_with_nothing_to_score_says_so(capsys):
    assert predict.main([]) is None
    assert "Nothing to score" in capsys.readouterr().out


def test_main_reports_a_missing_input_file_by_path(saved_bundle, tmp_path, capsys):
    missing = tmp_path / "no_such_file.csv"
    assert predict.main(["--input", str(missing)]) is None
    assert "no_such_file.csv" in capsys.readouterr().out


def test_the_summary_warns_about_rows_scored_mostly_from_medians(bundle, patients, capsys):
    """
    A row that is more imputed than observed describes the training population,
    and the summary says so rather than letting it disappear into an average.
    """
    model, preprocessor = bundle
    frame = patients.copy().reset_index(drop=True)
    frame.loc[0, config.FEATURE_COLUMNS[:20]] = None

    scored = predict.score(frame, model, preprocessor)
    predict.print_summary(scored, len(preprocessor.feature_columns))

    output = capsys.readouterr().out
    assert "WARNING" in output
    assert "over half their features imputed" in output
