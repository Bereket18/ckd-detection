"""
Sprint 2: the accuracy-critical baseline model — trained on the
clinical/lab modality alone. This is the model the Sprint 6 agent
will actually call at inference time (imaging/text/fusion layer
from Sprints 3-4 can be a stretch goal on top of this).
"""

# TODO (Sprint 2):
#   - train_baseline(X_train, y_train): try LogisticRegression,
#     RandomForestClassifier, and XGBClassifier; use GridSearchCV
#     with cross-validation to tune each
#   - evaluate(model, X_test, y_test): return accuracy, precision,
#     recall, F1, AUC-ROC — not accuracy alone
#   - save_model(model, path=config.TABULAR_MODEL_PATH): joblib.dump
