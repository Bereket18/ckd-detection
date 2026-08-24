"""
Sprint 6: the conversational agent -- the only "interface" this
project has. No web frontend, no backend API: this runs directly
as `python -m src.agent.chatbot` and talks to the trained model in
the same process.

Design choice (see project discussion): guided Q&A, not free-form
LLM parsing, because accuracy is the priority and a scripted
question flow can't misread a value the way natural-language
extraction could. Uses the Sprint 2 tabular baseline model -- not the
fusion or federated models -- since it remains the most accurate
verified model in the project. The baseline's measured metrics live in
saved_models/tabular_metrics.json; this docstring deliberately does not
quote them, because the figure it used to quote went stale silently.
"""

from __future__ import annotations
import argparse
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))
import config  # noqa: E402
import joblib  # noqa: E402
import pandas as pd  # noqa: E402
from rich.console import Console  # noqa: E402
from rich.panel import Panel  # noqa: E402

from src.agent import dialogue_fsm  # noqa: E402
from src.data.load_tabular import fetch_uci_ckd  # noqa: E402
from src.data.preprocess import encoded_feature_frame, prepare_tabular  # noqa: E402
from src.explain.shap_utils import explain_prediction, explanation_to_sentence  # noqa: E402
from src.models.tabular_model import risk_band  # noqa: E402

console = Console()

DISCLAIMER = (
    "This tool provides an informal risk screening only. "
    "It is NOT a medical diagnosis. Please consult a healthcare "
    "professional for any real concerns about your kidney health."
)


def load_trained_model():
    if not config.TABULAR_MODEL_PATH.exists():
        return None
    return joblib.load(config.TABULAR_MODEL_PATH)


def load_background_data(preprocessor=None, path=None):
    """
    SHAP needs a reference sample of "typical" patients to compute explanations
    against. scripts/train_baseline.py saves the training split it actually used
    to config.SHAP_BACKGROUND_PATH, and this loads that file.

    The reason this matters is correctness, not speed. The old code re-ran the
    whole load/encode/split pipeline on every consultation and always rebuilt the
    background from UCI -- so a model trained on any other dataset would have
    been explained against the wrong reference distribution, producing
    attributions that looked plausible and were not. Saving the background beside
    the model makes that impossible by construction, and the two guards below
    turn a mismatched pair into an error rather than a wrong answer.

    On the latency AUDIT.md P1-5 claimed: measured, the recompute cost 0.31 s and
    the entire post-questionnaire analysis costs 0.069 s. The "~10 s" in that
    entry was an unmeasured estimate and was wrong by roughly 30x; the real
    startup cost is ~12 s of importing shap/xgboost/sklearn, which this change
    does not affect. The correction is recorded in AUDIT.md.

    The fallback recompute is kept so an older saved_models/ directory still
    works -- but only when the loaded model really is on the UCI feature set. A
    mismatch is a misconfiguration with no safe silent handling, so it raises
    with the command that fixes it.
    """
    path = path or config.SHAP_BACKGROUND_PATH
    expected = list(preprocessor.feature_columns) if preprocessor is not None else None

    if path.exists():
        background = joblib.load(path)
        if expected is None or list(background.columns) == expected:
            return background
        raise ValueError(
            f"The saved SHAP background at {path} has features "
            f"{list(background.columns)}, but the loaded model expects {expected}. "
            f"These artifacts are from different training runs. Re-run "
            f"scripts/train_baseline.py to regenerate the bundle together."
        )

    if expected is not None and expected != list(config.FEATURE_COLUMNS):
        raise FileNotFoundError(
            f"No SHAP background at {path}, and the loaded model uses a reduced "
            f"feature set ({len(expected)} features), so it cannot be rebuilt from "
            f"the UCI dataset. Re-run scripts/train_baseline.py to regenerate it."
        )
    raw = fetch_uci_ckd()
    X_train, _, _, _, _ = prepare_tabular(raw)
    return X_train


# The answers that mean "I genuinely don't have this value" rather than a typo.
# Skipping is a first-class option: the training pipeline's imputer already
# handles missing features -- 38% of the UCI dataset's rbc column is missing --
# so requiring all 24 answers demanded lab results a walk-in patient does not
# have, and the only way to proceed was to invent one. An imputed population
# median is a documented estimate; a guessed number is silent fiction.
SKIP_ANSWERS = {"unknown", "skip", "?", "dont know", "don't know", "na", "n/a"}


