from fastapi import APIRouter

from api.dependencies import get_prediction_service
from api.schemas import HealthResponse
from src.services.clinical_prediction import ArtifactLoadError, SchemaCompatibilityError


router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
def health():
    try:
        return get_prediction_service().health()
    except (ArtifactLoadError, SchemaCompatibilityError) as exc:
        return {
            "status": "degraded",
            "model": "unavailable",
            "preprocessor": "unavailable",
            "shap": "unavailable",
            "schema_compatible": False,
            "detail": str(exc),
        }
