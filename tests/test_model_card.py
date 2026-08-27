"""
Tests for the generated model card (scripts/make_model_card.py).

The card is the one document in this project that gets quoted, so the property
worth testing is not that it renders -- it is that it CANNOT go stale. AUDIT.md
P1-1 records the failure being guarded against: the baseline accuracy was typed
into three files by hand and all three became false the moment the pipeline
changed. So the tests below check, in order of importance:

  - every figure in the card comes from the metrics file, and changes when the
    metrics file changes
  - a metrics file that lacks a field renders "not in this metrics file" and the
    command that produces it, never a plausible-looking substitute
  - --check exits 1 on a stale card, which is what makes the guard enforceable
    rather than advisory
  - the non-negotiable caveats (not a diagnosis, not a calibrated probability,
    the sweep is reported not selected) are present in every card

Everything runs against a synthetic metrics file in tmp_path with
config.SAVED_MODELS_DIR and config.MODEL_CARD_PATH redirected there, so the
suite neither reads nor overwrites whatever the developer last trained.
"""

import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import pytest

import config
import scripts.make_model_card as make_model_card
from src.data.datasets import get_spec

# A complete, realistic metrics payload -- the shape save_metrics() writes.
# The values are the ones the current baseline happens to produce, but nothing
# here reads them from disk: the point is that the card follows this dict.
METRICS = {
    "model": "random_forest",
    "accuracy": 0.975,
    "precision": 0.9615384615384616,
    "recall": 1.0,
    "f1": 0.9803921568627451,
    "auc_roc": 0.9993333333333333,
    "specificity": 0.9333333333333333,
    "brier_score": 0.0221,
    "confusion_matrix": [[28, 2], [0, 50]],
    "intervals": {
        "accuracy": [0.9134, 0.9931],
        "precision": [0.8702, 0.9894],
        "recall": [0.9285, 1.0],
        "specificity": [0.7822, 0.9819],
    },
    "threshold_sweep": [
        {"threshold": t, "recall": r, "specificity": s, "precision": p,
         "accuracy": a, "n_fn": fn, "n_fp": fp}
        for t, r, s, p, a, fn, fp in [
            (0.1, 1.0, 0.8000, 0.8929, 0.9250, 0, 6),
            (0.3, 1.0, 0.9000, 0.9434, 0.9625, 0, 3),
            (0.5, 1.0, 0.9333, 0.9615, 0.9750, 0, 2),
            (0.7, 0.9800, 0.9667, 0.9800, 0.9750, 1, 1),
            (0.9, 0.9400, 1.0000, 1.0000, 0.9625, 3, 0),
        ]
    ],
    "n_test": 80,
    "provenance": {
        "datasets": ["uci"],
        "features_mode": "intersect",
        "forced": False,
        "n_rows": 400,
        "n_train": 320,
        "n_features": 24,
        "feature_columns": list(config.FEATURE_COLUMNS),
        "coverage": {"uci": {"n_rows": 400, "absent": []}},
    },
}

# The measured figures, formatted exactly as the card formats them.
MEASURED = [f"{METRICS[name]:.4f}" for name in
            ("accuracy", "precision", "recall", "specificity", "f1", "auc_roc",
             "brier_score")]


@pytest.fixture
def card_env(tmp_path, monkeypatch):
    """
    A metrics file in tmp_path, with config pointed at it.

    Returns (metrics_path, card_path). Redirecting SAVED_MODELS_DIR rather than
    writing into the repo's saved_models/ is deliberate: these tests must pass on
    a clean checkout and must never overwrite the committed card.
    """
    saved = tmp_path / "saved_models"
    saved.mkdir()
    metrics_path = saved / "tabular_metrics.json"
    metrics_path.write_text(json.dumps(METRICS, indent=2), encoding="utf-8")

    card_path = tmp_path / "MODEL_CARD.md"
    monkeypatch.setattr(config, "SAVED_MODELS_DIR", saved)
    monkeypatch.setattr(config, "MODEL_CARD_PATH", card_path)
    return metrics_path, card_path


