# Recommendation Gateway

This service sends recommendation requests to Groq from the server. The mobile app only calls this gateway and never contains a Groq key.

Run locally with Node 18+:

```bash
cp .env.server.example .env.server
set -a; source .env.server; set +a
npm run server:recommendations
```

The service exposes `POST /v1/recommendations` and `GET /health`. Set the deployed HTTPS address in the mobile app's `.env.local`:

```bash
EXPO_PUBLIC_RECOMMENDATION_API_URL=https://your-api.example.com
```

Then rebuild the mobile app. `GROQ_API_KEY` belongs only in the server environment and must never use the `EXPO_PUBLIC_` prefix. Set `CORS_ORIGIN` to the deployed web origin rather than using the default `*` in production.

The default model is `llama-3.3-70b-versatile`; change `GROQ_MODEL` only to a model available to your Groq account. Free-tier limits can return HTTP 429, and the app will display its offline support plan in that case.

Before public release, add authentication and rate limiting at the gateway.