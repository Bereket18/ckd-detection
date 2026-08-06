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
IMAGING_MODEL_PATH = SAVED_MODELS_DIR / "imaging_model.pt"
FUSION_MODEL_PATH = SAVED_MODELS_DIR / "fusion_model.pt"

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

# Human-readable prompts for the chatbot agent (Sprint 6) — one per feature.
# Fill these in properly once the real question wording is decided; keep
# them here (not hardcoded in agent/chatbot.py) so both the data pipeline
# and the agent read from a single source of truth.
FEATURE_PROMPTS = {col: f"Enter value for '{col}': " for col in FEATURE_COLUMNS}

# ---------------------------------------------------------------------------
# Reproducibility
# ---------------------------------------------------------------------------
RANDOM_SEED = 42
TEST_SIZE = 0.2
