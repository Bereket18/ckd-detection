"""
Sprint 2 entry point: trains the tabular baseline model and saves it
to config.TABULAR_MODEL_PATH, where src/agent/chatbot.py already
expects to find it.

Usage:
    python scripts/train_baseline.py
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
from src.data.load_tabular import fetch_uci_ckd  # noqa: E402
from src.data.preprocess import clean_tabular, split_train_test  # noqa: E402
from src.models import tabular_model  # noqa: E402


def main():
    print("Loading and cleaning data...")
    raw = fetch_uci_ckd()
    cleaned, scaler = clean_tabular(raw)
    X_train, X_test, y_train, y_test = split_train_test(cleaned)
    print(f"  train: {len(X_train)} rows, test: {len(X_test)} rows\n")

    print("Comparing candidate models (5-fold cross-validation, accuracy)...")
    comparison = tabular_model.compare_candidates(X_train, y_train)
    for name, (mean, std) in sorted(comparison.items(), key=lambda kv: -kv[1][0]):
        print(f"  {name:20s} {mean:.4f} (+/- {std:.4f})")

    best_name = max(comparison, key=lambda k: comparison[k][0])
    print(f"\nBest candidate: {best_name} — tuning with GridSearchCV (scoring=recall)...")
    best_model, best_params = tabular_model.tune_model(best_name, X_train, y_train)
    print(f"  best params: {best_params}")

    print("\nEvaluating on held-out test set...")
    results = tabular_model.evaluate(best_model, X_test, y_test)
    for metric in ["accuracy", "precision", "recall", "f1", "auc_roc"]:
        print(f"  {metric:10s} {results[metric]:.4f}")
    print(f"\n  confusion matrix [[TN, FP], [FN, TP]]: {results['confusion_matrix']}")
    print(f"\n{results['classification_report']}")

    config.SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    tabular_model.save_model(best_model, config.TABULAR_MODEL_PATH)
    import joblib
    joblib.dump(scaler, config.TABULAR_SCALER_PATH)
    print(f"Saved scaler to {config.TABULAR_SCALER_PATH}")
    print(f"Saved final model ({best_name}) to {config.TABULAR_MODEL_PATH}")

    return best_name, comparison, results


if __name__ == "__main__":
    main()