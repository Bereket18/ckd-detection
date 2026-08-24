import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import numpy as np
import pytest
from src.federated.client import CKDClient, get_model_parameters, set_model_parameters, partition_data
from src.federated.server import Participation, weighted_accuracy_average


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


# ---------------------------------------------------------------------------
# Client participation (AUDIT.md P1-10)
#
# FedAvg defaults to accept_failures=True, so a round whose clients crash is
# still aggregated over the survivors and reported as if the whole federation
# had run. A real `--clients 5` run lost two clients in round 1 and printed a
# clean "round 1: 0.9875" for a three-hospital average, exit code 0.
#
# The simulation itself needs Ray and is slow, so these test the reporting logic
# directly against the counts Flower would hand it. That is the part that was
# wrong -- the crashes are environmental.
# ---------------------------------------------------------------------------

def _client_metrics(n_clients, accuracy=1.0, num_examples=80):
    """The shape Flower passes to the aggregation callbacks: one entry per
    client that actually returned a result."""
    return [(num_examples, {"accuracy": accuracy}) for _ in range(n_clients)]


def test_weighted_accuracy_average_weights_by_local_test_size():
    """The pre-existing aggregation had no test at all, and it is now wrapped by
    the participation recorder -- so this pins the value the wrapper must
    preserve. Unequal partition sizes are the case a plain mean gets wrong."""
    metrics = [(90, {"accuracy": 1.0}), (10, {"accuracy": 0.0})]
    assert weighted_accuracy_average(metrics)["accuracy"] == pytest.approx(0.9)


def test_recording_participation_does_not_change_the_aggregated_accuracy():
    """The recorder wraps the real aggregation; measuring must not perturb."""
    record = Participation(expected_clients=2, num_rounds=1)
    metrics = [(90, {"accuracy": 1.0}), (10, {"accuracy": 0.0})]
    assert record.record_evaluate(metrics) == weighted_accuracy_average(metrics)


def test_an_intact_federation_reports_no_shortfall():
    record = Participation(expected_clients=3, num_rounds=2)
    for _ in range(2):
        record.record_fit(_client_metrics(3))
        record.record_evaluate(_client_metrics(3))

    assert record.shortfalls() == []
    assert record.complete is True


def test_a_round_missing_clients_is_named_with_its_round_number():
    """The observed failure: round 1 aggregated 3 of 5, later rounds recovered.
    Both the round and the count must be reported, because 'some round was
    degraded' is not enough to tell whether the final figure is affected."""
    record = Participation(expected_clients=5, num_rounds=3)
    record.record_fit(_client_metrics(3))        # round 1: two clients died
    record.record_evaluate(_client_metrics(3))
    for _ in range(2):                           # rounds 2-3: recovered
        record.record_fit(_client_metrics(5))
        record.record_evaluate(_client_metrics(5))

    assert record.complete is False
    shortfalls = record.shortfalls()
    assert len(shortfalls) == 2                  # one fit line, one evaluate line
    assert all("round 1" in line for line in shortfalls)
    assert all("3 of 5 hospitals" in line for line in shortfalls)
    # Rounds that were intact must not be mentioned -- a warning that fires on
    # healthy rounds is one a reader learns to skip past.
    assert not any("round 2" in line or "round 3" in line for line in shortfalls)


def test_a_round_where_every_client_fails_is_reported_without_round_numbers():
    """
    Flower skips the aggregation callback entirely when a round returns no
    results, so that round is absent from the counts rather than recorded as a
    zero -- which means positional round numbers no longer line up. Guessing
    them would mislabel which round failed, so the count is reported and the
    numbering is dropped.
    """
    record = Participation(expected_clients=4, num_rounds=3)
    record.record_fit(_client_metrics(4))
    record.record_evaluate(_client_metrics(4))
    record.record_fit(_client_metrics(2))
    record.record_evaluate(_client_metrics(2))
    # third round: total failure, no callback at all

    shortfalls = record.shortfalls()
    assert record.complete is False
    assert any("1 of 3 round(s) produced no fit results at all" in line
               for line in shortfalls)
    assert any("2 of 4 hospitals" in line for line in shortfalls)
    assert not any("round 1" in line or "round 2" in line for line in shortfalls)


# ---------------------------------------------------------------------------
# The reporting path in scripts/train_federated.py
#
# The warning above is only reachable in real life through a run whose clients
# crash, which is exactly the run nobody can reproduce on demand. Stubbing
# run_simulation exercises the reporting without Ray, so the guard against
# quoting a degraded figure is itself covered.
# ---------------------------------------------------------------------------

class _FakeHistory:
    """Only .metrics_distributed is read by the script."""

    def __init__(self, accuracies):
        self.metrics_distributed = {"accuracy": accuracies}


def _stub_simulation(monkeypatch, per_round_clients, expected_clients):
    """Replace run_simulation with one that reports a chosen participation
    pattern. per_round_clients is the count that reported in each round."""
    import scripts.train_federated as train_federated

    def fake_run_simulation(*args, **kwargs):
        record = Participation(expected_clients, len(per_round_clients))
        for n in per_round_clients:
            record.record_fit([(64, {}) for _ in range(n)])
            record.record_evaluate([(80, {"accuracy": 0.9875}) for _ in range(n)])
        accuracies = [(i + 1, 0.9875) for i in range(len(per_round_clients))]
        return _FakeHistory(accuracies), record

    monkeypatch.setattr(train_federated, "run_simulation", fake_run_simulation)
    return train_federated


def test_a_degraded_federation_is_flagged_in_the_printed_report(monkeypatch, capsys):
    """
    The counts here are the ones Flower actually logged for `--clients 5` on
    this machine: "received 3 results and 2 failures" in round 1, then full
    participation. Before this guard that run printed a clean
    "round 1: 0.9875" and exited 0.
    """
    train_federated = _stub_simulation(monkeypatch, [3, 5, 5], expected_clients=5)
    train_federated.main(["--clients", "5", "--rounds", "3"])

    out = capsys.readouterr().out
    assert "did NOT complete as a 5-client federation" in out
    assert "round 1 fit: the global model was averaged over 3 of 5 hospitals" in out
    assert "round 1 evaluate" in out
    # The figures are still printed -- suppressing them would just move the
    # problem -- but they can no longer be read as an intact 5-client result.
    assert "Final federated accuracy: 0.9875" in out


def test_an_intact_federation_prints_no_warning(monkeypatch, capsys):
    """The complement, and the more important of the two: a warning that also
    fires on healthy runs teaches the reader to ignore it."""
    train_federated = _stub_simulation(monkeypatch, [3, 3, 3], expected_clients=3)
    train_federated.main(["--clients", "3", "--rounds", "3"])

    out = capsys.readouterr().out
    assert "did NOT complete" not in out
    assert "hospitals" not in out
    assert "Final federated accuracy: 0.9875" in out