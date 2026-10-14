[中文版](SLEEP_ANALYSIS_README.md)

# Three-Model Comparison (Current Implementation)

The project retains Logistic Regression and adds Random Forest and XGBoost. To run only the model comparison:

```bash
python3 -m pip install -r requirements-analysis.txt
bash run_model_comparison.sh
```

`python3 sleep_analysis.py` and `./run_analysis.sh` invoke the same comparison workflow as part of the full analysis.
Outputs are written to `model_results/`: `model_comparison.csv` contains metric means and standard deviations; `fold_metrics.csv` contains metrics for each fold; `out_of_fold_predictions.csv` stores each row's group, fold, and predicted probability; `run_metadata.json` stores parameters and dependency versions; and `model_comparison_report.txt` contains classification reports and confusion matrices. A separate Logistic Regression report is also saved in this directory.

For this project, XGBoost is installed locally in `.analysis-deps/`, so you can run `bash run_model_comparison.sh` directly. On macOS, this entry point first attempts to reuse the OpenMP runtime bundled with scikit-learn. If no compatible runtime is available, install `libomp` (for example, with `brew install libomp`).

Evaluation methodology:

- The labels follow the original implementation: a sleep-quality score below 7 is poor sleep (0), while a score of 7 or above is good sleep (1).
- The original 11 model inputs are retained. Person ID, the raw quality score, and derived risk labels are not used as features.
- All three models use the same five-fold `StratifiedGroupKFold` with `seed=42`. Rows with identical model inputs always stay in the same group to prevent duplicates from crossing folds.
- Missing-value imputation, scaling, and one-hot encoding are fitted independently within each fold. All models receive the same inputs and preprocessing.
- The classification threshold is fixed at 0.5. The report includes macro F1, poor-sleep recall (class 0), and ROC AUC (using the good-sleep probability, with class 1 as positive).
- Summary metrics are the mean and sample standard deviation across folds. Each fold is scored by record, so duplicate records still affect weighting.
- Hyperparameters are fixed in advance. Evaluation folds are not used for tuning or early stopping. These results are development-stage cross-validation results, not an independent external test.

The local CSV contains 374 rows and 13 columns. After excluding the ID, it contains 132 distinct complete records and 130 groups based on the model inputs. The approximately 450 rows mentioned in the older documentation below are illustrative.
This experiment evaluates sleep-quality classification in the existing table. It does not represent next-night prediction or clinical-risk validation, and it has not yet been connected to the app's recommendation API.
Before launching the app, align the model with the fields actually collected and gather real-world labels.

Run the evaluation-logic tests with `python3 -m unittest test_sleep_model_comparison.py`.

