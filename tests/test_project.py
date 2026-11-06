"""Automated checks for the project. Run from the project root:  python -m pytest -q"""
import json

import joblib
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from Helper.helper import (
    CONSTANT_COLUMNS,
    MODEL_FILES,
    PROJECT_ROOT,
    add_rul,
    evaluate,
    last_cycle_rows,
    load_cmapss,
)

MODELS = PROJECT_ROOT / "Models"


# ---------------------------------------------------------------- data
def test_original_data_has_expected_shape():
    df = load_cmapss(PROJECT_ROOT / "Data/Original/train_FD001.txt")
    assert df.shape == (20631, 26)
    assert df["engine_id"].nunique() == 100


def test_rul_is_last_cycle_minus_current_cycle():
    df = add_rul(load_cmapss(PROJECT_ROOT / "Data/Original/train_FD001.txt"))
    last = df.groupby("engine_id")["cycle"].transform("max")
    assert (df["RUL"] == last - df["cycle"]).all()
    assert df.groupby("engine_id")["RUL"].min().eq(0).all()


def test_cleaned_data_is_consistent_with_original():
    clean = pd.read_csv(PROJECT_ROOT / "Data/Cleaned/train_FD001_cleaned.csv")
    assert clean.shape == (20631, 20)
    assert clean.isna().sum().sum() == 0
    assert not set(CONSTANT_COLUMNS) & set(clean.columns)
    original = add_rul(load_cmapss(PROJECT_ROOT / "Data/Original/train_FD001.txt"))
    kept = original.drop(columns=CONSTANT_COLUMNS).sort_values(["engine_id", "cycle"]).reset_index(drop=True)
    pd.testing.assert_frame_equal(clean, kept, check_dtype=False)


def test_constant_columns_are_really_constant():
    df = load_cmapss(PROJECT_ROOT / "Data/Original/train_FD001.txt")
    assert (df[CONSTANT_COLUMNS].nunique() == 1).all()


def test_test_set_protocol():
    test = last_cycle_rows(load_cmapss(PROJECT_ROOT / "Data/Original/test_FD001.txt"))
    truth = pd.read_csv(PROJECT_ROOT / "Data/Original/RUL_FD001.txt", header=None)
    assert len(test) == len(truth) == 100
    assert test["engine_id"].tolist() == list(range(1, 101))


# ---------------------------------------------------------------- models
@pytest.fixture(scope="module")
def models_and_features():
    features = json.loads((MODELS / "feature_columns.json").read_text())
    return {n: joblib.load(MODELS / f) for n, f in MODEL_FILES.items()}, features


def test_four_models_saved_with_expected_features(models_and_features):
    models, features = models_and_features
    assert len(models) == 4 and len(features) == 18
    assert "engine_id" not in features and "RUL" not in features


def test_saved_results_match_recomputed_test_metrics(models_and_features):
    models, features = models_and_features
    test = last_cycle_rows(load_cmapss(PROJECT_ROOT / "Data/Original/test_FD001.txt"))
    y = pd.read_csv(PROJECT_ROOT / "Data/Original/RUL_FD001.txt", header=None)[0]
    saved = pd.read_csv(MODELS / "test_results.csv").set_index("Model")
    for name, model in models.items():
        got = evaluate(y, model.predict(test[features]))
        for metric in ("MAE", "RMSE", "R²"):
            assert got[metric] == pytest.approx(saved.loc[name, metric], rel=1e-6)


def test_linear_models_include_their_scaler(models_and_features):
    models, _ = models_and_features
    for name in ("Linear Regression", "Ridge"):
        assert "scaler" in models[name].named_steps
    for name in ("Random Forest", "Gradient Boosting"):
        assert "scaler" not in models[name].named_steps


def test_gradient_boosting_is_best_on_every_metric():
    r = pd.read_csv(MODELS / "test_results.csv").set_index("Model")
    assert r["MAE"].idxmin() == r["RMSE"].idxmin() == r["R²"].idxmax() == "Gradient Boosting"


# ---------------------------------------------------------------- web API
@pytest.fixture(scope="module")
def client():
    from webapp.server import app
    with TestClient(app) as c:      # runs the start-up that loads the models
        yield c


def test_api_meta_and_engines(client):
    meta = client.get("/api/meta").json()
    assert len(meta["features"]) == 18 and len(meta["models"]) == 4 and len(meta["results"]) == 4
    engines = client.get("/api/engines").json()
    assert len(engines) == 100
    assert set(engines[0]["features"]) == set(meta["features"])


