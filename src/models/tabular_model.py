"""
Sprint 2: the accuracy-critical baseline model — trained on the
clinical/lab modality alone. This is the model the Sprint 6 agent
will actually call at inference time (imaging/text/fusion layer
from Sprints 3-4 can be a stretch goal on top of this).
"""

from __future__ import annotations
import json
import math
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
    # n_jobs=1 (not -1): parallel workers can cause OpenBLAS thread/memory
    # crashes on some Windows setups. Dataset is small enough that this
    # costs no meaningful speed.
    grid = GridSearchCV(CANDIDATES[name], PARAM_GRIDS[name], cv=skf, scoring="recall", n_jobs=1)
    grid.fit(X_train, y_bin)
    return grid.best_estimator_, grid.best_params_


def wilson_interval(successes: int, n: int, z: float = 1.96):
    """
    Wilson score confidence interval for a proportion. Returns (low, high).

    Every metric this module reports is a proportion measured on 80 held-out
    rows, so a figure like "97.50%" carries about +/- 4 points of sampling
    uncertainty -- one extra misclassified patient moves accuracy by 1.25
    points. Reporting the point estimate alone implies a precision 80 rows
    cannot support.

    Wilson rather than the textbook normal approximation (Wald) specifically
    because the tuned model's recall is 100%. At p = 1.0 the Wald interval
    collapses to zero width -- it would claim [100%, 100%] from 50 positive
    cases, which is plainly false. Wilson stays sensible at the boundaries,
    which is the whole reason it is worth the extra three lines.

    Implemented with the standard library: no statsmodels or scipy.stats
    dependency is added for one formula.
    """
    if n == 0:
        return (0.0, 1.0)  # nothing observed -> no information, not a point
    p = successes / n
    denominator = 1 + z**2 / n
    centre = (p + z**2 / (2 * n)) / denominator
    half_width = (z / denominator) * math.sqrt(p * (1 - p) / n + z**2 / (4 * n**2))
    return (max(0.0, centre - half_width), min(1.0, centre + half_width))


def _intervals_from_confusion(confusion) -> dict:
    """
    95% Wilson intervals for the reported rates, derived from the confusion
    matrix so they cannot drift out of sync with the point estimates.

    confusion is [[TN, FP], [FN, TP]] -- the layout sklearn produces for a
    binary problem and the layout evaluate() already returns.

    Note each rate has a different denominator: recall is measured only on
    actual CKD patients, precision only on predicted-positive patients. That
    is why precision's interval is the widest despite a similar point value.
    """
    (tn, fp), (fn, tp) = confusion
    return {
        "accuracy": wilson_interval(tn + tp, tn + fp + fn + tp),
        "recall": wilson_interval(tp, tp + fn),          # of actual CKD cases
        "precision": wilson_interval(tp, tp + fp),        # of predicted CKD cases
        "specificity": wilson_interval(tn, tn + fp),      # of actual healthy cases
    }


def evaluate(model, X_test, y_test) -> dict:
    """
    Full evaluation on the held-out test set — accuracy, precision,
    recall, F1, AUC-ROC, and the confusion matrix. Recall is reported
    separately and prominently because a missed CKD case (false
    negative) is costlier than a false alarm, per the PRD's success
    metrics.

    Specificity is reported alongside it deliberately. Because tune_model
    optimizes for recall, recall alone is not an honest summary: a model that
    predicted "ckd" for every patient would score 100% recall and be useless.
    Specificity -- the share of healthy patients correctly cleared -- is what
    demonstrates the recall was not bought that way.

    Also returns 95% confidence intervals for the four rates. The test set is
    80 rows; every metric here is an estimate, and the interval is the honest
    statement of how good an estimate. See wilson_interval().
    """
    y_bin = _to_binary_target(y_test)
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    precision, recall, f1, _ = precision_recall_fscore_support(
        y_bin, y_pred, average="binary", zero_division=0
    )
    confusion = confusion_matrix(y_bin, y_pred).tolist()
    (tn, fp), (_fn, _tp) = confusion
    return {
        "accuracy": accuracy_score(y_bin, y_pred),
        "precision": precision,
        "recall": recall,
        "specificity": (tn / (tn + fp)) if (tn + fp) else 0.0,
        "f1": f1,
        "auc_roc": roc_auc_score(y_bin, y_proba),
        "confusion_matrix": confusion,
        "intervals": _intervals_from_confusion(confusion),
        "n_test": int(len(y_bin)),
        "classification_report": classification_report(y_bin, y_pred, target_names=["notckd", "ckd"]),
    }


def save_model(model, path):
    joblib.dump(model, path)


def save_metrics(model_name, results, path, provenance: dict | None = None):
    """
    Persist the baseline's measured held-out metrics so later sprints can
    compare against the real number instead of a hardcoded copy of it.

    Only the JSON-serializable scalar metrics are written -- the sklearn
    classification_report string is human-only and would just bloat the file.

    provenance records WHAT the model was trained on (dataset names, row count,
    feature list). Once a model can be trained on something other than UCI, a
    metrics file that does not say which data produced it is a number without a
    claim attached to it.
    """
    payload = {
        "model": model_name,
        **{k: results[k] for k in ("accuracy", "precision", "recall", "f1", "auc_roc")},
        "specificity": results.get("specificity"),
        "confusion_matrix": results["confusion_matrix"],
        "intervals": results.get("intervals", {}),
        "n_test": results.get("n_test"),
    }
    if provenance:
        payload["provenance"] = provenance
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_metrics(path):
    """Returns the saved baseline metrics, or None if the baseline hasn't been trained yet."""
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def append_metrics_history(entry: dict, path):
    """
    Append one training run to an append-only JSONL log.

    This is what makes "did adding that dataset actually help?" checkable
    rather than remembered. Each line is a complete self-describing record, so
    runs stay comparable even as the pipeline changes -- and nothing is ever
    rewritten, so an earlier disappointing result cannot quietly vanish.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry) + "\n")


def load_metrics_history(path) -> list[dict]:
    """Every recorded run, oldest first. Empty list if nothing has been logged."""
    if not path.exists():
        return []
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]