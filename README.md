# SleepTracker

SleepTracker is a cross-platform mobile demo that records sleep sessions, visualizes weekly trends, and turns recent sleep history into personalized daily wellness recommendations. Its companion ML pipeline compares Logistic Regression, Random Forest, and XGBoost with leakage-aware grouped cross-validation, achieving a 0.982 mean macro-F1 score for sleep-quality classification on the development dataset.

> The classifier is an offline portfolio experiment and is not yet connected to the app's recommendation flow or clinically validated.

## Demo

```bash
npm install
npm run web
```

In the app, use **Track Sleep** to record a session, then open **History**, **Stats**, and **Recommendations** to demonstrate the end-to-end user flow. To reproduce the ML comparison, install `requirements-analysis.txt` and run `bash run_model_comparison.sh`; reports are written to `model_results/`.

## Sleep ingestion

Sleep sessions now enter a durable mobile upload queue and an authenticated PostgreSQL ingestion API, with idempotent writes, retry and deletion events. See [setup and verification](server/INGESTION.md). Cloud deployment and S3/Databricks export are not included yet.

## Data engineering extension

See the [local ELT MVP](data-platform/README.md) for a runnable sleep-event pipeline with deduplication, quarantine and daily aggregates, and the [architecture roadmap](docs/data-engineering-architecture.md) for planned microservices, Airflow, Fivetran, Snowflake, dbt, Looker, Hightouch and AWS/EKS integration. Cloud integrations are not deployed.

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
