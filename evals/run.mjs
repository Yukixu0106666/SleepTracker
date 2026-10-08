import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLocalRecommendation } from '../services/dailyRecommendation.ts';
import { generateWithTools } from '../sleep-tracker/src/index.js';
import { scoreEvaluationCase, summarizeEvaluation, validateEvaluationCases } from './scoring.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function percentile(values, percentage) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentage) - 1)];
}

async function loadCases(path) {
  const lines = (await readFile(path, 'utf8')).split(/\r?\n/).filter((line) => line.trim());
  const cases = lines.map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`Invalid JSON on ${path}:${index + 1}: ${error.message}`); }
  });
  const issues = validateEvaluationCases(cases);
  if (issues.length) throw new Error(`Invalid evaluation dataset:\n- ${issues.join('\n- ')}`);
  return cases;
}

function usageSummary(modelCalls) {
  return modelCalls.reduce((total, call) => ({
    promptTokens: total.promptTokens + Number(call.usage?.prompt_tokens ?? 0),
    completionTokens: total.completionTokens + Number(call.usage?.completion_tokens ?? 0),
    totalTokens: total.totalTokens + Number(call.usage?.total_tokens ?? 0),
  }), { promptTokens: 0, completionTokens: 0, totalTokens: 0 });
}

function estimatedCost(usage, pricing) {
  if (!pricing) return null;
  return Number((
    usage.promptTokens * pricing.inputPerMillion / 1_000_000
    + usage.completionTokens * pricing.outputPerMillion / 1_000_000
  ).toFixed(8));
}

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

function rateLimitWaitMs(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!/rate limit/i.test(message)) return null;
  const seconds = /try again in ([\d.]+)s/i.exec(message)?.[1];
  return seconds ? Math.ceil(Number(seconds) * 1000) + 500 : 10_000;
}

async function generateLive(evalCase, env, trace, modelCalls, safetyRepairs, maxRateLimitRetries) {
  for (let attempt = 0; ; attempt += 1) {
    const attemptTrace = [];
    try {
      const recommendation = await generateWithTools(evalCase.context, env, {
        onToolCall: (call) => attemptTrace.push(call),
        onModelCall: (call) => modelCalls.push(call),
        onSafetyRepair: (repair) => safetyRepairs.push(repair),
      });
      trace.push(...attemptTrace);
      return recommendation;
    } catch (error) {
      const retryAfter = rateLimitWaitMs(error);
      if (retryAfter === null || attempt >= maxRateLimitRetries) throw error;
      console.error(`[eval] ${evalCase.id}: rate limited; retrying in ${retryAfter} ms`);
      await wait(retryAfter);
    }
  }
}

async function evaluateOne(evalCase, mode, pricing, maxRateLimitRetries) {
  const trace = [];
  const modelCalls = [];
  const safetyRepairs = [];
  const startedAt = performance.now();
  try {
    const recommendation = mode === 'live'
      ? await generateLive(evalCase, {
          GROQ_API_KEY: process.env.GROQ_API_KEY,
          GROQ_MODEL: process.env.GROQ_MODEL,
        }, trace, modelCalls, safetyRepairs, maxRateLimitRetries)
      : getLocalRecommendation(
          evalCase.context.session,
          evalCase.context.profile,
          evalCase.language,
        );
    const usage = usageSummary(modelCalls);
    return {
      ...scoreEvaluationCase(evalCase, recommendation, trace, { scoreTools: mode === 'live' }),
      latencyMs: Number((performance.now() - startedAt).toFixed(2)),
      modelCalls: modelCalls.length,
      usage,
      estimatedCostUsd: estimatedCost(usage, pricing),
      safetyRepairs,
      recommendation: mode === 'live' ? recommendation : undefined,
      error: null,
    };
  } catch (error) {
    const usage = usageSummary(modelCalls);
    return {
      ...scoreEvaluationCase(evalCase, null, trace, { scoreTools: mode === 'live' }),
      latencyMs: Number((performance.now() - startedAt).toFixed(2)),
      modelCalls: modelCalls.length,
      usage,
      estimatedCostUsd: estimatedCost(usage, pricing),
      safetyRepairs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const mode = option('--mode', 'local');
if (!['local', 'live'].includes(mode)) throw new Error('--mode must be local or live');
if (mode === 'live' && !process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is required for live evaluation');

const casesPath = resolve(option('--cases', `${here}/cases.jsonl`));
const outputPath = resolve(option('--output', `${here}/results/${mode}-latest.json`));
const minimumPassRate = Number(option('--min-pass-rate', mode === 'local' ? '1' : '0.8'));
if (!(minimumPassRate >= 0 && minimumPassRate <= 1)) throw new Error('--min-pass-rate must be between 0 and 1');
const inputCost = option('--input-cost-per-million', null);
const outputCost = option('--output-cost-per-million', null);
if ((inputCost === null) !== (outputCost === null)) {
  throw new Error('Provide both --input-cost-per-million and --output-cost-per-million');
}
const pricing = inputCost === null ? null : {
  inputPerMillion: Number(inputCost),
  outputPerMillion: Number(outputCost),
};
if (pricing && (!Number.isFinite(pricing.inputPerMillion) || !Number.isFinite(pricing.outputPerMillion)
  || pricing.inputPerMillion < 0 || pricing.outputPerMillion < 0)) {
  throw new Error('Token prices must be non-negative finite numbers');
}
const delayMs = Number(option('--delay-ms', mode === 'live' ? '16000' : '0'));
const maxRateLimitRetries = Number(option('--max-rate-limit-retries', mode === 'live' ? '5' : '0'));
if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error('--delay-ms must be a non-negative number');
if (!Number.isInteger(maxRateLimitRetries) || maxRateLimitRetries < 0) {
  throw new Error('--max-rate-limit-retries must be a non-negative integer');
}

const cases = await loadCases(casesPath);
const results = [];
for (const evalCase of cases) {
  if (results.length && delayMs) await wait(delayMs);
  const result = await evaluateOne(evalCase, mode, pricing, maxRateLimitRetries);
  results.push(result);
  console.error(`[eval] ${evalCase.id}: ${result.metrics.overallPass ? 'pass' : 'fail'} (${result.latencyMs} ms)`);
}

const latency = results.map((result) => result.latencyMs);
const totalUsage = usageSummary(results.map((result) => ({ usage: {
  prompt_tokens: result.usage.promptTokens,
  completion_tokens: result.usage.completionTokens,
  total_tokens: result.usage.totalTokens,
} })));
const report = {
  schemaVersion: 1,
  evalSet: 'sleep-recommendation-v1',
  mode,
  model: mode === 'live' ? (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile') : 'deterministic-local-fallback',
  pricingUsdPerMillionTokens: pricing,
  execution: { delayMs, maxRateLimitRetries },
  generatedAt: new Date().toISOString(),
  casesPath: relative(process.cwd(), casesPath),
  summary: {
    ...summarizeEvaluation(results),
    latencyMs: { p50: percentile(latency, 0.5), p95: percentile(latency, 0.95) },
    usage: totalUsage,
    estimatedCostUsd: estimatedCost(totalUsage, pricing),
    safetyRepairs: results.reduce((count, result) => count + result.safetyRepairs.length, 0),
  },
  results,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output: outputPath, ...report.summary }, null, 2));

if ((report.summary.overallPass.rate ?? 0) < minimumPassRate) process.exitCode = 1;
