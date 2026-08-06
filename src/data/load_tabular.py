"""
Sprint 1: the UCI Chronic Kidney Disease dataset lives at
data/raw/uci_ckd.csv (400 rows, confirmed).

Source: Rubini, L., Soundarapandian, P., & Eswaran, P. (2015). Chronic
Kidney Disease [Dataset]. UCI Machine Learning Repository.
https://doi.org/10.24432/C5G020 (CC BY 4.0). Retrieved via a GitHub
mirror of the original CSV, since the UCI archive itself isn't reachable
from every network environment.

fetch_ethiopian_ckd() remains a placeholder for the St. Paul's Hospital
dataset, once/if access is granted by its authors — see data/README.md.
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
    TODO: once the St. Paul's Hospital dataset is obtained, load it
    here with the same column contract as fetch_uci_ckd() so downstream
    code (cleaning, training, federated partitioning) doesn't need to
    care which source it's reading.
    """
    raise NotImplementedError(
        "Ethiopian dataset not yet obtained — see data/README.md"
    )
