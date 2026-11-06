# Aircraft Engine Remaining Useful Life Prediction

## Project Description

This project predicts the remaining useful life (RUL) of simulated aircraft engines from the current operating cycle, operating settings, and sensor readings. The prediction estimates how many operating cycles remain before failure and illustrates how RUL can inform predictive maintenance planning.

The project includes exploratory data analysis, preprocessing, a comparison of four regression models, and a Streamlit app.

## Dataset

- **Source** — NASA Prognostics Center of Excellence (PCoE), *Turbofan Engine Degradation Simulation Data Set*, item 6 in the [NASA data repository](https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/).
- **Download** — [NASA dataset ZIP](https://phm-datasets.s3.amazonaws.com/NASA/6.+Turbofan+Engine+Degradation+Simulation+Data+Set.zip).
- **Subset** — FD001 from the C-MAPSS simulator. The training set contains 20,631 observations from 100 engines. Each row records one engine at one operating cycle.
- **Target** — Remaining useful life, measured in operating cycles.

For each run-to-failure training trajectory, the target is calculated as `RUL = final recorded cycle − current cycle`. For the test engines, NASA supplies the true RUL at the last observed cycle in `RUL_FD001.txt`.

## Repository Structure

```text
project/
├── Data/
│   ├── Original/       # Original dataset files and description
│   └── Cleaned/        # Data produced by the preprocessing notebook
├── Notebooks/
│   ├── 01_EDA_and_Preprocessing.ipynb
│   └── 02_Modeling_and_Evaluation.ipynb
├── Models/             # Saved model pipelines
├── Helper/             # Supporting Python functions
├── main.py             # Streamlit application
├── requirements.txt    # Python dependencies
└── README.md
```

## Setup Instructions

Use Python 3.14.0. Open a terminal in the project root, where `requirements.txt` and `main.py` are located.

### 1. Create and Activate a Virtual Environment

**Windows PowerShell**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**macOS and Linux**

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install Dependencies

```bash
python -m pip install -r requirements.txt
```

### 3. Prepare the Dataset

Download and extract the NASA archive. Place these files directly in `Data/Original/`:

- `train_FD001.txt` — Training trajectories that run to failure.
- `test_FD001.txt` — Test trajectories that end before failure.
- `RUL_FD001.txt` — Reference RUL values for the test engines.

## Run the Notebooks

From the project root, with the virtual environment activated:

```bash
python -m jupyter notebook
```

Run all cells in `Notebooks/01_EDA_and_Preprocessing.ipynb` first to prepare the data. Then run `Notebooks/02_Modeling_and_Evaluation.ipynb` to train, evaluate, and save the four model pipelines as `.joblib` files in `Models/`.

## Run the Streamlit App

After generating the model files, run this command from the project root:

```bash
python -m streamlit run main.py
```

Open the local URL shown in the terminal.

## Work Summary

1. Inspected the training data types, missing values, duplicate rows, engine lifespans, and RUL distribution. Examined sensor trends, outliers, and feature correlations.
2. Calculated the training RUL and excluded seven constant columns and the engine identifier from the model inputs. Retained statistical outliers and used 18 input features.
3. Compared Linear Regression, Ridge (`alpha=1.0`), Random Forest, and Gradient Boosting. Applied `StandardScaler` inside the two linear model pipelines. The tree-based models used unscaled inputs.
4. Used five-fold `GroupKFold` on the FD001 training set so all rows from an engine stayed together in each fold. Tuned Random Forest and Gradient Boosting using grouped cross-validation and ranked settings by mean validation RMSE.
5. Evaluated the final models on the official FD001 test set. Used the last observed row of each of the 100 test engines and compared each prediction with its supplied RUL.
6. Saved all four fitted pipelines and built a Streamlit interface for estimating RUL from engine inputs.

## Final Results

| Model | MAE (cycles) | RMSE (cycles) | R² |
|---|---:|---:|---:|
| Gradient Boosting | **18.831** | **25.226** | **0.632** |
| Random Forest | 19.139 | 25.606 | 0.620 |
| Ridge | 25.975 | 31.250 | 0.434 |
| Linear Regression | 25.975 | 31.250 | 0.434 |

**Selected model — Gradient Boosting.** It achieved the lowest MAE and RMSE and the highest R² on the FD001 test set. Its predictions differed from the true RUL by 18.831 cycles on average in absolute terms. Random Forest was a close second, with an MAE 0.308 cycles higher.

MAE measures the average absolute prediction error. RMSE gives larger errors more weight. R² compares the model's squared errors with those from using the mean true RUL of the evaluation set as a constant prediction.



## References

- Saxena, A., & Goebel, K. (2008). *Turbofan Engine Degradation Simulation Data Set*. [NASA Prognostics Data Repository](https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/).
- [Scikit-learn documentation](https://scikit-learn.org/stable/)
- [Streamlit documentation](https://docs.streamlit.io/)
