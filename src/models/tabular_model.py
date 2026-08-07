"""
Sprint 2: the accuracy-critical baseline model — trained on the
clinical/lab modality alone. This is the model the Sprint 6 agent
will actually call at inference time (imaging/text/fusion layer
from Sprints 3-4 can be a stretch goal on top of this).
"""

from __future__ import annotations
import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score, StratifiedKFold, GridSearchCV
from sklearn.metrics import (
    accuracy_score, precision_recall_fscore_support, roc_auc_score,
    confusion_matrix, classification_report,
)
from xgboost import XGBClassifier


CANDIDATES = {
    "logistic_regression": LogisticRegression(max_iter=1000, random_state=42),
    "random_forest": RandomForestClassifier(random_state=42),
    "xgboost": XGBClassifier(eval_metric="logloss", random_state=42),
}

# GridSearchCV parameter grids — kept small and sensible rather than
# exhaustive, since the dataset is only 320 training rows.
PARAM_GRIDS = {
    "logistic_regression": {"C": [0.01, 0.1, 1, 10]},
    "random_forest": {"n_estimators": [100, 200], "max_depth": [3, 5, None]},
    "xgboost": {"n_estimators": [100, 200], "max_depth": [3, 5], "learning_rate": [0.05, 0.1]},
}


def _to_binary_target(y):
    """Models need 0/1, not the string labels 'ckd'/'notckd'."""
    return (np.asarray(y) == "ckd").astype(int)


def compare_candidates(X_train, y_train, cv=5):
    """
    5-fold stratified cross-validation on every candidate, using
    accuracy as the quick comparison metric (full precision/recall/F1
    happens later, only on the winner, against the held-out test set).
    Returns a dict of {name: (mean_cv_accuracy, std_cv_accuracy)}.
    """
    y_bin = _to_binary_target(y_train)
    skf = StratifiedKFold(n_splits=cv, shuffle=True, random_state=42)
    results = {}
    for name, model in CANDIDATES.items():
        scores = cross_val_score(model, X_train, y_bin, cv=skf, scoring="accuracy")
        results[name] = (scores.mean(), scores.std())
    return results


def tune_model(name, X_train, y_train, cv=5):
    """GridSearchCV over PARAM_GRIDS[name], returns the best fitted estimator."""
    y_bin = _to_binary_target(y_train)
    skf = StratifiedKFold(n_splits=cv, shuffle=True, random_state=42)
    grid = GridSearchCV(CANDIDATES[name], PARAM_GRIDS[name], cv=skf, scoring="recall", n_jobs=-1)
    grid.fit(X_train, y_bin)
    return grid.best_estimator_, grid.best_params_


def evaluate(model, X_test, y_test) -> dict:
    """
    Full evaluation on the held-out test set — accuracy, precision,
    recall, F1, AUC-ROC, and the confusion matrix. Recall is reported
    separately and prominently because a missed CKD case (false
    negative) is costlier than a false alarm, per the PRD's success
    metrics.
    """
    y_bin = _to_binary_target(y_test)
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    precision, recall, f1, _ = precision_recall_fscore_support(
        y_bin, y_pred, average="binary", zero_division=0
    )
    return {
        "accuracy": accuracy_score(y_bin, y_pred),
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "auc_roc": roc_auc_score(y_bin, y_proba),
        "confusion_matrix": confusion_matrix(y_bin, y_pred).tolist(),
        "classification_report": classification_report(y_bin, y_pred, target_names=["notckd", "ckd"]),
    }


def save_model(model, path):
    joblib.dump(model, path)