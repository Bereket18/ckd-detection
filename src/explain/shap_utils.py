"""
Sprint 6: explainability layer -- lets the agent say *why* it
predicted CKD risk, not just return a bare label.

Two correctness rules this module has to hold, both of which it got
wrong originally (see AUDIT.md, P0-4 and P0-5):

  1. The SIGN of a SHAP value is meaningful. Positive pushes toward
     "ckd", negative toward "notckd". A feature can be the single
     largest influence on a prediction while pushing *against* the
     predicted class -- so the direction has to come from the sign,
     never from the predicted label.
  2. The explainer has to match the model. scripts/train_baseline.py
     picks whichever of logistic regression / random forest / XGBoost
     scores best, so this module cannot assume a linear model.
"""

from __future__ import annotations
import numpy as np
import pandas as pd
import shap


def get_explainer(model, background_df):
    """
    Return a SHAP explainer appropriate for `model`.

    train_baseline.py saves whichever candidate wins cross-validation, so
    the winner is data-dependent: it is logistic regression today, but a
    retrain (or a different dataset, e.g. the St. Paul's data) can make it
    random forest or XGBoost. Hardcoding LinearExplainer meant the agent
    would raise InvalidModelError at the very last step of a consultation
    in that case -- after the patient had answered all 24 questions.

    Dispatch is on the fitted attributes rather than the class name, so a
    new linear or tree-based candidate works without touching this code.
    """
    if hasattr(model, "coef_"):
        return shap.LinearExplainer(model, background_df)
    if hasattr(model, "feature_importances_"):
        return shap.TreeExplainer(model)
    # Last resort: model-agnostic, works for anything with predict_proba,
    # but far slower -- so it is a fallback, not the default path.
    return shap.KernelExplainer(model.predict_proba, background_df)


def _positive_class_row(shap_output) -> np.ndarray:
    """
    Normalize the several shapes SHAP returns into a single 1-D vector of
    per-feature attributions toward the positive ("ckd") class.

    Needed because the return shape depends on the explainer and the
    model: LinearExplainer gives (n_samples, n_features); TreeExplainer on
    a scikit-learn forest gives (n_samples, n_features, n_classes);
    KernelExplainer gives a list of one array per class. Without this,
    swapping explainers silently changes the meaning of the numbers.
    """
    if isinstance(shap_output, list):
        # One array per class -> the last one is the positive class.
        shap_output = shap_output[-1] if len(shap_output) > 1 else shap_output[0]

    values = np.asarray(shap_output)
    row = values[0]
    if row.ndim > 1:
        row = row[:, -1]  # (n_features, n_classes) -> positive-class column
    return np.asarray(row, dtype=float).ravel()


def explain_prediction(model, patient_row, feature_names, background_data, top_n=3):
    """
    Returns the top_n features that most influenced this specific
    patient's prediction, as a list of (feature_name, shap_value)
    tuples sorted by absolute impact (largest first). Positive
    shap_value means that feature pushed the prediction toward
    "ckd"; negative means it pushed toward "notckd".

    Sorting is by ABSOLUTE value on purpose -- the goal is "which of
    this patient's answers mattered most", regardless of which way they
    pointed. Callers must therefore read the sign to describe direction;
    explanation_to_sentence() below does exactly that.

    background_data: a small reference sample (e.g. the training
    set) SHAP uses to establish a baseline for "what's a typical
    patient" -- required to compute meaningful attributions, not
    just an implementation detail to skip.

    patient_row / background_data are wrapped as DataFrames with
    real column names before being passed to the model/explainer --
    this matches how the model was originally trained (also on a
    DataFrame) and avoids a spurious sklearn warning that would
    otherwise print on every single prediction, which would look
    unpolished in a live demo.
    """
    background_df = pd.DataFrame(background_data, columns=feature_names)
    explainer = get_explainer(model, background_df)
    return explain_with_explainer(explainer, patient_row, feature_names, top_n=top_n)


def explain_with_explainer(explainer, patient_row, feature_names, top_n=3):
    """Explain one row with an already-created explainer."""
    patient_df = pd.DataFrame([patient_row], columns=feature_names)
    shap_values = _positive_class_row(explainer.shap_values(patient_df))

    impacts = list(zip(feature_names, shap_values))
    impacts.sort(key=lambda pair: abs(pair[1]), reverse=True)
    return impacts[:top_n]


FEATURE_PLAIN_LANGUAGE = {
    "age": "age",
    "bp": "blood pressure",
    "sg": "urine specific gravity",
    "al": "albumin level",
    "su": "sugar level",
    "bgr": "blood glucose",
    "bu": "blood urea",
    "sc": "serum creatinine",
    "sod": "sodium level",
    "pot": "potassium level",
    "hemo": "hemoglobin level",
    "pcv": "packed cell volume",
    "wc": "white blood cell count",
    "rc": "red blood cell count",
    "rbc": "red blood cell status",
    "pc": "pus cell status",
    "pcc": "pus cell clumps",
    "ba": "bacteria presence",
    "htn": "hypertension history",
    "dm": "diabetes history",
    "cad": "coronary artery disease history",
    "appet": "appetite",
    "pe": "pedal edema",
    "ane": "anemia",
}


def _join_names(names: list[str]) -> str:
    """Comma-separated list with a final 'and' -- 'a', 'a and b', 'a, b, and c'."""
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} and {names[1]}"
    return ", ".join(names[:-1]) + f", and {names[-1]}"


def explanation_to_sentence(impacts, risk_label):
    """
    Turns the raw (feature, shap_value) pairs into a plain-language
    sentence the agent can actually say to a patient. Only names
    the features, not raw SHAP numbers -- a patient doesn't need to
    see "0.34", they need to know which of their answers mattered.

    Direction comes from each feature's own SHAP sign, NOT from the
    predicted label. This used to derive one direction from risk_label
    and apply it to every named feature, which stated the opposite of the
    truth whenever a top feature pushed against the prediction -- for 15
    of the 80 test-set patients (19%). A patient could read that as
    reassurance about the exact value the model was most concerned by.
    See AUDIT.md (P0-4).
    """
    raising = [f for f, v in impacts if v > 0]
    lowering = [f for f, v in impacts if v < 0]

    def plain(keys):
        return [FEATURE_PLAIN_LANGUAGE.get(k, k) for k in keys]

    clauses = []
    if raising:
        clauses.append(f"your {_join_names(plain(raising))} pushed your risk up")
    if lowering:
        clauses.append(f"your {_join_names(plain(lowering))} pushed your risk down")

    if not clauses:
        # Every top feature had exactly zero impact -- vanishingly unlikely,
        # but say something honest rather than inventing a driver.
        outcome = "higher risk" if risk_label == "ckd" else "lower risk"
        return f"No single answer stood out as the main driver of this {outcome} result."

    sentence = ", while ".join(clauses)
    return sentence[0].upper() + sentence[1:] + "."
