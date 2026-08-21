"""
Sprint 6: explainability layer -- lets the agent say *why* it
predicted CKD risk, not just return a bare label.
"""

from __future__ import annotations
import pandas as pd
import shap


def explain_prediction(model, patient_row, feature_names, background_data, top_n=3):
    """
    Returns the top_n features that most influenced this specific
    patient's prediction, as a list of (feature_name, shap_value)
    tuples sorted by absolute impact (largest first). Positive
    shap_value means that feature pushed the prediction toward
    "ckd"; negative means it pushed toward "notckd".

    background_data: a small reference sample (e.g. the training
    set) SHAP uses to establish a baseline for "what's a typical
    patient" -- required by LinearExplainer to compute meaningful
    attributions, not just an implementation detail to skip.

    patient_row / background_data are wrapped as DataFrames with
    real column names before being passed to the model/explainer --
    this matches how the model was originally trained (also on a
    DataFrame) and avoids a spurious sklearn warning that would
    otherwise print on every single prediction, which would look
    unpolished in a live demo.
    """
    background_df = pd.DataFrame(background_data, columns=feature_names)
    patient_df = pd.DataFrame([patient_row], columns=feature_names)

    explainer = shap.LinearExplainer(model, background_df)
    shap_values = explainer.shap_values(patient_df)[0]

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


def explanation_to_sentence(impacts, risk_label):
    """
    Turns the raw (feature, shap_value) pairs into a plain-language
    sentence the agent can actually say to a patient. Only names
    the features, not raw SHAP numbers -- a patient doesn't need to
    see "0.34", they need to know which of their answers mattered.
    """
    direction = "toward higher risk" if risk_label == "ckd" else "toward lower risk"
    names = [FEATURE_PLAIN_LANGUAGE.get(f, f) for f, _ in impacts]
    if len(names) == 1:
        joined = names[0]
    elif len(names) == 2:
        joined = f"{names[0]} and {names[1]}"
    else:
        joined = ", ".join(names[:-1]) + f", and {names[-1]}"
    return f"Your {joined} contributed most {direction}."