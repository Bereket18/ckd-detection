"""Shared, framework-independent clinical CKD inference service."""

from __future__ import annotations

import hashlib
import threading
from pathlib import Path
from typing import Any, Iterable, Mapping

import joblib
import numpy as np
import pandas as pd

import config
from src.data.preprocess import encoded_feature_frame
from src.explain.shap_utils import (
    explain_with_explainer,
    explanation_to_sentence,
    get_explainer,
)
from src.models import tabular_model


DISCLAIMER = (
    "This tool provides an informal risk screening only. It is not a medical "
    "diagnosis. Please consult a healthcare professional for concerns about "
    "your kidney health."
)


class ArtifactLoadError(RuntimeError):
    """Raised when a required inference artifact cannot be loaded."""


class SchemaCompatibilityError(RuntimeError):
    """Raised when saved artifacts disagree about their feature schema."""


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class ClinicalPredictionService:
    """Load one verified tabular artifact bundle and score patient records."""

    def __init__(
        self,
        model,
        preprocessor,
        background: pd.DataFrame,
        metrics: dict | None = None,
        artifact_metadata: dict | None = None,
    ):
        self.model = model
        self.preprocessor = preprocessor
        self.background = background
        self.metrics = metrics or {}
        self.artifact_metadata = artifact_metadata or {}
        self.feature_columns = list(preprocessor.feature_columns)
        self._verify_schema()
        self.explainer = get_explainer(self.model, self.background)
        self._shap_lock = threading.Lock()

    @classmethod
    def from_artifacts(cls, suffix: str = "") -> "ClinicalPredictionService":
        paths = config.artifact_paths(suffix)
        required = ("model", "preprocessor", "shap_background")
        missing = [str(paths[name]) for name in required if not paths[name].exists()]
        if missing:
            raise ArtifactLoadError(
                "Missing required clinical inference artifact(s): " + ", ".join(missing)
            )

        try:
            model = joblib.load(paths["model"])
            preprocessor = joblib.load(paths["preprocessor"])
            background = joblib.load(paths["shap_background"])
        except Exception as exc:
            raise ArtifactLoadError(f"Could not load the clinical artifact bundle: {exc}") from exc

        metrics = tabular_model.load_metrics(paths["metrics"]) or {}
        # The sha256 is kept for integrity verification; the absolute filesystem
        # path is deliberately excluded. Exposing it via the /model endpoint would
        # leak server directory layout to any API caller (AUDIT: security finding,
        # also documented in FRONTEND_PLAN.md Rule 11).
        artifact_metadata = {
            name: {
                "sha256": _sha256(path),
            }
            for name, path in paths.items()
            if path.exists()
        }
        return cls(model, preprocessor, background, metrics, artifact_metadata)

    @classmethod
    def from_components(
        cls,
        model,
        preprocessor,
        background: pd.DataFrame | None = None,
        metrics: dict | None = None,
    ) -> "ClinicalPredictionService":
        if background is None:
            background = pd.DataFrame(
                np.zeros((1, len(preprocessor.feature_columns))),
                columns=preprocessor.feature_columns,
            )
        return cls(model, preprocessor, background, metrics)

    def _verify_schema(self) -> None:
        expected = self.feature_columns
        model_count = getattr(self.model, "n_features_in_", None)
        if model_count is not None and int(model_count) != len(expected):
            raise SchemaCompatibilityError(
                f"Model expects {model_count} features but the preprocessor produces "
                f"{len(expected)}. Refusing to score with mismatched artifacts."
            )

        model_names = getattr(self.model, "feature_names_in_", None)
        if model_names is not None and list(model_names) != expected:
            raise SchemaCompatibilityError(
                "Model and preprocessor feature names/order do not match. "
                "Refusing to score with mismatched artifacts."
            )

        if not isinstance(self.background, pd.DataFrame):
            self.background = pd.DataFrame(self.background, columns=expected)
        if list(self.background.columns) != expected:
            raise SchemaCompatibilityError(
                "SHAP background and preprocessor feature names/order do not match. "
                "Refusing to explain with mismatched artifacts."
            )

    def _canonical_frame(
        self, rows: Mapping[str, Any] | Iterable[Mapping[str, Any]] | pd.DataFrame
    ) -> pd.DataFrame:
        if isinstance(rows, pd.DataFrame):
            frame = rows.copy()
        elif isinstance(rows, Mapping):
            frame = pd.DataFrame([dict(rows)])
        else:
            frame = pd.DataFrame([dict(row) for row in rows])

        missing_columns = [name for name in self.feature_columns if name not in frame.columns]
        if missing_columns:
            raise ValueError(
                f"Missing feature column(s): {missing_columns}. Supply every field; "
                "use null for genuinely unknown values."
            )
        return frame

    def _prepare(self, rows) -> tuple[pd.DataFrame, pd.DataFrame, list[list[str]]]:
        frame = self._canonical_frame(rows)
        encoded = encoded_feature_frame(frame, self.preprocessor)

        invalid = []
        for position, (_, source_row) in enumerate(frame.iterrows()):
            bad = [
                field
                for field in self.feature_columns
                if pd.isna(encoded.iloc[position][field])
                and not pd.isna(source_row[field])
            ]
            if bad:
                invalid.append((position, bad))
        if invalid:
            detail = "; ".join(f"row {position}: {fields}" for position, fields in invalid)
            raise ValueError(
                "Unrecognized or malformed feature value(s): " + detail + ". "
                "Use null only when the value is genuinely unknown."
            )

        imputed_fields = [
            [field for field in self.feature_columns if pd.isna(encoded.iloc[i][field])]
            for i in range(len(encoded))
        ]
        return frame, self.preprocessor.transform(encoded), imputed_fields

    def _drivers(self, row, top_n: int) -> list[dict]:
        with self._shap_lock:
            impacts = explain_with_explainer(
                self.explainer, row, self.feature_columns, top_n=top_n
            )
        return [
            {
                "feature": feature,
                "value": float(value),
                "direction": "raises_risk" if value > 0 else "lowers_risk" if value < 0 else "neutral",
            }
            for feature, value in impacts
        ]

    def predict_one(self, patient: Mapping[str, Any], explain: bool = True, top_n: int = 3) -> dict:
        _, features, imputed = self._prepare(patient)
        prediction = int(self.model.predict(features)[0])
        probability = float(self.model.predict_proba(features)[0, 1])
        label = "ckd" if prediction == 1 else "notckd"
        drivers = self._drivers(features.iloc[0].to_numpy(), top_n) if explain else []
        impacts = [(item["feature"], item["value"]) for item in drivers]
        return {
            "prediction": label,
            "ckd_score": probability,
            "risk_band": tabular_model.risk_band(probability),
            "imputed_fields": imputed[0],
            "imputation_count": len(imputed[0]),
            "shap_drivers": drivers,
            "explanation": explanation_to_sentence(impacts, label) if impacts else None,
            "model": self.model_metadata(),
            "disclaimer": DISCLAIMER,
        }

    def predict_batch(self, rows, explain: bool = False, top_n: int = 3) -> list[dict]:
        _, features, imputed = self._prepare(rows)
        predictions = self.model.predict(features)
        probabilities = self.model.predict_proba(features)[:, 1]
        results = []
        for index, (prediction, probability) in enumerate(zip(predictions, probabilities)):
            label = "ckd" if int(prediction) == 1 else "notckd"
            drivers = self._drivers(features.iloc[index].to_numpy(), top_n) if explain else []
            results.append({
                "prediction": label,
                "ckd_score": float(probability),
                "risk_band": tabular_model.risk_band(float(probability)),
                "imputed_fields": imputed[index],
                "imputation_count": len(imputed[index]),
                "shap_drivers": drivers,
            })
        return results

    def score_frame(self, frame: pd.DataFrame, explain: bool = False, top_n: int = 3) -> pd.DataFrame:
        results = self.predict_batch(frame, explain=explain, top_n=top_n)
        out = frame.copy()
        out["prediction"] = [row["prediction"] for row in results]
        out["p_ckd"] = [round(row["ckd_score"], 4) for row in results]
        out["risk_band"] = [row["risk_band"] for row in results]
        out["n_imputed"] = [row["imputation_count"] for row in results]
        if explain:
            out["top_drivers"] = [
                "; ".join(
                    f"{driver['feature']}({driver['value']:+.3f})"
                    for driver in row["shap_drivers"]
                )
                for row in results
            ]
        return out

    def model_metadata(self) -> dict:
        provenance = self.metrics.get("provenance", {})
        return {
            "name": self.metrics.get("model", type(self.model).__name__),
            "version": self.artifact_metadata.get("model", {}).get("sha256", "in-memory")[:12],
            "feature_count": len(self.feature_columns),
            "feature_schema": self.feature_columns,
            "datasets": provenance.get("datasets", []),
            "n_rows": provenance.get("n_rows"),
            "n_train": provenance.get("n_train"),
            "n_test": self.metrics.get("n_test"),
            "metrics": {
                key: self.metrics.get(key)
                for key in (
                    "accuracy", "precision", "recall", "specificity", "f1",
                    "auc_roc", "brier_score", "confusion_matrix", "intervals",
                )
                if key in self.metrics
            },
            "artifacts": self.artifact_metadata,
            "limitations": [
                "Research screening prototype; not a medical diagnosis.",
                "Trained on the UCI CKD dataset and not validated on Ethiopian patients.",
                "The CKD score is not a calibrated probability.",
                "Missing values are imputed from the training population.",
                "Imaging, fusion, and federated experiments are not active inference inputs.",
            ],
        }

    def health(self) -> dict:
        return {
            "status": "ok",
            "model": "ready",
            "preprocessor": "ready",
            "shap": "ready",
            "schema_compatible": True,
            "feature_count": len(self.feature_columns),
        }
