from pathlib import Path
import json
import pandas as pd
import joblib
import streamlit as st

st.set_page_config(
    page_title="Engine RUL Prediction",
    page_icon="✈️",
    layout="wide"
)

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "Models"


@st.cache_resource
def load_models():
    filenames = {
        "Linear Regression": "linear_regression.joblib",
        "Ridge": "ridge.joblib",
        "Random Forest": "random_forest.joblib",
        "Gradient Boosting": "gradient_boosting.joblib"
    }

    return {
        name: joblib.load(MODELS_DIR / filename)
        for name, filename in filenames.items()
    }


try:
    models = load_models()

    with open(MODELS_DIR / "feature_columns.json") as file:
        feature_columns = json.load(file)

except FileNotFoundError as error:
    st.error(f"Required file not found: {error.filename}")
    st.stop()

st.title("✈️ Engine Remaining Useful Life Prediction")
st.write(
    "Predict the number of operating cycles remaining "
    "using engine sensor readings."
)

selected_model = st.selectbox(
    "Choose a model",
    list(models),
    index=list(models).index("Gradient Boosting")
)

st.success("All four models loaded successfully.")
st.write("Selected model:", selected_model)
st.write("Number of input features:", len(feature_columns))



# استخدام صف حقيقي من التدريب كقيم مبدئية قابلة للتعديل
data_path = BASE_DIR / "Data" / "Cleaned" / "train_FD001_cleaned.csv"
sample = pd.read_csv(data_path, nrows=1).iloc[0]

st.subheader("Engine readings")
st.caption("Initial values are a training example. Edit them for a new prediction.")

with st.form("prediction_form"):
    inputs = {}
    columns = st.columns(3)

    for i, feature in enumerate(feature_columns):
        with columns[i % 3]:
            if feature == "cycle":
                inputs[feature] = st.number_input(
                    "Cycle",
                    min_value=1,
                    value=int(sample[feature]),
                    step=1
                )
            else:
                inputs[feature] = st.number_input(
                    feature,
                    value=float(sample[feature]),
                    format="%.4f"
                )

    submitted = st.form_submit_button("Predict RUL")

if submitted:
    # نفس أسماء المدخلات وترتيبها المستخدم في التدريب
    input_df = pd.DataFrame([inputs], columns=feature_columns)

    predictions = {
        name: float(model.predict(input_df)[0])
        for name, model in models.items()
    }

    st.subheader("Selected model prediction")
    st.metric(
        selected_model,
        f"{predictions[selected_model]:.1f} cycles remaining"
    )

    st.subheader("Compare all models")
    result_columns = st.columns(4)

    for column, (name, prediction) in zip(
        result_columns, predictions.items()
    ):
        column.metric(name, f"{prediction:.1f} cycles")

    if any(value < 0 for value in predictions.values()):
        st.warning(
            "A model returned a negative RUL, which is physically invalid."
        )

    st.caption(
        "Educational prototype using simulated NASA data. "
        "Predictions are not maintenance instructions."
    )