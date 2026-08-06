"""
Sprint 2 entry point: trains the tabular baseline model and saves it
to config.TABULAR_MODEL_PATH, where src/agent/chatbot.py already
expects to find it.

Usage (once Sprint 1-2 are implemented):
    python scripts/train_baseline.py
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
from src.data import preprocess  # noqa: E402
from src.models import tabular_model  # noqa: E402


def main():
    raise NotImplementedError(
        "Sprint 1-2: load + clean data (src/data/preprocess.py), "
        "train + evaluate the model (src/models/tabular_model.py), "
        "then save it to config.TABULAR_MODEL_PATH."
    )


if __name__ == "__main__":
    main()
