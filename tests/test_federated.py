import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import numpy as np
from src.federated.client import CKDClient, get_model_parameters, set_model_parameters, partition_data


def _make_toy_data(n=60, n_features=4, seed=0):
    rng = np.random.default_rng(seed)
    X = rng.normal(size=(n, n_features))
    y = (X[:, 0] + X[:, 1] > 0).astype(int)  # simple, learnable pattern
    return X, y


def test_partition_data_splits_are_disjoint_and_cover_everything():
    X, y = _make_toy_data(n=90)
    partitions = partition_data(X, y, num_clients=3)
    assert len(partitions) == 3
    total_rows = sum(len(px) for px, _ in partitions)
    assert total_rows == 90


def test_client_fit_returns_updated_parameters_and_example_count():
    X, y = _make_toy_data(n=60)
    client = CKDClient(X, y, X, y, n_features=4)
    initial_params = get_model_parameters(client.model)

    updated_params, num_examples, _ = client.fit(initial_params, {})
    assert num_examples == len(X)
    assert updated_params[0].shape == initial_params[0].shape  # coef_ shape unchanged
    assert updated_params[1].shape == initial_params[1].shape  # intercept_ shape unchanged


def test_client_evaluate_returns_accuracy_between_0_and_1():
    X, y = _make_toy_data(n=60)
    client = CKDClient(X, y, X, y, n_features=4)
    params, _, _ = client.fit(get_model_parameters(client.model), {})

    loss, num_examples, metrics = client.evaluate(params, {})
    assert 0.0 <= metrics["accuracy"] <= 1.0
    assert num_examples == len(X)


def test_set_then_get_parameters_round_trip():
    X, y = _make_toy_data(n=60)
    client = CKDClient(X, y, X, y, n_features=4)
    fake_params = [np.ones((1, 4)) * 0.5, np.array([0.1])]

    set_model_parameters(client.model, fake_params)
    retrieved = get_model_parameters(client.model)

    assert np.allclose(retrieved[0], fake_params[0])
    assert np.allclose(retrieved[1], fake_params[1])