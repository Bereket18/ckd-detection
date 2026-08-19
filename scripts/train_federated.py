"""
Sprint 5 entry point: runs the federated learning simulation and
compares the final federated model's accuracy against the Sprint 2
centralized baseline (98.75%) -- the key question this sprint
answers is how much, if anything, federating the training costs in
accuracy.

Usage:
    python scripts/train_federated.py
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
from src.data.load_tabular import fetch_uci_ckd  # noqa: E402
from src.data.preprocess import clean_tabular, split_train_test  # noqa: E402
from src.federated.server import run_simulation  # noqa: E402

NUM_CLIENTS = 3
NUM_ROUNDS = 10


def main():
    print("Loading and cleaning data...")
    raw = fetch_uci_ckd()
    cleaned, _ = clean_tabular(raw)
    X_train, X_test, y_train, y_test = split_train_test(cleaned)

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
        print("Sprint 2 centralized baseline was: 0.9875")
        print(f"Gap: {0.9875 - final_acc:.4f} ({'federation cost this much accuracy' if final_acc < 0.9875 else 'federation matched or beat the centralized baseline'})")


if __name__ == "__main__":
    main()