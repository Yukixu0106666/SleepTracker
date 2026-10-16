# SleepTracker

SleepTracker is a cross-platform sleep journal that visualizes weekly trends and turns recent sleep history into personalized daily wellness recommendations.

Its companion ML pipeline compares Logistic Regression, Random Forest, and XGBoost with leakage-aware grouped cross-validation, achieving a 0.982 mean macro-F1 score for sleep-quality classification on the development dataset.

The Last Night's Sleep Report uses a compact Logistic Regression model to calculate a retrospective sleep score from app-available sleep duration, age, and BMI-category inputs; it reached 0.960 mean macro-F1 in grouped 5-fold development validation. It is not a forecast of tonight. The broader three-model comparison remains an offline experiment, and neither result is clinically validated.

The Recommendations screen separately provides an experimental tonight forecast after at least three recorded nights. It uses up to seven recent nights, combining the smoothed frequency of 7–9-hour nights with bedtime consistency. The card shows its sample size and data confidence and is explicitly presented as a limited, non-clinical estimate.

## Demo

```bash
npm install
npm run web
```

In the app, use **Track Sleep** to record a session, inspect the model-assisted Last Night's Sleep Report, then open **History**, **Stats**, and **Recommendations** to demonstrate the end-to-end user flow. The report exposes the retrospective sleep score, ranked scoring factors, validation result, and limitations; **Stats** applies the same scoring model across the latest seven days. To reproduce the broader ML comparison, install `requirements-analysis.txt` and run `bash run_model_comparison.sh`; reports are written to `model_results/`.

Reproduce the compact model used by the Last Night's Sleep Report with `npm run model:mobile`. Its fitted coefficients and grouped-validation metrics are saved to `model_results/mobile_sleep_quality_model.json`.

## Sleep ingestion

Sleep sessions now enter a durable mobile upload queue and an authenticated PostgreSQL ingestion API, with idempotent writes, retry and deletion events. See [setup and verification](server/INGESTION.md). Cloud deployment and S3/Databricks export are not included yet.

## Recommendation evaluations

The recommendation path has a versioned bilingual evaluation set with strict nested-schema checks, rule-based safety checks, language consistency, scenario requirements, tool-call scoring, latency and token usage. Run the deterministic offline baseline with:

```bash
npm run test:eval
npm run eval:local
```

`npm run eval:live` evaluates the Groq function-calling path when `GROQ_API_KEY` is available and writes a machine-readable report. See [evaluation setup and limitations](evals/README.md). Local fallback scores must not be reported as live-model results.

## Data engineering extension

See the [local ELT MVP](data-platform/README.md) for a runnable sleep-event pipeline with deduplication, quarantine and daily aggregates, and the [architecture roadmap](docs/data-engineering-architecture.md) for planned microservices, Airflow, Fivetran, Snowflake, dbt, Looker, Hightouch and AWS/EKS integration. Cloud integrations are not deployed.

## Analysis assets

The source dataset is stored in [`data/`](data/), and generated exploratory charts are kept in [`docs/analysis/`](docs/analysis/). Run `bash run_analysis.sh` to refresh the charts and model reports.
