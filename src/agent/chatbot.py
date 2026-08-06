"""
Sprint 6: the conversational agent — the only "interface" this
project has. No web frontend, no backend API: this runs directly
as `python -m src.agent.chatbot` and talks to the trained model
in the same process.

This file is already runnable in Sprint 0 (it just can't predict
anything yet, since no model exists). That's intentional: it proves
the interface shape early and gives Sprint 6 a working starting
point instead of a blank file.

Design choice (see project discussion): guided Q&A first (this file),
because free-form parsing of natural answers risks misreading a
value and hurting accuracy. An LLM-based free-form front end can be
layered on top of the same `predict()` call later without changing
the model at all.
"""

from __future__ import annotations
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))
import config  # noqa: E402


def collect_patient_data() -> dict:
    """Ask the user for each required feature, one at a time."""
    print("=== CKD Risk Assessment \u2014 please answer each question ===\n")
    answers = {}
    for col in config.FEATURE_COLUMNS:
        prompt = config.FEATURE_PROMPTS.get(col, f"Enter value for '{col}': ")
        answers[col] = input(prompt).strip()
    return answers


def load_trained_model():
    """
    TODO (Sprint 2 hooks in here): load the joblib model saved at
    config.TABULAR_MODEL_PATH. Returns None if it doesn't exist yet
    so this script stays runnable before the model is trained.
    """
    if not config.TABULAR_MODEL_PATH.exists():
        return None
    import joblib
    return joblib.load(config.TABULAR_MODEL_PATH)


def run_agent() -> None:
    model = load_trained_model()
    if model is None:
        print(
            "No trained model found yet at "
            f"{config.TABULAR_MODEL_PATH}.\n"
            "Run scripts/train_baseline.py first (Sprint 2), "
            "then re-run this agent.\n"
        )
        return

    patient_data = collect_patient_data()

    # TODO (Sprint 2/6): convert patient_data into the exact feature
    # vector/order the model expects, call model.predict_proba(...),
    # and pass the result + patient_data through
    # src/explain/shap_utils.explain_prediction() for a plain-language
    # explanation instead of a bare label.
    print("\n[Prediction step not implemented yet \u2014 Sprint 2/6]")


if __name__ == "__main__":
    run_agent()
