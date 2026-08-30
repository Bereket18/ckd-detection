from functools import lru_cache

from fastapi import HTTPException, status

from src.services.clinical_prediction import (
    ArtifactLoadError,
    ClinicalPredictionService,
    SchemaCompatibilityError,
)


@lru_cache(maxsize=1)
def get_prediction_service() -> ClinicalPredictionService:
    return ClinicalPredictionService.from_artifacts()


def require_prediction_service() -> ClinicalPredictionService:
    try:
        return get_prediction_service()
    except (ArtifactLoadError, SchemaCompatibilityError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