# Plausible value ranges per field, based on the actual training data's
# observed range (with headroom for genuine extreme cases) -- this is
# NOT "clinically normal" ranges, since abnormal-but-real values are
# exactly what the model needs to see. It only catches values that are
# impossible/scale-confused, like "23" on a 0-5 scale (a real bug found
# by testing: this exact input silently passed the old numeric-only
# check and distorted the prediction).
NUMERIC_RANGES = {
    "age": (0, 120), "bp": (30, 200), "sg": (1.000, 1.030), "al": (0, 5), "su": (0, 5),
    "bgr": (0, 600), "bu": (0, 400), "sc": (0, 80), "sod": (0, 200), "pot": (0, 50),
    "hemo": (0, 25), "pcv": (0, 60), "wc": (0, 30000), "rc": (0, 10),
}


def validate_numeric(value: str, field: str):
    """
    Returns (ok, parsed). A parsed value of None means the patient explicitly
    declined to answer -- see SKIP_ANSWERS. That is distinct from (False, msg),
    which means the answer was malformed and should be re-asked.
    """
    if value.strip().lower() in SKIP_ANSWERS:
        return True, None
    try:
        parsed = float(value)
    except ValueError:
        return False, f"'{value}' isn't a number. Please enter a numeric value for {field}, or 'unknown' to skip."
    if field in NUMERIC_RANGES:
        low, high = NUMERIC_RANGES[field]
        if not (low <= parsed <= high):
            return False, f"{parsed} is outside the expected range for {field} ({low}-{high}). Please double check and re-enter."
    return True, parsed

def validate_binary(value: str, accepted_pairs: list[tuple[str, str]]):
    """Same (ok, parsed) contract as validate_numeric: None means a deliberate skip."""
    v = value.strip().lower()
    if v in SKIP_ANSWERS:
        return True, None
    for a, b in accepted_pairs:
        if v == a or v == b:
            return True, v
    options = " / ".join(f"{a}/{b}" for a, b in accepted_pairs)
    return False, f"Please answer with one of: {options} (or 'unknown' to skip)"


BINARY_ACCEPTED = {
    "rbc": [("normal", "abnormal")],
    "pc": [("normal", "abnormal")],
    "pcc": [("present", "notpresent")],
    "ba": [("present", "notpresent")],
    "htn": [("yes", "no")],
    "dm": [("yes", "no")],
    "cad": [("yes", "no")],
    "appet": [("good", "poor")],
    "pe": [("yes", "no")],
    "ane": [("yes", "no")],
}


def collect_patient_data(preprocessor=None) -> dict:
    """
    Ask one question per feature the loaded model actually uses.

    The field list comes from the fitted preprocessor, not from
    config.FEATURE_COLUMNS, so a model trained on a reduced feature set -- the
    intersection of two datasets' columns, see src/data/datasets.py -- asks only
    the questions it can use. Hardcoding 24 questions would have made such a
    model unusable through the only interface this project has.
    preprocessor=None keeps the original behaviour for callers that just want
    the full canonical questionnaire.

    The control flow is the DFA in src/agent/dialogue_fsm.py, executed rather
    than described. This function used to hand-roll it as a `for` over fields
    wrapping a `while True` with two implicit self-loops (re-ask on invalid, and
    on "help"), which is the same machine but not an object anything could check
    for totality or termination. Driving the table means the specification in
    the report and the code a patient talks to cannot drift apart -- the failure
    mode AUDIT.md P1-1 records for hand-copied facts.

    Observable behaviour is unchanged: same prompts, same help text, same
    "a typical value will be estimated" note on a skip.
    """
    machine = dialogue_fsm.from_preprocessor(preprocessor)
    feature_columns = machine.fields

    console.print(Panel(
        f"[bold]CKD Risk Assessment[/bold]\n\n{DISCLAIMER}",
        border_style="cyan",
    ))
    console.print(
        f"\n{len(feature_columns)} questions. Press Enter after each answer. "
        "Type 'help' at any prompt for more detail, or 'unknown' if you don't "
        "have that value.\n"
    )

    answers = {}
    while not machine.accepted:
        field = machine.current_field
        prompt_text = config.FEATURE_PROMPTS.get(field, f"Enter value for '{field}': ")
        raw_value = console.input(f"[cyan]{prompt_text}[/cyan] ")

        symbol, payload = machine.classify(raw_value, field)
        if symbol == dialogue_fsm.HELP:
            console.print(f"  [dim]This refers to your {field} value, typically from a recent lab test or urinalysis.[/dim]")
        elif symbol == dialogue_fsm.INVALID:
            console.print(f"  [yellow]{payload}[/yellow]")
        else:
            # VALID or SKIP: both record an answer (None means skipped) and both
            # advance. The machine decides that, not this branch.
            answers[field] = payload
            if symbol == dialogue_fsm.SKIP:
                console.print("  [dim]Skipped -- a typical value will be estimated for this field.[/dim]")

        machine.step(symbol)
    return answers