@pytest.fixture
def card(card_env):
    metrics_path, _ = card_env
    return make_model_card.build_card(METRICS, metrics_path)


# ---------------------------------------------------------------------------
# The anti-staleness property: every figure comes from the metrics file
# ---------------------------------------------------------------------------

def test_every_measured_figure_in_the_card_is_the_metrics_files_figure(card):
    """
    The headline guard, and the reason this script exists at all. Each rate is
    rendered at 4 decimal places from the loaded dict -- so the card and
    tabular_metrics.json cannot disagree without one of them being edited by hand.
    """
    for value in MEASURED:
        assert value in card, f"{value} missing from the card"
    assert f"| accuracy | {METRICS['accuracy']:.4f} |" in card
    assert METRICS["model"] in card
    assert str(METRICS["n_test"]) in card


def test_changing_the_metrics_file_changes_the_card(card_env, card):
    """
    Stated as the property rather than as a rendering check: the card TRACKS the
    file. Move accuracy in the metrics and the accuracy row moves with it, with no
    stale copy left behind.

    Asserted on the performance row specifically, not on the whole card: 0.9750 is
    also the accuracy of two threshold-sweep rows, and those legitimately do not
    change when the top-level figure does. An assertion that the string vanishes
    from the entire document would be testing something untrue.
    """
    metrics_path, _ = card_env
    worse = {**METRICS, "accuracy": 0.5}
    regenerated = make_model_card.build_card(worse, metrics_path)

    assert "| accuracy | 0.9750 |" in card
    assert "| accuracy | 0.9750 |" not in regenerated
    assert "| accuracy | 0.5000 |" in regenerated


def test_no_measured_figure_is_typed_into_the_prose_constants(card_env):
    """
    The prose IS written by hand -- intended use, limitations, the calibration
    argument -- so the rule that keeps the card honest is that the prose contains
    no measured number. This checks the rule rather than trusting it.

    (The calibration note does contain 0.80 and 0.2500 as illustrations of what a
    score means; those are constants of the argument, not measurements of this
    model, and neither is a value in the metrics file.)
    """
    prose = "".join([
        make_model_card.INTENDED_USE,
        make_model_card.OUT_OF_SCOPE_USE,
        make_model_card.CALIBRATION_NOTE,
        make_model_card.THRESHOLD_NOTE,
        make_model_card.LIMITATIONS,
    ])
    for value in MEASURED:
        assert value not in prose, f"{value} was typed into the card's prose"


def test_the_card_declares_itself_generated_and_names_its_command(card):
    """A hand edit must look wrong at the top of the file, and the reader must be
    told how to regenerate rather than left to guess."""
    assert "GENERATED FILE -- DO NOT EDIT BY HAND" in card
    assert "python scripts/make_model_card.py" in card
    assert "tabular_metrics.json" in card


# ---------------------------------------------------------------------------
# Sections: intervals, confusion matrix, threshold table, provenance
# ---------------------------------------------------------------------------

def test_each_rate_is_printed_beside_its_own_interval(card):
    low, high = METRICS["intervals"]["recall"]
    assert f"| recall | 1.0000 | [{low:.4f}, {high:.4f}] |" in card


def test_f1_and_auc_get_a_blank_interval_rather_than_a_borrowed_one(card):
    """
    Neither is a proportion wilson_interval() covers, and reusing another
    metric's band for them would put a fabricated number in the one document
    that must not contain one.
    """
    assert f"| f1 | {METRICS['f1']:.4f} | -- |" in card
    assert f"| auc_roc | {METRICS['auc_roc']:.4f} | -- |" in card


def test_format_interval_reports_absence_instead_of_inventing_bounds():
    assert make_model_card.format_interval(METRICS["intervals"], "recall") == "[0.9285, 1.0000]"
    assert make_model_card.format_interval(METRICS["intervals"], "f1") == "--"
    assert make_model_card.format_interval({}, "accuracy") == "--"
    assert make_model_card.format_interval(None, "accuracy") == "--"


