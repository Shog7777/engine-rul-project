# Aircraft Engine Remaining Useful Life Prediction

## Project Description
This project predicts the Remaining Useful Life (RUL) of aircraft engines using operating settings and sensor readings. The goal is to support predictive maintenance by estimating the number of operating cycles remaining before failure.

The project includes exploratory data analysis, preprocessing, regression model comparison, and a Streamlit application.

## Dataset
- **Source:** NASA C-MAPSS Turbofan Engine Degradation Dataset
- **Dataset link:** [Add the exact dataset download link]
- **Subset:** [Add the subset used, e.g., FD001]
- **Target:** Remaining Useful Life (RUL), measured in operating cycles.
- Each row represents one engine at one operating cycle.

For run-to-failure training trajectories, RUL is calculated as:

`RUL = Engine's final recorded cycle − Current cycle`

## Repository Structure
```text
project/
├── Data/
│   ├── Original/       # Original data and description, kept unchanged
│   └── Cleaned/        # Cleaned data
├── Notebooks/
│   ├── 01_EDA_and_Preprocessing.ipynb
│   └── 02_Modeling_and_Evaluation.ipynb
├── Models/             # Saved models and preprocessing objects
├── Helper/             # Supporting Python functions
├── main.py             # Streamlit application
├── requirements.txt    # Required Python packages
└── README.md
```

## Python Version
Python [Add the exact version used].

## Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
```

### 2. Create and Activate a Virtual Environment

#### Windows — PowerShell
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

#### macOS and Linux
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies
With the virtual environment activated, run:

```bash
python -m pip install -r requirements.txt
```

### 4. Prepare the Dataset
Place the original dataset files in `Data/Original/`.
Ensure the filenames match the paths used in the notebooks.

## Run the Notebooks
From the project root, with the virtual environment activated:

```bash
python -m jupyter notebook
```

Run the notebooks in this order:

1. `Notebooks/01_EDA_and_Preprocessing.ipynb`
2. `Notebooks/02_Modeling_and_Evaluation.ipynb`

Run all cells from top to bottom. Generate the saved model files before launching the app.

## Run the Streamlit App
From the project root, with the virtual environment activated:

```bash
python -m streamlit run main.py
```

Open the local URL shown in the terminal.

## Work Summary
1. Loaded the dataset and inspected its structure and data types.
2. Checked for missing values and duplicate rows.
3. Calculated RUL for each engine's training trajectory.
4. Explored engine lifespans and the RUL distribution.
5. Examined sensor trends, outliers, and feature correlations.
6. Identified seven constant features for exclusion from model inputs.
7. Retained statistical outliers where no evidence of data errors was found.
8. [Describe the actual training, validation, and test split.]
9. [Describe the preprocessing and regression models used.]
10. [Describe model evaluation and selection.]
11. [Describe the saved models and Streamlit application.]

## Final Results

| Model | MAE (cycles) | RMSE (cycles) | R² |
|---|---:|---:|---:|
| [Model 1] | [Value] | [Value] | [Value] |
| [Model 2] | [Value] | [Value] | [Value] |
| [Model 3] | [Value] | [Value] | [Value] |

- **Selected model:** [Model name]
- **Evaluation method:** [Describe the held-out test set or cross-validation.]
- **Main finding:** [Summarize the actual results.]
- Lower MAE and RMSE indicate smaller prediction errors.
- Higher R² indicates better performance relative to predicting the evaluation-set mean.

## Limitations
The dataset contains simulated engine degradation trajectories. Performance on this dataset does not establish readiness for real-world aircraft maintenance decisions.

## References
- [NASA Prognostics Center of Excellence Data Repository](https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/)
- [Scikit-learn Documentation](https://scikit-learn.org/stable/)
- [Streamlit Documentation](https://docs.streamlit.io/)