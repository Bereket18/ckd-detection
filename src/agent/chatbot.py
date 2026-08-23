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
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))
import config  # noqa: E402
import joblib  # noqa: E402
import pandas as pd  # noqa: E402
from rich.console import Console  # noqa: E402
from rich.panel import Panel  # noqa: E402

from src.data.load_tabular import fetch_uci_ckd  # noqa: E402
from src.data.preprocess import prepare_tabular  # noqa: E402
from src.explain.shap_utils import explain_prediction, explanation_to_sentence  # noqa: E402

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


def load_background_data():
    """
    SHAP needs a reference sample of "typical" patients to compute
    explanations against -- reuse the training data for this rather
    than requiring a separate stored file.

    Known cost: this re-runs the whole load/encode/split pipeline on every
    consultation (~10s). Saving a background sample at training time would
    remove it -- tracked as P1-5 in AUDIT.md.
    """
    raw = fetch_uci_ckd()
    X_train, _, _, _, _ = prepare_tabular(raw)
    return X_train


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
    try:
        parsed = float(value)
    except ValueError:
        return False, f"'{value}' isn't a number. Please enter a numeric value for {field}."
    if field in NUMERIC_RANGES:
        low, high = NUMERIC_RANGES[field]
        if not (low <= parsed <= high):
            return False, f"{parsed} is outside the expected range for {field} ({low}-{high}). Please double check and re-enter."
    return True, parsed

def validate_binary(value: str, accepted_pairs: list[tuple[str, str]]):
    v = value.strip().lower()
    for a, b in accepted_pairs:
        if v == a or v == b:
            return True, v
    options = " / ".join(f"{a}/{b}" for a, b in accepted_pairs)
    return False, f"Please answer with one of: {options}"


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


def collect_patient_data() -> dict:
    console.print(Panel(
        f"[bold]CKD Risk Assessment[/bold]\n\n{DISCLAIMER}",
        border_style="cyan",
    ))
    console.print("\nPress Enter after each answer. Type 'help' at any prompt for more detail.\n")

    answers = {}
    for field in config.FEATURE_COLUMNS:
        prompt_text = config.FEATURE_PROMPTS.get(field, f"Enter value for '{field}': ")
        while True:
            raw_value = console.input(f"[cyan]{prompt_text}[/cyan] ")
            if raw_value.strip().lower() == "help":
                console.print(f"  [dim]This refers to your {field} value, typically from a recent lab test or urinalysis.[/dim]")
                continue
            if field in config.NUMERIC_COLUMNS:
                ok, result = validate_numeric(raw_value, field)
            else:
                ok, result = validate_binary(raw_value, BINARY_ACCEPTED[field])
            if ok:
                answers[field] = result
                break
            console.print(f"  [yellow]{result}[/yellow]")
    return answers


def load_preprocessor():
    if not config.TABULAR_PREPROCESSOR_PATH.exists():
        return None
    return joblib.load(config.TABULAR_PREPROCESSOR_PATH)


def answers_to_feature_row(answers: dict, preprocessor) -> pd.DataFrame:
    """
    Converts raw patient answers into the exact model-ready format.
    Binary fields are encoded 0/1 the same way training data was.
    Numeric fields MUST then go through the SAME fitted preprocessor used
    during training (Sprint 2) -- the model was trained on standardized
    values (roughly -3 to +3), not raw patient-entered numbers (e.g.
    age=62, glucose=150). Feeding raw values directly would silently
    produce meaningless predictions: this exact bug was caught by testing
    with a clinically obvious "sick" patient profile and noticing the
    predicted risk was wrong, not by inspection alone.

    Passing the whole row through preprocessor.transform() (rather than
    applying a standalone scaler by hand, as this used to) means there is
    only one code path that can define "model-ready", so training and
    inference cannot drift apart again. Returns a DataFrame (not a raw
    array) so the model and SHAP explainer both see real column names.
    """
    binary_map = {"yes": 1, "no": 0, "normal": 1, "abnormal": 0, "present": 1, "notpresent": 0, "good": 1, "poor": 0}
    row = {}
    for field in config.FEATURE_COLUMNS:
        value = answers[field]
        row[field] = binary_map[value] if field in config.BINARY_COLUMNS else value
    df = pd.DataFrame([row], columns=config.FEATURE_COLUMNS)
    return preprocessor.transform(df)


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

    answers = collect_patient_data()
    feature_row = answers_to_feature_row(answers, preprocessor)

    with console.status("[cyan]Analyzing your responses...[/cyan]"):
        prediction = model.predict(feature_row)[0]
        risk_label = "ckd" if prediction == 1 else "notckd"
        background = load_background_data()
        impacts = explain_prediction(model, feature_row.values[0], config.FEATURE_COLUMNS, background.values, top_n=3)
        explanation = explanation_to_sentence(impacts, risk_label)

    if risk_label == "ckd":
        console.print(Panel(
            f"[bold red]HIGHER RISK[/bold red]\n\n{explanation}\n\n[dim]{DISCLAIMER}[/dim]",
            title="Result", border_style="red",
        ))
    else:
        console.print(Panel(
            f"[bold green]LOWER RISK[/bold green]\n\n{explanation}\n\n[dim]{DISCLAIMER}[/dim]",
            title="Result", border_style="green",
        ))


if __name__ == "__main__":
    run_agent()
