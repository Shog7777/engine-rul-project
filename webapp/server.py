"""FastAPI bonus: a web version of the Engine RUL predictor.

Run from the project root with:
    python -m uvicorn webapp.server:app --reload
then open http://127.0.0.1:8000
"""
import math
from contextlib import asynccontextmanager
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator

from webapp.data import load_state

STATIC_DIR = Path(__file__).resolve().parent / "static"
SPARK_SENSORS = ["sensor_11", "sensor_4", "sensor_12", "sensor_7"]
state = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the saved pipelines and the example engines once at start-up."""
    state.update(load_state())
    yield
    state.clear()


app = FastAPI(title="Engine RUL API", version="1.2", lifespan=lifespan)


class PredictRequest(BaseModel):
    features: dict[str, float]

    @field_validator("features")
    @classmethod
    def finite_numbers(cls, value):
        bad = [k for k, v in value.items() if not math.isfinite(v)]
        if bad:
            raise ValueError(f"Readings must be finite numbers: {bad}")
        return value


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    """Return a clean 422. The default handler echoes the bad input, and NaN cannot be written as JSON."""
    errors = [{"loc": list(e["loc"]), "msg": str(e["msg"])} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": errors})


@app.get("/api/meta")
def meta():
    """Feature names, model names and test-set results."""
    return {
        "features": state["features"],
        "models": list(state["models"]),
        "results": state["results"].to_dict(orient="records"),
    }


@app.get("/api/engines")
def engines():
    """The 100 NASA test engines (last observed cycle) with their true RUL."""
    return state["engines"]


@app.get("/api/dataset")
def dataset():
    """Short facts about the training data."""
    return state["dataset"]


@app.get("/api/importance")
def importance():
    """Feature importance of the tuned Gradient Boosting model."""
    gb = state["models"]["Gradient Boosting"].named_steps["model"]
    pairs = sorted(zip(state["features"], gb.feature_importances_), key=lambda p: -p[1])
    return [{"feature": f, "importance": float(v)} for f, v in pairs]


@app.get("/api/trajectory/{engine_id}")
def trajectory(engine_id: int):
    """Every observed cycle of a test engine: true RUL, each model's estimate, some sensors."""
    rows = state["test_df"][state["test_df"]["engine_id"] == engine_id].sort_values("cycle")
    if rows.empty:
        raise HTTPException(status_code=404, detail="Unknown engine")
    last_cycle = int(rows["cycle"].max())
    final = state["true_final"][engine_id]
    frame = rows[state["features"]]
    return {
        "cycles": rows["cycle"].astype(int).tolist(),
        "true_rul": [final + last_cycle - int(c) for c in rows["cycle"]],
        "predictions": {n: m.predict(frame).tolist() for n, m in state["models"].items()},
        "sensors": {s: rows[s].tolist() for s in SPARK_SENSORS},
    }


@app.post("/api/predict")
def predict(request: PredictRequest):
    """Predict RUL (cycles) with all four saved models."""
    missing = [f for f in state["features"] if f not in request.features]
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing features: {missing}")
    frame = pd.DataFrame([request.features], columns=state["features"])
    margin = 0.05   # tolerate 5% beyond the training range before warning
    outside = []
    for f, (lo, hi) in state["ranges"].items():
        span = (hi - lo) or 1.0
        if not (lo - margin * span <= request.features[f] <= hi + margin * span):
            outside.append(f)
    return {
        "predictions": {n: float(m.predict(frame)[0]) for n, m in state["models"].items()},
        "outside_training_range": outside,
    }


app.mount("/assets", StaticFiles(directory=STATIC_DIR), name="assets")


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")
