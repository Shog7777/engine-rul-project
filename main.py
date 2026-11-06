"""Streamlit app: Aircraft Engine Remaining Useful Life (RUL) prediction.

Run from the project root with:  streamlit run main.py
"""
import json

import joblib
import pandas as pd
import streamlit as st

from Helper.helper import MODEL_FILES, PROJECT_ROOT, last_cycle_rows, load_cmapss

MODELS_DIR = PROJECT_ROOT / "Models"
DATA_DIR = PROJECT_ROOT / "Data"
IMAGES_DIR = PROJECT_ROOT / "Images"
DEFAULT_MODEL = "Gradient Boosting"

st.set_page_config(page_title="Engine RUL Prediction", page_icon="✈️", layout="wide")


@st.cache_resource
def load_models():
    return {name: joblib.load(MODELS_DIR / file) for name, file in MODEL_FILES.items()}


@st.cache_data
def load_examples():
    """Real engines to start from: the last observed cycle of every NASA test engine."""
    test_last = last_cycle_rows(load_cmapss(DATA_DIR / "Original" / "test_FD001.txt"))
    true_rul = pd.read_csv(
        DATA_DIR / "Original" / "RUL_FD001.txt", sep=r"\s+", header=None, names=["RUL"]
    )["RUL"]
    test_last["true_RUL"] = true_rul
    return test_last


try:
    models = load_models()
    feature_columns = json.loads((MODELS_DIR / "feature_columns.json").read_text())
    results = pd.read_csv(MODELS_DIR / "test_results.csv")
    examples = load_examples()
except FileNotFoundError as error:
    st.error(
        f"Required file not found: {error.filename}. "
        "Run Notebook 02 first to create the saved models."
    )
    st.stop()

st.title("✈️ Engine Remaining Useful Life Prediction")
st.write(
    "Estimate how many operating cycles an aircraft engine has left before failure, "
    "and compare four regression models side by side. The models learn remaining life capped at "
    "125 cycles, so an estimate near 125 means \"at least 125 cycles left\"."
)

with st.sidebar:
    st.header("Settings")
    selected_model = st.selectbox(
        "Choose a model", list(models), index=list(models).index(DEFAULT_MODEL)
    )
    st.caption("The selected model is highlighted; all four models always run.")
    st.divider()
    st.caption(
        "Data: NASA C-MAPSS FD001 (simulated engines). "
        "Educational prototype — not a maintenance instruction."
    )

tab_predict, tab_compare = st.tabs(["🔧 Predict", "📊 Model comparison"])

# ------------------------------------------------------------------ Predict
with tab_predict:
    st.subheader("1. Choose a starting point")
    engine_id = st.selectbox(
        "Start from a real NASA test engine (its last observed cycle)",
        examples["engine_id"].tolist(),
        help="Values are filled in for you and can be edited below.",
    )
    row = examples[examples["engine_id"] == engine_id].iloc[0]
    st.caption(f"Engine {engine_id}: the true remaining life recorded by NASA is "
               f"**{int(row['true_RUL'])} cycles**.")

    st.subheader("2. Engine readings")
    with st.form("prediction_form"):
        inputs = {}
        cols = st.columns(3)
        for i, feature in enumerate(feature_columns):
            with cols[i % 3]:
                key = f"{feature}_{engine_id}"          # new key per engine → inputs reset
                if feature == "cycle":
                    inputs[feature] = st.number_input(
                        "cycle", min_value=1, value=int(row[feature]), step=1, key=key
                    )
                else:
                    inputs[feature] = st.number_input(
                        feature, value=float(row[feature]), format="%.4f", key=key
                    )
        submitted = st.form_submit_button("Predict RUL", type="primary")

    if submitted:
        input_df = pd.DataFrame([inputs], columns=feature_columns)
        predictions = {name: float(m.predict(input_df)[0]) for name, m in models.items()}

        st.subheader(f"Prediction — {selected_model}")
        left, right = st.columns(2)
        left.metric("Predicted remaining useful life",
                    f"{predictions[selected_model]:.1f} cycles")
        right.metric(
            "True RUL (NASA)", f"{int(row['true_RUL'])} cycles",
            delta=f"{predictions[selected_model] - row['true_RUL']:+.1f} cycles error",
            delta_color="off",
            help="Only meaningful while the inputs are unchanged from the chosen engine.",
        )

        st.subheader("All models side by side")
        cols = st.columns(len(predictions))
        for col, (name, value) in zip(cols, predictions.items()):
            label = f"⭐ {name}" if name == selected_model else name
            col.metric(label, f"{value:.1f} cycles")

        comparison = pd.DataFrame(
            {"Predicted RUL (cycles)": predictions}
        ).rename_axis("Model")
        st.bar_chart(comparison)

        if any(v < 0 for v in predictions.values()):
            st.warning("A model returned a negative RUL, which is physically impossible.")
        if max(predictions.values()) - min(predictions.values()) > 30:
            st.info("The models disagree by more than 30 cycles, so treat this "
                    "estimate with extra caution.")

# ------------------------------------------------------------ Model comparison
with tab_compare:
    st.subheader("Performance on the official NASA test set (100 engines)")
    shown = results.set_index("Model")
    st.dataframe(
        shown.style.format("{:.3f}").highlight_min(subset=["MAE", "RMSE"], color="#c6efce")
        .highlight_max(subset=["R²"], color="#c6efce"),
        width="stretch",
    )
    st.caption("MAE and RMSE are in cycles (lower is better); R² is higher-is-better. "
               "Green marks the best model for each metric.")

    c1, c2 = st.columns(2)
    c1.bar_chart(shown[["MAE", "RMSE"]])
    c2.bar_chart(shown[["R²"]])

    best = shown["RMSE"].idxmin()
    st.success(f"Best model: **{best}** (lowest MAE and RMSE, highest R²).")

    plot_a, plot_b = st.columns(2)
    if (IMAGES_DIR / "actual_vs_predicted.png").exists():
        plot_a.image(str(IMAGES_DIR / "actual_vs_predicted.png"),
                     caption="Actual vs predicted RUL (best model)")
    if (IMAGES_DIR / "feature_importance.png").exists():
        plot_b.image(str(IMAGES_DIR / "feature_importance.png"),
                     caption="Gradient Boosting feature importance")
