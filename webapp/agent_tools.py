"""Tools that let an LLM agent use the RUL models.

The same functions are exposed three ways:
* as an MCP server (`python -m webapp.mcp_server`) for agents such as Claude Code,
* as JSON tool definitions (`GET /api/agent/tools`) for function-calling APIs,
* as an HTTP tool runner (`POST /api/agent/call`) used by the demo in the web page.
"""
import json

import joblib
import pandas as pd

from Helper.helper import MODEL_FILES, PROJECT_ROOT, last_cycle_rows, load_cmapss

MODELS_DIR = PROJECT_ROOT / "Models"
DEFAULT_MODEL = "Gradient Boosting"
MAX_RUL = 250

PHASES = [
    "Healthy", "Strong", "Aging", "Halfway",
    "Wearing", "Watch closely", "Service soon", "End of life",
]


def load_state():
    """Load saved pipelines, test engines and dataset facts."""
    models = {n: joblib.load(MODELS_DIR / f) for n, f in MODEL_FILES.items()}
    features = json.loads((MODELS_DIR / "feature_columns.json").read_text())
    results = pd.read_csv(MODELS_DIR / "test_results.csv")

    test_df = load_cmapss(PROJECT_ROOT / "Data/Original/test_FD001.txt")
    test_last = last_cycle_rows(test_df)
    true_rul = pd.read_csv(
        PROJECT_ROOT / "Data/Original/RUL_FD001.txt", sep=r"\s+", header=None, names=["RUL"]
    )["RUL"]
    cleaned = pd.read_csv(PROJECT_ROOT / "Data/Cleaned/train_FD001_cleaned.csv")
    lifetimes = cleaned.groupby("engine_id")["cycle"].max()
    return {
        "models": models,
        "features": features,
        "results": results,
        "test_df": test_df,
        "true_final": {int(i + 1): int(v) for i, v in enumerate(true_rul)},
        "dataset": {
            "engines": int(cleaned["engine_id"].nunique()),
            "readings": int(len(cleaned)),
            "features": len(features),
            "median_life": int(lifetimes.median()),
            "shortest_life": int(lifetimes.min()),
            "longest_life": int(lifetimes.max()),
        },
        "engines": [
            {
                "engine_id": int(row["engine_id"]),
                "true_rul": int(true_rul.iloc[i]),
                "features": {f: float(row[f]) for f in features},
            }
            for i, row in test_last.iterrows()
        ],
    }


_cache = {}


def get_state():
    if not _cache:
        _cache.update(load_state())
    return _cache


def phase_of(rul):
    return PHASES[min(7, max(0, int((1 - min(max(rul, 0), MAX_RUL) / MAX_RUL) * 8)))]


# ------------------------------------------------------------------ tools
def list_engines(limit: int = 10) -> dict:
    """List NASA test engines with how many cycles were observed."""
    state = get_state()
    rows = [
        {"engine_id": e["engine_id"], "observed_cycles": int(e["features"]["cycle"])}
        for e in state["engines"][: max(1, min(limit, 100))]
    ]
    return {"total_engines": len(state["engines"]), "engines": rows}


def predict_rul(engine_id: int, model: str = DEFAULT_MODEL, state=None) -> dict:
    """Predict the remaining useful life (cycles) of one NASA test engine."""
    state = state or get_state()
    engine = next((e for e in state["engines"] if e["engine_id"] == engine_id), None)
    if engine is None:
        return {"error": f"Unknown engine_id {engine_id}. Valid ids are 1 to {len(state['engines'])}."}
    if model not in state["models"]:
        return {"error": f"Unknown model '{model}'. Choose one of {list(state['models'])}."}
    frame = pd.DataFrame([engine["features"]], columns=state["features"])
    all_models = {n: round(float(m.predict(frame)[0]), 1) for n, m in state["models"].items()}
    value = all_models[model]
    return {
        "engine_id": engine_id,
        "model": model,
        "predicted_rul_cycles": value,
        "life_phase": phase_of(value),
        "last_observed_cycle": int(engine["features"]["cycle"]),
        "all_models": all_models,
        "nasa_true_rul_cycles": engine["true_rul"],
        "note": "Simulated NASA C-MAPSS FD001 data. Not a maintenance instruction.",
    }


def compare_models() -> dict:
    """Test-set MAE, RMSE and R2 of the four trained models."""
    return {"test_set": "NASA FD001, 100 engines",
            "results": get_state()["results"].round(3).to_dict(orient="records")}


def maintenance_brief(engine_id: int) -> dict:
    """Plain-language maintenance summary for one engine (rule-based text, not an LLM)."""
    p = predict_rul(engine_id)
    if "error" in p:
        return p
    rul = p["predicted_rul_cycles"]
    if rul <= 30:
        action = "Schedule service as soon as possible."
    elif rul <= 80:
        action = "Plan service within the next maintenance window."
    else:
        action = "No action needed yet. Keep monitoring."
    caution = ("Gradient Boosting tends to overestimate remaining life near failure "
               "(21 of 25 test engines within 30 cycles of failure), so be conservative.")
    return {"engine_id": engine_id, "predicted_rul_cycles": rul, "life_phase": p["life_phase"],
            "recommendation": action, "caution": caution,
            "thresholds": "30 and 80 cycles are illustrative, not NASA limits."}


TOOLS = {"list_engines": list_engines, "predict_rul": predict_rul,
         "compare_models": compare_models, "maintenance_brief": maintenance_brief}

# JSON Schema tool definitions (the shape used by function-calling APIs).
TOOL_SCHEMAS = [
    {"name": "list_engines",
     "description": "List NASA test engines with the number of cycles observed for each.",
     "input_schema": {"type": "object", "properties": {
         "limit": {"type": "integer", "description": "How many engines to return (1 to 100).", "default": 10}}}},
    {"name": "predict_rul",
     "description": "Predict the remaining useful life, in operating cycles, of one aircraft engine "
                    "using the trained regression models. Returns the estimate of the chosen model, "
                    "all four models, the life phase and NASA's true value.",
     "input_schema": {"type": "object", "required": ["engine_id"], "properties": {
         "engine_id": {"type": "integer", "description": "Test engine number, 1 to 100."},
         "model": {"type": "string", "enum": list(MODEL_FILES), "default": DEFAULT_MODEL}}}},
    {"name": "compare_models",
     "description": "Return MAE, RMSE and R2 on the official NASA test set for all four models.",
     "input_schema": {"type": "object", "properties": {}}},
    {"name": "maintenance_brief",
     "description": "Short maintenance recommendation for one engine, based on its predicted RUL.",
     "input_schema": {"type": "object", "required": ["engine_id"], "properties": {
         "engine_id": {"type": "integer", "description": "Test engine number, 1 to 100."}}}},
]


def call_tool(name: str, arguments: dict) -> dict:
    if name not in TOOLS:
        return {"error": f"Unknown tool '{name}'. Available: {list(TOOLS)}"}
    try:
        return TOOLS[name](**arguments)
    except TypeError as exc:
        return {"error": f"Bad arguments for {name}: {exc}"}
