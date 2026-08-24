"""
Central configuration for the CKD federated multimodal agent project.
Import from here rather than hardcoding paths/column names elsewhere,
so Sprint 1's data work and Sprint 6's agent stay in sync automatically.
"""

from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT_DIR = Path(__file__).resolve().parent
DATA_RAW_DIR = ROOT_DIR / "data" / "raw"
DATA_PROCESSED_DIR = ROOT_DIR / "data" / "processed"
SAVED_MODELS_DIR = ROOT_DIR / "saved_models"

TABULAR_MODEL_PATH = SAVED_MODELS_DIR / "tabular_model.joblib"
# The fitted TabularPreprocessor (imputers + scaler bundled together).
# Replaces the older standalone "tabular_scaler.joblib": the imputers have
# to be saved too, or live patient input is transformed differently than
# the training data was. See AUDIT.md (P0-3).
TABULAR_PREPROCESSOR_PATH = SAVED_MODELS_DIR / "tabular_preprocessor.joblib"
# Measured held-out metrics for the baseline, written by train_baseline.py.
# Sprints 4 and 5 compare themselves against the baseline; they used to
# hardcode its accuracy, which silently became false the moment the
# pipeline changed. They now read this file. See AUDIT.md (P1-1).
TABULAR_METRICS_PATH = SAVED_MODELS_DIR / "tabular_metrics.json"
# A saved sample of training rows for SHAP to explain against. The agent used
# to rebuild this by re-running the whole load/encode/split pipeline on every
# consultation. The reason for saving it is correctness rather than speed: the
# recompute always rebuilt the background from UCI, so a model trained on any
# other dataset would have been explained against the wrong reference
# distribution. Measured, the recompute cost 0.31 s, not the "~10 s" AUDIT.md
# P1-5 originally estimated -- see the correction recorded there.
SHAP_BACKGROUND_PATH = SAVED_MODELS_DIR / "shap_background.joblib"
# Append-only log of every training run: which datasets, how many rows and
# features, and the resulting metrics. This is what makes "did feeding the
# model more data actually help?" an answerable question instead of a guess.
METRICS_HISTORY_PATH = SAVED_MODELS_DIR / "metrics_history.jsonl"
IMAGING_MODEL_PATH = SAVED_MODELS_DIR / "imaging_model.pt"
FUSION_MODEL_PATH = SAVED_MODELS_DIR / "fusion_model.pt"


def artifact_paths(suffix: str = "") -> dict:
    """
    The four files that together make up one trained tabular bundle.

    suffix="" gives the default bundle -- the one src/agent/chatbot.py loads.
    Passing a suffix (train_baseline.py --out-suffix) keeps an experimental run,
    e.g. a model trained on a combined multi-dataset feature intersection, from
    overwriting the model being demonstrated.

    All four must be written together: a model without its matching
    preprocessor cannot transform patient input, and a background sample from a
    different feature set would produce meaningless SHAP attributions.
    """
    tag = f"_{suffix}" if suffix else ""
    return {
        "model": SAVED_MODELS_DIR / f"tabular_model{tag}.joblib",
        "preprocessor": SAVED_MODELS_DIR / f"tabular_preprocessor{tag}.joblib",
        "metrics": SAVED_MODELS_DIR / f"tabular_metrics{tag}.json",
        "shap_background": SAVED_MODELS_DIR / f"shap_background{tag}.joblib",
    }

# ---------------------------------------------------------------------------
# UCI Chronic Kidney Disease dataset — column reference
# (the classic 400-row / 24-feature dataset: age, bp, sg, al, su, rbc, pc,
# pcc, ba, bgr, bu, sc, sod, pot, hemo, pcv, wc, rc, htn, dm, cad, appet,
# pe, ane -> class)
#
# Confirmed against the actual downloaded CSV (Sprint 1):
#   - target column is named "class", not "classification"
#   - missing values are genuinely blank/NaN in this CSV, not "?"-marked
#   - there's a leading "id" column that is not a feature and must be dropped
#   - "class" has 2 dirty values ("ckd\t" with a stray tab) — strip before use
#   - missingness is uneven: rbc ~38%, rc ~32%, wc ~26% missing — worth
#     flagging in the report, not just silently imputing without comment
# ---------------------------------------------------------------------------

ID_COLUMN = "id"

NUMERIC_COLUMNS = [
    "age", "bp", "sg", "al", "su", "bgr", "bu", "sc", "sod", "pot",
    "hemo", "pcv", "wc", "rc",
]

# Categorical columns that are yes/no, normal/abnormal, or present/notpresent
BINARY_COLUMNS = [
    "rbc", "pc", "pcc", "ba", "htn", "dm", "cad", "appet", "pe", "ane",
]

TARGET_COLUMN = "class"  # values: "ckd" / "notckd" (a couple of rows have a stray "ckd\t" — strip whitespace)

FEATURE_COLUMNS = NUMERIC_COLUMNS + BINARY_COLUMNS

# ---------------------------------------------------------------------------
# Reproducibility
# ---------------------------------------------------------------------------
RANDOM_SEED = 42
TEST_SIZE = 0.2

# The PRD's MVP success bar for recall, and the gate train_baseline.py applies
# before it will overwrite the saved model. Recall specifically (not accuracy):
# a missed CKD case is the costly error for a screening tool, so that is the
# number a retrain on new data must not quietly regress.
#
# tests/test_tabular_model.py asserts the same bar, so a code change that
# regresses the model fails the suite and a data change that regresses it is
# refused at training time.
MIN_ACCEPTABLE_RECALL = 0.90

# Human-readable prompts for the chatbot agent (Sprint 6) — one per feature.
# Kept here rather than in agent/chatbot.py so the data pipeline and the
# agent read feature names from a single source of truth.
#
# There used to be a placeholder version of this dict defined ABOVE, which
# this one silently shadowed — so the placeholder was dead code that read
# like live code. See AUDIT.md (P2-1).
FEATURE_PROMPTS = {
    "age": "What is your age (in years)?",
    "bp": "What is your blood pressure (diastolic, mm/Hg)?",
    "sg": "What is your urine specific gravity (typically 1.005-1.025; check a recent urinalysis)?",
    "al": "What is your urine albumin level (0-5 scale from a urinalysis)?",
    "su": "What is your urine sugar level (0-5 scale from a urinalysis)?",
    "bgr": "What is your blood glucose (random, mg/dL)?",
    "bu": "What is your blood urea (mg/dL)?",
    "sc": "What is your serum creatinine (mg/dL)?",
    "sod": "What is your sodium level (mEq/L)?",
    "pot": "What is your potassium level (mEq/L)?",
    "hemo": "What is your hemoglobin level (g/dL)?",
    "pcv": "What is your packed cell volume (%)?",
    "wc": "What is your white blood cell count (cells/cumm)?",
    "rc": "What is your red blood cell count (millions/cmm)?",
    "rbc": "Is your red blood cell status normal or abnormal (from a urinalysis)? [normal/abnormal]",
    "pc": "Is your pus cell status normal or abnormal? [normal/abnormal]",
    "pcc": "Are pus cell clumps present in your urine? [present/notpresent]",
    "ba": "Is bacteria present in your urine? [present/notpresent]",
    "htn": "Do you have a history of hypertension (high blood pressure)? [yes/no]",
    "dm": "Do you have a history of diabetes mellitus? [yes/no]",
    "cad": "Do you have a history of coronary artery disease? [yes/no]",
    "appet": "How would you describe your appetite? [good/poor]",
    "pe": "Do you have pedal edema (swelling in your feet/ankles)? [yes/no]",
    "ane": "Do you have anemia? [yes/no]",
}