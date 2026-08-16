import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import pandas as pd
from src.data.load_tabular import fetch_uci_ckd
from src.models.text_model import generate_synthetic_notes, encode_notes


def test_generate_synthetic_notes_produces_readable_text():
    df = fetch_uci_ckd()
    notes = generate_synthetic_notes(df)
    assert len(notes) == len(df)
    assert all(isinstance(n, str) and len(n) > 0 for n in notes)
    # spot check: values should read as real numbers, not scaled z-scores
    assert any("blood pressure" in n for n in notes)


def test_generate_synthetic_notes_handles_missing_values_gracefully():
    df = pd.DataFrame([{"age": None, "bp": None, "hemo": None, "sc": None,
                         "bu": None, "htn": None, "dm": None, "appet": None}])
    notes = generate_synthetic_notes(df)
    assert notes.iloc[0] == "no additional clinical notes recorded."


def test_encode_notes_fit_and_transform_consistency():
    df = fetch_uci_ckd()
    notes = generate_synthetic_notes(df)
    train_notes, test_notes = notes.iloc[:320], notes.iloc[320:]

    train_matrix, vectorizer = encode_notes(train_notes)
    test_matrix, _ = encode_notes(test_notes, vectorizer=vectorizer)

    assert train_matrix.shape[1] == test_matrix.shape[1]  # same vocabulary size
    assert train_matrix.shape[0] == len(train_notes)
    assert test_matrix.shape[0] == len(test_notes)