def test_the_confusion_matrix_labels_which_cell_is_which(card):
    """
    TN/FP/FN/TP order is what readers most often get backwards, and for a
    screening tool the FN cell is the one that matters -- so it is spelled out
    and restated in words.
    """
    (tn, fp), (fn, tp) = METRICS["confusion_matrix"]
    assert f"| **actual notckd** | {tn} (TN) | {fp} (FP) |" in card
    assert f"| **actual ckd** | {fn} (FN) | {tp} (TP) |" in card
    assert f"{fn} of the {fn + tp} CKD patients in the test set were missed" in card


def test_the_threshold_table_carries_every_swept_row_and_marks_the_deployed_one(card):
    """
    0.5 must be identifiable, because it is the only row the Performance section
    above describes. The rest are context.
    """
    for row in METRICS["threshold_sweep"]:
        assert f"| {row['threshold']:.2f}" in card
    assert "| 0.50 **(deployed)** |" in card
    assert card.count("**(deployed)**") == 1
    # The FN count is in the table, not just the rate: at 80 rows "recall 0.94"
    # is three missed patients, and the table says three.
    assert "| 0.9400 | 1.0000 | 1.0000 | 0.9625 | 3 | 0 |" in card


def test_the_sweep_is_labelled_reported_rather_than_used_for_selection(card):
    """
    Selecting an operating point from a table measured on the test set is the
    P0-3 leakage error from a different direction. The card has to say so, or a
    reader will reasonably assume the best row was chosen.
    """
    assert "reported, not used for selection" in card
    assert "The deployed threshold is therefore 0.5" in card


def test_provenance_says_what_the_model_was_trained_on(card):
    provenance = METRICS["provenance"]
    assert f"{provenance['n_rows']} total" in card
    assert f"{provenance['n_train']} used for training" in card
    assert f"{METRICS['n_test']} held out" in card
    assert f"**Features:** {provenance['n_features']}" in card
    assert "`intersect`" in card


def test_the_citation_comes_from_the_dataset_registry_not_a_retyped_copy(card):
    """Same argument as the metrics: one definition, read rather than pasted."""
    spec = get_spec("uci")
    assert spec.citation in card
    assert spec.license in card


def test_a_forced_run_is_flagged_in_the_card(card_env):
    """
    --force overrides the recall gate or the refusal to impute absent columns.
    Every figure downstream has to be read with that in mind, so it cannot be a
    detail only the training log remembers.
    """
    metrics_path, _ = card_env
    forced = {**METRICS, "provenance": {**METRICS["provenance"], "forced": True}}
    assert "WARNING: this run used `--force`" in make_model_card.build_card(forced, metrics_path)
    # And absent when nothing was overridden, so the warning means something.
    assert "WARNING: this run used" not in make_model_card.build_card(METRICS, metrics_path)


# ---------------------------------------------------------------------------
# Honest degradation: an older metrics file
# ---------------------------------------------------------------------------

def test_a_metrics_file_without_a_brier_score_says_so(card_env):
    metrics_path, _ = card_env
    older = {k: v for k, v in METRICS.items() if k != "brier_score"}
    card = make_model_card.build_card(older, metrics_path)
    assert "| brier | not in this metrics file | -- |" in card


def test_a_metrics_file_without_a_sweep_names_the_command_that_produces_one(card_env):
    """
    Not a blank section and not a substitute table: the absence is stated and the
    fix is named. A plausible-looking table with no run behind it is the exact
    thing this script exists to prevent.
    """
    metrics_path, _ = card_env
    older = {k: v for k, v in METRICS.items() if k != "threshold_sweep"}
    card = make_model_card.build_card(older, metrics_path)
    assert "predates the threshold sweep" in card
    assert "python scripts/train_baseline.py" in card
    assert "**(deployed)**" not in card


