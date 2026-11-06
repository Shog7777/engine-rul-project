"""FastAPI bonus: a web version of the Engine RUL predictor.

Run from the project root with:
    python -m uvicorn webapp.server:app --reload
then open http://127.0.0.1:8000
"""
import json
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from Helper.helper import MODEL_FILES, PROJECT_ROOT, last_cycle_rows, load_cmapss

MODELS_DIR = PROJECT_ROOT / "Models"
STATIC_DIR = Path(__file__).resolve().parent / "static"
state = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the saved pipelines and the example engines once at start-up."""
    state["models"] = {n: joblib.load(MODELS_DIR / f) for n, f in MODEL_FILES.items()}
    state["features"] = json.loads((MODELS_DIR / "feature_columns.json").read_text())
    state["results"] = pd.read_csv(MODELS_DIR / "test_results.csv")

    test_last = last_cycle_rows(load_cmapss(PROJECT_ROOT / "Data/Original/test_FD001.txt"))
    true_rul = pd.read_csv(
        PROJECT_ROOT / "Data/Original/RUL_FD001.txt", sep=r"\s+", header=None, names=["RUL"]
    )["RUL"]
    state["test_df"] = load_cmapss(PROJECT_ROOT / "Data/Original/test_FD001.txt")
    state["true_final"] = {int(i + 1): int(v) for i, v in enumerate(true_rul)}
    cleaned = pd.read_csv(PROJECT_ROOT / "Data/Cleaned/train_FD001_cleaned.csv")
    lifetimes = cleaned.groupby("engine_id")["cycle"].max()
    state["dataset"] = {
        "engines": int(cleaned["engine_id"].nunique()),
        "readings": int(len(cleaned)),
        "features": len(state["features"]),
        "median_life": int(lifetimes.median()),
        "shortest_life": int(lifetimes.min()),
        "longest_life": int(lifetimes.max()),
    }
    state["engines"] = [
        {
            "engine_id": int(row["engine_id"]),
            "true_rul": int(true_rul.iloc[i]),
            "features": {f: float(row[f]) for f in state["features"]},
        }
        for i, row in test_last.iterrows()
    ]
    yield
    state.clear()


app = FastAPI(title="Engine RUL API", version="1.0", lifespan=lifespan)


class PredictRequest(BaseModel):
    features: dict[str, float]


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


SPARK_SENSORS = ["sensor_11", "sensor_4", "sensor_12", "sensor_7"]


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
    return {
        "predictions": {n: float(m.predict(frame)[0]) for n, m in state["models"].items()}
    }


app.mount("/assets", StaticFiles(directory=STATIC_DIR), name="assets")


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")
