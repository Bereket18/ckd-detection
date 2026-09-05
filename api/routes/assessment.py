from __future__ import annotations

from io import StringIO

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import TypeAdapter, ValidationError

from api.dependencies import require_prediction_service
from api.schemas import (
    BatchPredictionResponse,
    PatientAssessment,
    PredictionResponse,
)
from src.services.clinical_prediction import ClinicalPredictionService


router = APIRouter(tags=["assessment"])
batch_adapter = TypeAdapter(list[PatientAssessment])


@router.post("/predict", response_model=PredictionResponse)
def predict(
    patient: PatientAssessment,
    service: ClinicalPredictionService = Depends(require_prediction_service),
):
    try:
        return service.predict_one(patient.model_dump(), explain=True)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.post("/predict/batch", response_model=BatchPredictionResponse)
async def predict_batch(
    request: Request,
    explain: bool = Query(default=False),
    service: ClinicalPredictionService = Depends(require_prediction_service),
):
    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    try:
        if content_type in {"text/csv", "application/csv"}:
            text = (await request.body()).decode("utf-8-sig")
            frame = pd.read_csv(StringIO(text))
            rows = frame.where(pd.notna(frame), None).to_dict(orient="records")
            validated = batch_adapter.validate_python(rows)
        elif content_type == "application/json":
            payload = await request.json()
            rows = payload.get("patients") if isinstance(payload, dict) else payload
            validated = batch_adapter.validate_python(rows)
        else:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Use application/json or text/csv for batch prediction.",
            )
        results = service.predict_batch(
            [patient.model_dump() for patient in validated],
            explain=explain,
        )
        return {"count": len(results), "results": results}
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.errors(),
        ) from exc
    except (UnicodeDecodeError, pd.errors.ParserError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
