"""Loads everything the web app needs: saved pipelines, test engines and dataset facts."""
import json

import joblib
import pandas as pd

from Helper.helper import MODEL_FILES, PROJECT_ROOT, last_cycle_rows, load_cmapss

MODELS_DIR = PROJECT_ROOT / "Models"


def load_state():
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
