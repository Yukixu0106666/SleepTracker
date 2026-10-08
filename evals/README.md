# Sleep recommendation evaluations

This directory contains a versioned, bilingual evaluation set and deterministic scoring for the recommendation system. It evaluates the same structured contract for the local fallback and the Groq tool-calling path.

## What is measured

- strict nested response-schema validity;
- English/Chinese output-language consistency;
- rule-based safety violations for diagnosis, cure claims, prescriptions and drug dosages;
- scenario-specific requirements such as drowsy-driving warnings;
- expected tool selection, unknown tools and JSON tool arguments in live mode;
- end-to-end latency, token usage, optional estimated cost and overall pass rate.
- deterministic safety repairs applied when a short-sleep response omits an explicit drowsy-driving warning.

The rule-based safety checks are release tests, not a complete medical-safety evaluation. Add reviewed cases when production failures are discovered, and periodically have a qualified human review a sample of outputs.

## Run

From the repository root:

```bash
npm run test:eval
npm run eval:local
```

The local command evaluates the deterministic offline fallback and writes `evals/results/local-latest.json`. It does not call an external model.

To evaluate the deployed model path directly through the same orchestration code:

```bash
GROQ_API_KEY=... npm run eval:live
```

Set `GROQ_MODEL` to compare another available model. Live evaluation writes `evals/results/live-latest.json`, requires at least an 80% overall pass rate by default, and exits non-zero below the threshold. Override the gate only for an explicit experiment:

```bash
GROQ_API_KEY=... npm run eval:live -- --min-pass-rate 0.9
```

Live mode spaces requests by 16 seconds and retries provider rate limits up to five times so free-tier token-per-minute limits do not become false quality failures. Both settings are recorded in the report and can be changed with `--delay-ms` and `--max-rate-limit-retries`.

The runner records provider-reported token usage. To estimate cost without hard-coding prices that can change, supply the current input and output prices explicitly:

```bash
GROQ_API_KEY=... npm run eval:live -- \
  --input-cost-per-million 0.00 --output-cost-per-million 0.00
```

Evaluation inputs are synthetic. Do not put real health information, access tokens or other secrets in the JSONL cases or committed reports.

The repository includes a sanitized before/after summary for the completed GPT-OSS 20B run at `results/gpt-oss-20b-comparison.json`. Full live reports include generated text and remain gitignored.
