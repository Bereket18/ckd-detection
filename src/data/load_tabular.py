"""
Sprint 1: the UCI Chronic Kidney Disease dataset lives at
data/raw/uci_ckd.csv (400 rows, confirmed).

Source: Rubini, L., Soundarapandian, P., & Eswaran, P. (2015). Chronic
Kidney Disease [Dataset]. UCI Machine Learning Repository.
https://doi.org/10.24432/C5G020 (CC BY 4.0). Retrieved via a GitHub
mirror of the original CSV, since the UCI archive itself isn't reachable
from every network environment.

These are the two named, hardcoded loaders. Anything beyond them goes through
src/data/datasets.py, which maps an arbitrary CSV onto the same column contract
via a DatasetSpec -- adding a third source should not mean adding a third
fetch_* function here.
"""

from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[2]))
import config  # noqa: E402
from src.data.preprocess import load_raw_tabular  # noqa: E402


def fetch_uci_ckd():
    """Load the already-downloaded UCI CKD dataset from data/raw/."""
    path = config.DATA_RAW_DIR / "uci_ckd.csv"
    if not path.exists():
        raise FileNotFoundError(
            f"{path} not found. See data/README.md for the source."
        )
    return load_raw_tabular(path)


def fetch_ethiopian_ckd():
    """
    Load the St. Paul's Hospital (Addis Ababa) CKD dataset, if it has been
    obtained -- see data/README.md.

    No longer a NotImplementedError stub: the mapping onto this project's column
    contract now exists as the `ethiopian` DatasetSpec in src/data/datasets.py,
    so the only thing still missing is the file. That distinction matters,
    because NotImplementedError said "nobody has written this yet" when the
    truth is "the code is here and tested; the data has been requested and has
    not arrived." Whoever receives the CSV drops it at the reported path and
    checks the spec's column_map against its real headers.

    Raises FileNotFoundError naming the expected path, which is a message
    someone can act on.
    """
    from src.data.datasets import load_dataset

    df, _coverage = load_dataset("ethiopian")
    return df
