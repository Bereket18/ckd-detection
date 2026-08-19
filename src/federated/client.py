"""
Sprint 5: Flower (flwr) client -- represents one simulated hospital.
Each client trains only on its own local partition of the data and
never sends raw records anywhere; only the model's learned
parameters (coefficients) leave this class.

Uses scikit-learn's LogisticRegression with warm_start=True, which
lets it continue optimizing from a given starting coef_/intercept_
rather than fitting fresh each round -- this is what makes "start
from the global model, train locally, send back updated
parameters" (the core FedAvg pattern) work with a non-neural-network
model.
"""

import numpy as np
from flwr.client import NumPyClient
from sklearn.linear_model import LogisticRegression


def get_model_parameters(model):
    """Extract [coef_, intercept_] as a list of numpy arrays -- Flower's expected parameter format."""
    return [model.coef_, model.intercept_]


def set_model_parameters(model, parameters):
    model.coef_ = parameters[0]
    model.intercept_ = parameters[1]
    return model


class CKDClient(NumPyClient):
    """One simulated hospital: wraps a LogisticRegression model plus
    this client's local partition of the tabular training data."""

    def __init__(self, X_train, y_train, X_test, y_test, n_features, local_epochs=1):
        self.X_train, self.y_train = X_train, y_train
        self.X_test, self.y_test = X_test, y_test
        self.local_epochs = local_epochs
        self.model = LogisticRegression(
            max_iter=100, warm_start=True, random_state=42,
        )
        # LogisticRegression requires at least one .fit() call before
        # coef_/intercept_ exist, so initialize with zeros of the
        # right shape via a throwaway fit on this client's own data --
        # the real starting point comes from set_parameters() right after.
        self.model.classes_ = np.array([0, 1])
        self.model.coef_ = np.zeros((1, n_features))
        self.model.intercept_ = np.zeros(1)

    def get_parameters(self, config):
        return get_model_parameters(self.model)

    def fit(self, parameters, config):
        set_model_parameters(self.model, parameters)
        for _ in range(self.local_epochs):
            self.model.fit(self.X_train, self.y_train)
        return get_model_parameters(self.model), len(self.X_train), {}

    def evaluate(self, parameters, config):
        set_model_parameters(self.model, parameters)
        accuracy = self.model.score(self.X_test, self.y_test)
        loss = 1.0 - accuracy  # simple proxy loss; accuracy is the metric we actually care about
        return loss, len(self.X_test), {"accuracy": accuracy}


def partition_data(X, y, num_clients, seed=42):
    """
    Split the tabular training data into num_clients partitions, one
    per simulated hospital. Uses a plain random (non-overlapping)
    split -- with only 320 training rows, keeping partitions simple
    and evenly sized matters more here than simulating realistic
    non-IID hospital differences, which would need far more data to
    do meaningfully.
    """
    rng = np.random.default_rng(seed)
    indices = rng.permutation(len(X))
    splits = np.array_split(indices, num_clients)
    return [(X[idx], y[idx]) for idx in splits]