# Aircraft Engine Remaining Useful Life (RUL) Prediction

## Project Description

This project predicts the **remaining useful life (RUL)** of simulated aircraft engines: how many operating cycles an engine can still run before it fails. The prediction uses the current operating cycle, operating settings and sensor readings, and shows how RUL estimates can support predictive-maintenance planning.

The project contains exploratory data analysis, preprocessing, a comparison of four regression models with cross-validation and tuning, and a Streamlit app that compares the saved models side by side.

## Dataset

- **Source** — NASA Prognostics Center of Excellence (PCoE), *Turbofan Engine Degradation Simulation Data Set* (C-MAPSS), item 6 in the [NASA data repository](https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/).
- **Download** — [NASA dataset ZIP](https://phm-datasets.s3.amazonaws.com/NASA/6.+Turbofan+Engine+Degradation+Simulation+Data+Set.zip).
- **Subset used** — FD001 (one operating condition, one fault mode). The training set has 20,631 rows from 100 engines; each row is one engine at one operating cycle. The other subsets (FD002–FD004) are kept in `Data/Original/` but not used.
- **Target** — Remaining useful life, in operating cycles. For the training engines `RUL = last recorded cycle − current cycle`. For the 100 test engines NASA provides the true RUL at the last observed cycle in `RUL_FD001.txt`.
- `Data/Original/readme.txt` is NASA's own description of the files.

## Repository Structure

```text
project/
├── Data/
│   ├── Original/       # NASA files, never edited
│   └── Cleaned/        # train_FD001_cleaned.csv, created by Notebook 01
├── Notebooks/
│   ├── 01_EDA_and_Preprocessing.ipynb
│   └── 02_Modeling_and_Evaluation.ipynb
├── Models/             # 4 saved pipelines (.joblib), feature_columns.json, result tables
├── Helper/             # helper.py: functions shared by notebooks and app
├── Images/             # plots saved by the notebooks
├── Presentation/       # PowerPoint presentation
├── webapp/             # Bonus: FastAPI backend and cockpit-style web interface
├── main.py             # Streamlit application
├── requirements.txt    # Python libraries with exact versions
├── requirements-dev.txt  # test libraries
├── tests/              # automated checks (pytest)
├── .gitignore
└── README.md
```

## Python Version

Python 3.14 (developed and tested with 3.14.6). Other recent Python 3 versions should work with matching package versions.

## Setup Instructions

Open a terminal in the project root (the folder that contains `requirements.txt` and `main.py`).

### 1. Create and activate a virtual environment

**Windows (PowerShell)**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**macOS and Linux**

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install the dependencies

```bash
python -m pip install -r requirements.txt
```

### 3. Data

The NASA files are already included in `Data/Original/`. If you want to re-download them, extract the NASA ZIP and place `train_FD001.txt`, `test_FD001.txt` and `RUL_FD001.txt` directly in `Data/Original/`.

## Run the Notebooks

From the project root, with the environment activated:

```bash
python -m jupyter notebook
```

Run `Notebooks/01_EDA_and_Preprocessing.ipynb` first (it creates `Data/Cleaned/train_FD001_cleaned.csv`), then `Notebooks/02_Modeling_and_Evaluation.ipynb` (it trains, tunes and saves the models in `Models/`). Both notebooks run from top to bottom with *Run All*; Notebook 02 takes about 3 minutes because of the grid searches. All paths are relative.

## Run the Streamlit App

From the project root:

```bash
python -m streamlit run main.py
```

Open the local URL shown in the terminal (usually http://localhost:8501). In the app you can:

1. pick a model in the sidebar;
2. start from the last observed cycle of any NASA test engine (true RUL shown), edit the readings, and press **Predict RUL**;
3. see the prediction of all four models side by side, with a chart;
4. open the **Model comparison** tab for the MAE / RMSE / R² table and plots.

## Bonus: FastAPI Web App

Besides the required Streamlit app, `webapp/` contains a web version of the same predictor: a **FastAPI** backend that loads the saved models, and a custom HTML/CSS/JavaScript interface styled as an engineering drawing on a sunrise sky, with circling wireframe aircraft and rockets, a blueprint launch pad and a cinematic sports-car scene. It uses the same files in `Models/`, so run the notebooks first.

```bash
python -m uvicorn webapp.server:app
```

Open http://127.0.0.1:8000. The interface has an instrument-style gauge (teal, orange and red bands), a simplified turbofan section with the sensor positions marked, aircraft line drawings with the predicted remaining life, an engine life-stage panel, a chart of how each model's estimate evolves over the engine's observed cycles, sensor trends, a side-by-side bar chart of the four models (with NASA's true RUL marked), feature importance, dataset facts, editable sensor readings and the test-set metrics. The API is documented automatically at http://127.0.0.1:8000/docs (`GET /api/meta`, `GET /api/engines`, `GET /api/trajectory/{engine_id}`, `GET /api/importance`, `GET /api/dataset`, `POST /api/predict`).

## Run the Tests

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
python -m ruff check .
```

The 14 tests check the data and the cleaned file, the target definition, the saved models and their metrics, and every endpoint of the web API.

## Work Summary

1. **Set-up** — created the repository structure, a virtual environment and a pinned `requirements.txt`.
2. **EDA** — checked types, missing values, duplicates, the RUL distribution, engine lifetimes, sensor trends, constant columns, outliers and correlations with RUL; wrote a conclusion after each finding.
3. **Preprocessing** — computed the RUL target, removed the 7 constant columns, kept the statistical outliers (they come from real end-of-life degradation), found no need for imputation or categorical encoding, and saved `Data/Cleaned/train_FD001_cleaned.csv`. The model input has **18 features**: `cycle`, 2 operating settings and 15 sensors. `engine_id` is used only for grouping.
4. **Choosing the training target** — the sensors barely move while an engine still has more than about 125 cycles left (39% of the training rows), so the models are trained on `min(RUL, 125)`. The cleaned file keeps the real RUL, and every score on the NASA test set is measured against the **real** RUL.
5. **Splitting without leakage** — all splits are by engine (`GroupShuffleSplit` with `random_state=42` and `GroupKFold`), because rows of one engine are strongly dependent. Scaling happens *inside* the model pipelines, so the scaler is fitted only on training data and is saved with each model.
6. **Models** — Linear Regression, Ridge, Random Forest and Gradient Boosting (`StandardScaler` for the two linear models, none for the tree models), compared with 5-fold grouped cross-validation.
7. **Tuning** — `GridSearchCV` with grouped folds for Ridge, Random Forest and Gradient Boosting, choosing by mean validation RMSE.
8. **Final evaluation** — final models were fitted on all 100 training engines and evaluated once on the official FD001 test set (the last observed row of each of the 100 test engines, compared with NASA's true RUL).
9. **Ablation** — the same pipelines were also trained on the real, uncapped RUL to measure what the cap buys.
10. **Saving and apps** — saved all four fitted pipelines and built the Streamlit app and the FastAPI web app that load them.

## Final Results

Official NASA FD001 test set (100 engines), models trained on `min(RUL, 125)`, scored against the real RUL:

| Model | MAE (cycles) | RMSE (cycles) | R² |
|---|---:|---:|---:|
| Gradient Boosting | **13.048** | **17.725** | **0.818** |
| Random Forest | 13.711 | 18.295 | 0.806 |
| Ridge | 17.780 | 22.545 | 0.706 |
| Linear Regression | 17.786 | 22.554 | 0.705 |

Cross-validation (5 grouped folds on the training engines, capped target) ranks the models the same way: Gradient Boosting RMSE 16.5, Random Forest 16.6, Ridge 20.1.

**Selected model — Gradient Boosting (tuned: 200 trees, learning rate 0.1, depth 3).** It has the lowest MAE and RMSE and the highest R² on the test set and also won in cross-validation. On average its prediction is 13.0 cycles away from the true RUL. Random Forest is close, and a bootstrap over the 100 test engines gives the Gradient Boosting MAE an interval of roughly 10.7 to 15.4 cycles, so the gap between the two tree models is within the noise. Both tree models are about 21% better in RMSE than the linear models, because the sensor–RUL relationship is non-linear.

![Model comparison](Images/model_comparison.png)

### What the cap buys (ablation)

| Gradient Boosting | Test RMSE | PHM08 score (lower is better) |
|---|---:|---:|
| Trained on `min(RUL, 125)` | 17.7 | 575 |
| Trained on the real RUL | 25.6 | 5,725 |

PHM08 is NASA's asymmetric score for this data set: a prediction that is too late is punished harder than one that is too early. Both rows are scored against the real RUL of the test engines.

### Limitations
- Predictions saturate near 125 cycles, so an estimate of 125 means "at least 125 cycles left". Engines whose real RUL is above 125 are underestimated (about 11 cycles on average).
- Close to failure the model leans late: of the 25 test engines within 30 cycles of failure, 18 are overestimated (+7 cycles on average). That is the risky direction for maintenance.
- Each prediction uses a single row (the current readings). Using the recent history of an engine would very likely help further.
- Only the FD001 subset (one operating condition) was used; FD002–FD004 would need more work.
- Data is simulated, and the apps are educational prototypes, not maintenance tools.

## References

- Saxena, A., & Goebel, K. (2008). *Turbofan Engine Degradation Simulation Data Set*. [NASA Prognostics Data Repository](https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/).
- [Scikit-learn documentation](https://scikit-learn.org/stable/)
- [Streamlit documentation](https://docs.streamlit.io/)