Method references: [scikit-learn stratified group cross-validation](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.StratifiedGroupKFold.html) and the [XGBoost classifier API](https://xgboost.readthedocs.io/en/stable/python/python_api.html#xgboost.XGBClassifier).

---

# 🛏️ Sleep Health and Lifestyle Data Analysis

## Kaggle Data Analysis Project

This is a complete sleep-health and lifestyle data analysis project designed for the SleepTracker app use case.

## 📋 Project Scope

### Analysis features

1. ✅ **Data loading** — automatically download or load the Kaggle dataset
2. ✅ **Data cleaning** — handle missing values, duplicates, and data-type conversion
3. ✅ **Descriptive statistics** — calculate means, medians, standard deviations, and other metrics
4. ✅ **Data visualization** — create histograms, box plots, scatter plots, and heatmaps
5. ✅ **Correlation analysis** — identify relationships between features
6. ✅ **Insight summary** — report key findings and recommendations for the app

### Metrics analyzed

- Age
- Occupation
- Sleep Duration
- Stress Level
- Body Mass Index (BMI)
- Exercise Frequency
- Other related health metrics

## 🚀 Quick Start

### Prerequisites

```bash
# Make sure Python 3.7+ is installed
python3 --version

# Install dependencies
pip install pandas numpy matplotlib seaborn kaggle
```

### Option 1: Use Jupyter Notebook

```bash
cd /Users/xuri/Downloads/SleepTracker-main
jupyter notebook sleep_health_analysis.ipynb
```

### Option 2: Download the Dataset

#### Option A: Use the Kaggle API (recommended)

```bash
# 1. Get an API key from https://www.kaggle.com/settings/account
# 2. Place it at ~/.kaggle/kaggle.json
# 3. Run:
mkdir -p data
kaggle datasets download -d deadmau49/sleep-health-and-lifestyle-dataset -p data
unzip data/sleep-health-and-lifestyle-dataset.zip -d data
```

#### Option B: Download manually

1. Visit https://www.kaggle.com/datasets/deadmau49/sleep-health-and-lifestyle-dataset.
2. Download the CSV file.
3. Put it in the `data/` directory and name it `Sleep_health_and_lifestyle_dataset.csv`.

## 📊 Notebook Structure

```text
1. Import libraries
   ↓
2. Load the dataset
   ↓
3. Clean and preprocess data
   ↓
4. Run descriptive statistical analysis
   ↓
5. Visualize the data
   ├─ Histograms (distributions)
   ├─ Categorical plots (counts)
   ├─ Box plots (outliers)
   └─ Scatter plots (relationships)
   ↓
6. Analyze correlations
   └─ Display a heatmap
   ↓
7. Summarize findings and app recommendations
```

## 💡 Key Insights

After completing the analysis, you will have information about:

### 1. Sleep patterns

- Differences in sleep duration by age
- The relationship between sleep quality and stress
- The effect of occupation on sleep

### 2. Health-metric relationships

- The relationship between BMI and sleep
- Exercise frequency and sleep quality
- The effect of stress level

### 3. Population characteristics

- Sleep characteristics across occupations
- Sleep needs by age group
- Health-risk identification

## 🎯 Applying the Analysis to the SleepTracker App

### Recommended feature enhancements

1. **Smart recommendation system**
   - Personalized sleep advice based on age and occupation
   - Goal adjustments based on stress level

2. **Health reports**
   - Compare a user's sleep with peers of the same age
   - Benchmark health metrics

3. **Pattern discovery**
   - Automatically detect user sleep patterns
   - Flag unusual conditions

4. **Community insights**
   - Show sleep statistics for different populations
   - Provide comparison features

## 🔧 Visualization Examples

After running the notebook, you will see:

- 📈 Four distribution histograms
- 📊 Three categorical-feature charts
- 📦 Three box plots for outlier detection
- 📍 Two scatter plots for relationship exploration
- 🔥 A correlation-matrix heatmap

## 📝 Example Output

```text
Dataset overview:
- Samples: 450
- Features: 12
- Numeric features: 8

Key statistics:
Sleep Duration:
  - Mean: 7.2 hours
  - Median: 7.0 hours
  - Range: [5.0, 9.5] hours

Strong correlations:
✓ Exercise Frequency ↔ Sleep Quality: 0.856 (very strong positive correlation)
✓ Stress Level ↔ Sleep Duration: -0.724 (strong negative correlation)
```

## 🐛 Troubleshooting

**Q: The dataset download failed. What should I do?**  
A: Check your network connection, or download the CSV manually from Kaggle.

**Q: The data file cannot be found. What should I do?**  
A: Make sure it is named `Sleep_health_and_lifestyle_dataset.csv` and is located in the `data/` directory.

**Q: What if packages are missing?**  
A: Run `pip install pandas numpy matplotlib seaborn`.

**Q: Jupyter will not start. What should I do?**  
A: Run `pip install jupyter` and try again.

## 📚 References

- Kaggle dataset: https://www.kaggle.com/datasets/deadmau49/sleep-health-and-lifestyle-dataset
- Pandas documentation: https://pandas.pydata.org/
- Matplotlib documentation: https://matplotlib.org/
- Seaborn documentation: https://seaborn.pydata.org/

## 📄 License

This project is for educational and research purposes only.

---

**Last updated**: 2026-06-07  
**Created by**: GitHub Copilot  
**Project**: SleepTracker data analysis module
