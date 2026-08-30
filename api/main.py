from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import assessment, health, model


app = FastAPI(
    title="EthioCKD Clinical API",
    version="1.0.0",
    description="Verified tabular CKD screening API for the EthioCKD-Agent prototype.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(model.router)
app.include_router(assessment.router)