def load_preprocessor():
    if not config.TABULAR_PREPROCESSOR_PATH.exists():
        return None
    return joblib.load(config.TABULAR_PREPROCESSOR_PATH)


def answers_to_feature_row(answers: dict, preprocessor) -> pd.DataFrame:
    """
    Converts one patient's raw answers into the exact model-ready format.

    The encoding itself lives in src.data.preprocess.encoded_feature_frame,
    shared with scripts/predict.py. This function is the interactive path's thin
    wrapper: it builds the one-row frame and applies the skip-vs-malformed guard
    below, which is meaningful only when a human was asked the question.

    Numeric answers MUST go through the SAME fitted preprocessor used during
    training (Sprint 2) -- the model was trained on standardized values (roughly
    -3 to +3), not raw patient-entered numbers (e.g. age=62, glucose=150).
    Feeding raw values directly would silently produce meaningless predictions:
    this exact bug was caught by testing with a clinically obvious "sick" patient
    profile and noticing the predicted risk was wrong, not by inspection alone.

    Binary encoding likewise reuses the data layer's map rather than carrying a
    private copy, which is what this function used to do -- a second definition
    of "how a binary answer becomes a number" that had to stay in sync with the
    training pipeline by hand. See AUDIT.md (P1-8).

    The column list comes from the preprocessor, so this row always matches
    whatever feature set the loaded model was trained on. Returns a DataFrame
    (not a raw array) so the model and SHAP explainer both see real column names.

    A value of None means the patient deliberately skipped the field: it stays
    NaN and the preprocessor's imputer fills it, which is what imputers are for.
    Anything else that fails to parse still raises -- see below.
    """
    feature_columns = list(preprocessor.feature_columns)

    missing = [f for f in feature_columns if f not in answers]
    if missing:
        raise ValueError(
            f"No answer supplied for field(s) {missing}. The loaded model was "
            f"trained on {len(feature_columns)} features and needs a value or an "
            f"explicit None (skip) for each."
        )

    df = pd.DataFrame(
        [{field: answers[field] for field in feature_columns}],
        columns=feature_columns,
    )
    encoded = encoded_feature_frame(df, preprocessor)

    # A field is NaN here for one of two reasons, and they must not be
    # conflated. A deliberate skip (answer is None) is fine -- the imputer
    # fills it with a population value, which is a documented estimate. An
    # answer that was *given* but did not parse is a different thing: imputing
    # it would silently substitute a value the patient never provided, so it
    # raises. The previous inline mapping raised KeyError here, and failing
    # loudly is the correct behaviour for a clinical tool.
    # validate_numeric()/validate_binary() make this unreachable from the CLI;
    # this guards programmatic callers that bypass them.
    unparsed = [
        f for f in feature_columns
        if pd.isna(encoded[f].iloc[0]) and answers[f] is not None
    ]
    if unparsed:
        raise ValueError(
            f"Unrecognized value(s) for field(s) {unparsed}. Expected a number, or "
            f"one of the documented option pairs (see BINARY_ACCEPTED); pass None "
            f"to skip a field deliberately."
        )
    return preprocessor.transform(encoded)