def test_a_metrics_file_without_provenance_or_a_matrix_degrades_in_words(card_env):
    metrics_path, _ = card_env
    bare = {k: v for k, v in METRICS.items()
            if k not in ("provenance", "confusion_matrix")}
    card = make_model_card.build_card(bare, metrics_path)
    assert "carries no provenance record" in card
    assert "No confusion matrix in the metrics file" in card
    # The measured rates it DOES have are still reported -- degrading one section
    # must not blank the rest.
    assert f"| accuracy | {METRICS['accuracy']:.4f} |" in card


# ---------------------------------------------------------------------------
# The caveats that must survive every regeneration
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("caveat", [
    "Not a diagnosis",
    "Not validated on Ethiopian patients",
    "It is a confidence score, not a calibrated probability",
    "A reliability diagram is **not** reported",
    "Brier conflates calibration with discrimination",
    "Missing values are imputed with population medians",
    "were not re-verified after the leakage fix",
])
def test_the_card_keeps_its_non_negotiable_caveats(card, caveat):
    """
    These are the sentences that make the numbers above them safe to read. A
    regeneration that dropped one would leave a card that looks the same and
    claims more than the project can support.
    """
    assert caveat in card


def test_the_card_explains_why_the_model_was_not_calibrated(card):
    """
    The decision was deliberate (it would change the saved model and the gated
    recall), so the card records the reasoning rather than only the consequence
    -- otherwise the omission reads as an oversight.
    """
    assert "CalibratedClassifierCV" in card
    assert "config.MIN_ACCEPTABLE_RECALL" in card


# ---------------------------------------------------------------------------
# main(): writing, and the --check staleness gate
# ---------------------------------------------------------------------------

def test_main_writes_the_card_it_returns(card_env, capsys):
    _, card_path = card_env
    written = make_model_card.main([])

    assert card_path.read_text(encoding="utf-8") == written
    output = capsys.readouterr().out
    assert "Wrote" in output
    assert "random_forest" in output and "80 test rows" in output


def test_main_honours_an_explicit_output_path(card_env, tmp_path):
    _, default_path = card_env
    elsewhere = tmp_path / "CARD_elsewhere.md"
    make_model_card.main(["--output", str(elsewhere)])

    assert elsewhere.exists()
    assert not default_path.exists()


def test_main_reports_a_missing_metrics_file_instead_of_writing_an_empty_card(
    tmp_path, monkeypatch, capsys
):
    monkeypatch.setattr(config, "SAVED_MODELS_DIR", tmp_path / "nothing_here")
    monkeypatch.setattr(config, "MODEL_CARD_PATH", tmp_path / "MODEL_CARD.md")

    assert make_model_card.main([]) is None
    assert "train_baseline.py" in capsys.readouterr().out
    assert not (tmp_path / "MODEL_CARD.md").exists()


def test_check_passes_on_a_card_that_matches_the_metrics(card_env, capsys):
    make_model_card.main([])
    assert make_model_card.main(["--check"]) is not None
    assert "up to date" in capsys.readouterr().out


def test_check_exits_nonzero_on_a_stale_card(card_env, capsys):
    """
    What makes the guard enforceable: a hand-edited or out-of-date card fails
    rather than being quietly regenerated. This is the invocation CI can run.
    """
    _, card_path = card_env
    make_model_card.main([])
    card_path.write_text(
        card_path.read_text(encoding="utf-8").replace("0.9750", "0.9990"),
        encoding="utf-8",
    )

    with pytest.raises(SystemExit) as exit_info:
        make_model_card.main(["--check"])
    assert exit_info.value.code == 1
    assert "STALE" in capsys.readouterr().out


def test_check_treats_a_missing_card_as_stale(card_env):
    _, card_path = card_env
    assert not card_path.exists()
    with pytest.raises(SystemExit) as exit_info:
        make_model_card.main(["--check"])
    assert exit_info.value.code == 1


def test_check_does_not_write_the_card_it_is_checking(card_env):
    """--check is read-only, so running it in CI cannot mask the staleness it is
    meant to detect."""
    _, card_path = card_env
    with pytest.raises(SystemExit):
        make_model_card.main(["--check"])
    assert not card_path.exists()
