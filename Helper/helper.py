"""Shared helpers for the Aircraft Engine RUL project.

Functions used by both notebooks and the Streamlit app live here so
that nothing is copied between files.
"""
from pathlib import Path

import pandas as pd
from sklearn.metrics import (
    mean_absolute_error,
    r2_score,
    root_mean_squared_error,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Column layout of the NASA C-MAPSS text files (26 columns, no header)
COLUMN_NAMES = (
    ["engine_id", "cycle"]
    + [f"setting_{i}" for i in range(1, 4)]
    + [f"sensor_{i}" for i in range(1, 22)]
)

# Columns with a single value in FD001 (found in Notebook 01)
CONSTANT_COLUMNS = [
    "setting_3", "sensor_1", "sensor_5", "sensor_10",
    "sensor_16", "sensor_18", "sensor_19",
]

# RUL cap used in the optional "capped RUL" experiment (Notebook 02)
RUL_CAP = 125

MODEL_FILES = {
    "Linear Regression": "linear_regression.joblib",
    "Ridge": "ridge.joblib",
    "Random Forest": "random_forest.joblib",
    "Gradient Boosting": "gradient_boosting.joblib",
}


def load_cmapss(path):
    """Read a whitespace-separated C-MAPSS file and name its columns."""
    return pd.read_csv(path, sep=r"\s+", header=None, names=COLUMN_NAMES)


def add_rul(df):
    """Add RUL = final recorded cycle of the engine - current cycle."""
    out = df.copy()
    out["RUL"] = out.groupby("engine_id")["cycle"].transform("max") - out["cycle"]
    return out


def last_cycle_rows(df):
    """Keep only the last observed row of every engine (official test protocol)."""
    return (
        df.sort_values(["engine_id", "cycle"])
        .groupby("engine_id")
        .tail(1)
        .sort_values("engine_id")
        .reset_index(drop=True)
    )


def evaluate(y_true, y_pred):
    """Return MAE, RMSE and R2 as a dictionary."""
    return {
        "MAE": mean_absolute_error(y_true, y_pred),
        "RMSE": root_mean_squared_error(y_true, y_pred),
        "R²": r2_score(y_true, y_pred),
    }
