import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from sleep_model_comparison import make_splits, prepare_data, score_predictions


class ComparisonTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.df = pd.read_csv(Path(__file__).with_name('Sleep_health_and_lifestyle_dataset.csv'))

    def test_group_isolation_and_exactly_one_evaluation_per_row(self):
        X, y, groups = prepare_data(self.df)
        splits = make_splits(X, y, groups)
        seen = np.zeros(len(y), dtype=int)
        for train, test in splits:
            self.assertFalse(set(groups[train]) & set(groups[test]))
            self.assertEqual(set(y.iloc[test]), {0, 1})
            self.assertEqual(set(y.iloc[train]), {0, 1})
            seen[test] += 1
        np.testing.assert_array_equal(seen, np.ones(len(y)))
        for first, second in zip(splits, make_splits(X, y, groups)):
            np.testing.assert_array_equal(first[1], second[1])

    def test_id_and_target_do_not_define_groups_or_features(self):
        df = pd.concat([self.df.iloc[[0]], self.df.iloc[[0]]], ignore_index=True)
        df.loc[1, 'Person ID'] = 9999
        df.loc[1, 'Quality of Sleep'] = 9
        X, y, groups = prepare_data(df)
        self.assertEqual(groups[0], groups[1])
        self.assertNotEqual(y.iloc[0], y.iloc[1])
        self.assertNotIn('Person ID', X.columns)
        self.assertNotIn('Quality of Sleep', X.columns)

    def test_poor_sleep_recall_uses_zero_class(self):
        scores = score_predictions([0, 0, 1, 1], [0.1, 0.6, 0.7, 0.9])
        self.assertAlmostEqual(scores['poor_sleep_recall'], 0.5)
        self.assertAlmostEqual(scores['macro_f1'], (2 / 3 + 0.8) / 2)
        self.assertAlmostEqual(scores['roc_auc'], 1.0)

    def test_missing_label_is_rejected(self):
        df = self.df.copy()
        df.loc[0, 'Quality of Sleep'] = np.nan
        with self.assertRaisesRegex(ValueError, 'missing labels'):
            prepare_data(df)


if __name__ == '__main__':
    unittest.main()
