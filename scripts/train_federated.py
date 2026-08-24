"""
Sprint 5 entry point: runs the federated learning simulation and
compares the final federated model's accuracy against the Sprint 2
centralized baseline -- the key question this sprint answers is how
much, if anything, federating the training costs in accuracy.

The baseline figure is read from saved_models/tabular_metrics.json
(written by train_baseline.py) rather than hardcoded, so the
comparison can't quote a stale number. See AUDIT.md (P1-1).

Two comparisons are printed, deliberately. The saved baseline is a
recall-tuned random forest, while the federated client wraps logistic
regression -- so "federated vs saved baseline" mixes the federation effect
together with the change of model family, and cannot answer the question
this sprint asks. The like-for-like line fits the same logistic regression
centrally on the same split, which isolates the federation effect. That
number is computed here rather than quoted, for the same reason the
baseline is read from disk.

Before any of those numbers are trusted, the run is checked for whether the
federation actually completed: FedAvg accepts client failures by default, so a
crashed client silently shrinks the number of hospitals in the average without
changing how confidently the average is printed. See
src/federated/server.py Participation, and AUDIT.md (P1-10).

Usage:
    python scripts/train_federated.py
    python scripts/train_federated.py --clients 5 --rounds 20
"""

import argparse
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
from sklearn.base import clone  # noqa: E402
from sklearn.metrics import accuracy_score  # noqa: E402
from src.data.load_tabular import fetch_uci_ckd  # noqa: E402
from src.data.preprocess import prepare_tabular  # noqa: E402
from src.federated.server import run_simulation  # noqa: E402
from src.models import tabular_model  # noqa: E402

NUM_CLIENTS = 3
NUM_ROUNDS = 10  # defaults; override with --clients / --rounds

# The model family src/federated/client.py federates. Named here so the
# like-for-like comparison below cannot drift away from what is federated.
CENTRALIZED_EQUIVALENT = "logistic_regression"


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Run the federated (FedAvg) simulation and compare it to "
                    "centralized training on the same split.",
    )
    parser.add_argument(
        "--clients", type=int, default=NUM_CLIENTS,
        help=f"Number of simulated hospital clients (default: {NUM_CLIENTS}). "
             f"The training split is partitioned evenly between them.",
    )
    parser.add_argument(
        "--rounds", type=int, default=NUM_ROUNDS,
        help=f"Number of federated rounds (default: {NUM_ROUNDS}).",
    )
    args = parser.parse_args(argv)
    if args.clients < 2:
        parser.error("--clients must be at least 2; a single client is not federation.")
    if args.rounds < 1:
        parser.error("--rounds must be at least 1.")
    return args


def main(argv=None):
    args = parse_args(argv)
    print("Loading and cleaning data...")
    raw = fetch_uci_ckd()
    X_train, X_test, y_train, y_test, _ = prepare_tabular(raw)

    X_train_arr = X_train.values
    X_test_arr = X_test.values
    y_train_arr = (y_train.values == "ckd").astype(int)
    y_test_arr = (y_test.values == "ckd").astype(int)

    print(f"Simulating {args.clients} hospital clients, {args.rounds} federated rounds...\n")
    history, participation = run_simulation(
        X_train_arr, y_train_arr, X_test_arr, y_test_arr,
        num_clients=args.clients, num_rounds=args.rounds,
    )

    print("\nPer-round accuracy (federated global model, evaluated each round):")
    accuracies = history.metrics_distributed.get("accuracy", [])
    for round_num, acc in accuracies:
        print(f"  round {round_num:2d}: {acc:.4f}")

    # Whether the federation that produced those numbers is the one that was
    # requested. FedAvg accepts client failures by default, so a crashed client
    # lowers the number of hospitals in the average without lowering the
    # confidence with which the average gets printed. Reporting a degraded run
    # as a clean one is the failure mode this guards.
    shortfalls = participation.shortfalls()
    if shortfalls:
        print(
            f"\nWARNING: this run did NOT complete as a {args.clients}-client "
            f"federation. Every figure below is\naggregated over fewer hospitals "
            f"than requested and must not be quoted as a\n{args.clients}-client "
            f"result:"
        )
        for line in shortfalls:
            print(line)
        print(
            "  Cause is usually local resources, not the model: each simulated "
            "client is a\n  separate Ray worker importing its own scipy/sklearn. "
            "Re-run with fewer\n  --clients, or free memory, to get a figure that "
            "is comparable to the others."
        )

    if accuracies:
        final_acc = accuracies[-1][1]
        print(f"\nFinal federated accuracy: {final_acc:.4f}")

        # The comparison this sprint actually asks about: the same model family,
        # trained centrally on the same split. Anything else conflates the cost
        # of federating with the choice of estimator.
        centralized = clone(tabular_model.CANDIDATES[CENTRALIZED_EQUIVALENT])
        centralized.fit(X_train_arr, y_train_arr)
        central_acc = accuracy_score(y_test_arr, centralized.predict(X_test_arr))
        like_gap = central_acc - final_acc
        print(
            f"\nLike-for-like ({CENTRALIZED_EQUIVALENT}, trained centrally on the "
            f"same split): {central_acc:.4f}"
        )
        print(f"  cost of federating: {like_gap:+.4f} "
              f"({abs(round(like_gap * len(y_test_arr)))} of "
              f"{len(y_test_arr)} test patients)")

        baseline = tabular_model.load_metrics(config.TABULAR_METRICS_PATH)
        if baseline is None:
            print("Centralized baseline not found -- run scripts/train_baseline.py "
                  "to generate it, then re-run this for the comparison.")
        else:
            base_acc = baseline["accuracy"]
            gap = base_acc - final_acc
            verdict = ("federation cost this much accuracy" if gap > 0
                       else "federation matched or beat the centralized baseline")
            print(f"\nSaved Sprint 2 baseline ({baseline['model']}) was: {base_acc:.4f}")
            print(f"Gap: {gap:.4f} ({verdict})")
            # Two honest qualifications on that last line, both of which the
            # number alone invites a reader to miss.
            print(
                f"  NOTE: this gap is {abs(round(gap * len(y_test_arr)))} patient(s) "
                f"out of {len(y_test_arr)}, and it is not model-for-model -- the "
                f"baseline is a\n  recall-tuned {baseline['model']}, the federated "
                f"client is {CENTRALIZED_EQUIVALENT}. Use the like-for-like line "
                f"above to judge federation."
            )


if __name__ == "__main__":
    main()