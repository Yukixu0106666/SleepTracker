"""Train and validate the compact Logistic Regression deployed in the mobile app."""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, recall_score, roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

FEATURES = ['Age', 'Sleep Duration', 'BMI Category']


def build_model():
    preprocessing = ColumnTransformer([
        ('numeric', Pipeline([
            ('imputer', SimpleImputer(strategy='median')),
            ('scaler', StandardScaler()),
        ]), ['Age', 'Sleep Duration']),
        ('bmi', Pipeline([
            ('imputer', SimpleImputer(strategy='most_frequent')),
            ('encoder', OneHotEncoder(handle_unknown='ignore', sparse_output=False)),
        ]), ['BMI Category']),
    ])
    return Pipeline([
        ('preprocessing', preprocessing),
        ('classifier', LogisticRegression(max_iter=1000, random_state=42)),
    ])


def train(data_path='Sleep_health_and_lifestyle_dataset.csv'):
    frame = pd.read_csv(data_path)
    frame['BMI Category'] = frame['BMI Category'].replace({'Normal Weight': 'Normal'})
    features = frame[FEATURES]
    target = (frame['Quality of Sleep'] >= 7).astype(int)
    groups = features.groupby(FEATURES, dropna=False, sort=True).ngroup().to_numpy()

    splitter = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
    probabilities = np.zeros(len(target))
    template = build_model()
    for training, evaluation in splitter.split(features, target, groups):
        fold_model = clone(template).fit(features.iloc[training], target.iloc[training])
        probabilities[evaluation] = fold_model.predict_proba(features.iloc[evaluation])[:, 1]

    predicted = (probabilities >= 0.5).astype(int)
    validation = {
        'macro_f1': f1_score(target, predicted, average='macro'),
        'poor_sleep_recall': recall_score(target, predicted, pos_label=0),
        'roc_auc': roc_auc_score(target, probabilities),
        'folds': 5,
        'rows': len(target),
    }

    fitted = template.fit(features, target)
    numeric = fitted.named_steps['preprocessing'].named_transformers_['numeric'].named_steps['scaler']
    encoder = fitted.named_steps['preprocessing'].named_transformers_['bmi'].named_steps['encoder']
    classifier = fitted.named_steps['classifier']
    artifact = {
        'version': 'mobile-logreg-v1',
        'features': FEATURES,
        'numeric_mean': numeric.mean_.tolist(),
        'numeric_scale': numeric.scale_.tolist(),
        'bmi_categories': encoder.categories_[0].tolist(),
        'coefficients': classifier.coef_[0].tolist(),
        'intercept': float(classifier.intercept_[0]),
        'validation': validation,
        'limitations': 'Development data only; not a clinical model or prospective next-night prediction.',
    }
    return artifact


if __name__ == '__main__':
    output = Path('model_results/mobile_sleep_quality_model.json')
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(train(), indent=2), encoding='utf-8')
    print(f'Mobile model artifact written to {output.resolve()}')
