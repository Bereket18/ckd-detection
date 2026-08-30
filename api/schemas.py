from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class PatientAssessment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    age: float | None = Field(default=None, ge=0, le=120)
    bp: float | None = Field(default=None, ge=30, le=200)
    sg: float | None = Field(default=None, ge=1.0, le=1.03)
    al: float | None = Field(default=None, ge=0, le=5)
    su: float | None = Field(default=None, ge=0, le=5)
    bgr: float | None = Field(default=None, ge=0, le=600)
    bu: float | None = Field(default=None, ge=0, le=400)
    sc: float | None = Field(default=None, ge=0, le=80)
    sod: float | None = Field(default=None, ge=0, le=200)
    pot: float | None = Field(default=None, ge=0, le=50)
    hemo: float | None = Field(default=None, ge=0, le=25)
    pcv: float | None = Field(default=None, ge=0, le=60)
    wc: float | None = Field(default=None, ge=0, le=30000)
    rc: float | None = Field(default=None, ge=0, le=10)
    rbc: Literal["normal", "abnormal"] | None = None
    pc: Literal["normal", "abnormal"] | None = None
    pcc: Literal["present", "notpresent"] | None = None
    ba: Literal["present", "notpresent"] | None = None
    htn: Literal["yes", "no"] | None = None
    dm: Literal["yes", "no"] | None = None
    cad: Literal["yes", "no"] | None = None
    appet: Literal["good", "poor"] | None = None
    pe: Literal["yes", "no"] | None = None
    ane: Literal["yes", "no"] | None = None


class ShapDriver(BaseModel):
    feature: str
    value: float
    direction: Literal["raises_risk", "lowers_risk", "neutral"]


class PredictionResponse(BaseModel):
    prediction: Literal["ckd", "notckd"]
    ckd_score: float
    risk_band: Literal["LOW", "MODERATE", "HIGH"]
    imputed_fields: list[str]
    imputation_count: int
    shap_drivers: list[ShapDriver]
    explanation: str | None
    model: dict[str, Any]
    disclaimer: str


class BatchPredictionItem(BaseModel):
    prediction: Literal["ckd", "notckd"]
    ckd_score: float
    risk_band: Literal["LOW", "MODERATE", "HIGH"]
    imputed_fields: list[str]
    imputation_count: int
    shap_drivers: list[ShapDriver]


class BatchPredictionResponse(BaseModel):
    count: int
    results: list[BatchPredictionItem]


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    model: str
    preprocessor: str
    shap: str
    schema_compatible: bool
    feature_count: int | None = None
    detail: str | None = None
