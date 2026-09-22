"""Reproducible, grouped evaluation of sleep-quality classifiers."""

import argparse
import json
from importlib.metadata import version
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, f1_score, recall_score, roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

NUMERIC = ['Age', 'Sleep Duration', 'Physical Activity Level', 'Stress Level',
           'Heart Rate', 'Daily Steps', 'Systolic', 'Diastolic']
CATEGORICAL = ['Gender', 'BMI Category', 'Sleep Disorder']
METRICS = ['macro_f1', 'poor_sleep_recall', 'roc_auc']


def prepare_data(df):
    df = df.copy().reset_index(drop=True)
    df.columns = df.columns.str.strip()
    quality = pd.to_numeric(df['Quality of Sleep'], errors='raise')
    if quality.isna().any():
        raise ValueError('Quality of Sleep contains missing labels.')
    bp = df['Blood Pressure'].astype('string').str.extract(r'^\s*(\d+)\s*/\s*(\d+)\s*$')
    df['Systolic'] = pd.to_numeric(bp[0], errors='coerce')
    df['Diastolic'] = pd.to_numeric(bp[1], errors='coerce')
    # pandas reads the dataset's literal "None" (no disorder) as NA.
    df['Sleep Disorder'] = df['Sleep Disorder'].fillna('None')
    for column in NUMERIC:
        df[column] = pd.to_numeric(df[column], errors='raise')
    X = df[NUMERIC + CATEGORICAL]
    y = (quality >= 7).astype(int)
    # Group on model inputs, excluding ID and label, including conflicting labels.
    groups = X.groupby(list(X.columns), dropna=False, sort=True).ngroup().to_numpy()
    return X, y, groups


def make_splits(X, y, groups, n_splits=5, seed=42):
    splitter = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=seed)
    splits = list(splitter.split(X, y, groups))
    for train, test in splits:
        if set(groups[train]) & set(groups[test]):
            raise ValueError('Feature groups overlap between training and evaluation.')
        if y.iloc[train].nunique() != 2 or y.iloc[test].nunique() != 2:
            raise ValueError('Each fold must contain both classes; use fewer folds or more data.')
    return splits


def build_models(seed=42):
    from xgboost import XGBClassifier

    numeric = Pipeline([('imputer', SimpleImputer(strategy='median')),
                        ('scaler', StandardScaler())])
    categorical = Pipeline([('imputer', SimpleImputer(strategy='most_frequent')),
                            ('encoder', OneHotEncoder(handle_unknown='ignore', sparse_output=False))])
    preprocessor = ColumnTransformer([('num', numeric, NUMERIC),
                                      ('cat', categorical, CATEGORICAL)])
    classifiers = {
        'Logistic Regression': LogisticRegression(max_iter=1000, random_state=seed),
        'Random Forest': RandomForestClassifier(n_estimators=300, max_depth=5,
                                                min_samples_leaf=3, random_state=seed, n_jobs=1),
        'XGBoost': XGBClassifier(n_estimators=200, max_depth=3, learning_rate=0.05,
                                min_child_weight=3, subsample=0.8, colsample_bytree=0.8,
                                reg_lambda=1, objective='binary:logistic', eval_metric='logloss',
                                tree_method='hist', random_state=seed, n_jobs=1),
    }
    return {name: Pipeline([('preprocessor', clone(preprocessor)), ('classifier', classifier)])
            for name, classifier in classifiers.items()}


def score_predictions(y, probability):
    predicted = (np.asarray(probability) >= 0.5).astype(int)
    return {
        'macro_f1': f1_score(y, predicted, average='macro', zero_division=0),
        'poor_sleep_recall': recall_score(y, predicted, pos_label=0, zero_division=0),
        'roc_auc': roc_auc_score(y, probability),
    }


