"""
Sprint 3: encoder for the clinical-notes modality. Since no public
Ethiopian clinical-notes dataset exists, notes are synthetically
generated from the tabular features as a documented proxy (see
docs/ for the honesty note that belongs in the final report).
"""

from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer


def generate_synthetic_notes(df: pd.DataFrame) -> pd.Series:
    """
    Build one short, plain-language sentence per patient row from the
    *raw* (pre-scaling) tabular values, so numbers read naturally
    ("blood pressure 80") instead of as z-scores. Missing values are
    skipped in the sentence rather than guessed at — an honestly
    incomplete synthetic note, not a fabricated one.

    This is explicitly a documented proxy for real clinical text,
    not a claim that it resembles an actual doctor's note.
    """
    def _fmt(row):
        parts = []
        if pd.notna(row.get("age")):
            parts.append(f"{int(row['age'])}-year-old patient")
        if pd.notna(row.get("bp")):
            parts.append(f"blood pressure {row['bp']:.0f}")
        if pd.notna(row.get("hemo")):
            parts.append(f"hemoglobin {row['hemo']:.1f}")
        if pd.notna(row.get("sc")):
            parts.append(f"serum creatinine {row['sc']:.1f}")
        if pd.notna(row.get("bu")):
            parts.append(f"blood urea {row['bu']:.0f}")
        if str(row.get("htn", "")).strip().lower() == "yes":
            parts.append("history of hypertension")
        if str(row.get("dm", "")).strip().lower() == "yes":
            parts.append("history of diabetes mellitus")
        if str(row.get("appet", "")).strip().lower() == "poor":
            parts.append("poor appetite reported")
        return ", ".join(parts) + "." if parts else "no additional clinical notes recorded."

    return df.apply(_fmt, axis=1)


def encode_notes(notes: pd.Series, vectorizer: TfidfVectorizer | None = None):
    """
    TF-IDF vectorize the synthetic notes. Pass a already-fitted
    vectorizer (from the training set) to transform new notes
    consistently at inference/test time; omit it to fit a new one.
    Returns (feature_matrix, fitted_vectorizer).
    """
    if vectorizer is None:
        vectorizer = TfidfVectorizer(max_features=100, stop_words="english")
        matrix = vectorizer.fit_transform(notes)
    else:
        matrix = vectorizer.transform(notes)
    return matrix, vectorizer