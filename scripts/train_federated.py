"""
Sprint 5 entry point: runs the federated learning simulation and
compares the final federated model's accuracy against the Sprint 2
centralized baseline -- the key question this sprint answers is how
much, if anything, federating the training costs in accuracy.

The baseline figure is read from saved_models/tabular_metrics.json
(written by train_baseline.py) rather than hardcoded, so the
comparison can't quote a stale number. See AUDIT.md (P1-1).

Usage:
    python scripts/train_federated.py
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
from src.data.load_tabular import fetch_uci_ckd  # noqa: E402
from src.data.preprocess import prepare_tabular  # noqa: E402
from src.federated.server import run_simulation  # noqa: E402
from src.models import tabular_model  # noqa: E402

NUM_CLIENTS = 3
NUM_ROUNDS = 10


def main():
    print("Loading and cleaning data...")
    raw = fetch_uci_ckd()
    X_train, X_test, y_train, y_test, _ = prepare_tabular(raw)

    X_train_arr = X_train.values
    X_test_arr = X_test.values
    y_train_arr = (y_train.values == "ckd").astype(int)
    y_test_arr = (y_test.values == "ckd").astype(int)

    print(f"Simulating {NUM_CLIENTS} hospital clients, {NUM_ROUNDS} federated rounds...\n")
    history = run_simulation(
        X_train_arr, y_train_arr, X_test_arr, y_test_arr,
        num_clients=NUM_CLIENTS, num_rounds=NUM_ROUNDS,
    )

    print("\nPer-round accuracy (federated global model, evaluated each round):")
    accuracies = history.metrics_distributed.get("accuracy", [])
    for round_num, acc in accuracies:
        print(f"  round {round_num:2d}: {acc:.4f}")

    if accuracies:
        final_acc = accuracies[-1][1]
        print(f"\nFinal federated accuracy: {final_acc:.4f}")

        baseline = tabular_model.load_metrics(config.TABULAR_METRICS_PATH)
        if baseline is None:
            print("Centralized baseline not found -- run scripts/train_baseline.py "
                  "to generate it, then re-run this for the comparison.")
        else:
            base_acc = baseline["accuracy"]
            gap = base_acc - final_acc
            verdict = ("federation cost this much accuracy" if gap > 0
                       else "federation matched or beat the centralized baseline")
            print(f"Sprint 2 centralized baseline ({baseline['model']}) was: {base_acc:.4f}")
            print(f"Gap: {gap:.4f} ({verdict})")


if __name__ == "__main__":
    main()