def compare_models(df, output_dir='model_results', n_splits=5, seed=42):
    X, y, groups = prepare_data(df)
    splits = make_splits(X, y, groups, n_splits, seed)
    models = build_models(seed)
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    assignments = np.zeros(len(y), dtype=int)
    for fold, (_, test) in enumerate(splits, 1):
        assignments[test] = fold
    predictions = pd.DataFrame({'row_index': np.arange(len(y)), 'group': groups,
                                'fold': assignments, 'actual': y})
    fold_rows, reports = [], []
    for name, template in models.items():
        probabilities = np.full(len(y), np.nan)
        for fold, (train, test) in enumerate(splits, 1):
            # Fresh preprocessing and estimator, fitted only on this training fold.
            model = clone(template).fit(X.iloc[train], y.iloc[train])
            prob = model.predict_proba(X.iloc[test])[:, list(model.classes_).index(1)]
            probabilities[test] = prob
            fold_rows.append({'model': name, 'fold': fold, 'train_rows': len(train),
                              'test_rows': len(test), **score_predictions(y.iloc[test], prob)})
        predictions[f'{name}_prob_good'] = probabilities
        predicted = (probabilities >= 0.5).astype(int)
        reports.append(f'\n{name}\nOut-of-fold classification report (threshold=0.5):\n'
                       + classification_report(y, predicted, target_names=['Poor Sleep', 'Good Sleep'],
                                               digits=4, zero_division=0)
                       + '\nConfusion matrix: rows=true, columns=predicted; order=[Poor, Good]\n'
                       + str(confusion_matrix(y, predicted, labels=[0, 1])) + '\n')
    folds = pd.DataFrame(fold_rows)
    summary = folds.groupby('model', sort=False)[METRICS].agg(['mean', 'std'])
    summary.columns = ['_'.join(column) for column in summary.columns]
    folds.to_csv(output / 'fold_metrics.csv', index=False)
    summary.to_csv(output / 'model_comparison.csv')
    predictions.to_csv(output / 'out_of_fold_predictions.csv', index=False)
    metadata = {
        'rows': len(y), 'unique_feature_groups': int(len(np.unique(groups))),
        'class_counts': {str(k): int(v) for k, v in y.value_counts().items()},
        'target': '0=Quality of Sleep <7; 1=Quality of Sleep >=7',
        'features': list(X.columns), 'seed': seed, 'n_splits': n_splits,
        'splitter': 'StratifiedGroupKFold; groups=identical model inputs',
        'threshold': 0.5, 'roc_auc_positive_class': 1,
        'versions': {name: version(name) for name in ['numpy', 'pandas', 'scikit-learn', 'xgboost']},
        'models': {name: model.named_steps['classifier'].get_params() for name, model in models.items()},
    }
    (output / 'run_metadata.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    overview = (f'Sleep quality model comparison\nRows: {len(y)}; feature groups: {len(np.unique(groups))}\n'
                f'{n_splits}-fold grouped cross-validation, seed={seed}. Same folds for every model.\n'
                'Metrics are row-weighted within folds; summary is fold mean and sample standard deviation.\n'
                'Poor sleep recall uses class 0. ROC-AUC uses P(good sleep), class 1.\n'
                'Fixed hyperparameters; no tuning or early stopping on evaluation folds.\n'
                'These are development CV results, not an independent external test or clinical validation.\n\n'
                + summary.to_string(float_format=lambda value: f'{value:.4f}') + '\n')
    (output / 'model_comparison_report.txt').write_text(overview + ''.join(reports), encoding='utf-8')
    (output / 'logistic_regression_report.txt').write_text(overview + reports[0], encoding='utf-8')
    print(overview)
    print(f'Reports saved to {output.resolve()}')
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path,
                        default=Path(__file__).with_name('Sleep_health_and_lifestyle_dataset.csv'))
    parser.add_argument('--output-dir', type=Path, default=Path('model_results'))
    args = parser.parse_args()
    compare_models(pd.read_csv(args.data), args.output_dir)
