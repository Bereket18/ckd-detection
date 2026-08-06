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
# pe, ane -> classification)
# Missing values in the raw files are marked "?" — handle in preprocess.py.
# ---------------------------------------------------------------------------

NUMERIC_COLUMNS = [
    "age", "bp", "sg", "al", "su", "bgr", "bu", "sc", "sod", "pot",
    "hemo", "pcv", "wc", "rc",
]

# Categorical columns that are yes/no, normal/abnormal, or present/notpresent
BINARY_COLUMNS = [
    "rbc", "pc", "pcc", "ba", "htn", "dm", "cad", "appet", "pe", "ane",
]

TARGET_COLUMN = "classification"  # values: "ckd" / "notckd"

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