def run_agent() -> None:
    model = load_trained_model()
    preprocessor = load_preprocessor()
    if model is None or preprocessor is None:
        missing = config.TABULAR_MODEL_PATH if model is None else config.TABULAR_PREPROCESSOR_PATH
        console.print(
            f"[yellow]No trained model/preprocessor found yet at {missing}.\n"
            "Run scripts/train_baseline.py first, then re-run this agent.[/yellow]"
        )
        return

    answers = collect_patient_data(preprocessor)
    feature_row = answers_to_feature_row(answers, preprocessor)

    with console.status("[cyan]Analyzing your responses...[/cyan]"):
        prediction = model.predict(feature_row)[0]
        risk_label = "ckd" if prediction == 1 else "notckd"
        # The verdict above stays model.predict(), i.e. the 0.5 boundary, so the
        # accuracy and recall reported in MODEL_CARD.md describe exactly what is
        # shown here. The probability is additional information about the same
        # decision, never a third outcome.
        probability = float(model.predict_proba(feature_row)[0][1])
        band = risk_band(probability)
        background = load_background_data(preprocessor)
        impacts = explain_prediction(
            model, feature_row.values[0], list(preprocessor.feature_columns),
            background.values, top_n=3,
        )
        explanation = explanation_to_sentence(impacts, risk_label)

    # Naming the estimated fields is not decoration: the explanation below may
    # cite a feature the patient never actually reported, and a reader has to be
    # able to tell those apart from measured values.
    skipped = sorted(f for f, v in answers.items() if v is None)
    if skipped:
        explanation += (
            f"\n\n[dim]Note: you skipped {len(skipped)} field(s) "
            f"({', '.join(skipped)}); a typical value from the training data was "
            f"used instead, so this result is less certain than a complete one.[/dim]"
        )

    # The number and its caveat are built together so neither can be shown
    # without the other. A tree ensemble's predict_proba is the share of votes
    # for the class, not a calibrated probability: 0.80 does not mean "80% of
    # such patients have CKD". The project measures that gap rather than papering
    # over it -- calibrating would change the saved model and could move the
    # measured recall below config.MIN_ACCEPTABLE_RECALL -- so the caveat is
    # part of the output and the Brier score is in the card.
    confidence_block = (
        f"Model confidence P(CKD) = {probability:.2f}   ({band} band)\n"
        f"[dim]An uncalibrated confidence score, not a calibrated probability. "
        f"See MODEL_CARD.md for the measured Brier score and what it does and "
        f"does not establish.[/dim]"
    )
    if band == "MODERATE":
        confidence_block += (
            f"\n[yellow]This is close to the model's decision boundary, so a small "
            f"change in one answer could flip the result. It should not be relied "
            f"on without a laboratory test.[/yellow]"
        )

    if risk_label == "ckd":
        console.print(Panel(
            f"[bold red]HIGHER RISK[/bold red]\n\n{confidence_block}\n\n"
            f"{explanation}\n\n[dim]{DISCLAIMER}[/dim]",
            title="Result", border_style="red",
        ))
    else:
        console.print(Panel(
            f"[bold green]LOWER RISK[/bold green]\n\n{confidence_block}\n\n"
            f"{explanation}\n\n[dim]{DISCLAIMER}[/dim]",
            title="Result", border_style="green",
        ))


def show_fsm() -> None:
    """
    Print the questionnaire's automaton -- what `--show-fsm` does.

    It reads the saved preprocessor when one exists, so the machine printed is
    the machine a consultation would actually run: a model trained on 10 shared
    features prints an 11-state machine, not a hardcoded 25. With nothing trained
    yet it falls back to the canonical questionnaire, which is still the right
    thing to show.

    Plain print() rather than console.print(): describe() returns a table aligned
    with fixed-width padding, and Rich re-wraps and highlights text, which would
    misalign the delta columns.
    """
    preprocessor = load_preprocessor()
    if preprocessor is None:
        console.print(
            f"[dim]No trained preprocessor at {config.TABULAR_PREPROCESSOR_PATH}, "
            f"so this is the canonical {len(config.FEATURE_COLUMNS)}-feature "
            f"questionnaire rather than a specific model's.[/dim]\n"
        )
    print(dialogue_fsm.from_preprocessor(preprocessor).describe())


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        prog="python -m src.agent.chatbot",
        description="Interactive CKD risk screening agent (Sprint 6).",
    )
    parser.add_argument(
        "--show-fsm", action="store_true",
        help="Print the dialogue automaton -- states, transition table, accepted "
             "language and verified properties -- then exit without asking "
             "anything. See src/agent/dialogue_fsm.py.",
    )
    return parser.parse_args(argv)


def main(argv=None) -> None:
    args = parse_args(argv)
    if args.show_fsm:
        show_fsm()
        return
    run_agent()


if __name__ == "__main__":
    main()