def test_api_predict_matches_the_saved_model(client, models_and_features):
    models, features = models_and_features
    engine = client.get("/api/engines").json()[48]
    got = client.post("/api/predict", json={"features": engine["features"]}).json()["predictions"]
    frame = pd.DataFrame([engine["features"]], columns=features)
    for name, model in models.items():
        assert got[name] == pytest.approx(float(model.predict(frame)[0]))


def test_api_predict_rejects_missing_features(client):
    r = client.post("/api/predict", json={"features": {"cycle": 5.0}})
    assert r.status_code == 422


def test_api_trajectory(client):
    t = client.get("/api/trajectory/49").json()
    n = len(t["cycles"])
    assert n == len(t["true_rul"]) and all(len(v) == n for v in t["predictions"].values())
    assert t["true_rul"][-1] == client.get("/api/engines").json()[48]["true_rul"]
    assert np.all(np.diff(t["true_rul"]) == -1)
    assert client.get("/api/trajectory/999").status_code == 404


def test_api_importance_dataset_and_pages(client):
    imp = client.get("/api/importance").json()
    assert sum(i["importance"] for i in imp) == pytest.approx(1.0)
    by_name = {i["feature"]: i["importance"] for i in imp}
    assert by_name["setting_1"] + by_name["setting_2"] < 0.01      # operating settings add almost nothing
    assert client.get("/api/dataset").json()["engines"] == 100
    page = client.get("/")
    assert page.status_code == 200 and "Engine Health Monitor" in page.text
    assert client.get("/assets/app.js").status_code == 200


def test_api_flags_readings_outside_the_training_range(client):
    engine = client.get("/api/engines").json()[0]["features"]
    ok = client.post("/api/predict", json={"features": engine}).json()
    assert ok["outside_training_range"] == []
    wild = {**engine, "sensor_11": engine["sensor_11"] * 3}
    flagged = client.post("/api/predict", json={"features": wild}).json()
    assert "sensor_11" in flagged["outside_training_range"]


def test_api_rejects_non_finite_readings(client):
    engine = client.get("/api/engines").json()[0]["features"]
    body = json.dumps({"features": {**engine, "sensor_2": float("nan")}})
    r = client.post("/api/predict", content=body, headers={"Content-Type": "application/json"})
    assert r.status_code == 422


# ---------------------------------------------------------------- documentation matches the results
def test_readme_results_table_matches_saved_results():
    readme = (PROJECT_ROOT / "README.md").read_text(encoding="utf8")
    saved = pd.read_csv(MODELS / "test_results.csv").set_index("Model")
    for name, row in saved.iterrows():
        line = next(line for line in readme.splitlines() if line.startswith(f"| {name} |"))
        nums = [float(x.strip("* ")) for x in line.split("|")[2:5]]
        assert nums == [round(row["MAE"], 3), round(row["RMSE"], 3), round(row["R²"], 3)], name


def test_predictions_stay_below_the_training_cap(models_and_features):
    """The models learn min(RUL, 125), so they must not predict far beyond it."""
    models, features = models_and_features
    from Helper.helper import RUL_CAP
    test = last_cycle_rows(load_cmapss(PROJECT_ROOT / "Data/Original/test_FD001.txt"))
    for name in ("Random Forest", "Gradient Boosting"):
        assert models[name].predict(test[features]).max() <= RUL_CAP + 10


def test_models_beat_a_constant_baseline(models_and_features):
    from sklearn.dummy import DummyRegressor
    models, features = models_and_features
    train = pd.read_csv(PROJECT_ROOT / "Data/Cleaned/train_FD001_cleaned.csv")
    test = last_cycle_rows(load_cmapss(PROJECT_ROOT / "Data/Original/test_FD001.txt"))
    y = pd.read_csv(PROJECT_ROOT / "Data/Original/RUL_FD001.txt", header=None)[0]
    base = evaluate(y, DummyRegressor().fit(train[features], train["RUL"]).predict(test[features]))
    for name, model in models.items():
        assert evaluate(y, model.predict(test[features]))["MAE"] < 0.6 * base["MAE"], name


def test_model_input_columns_match_the_saved_feature_list(models_and_features):
    models, features = models_and_features
    for name, model in models.items():
        assert list(model.feature_names_in_) == features, name
