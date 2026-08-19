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


def run_simulation(X_train, y_train, X_test, y_test, num_clients=3, num_rounds=10, local_epochs=1):
    """
    Partitions the training data across num_clients simulated
    hospitals, runs FedAvg for num_rounds, and returns the
    round-by-round accuracy history so it can be plotted/reported.
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

    strategy = FedAvg(
        fraction_fit=1.0,
        fraction_evaluate=1.0,
        min_fit_clients=num_clients,
        min_evaluate_clients=num_clients,
        min_available_clients=num_clients,
        evaluate_metrics_aggregation_fn=weighted_accuracy_average,
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
    return history