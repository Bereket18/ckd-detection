from typing import Any

from fastapi import APIRouter, Depends

from api.dependencies import require_prediction_service
from src.services.clinical_prediction import ClinicalPredictionService


router = APIRouter(tags=["model"])


@router.get("/model", response_model=dict[str, Any])
def model_metadata(
    service: ClinicalPredictionService = Depends(require_prediction_service),
):
    return service.model_metadata()
