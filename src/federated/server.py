"""
Sprint 5: Flower simulation entry point -- runs multiple simulated
hospital clients inside this one process (flwr.simulation), no
actual network servers or deployment needed.
"""

import flwr as fl
import ray
from flwr.client import Client
from flwr.common import Metrics
from flwr.server.strategy import FedAvg
from flwr.simulation import start_simulation

from src.federated.client import CKDClient, partition_data


def weighted_accuracy_average(metrics: list[tuple[int, Metrics]]) -> Metrics:
    """
    Flower does not aggregate custom per-client metrics (like our
    "accuracy") automatically -- only the built-in loss is aggregated
    by default. This computes a weighted average across clients,
    weighted by each client's local test-set size, and is what
    actually makes per-round accuracy show up in history.metrics_distributed.
    """
    total_examples = sum(num_examples for num_examples, _ in metrics)
    weighted_acc = sum(num_examples * m["accuracy"] for num_examples, m in metrics)
    return {"accuracy": weighted_acc / total_examples}


class Participation:
    """
    Counts how many clients actually reported back in each round.

    This exists because FedAvg defaults to ``accept_failures=True``: a round
    whose clients crash is still aggregated over whichever ones survived, and
    the resulting accuracy is returned as though the whole federation had run.
    That is not hypothetical. On this machine ``--clients 5`` lost two clients
    in round 1 to Windows paging-file exhaustion (every Ray actor imports its
    own copy of scipy/sklearn), Flower logged "received 3 results and 2
    failures", and the script printed a clean ``round 1: 0.9875`` for what was
    really a three-hospital average. The process exited 0.

    The failures themselves are environmental, not a bug in this code, and
    ``accept_failures=False`` is not the fix: in Flower that makes the round
    return no aggregate at all, so the global model silently fails to update --
    harder to notice, not easier. The defect worth fixing is the *reporting*.
    So this counts what took part and lets the caller qualify the number.

    The count is a measurement rather than an inference: Flower invokes the
    metrics-aggregation callbacks with exactly one entry per client that
    returned a result, so ``len(metrics)`` *is* the participating client count.
    """

    def __init__(self, expected_clients: int, num_rounds: int):
        self.expected_clients = expected_clients
        self.num_rounds = num_rounds
        self.fit_counts: list[int] = []
        self.evaluate_counts: list[int] = []

    def record_fit(self, metrics: list[tuple[int, Metrics]]) -> Metrics:
        """Attached as fit_metrics_aggregation_fn. The clients return no fit
        metrics of their own, so there is nothing to aggregate -- but being
        attached is what makes the participation count observable."""
        self.fit_counts.append(len(metrics))
        return {}

    def record_evaluate(self, metrics: list[tuple[int, Metrics]]) -> Metrics:
        """Attached as evaluate_metrics_aggregation_fn, wrapping the real
        accuracy aggregation so counting cannot be forgotten separately."""
        self.evaluate_counts.append(len(metrics))
        return weighted_accuracy_average(metrics)

    @property
    def complete(self) -> bool:
        """True only if every round was aggregated over every client."""
        return not self.shortfalls()

    def shortfalls(self) -> list[str]:
        """
        One line per way the federation fell short of what was requested;
        empty when it ran intact. Returned as text rather than printed so the
        measuring code stays free of presentation.
        """
        lines = []
        for label, counts, effect in (
            ("fit", self.fit_counts,
             "the global model was averaged over"),
            ("evaluate", self.evaluate_counts,
             "the reported accuracy is a weighted average over"),
        ):
            # A round in which *every* client fails never reaches the
            # aggregation callback at all, so it is absent from the list rather
            # than recorded as a zero. That also means positional round numbers
            # can no longer be trusted, so they are not claimed in that case.
            missing = self.num_rounds - len(counts)
            if missing > 0:
                lines.append(
                    f"{missing} of {self.num_rounds} round(s) produced no {label} "
                    f"results at all (every client failed), so per-round numbering "
                    f"below is omitted for {label}"
                )
                lines.extend(
                    f"  a {label} round: {effect} {n} of {self.expected_clients} hospitals"
                    for n in counts if n < self.expected_clients
                )
                continue
            lines.extend(
                f"  round {i + 1} {label}: {effect} {n} of "
                f"{self.expected_clients} hospitals"
                for i, n in enumerate(counts) if n < self.expected_clients
            )
        return lines


def run_simulation(X_train, y_train, X_test, y_test, num_clients=3, num_rounds=10, local_epochs=1):
    """
    Partitions the training data across num_clients simulated
    hospitals, runs FedAvg for num_rounds, and returns
    ``(history, participation)`` -- the round-by-round accuracy history so it
    can be plotted/reported, and a Participation record of how many clients
    each round was actually aggregated over. The caller needs the second value
    to know whether the first describes the federation it asked for; see
    Participation for the run where it did not.
    All clients share the same held-out X_test/y_test for
    per-round evaluation, since the test set represents "how well
    does the current global model generalize," independent of
    which client is being evaluated.
    """
    n_features = X_train.shape[1]
    client_partitions = partition_data(X_train, y_train, num_clients)

    def client_fn(context) -> Client:
        cid = int(context.node_config["partition-id"])
        X_local, y_local = client_partitions[cid]
        return CKDClient(X_local, y_local, X_test, y_test, n_features, local_epochs).to_client()

    participation = Participation(num_clients, num_rounds)
    strategy = FedAvg(
        fraction_fit=1.0,
        fraction_evaluate=1.0,
        min_fit_clients=num_clients,
        min_evaluate_clients=num_clients,
        min_available_clients=num_clients,
        fit_metrics_aggregation_fn=participation.record_fit,
        evaluate_metrics_aggregation_fn=participation.record_evaluate,
    )

    # Initialize Ray manually with balanced object store and system memory limits
    if not ray.is_initialized():
        ray.init(
            num_cpus=2,
            object_store_memory=100 * 1024 * 1024,  # 100 MB (satisfies > 78.6 MB requirement)
            _system_config={
                "object_spilling_config": '{"type":"filesystem","params":{"directory_path":["C:\\\\Temp"]}}'
            },
            ignore_reinit_error=True,
            include_dashboard=False,
        )

    history = start_simulation(
        client_fn=client_fn,
        num_clients=num_clients,
        config=fl.server.ServerConfig(num_rounds=num_rounds),
        strategy=strategy,
    )
    return history, participation