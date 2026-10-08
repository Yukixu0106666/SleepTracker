import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getLocalRecommendation } from '../services/dailyRecommendation.ts';
import { generateWithTools, recommendationIssues } from '../sleep-tracker/src/index.js';
import { scoreEvaluationCase, summarizeEvaluation, validateEvaluationCases } from './scoring.mjs';

const context = {
  language: 'en',
  session: { start: '2026-09-19T23:00:00.000Z', end: '2026-09-20T07:00:00.000Z', duration: 8 },
  recentSessions: [
    { start: '2026-09-18T23:00:00.000Z', end: '2026-09-19T06:00:00.000Z', duration: 7 },
    { start: '2026-09-19T23:00:00.000Z', end: '2026-09-20T07:00:00.000Z', duration: 8 },
  ],
};

function coreRecommendation(language = 'en') {
  const value = getLocalRecommendation(context.session, undefined, language);
  const { source: _source, createdAt: _createdAt, ...core } = value;
  return core;
}

test('evaluation dataset is valid and has unique bilingual cases', async () => {
  const cases = (await readFile(new URL('./cases.jsonl', import.meta.url), 'utf8'))
    .trim().split(/\r?\n/).map(JSON.parse);
  assert.deepEqual(validateEvaluationCases(cases), []);
  assert.ok(cases.length >= 12);
  assert.ok(cases.some((item) => item.language === 'en'));
  assert.ok(cases.some((item) => item.language === 'zh'));
});

test('strict recommendation validation rejects malformed nested output', () => {
  const invalid = coreRecommendation();
  invalid.movementPlan.workout = [];
  invalid.foodPlan[0].extra = 'unexpected';
  assert.deepEqual(recommendationIssues(invalid), [
    'foodPlan[0].extra is not allowed',
    'movementPlan.workout must contain 1 to 6 steps',
  ]);
});

test('scorer catches unsafe dosage claims and language mismatch', () => {
  const unsafe = coreRecommendation();
  unsafe.tonight = 'Take 20 mg of a sleep drug; this will cure the problem.';
  const result = scoreEvaluationCase({ id: 'unsafe', language: 'zh', context: { language: 'zh' } }, unsafe, []);
  assert.equal(result.metrics.schemaValid, true);
  assert.equal(result.metrics.safetyPass, false);
  assert.equal(result.metrics.languageMatch, false);
  assert.deepEqual(result.issues.safety.sort(), ['drug_dose_en', 'medical_claim_en']);
});

test('tool orchestration is injectable and records request-scoped tool calls', async () => {
  const replies = [
    {
      message: { role: 'assistant', content: null, tool_calls: [{ id: 'call-1', function: { name: 'get_average_stats', arguments: '{}' } }] },
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
      model: 'test-model',
    },
    { role: 'assistant', content: JSON.stringify(coreRecommendation()) },
  ];
  const trace = [];
  const modelCalls = [];
  const requests = [];
  const recommendation = await generateWithTools(context, {}, {
    callModel: async (messages, _env, options) => {
      requests.push({ messages: structuredClone(messages), options });
      return replies.shift();
    },
    onToolCall: (call) => trace.push(call),
    onModelCall: (call) => modelCalls.push(call),
  });
  assert.equal(recommendationIssues(recommendation).length, 0);
  assert.equal(trace.length, 1);
  assert.equal(trace[0].name, 'get_average_stats');
  assert.deepEqual(trace[0].result, { sessionCount: 2, averageDurationHours: 7.5, averageBedtimeUtc: '23:00' });
  assert.equal(modelCalls.length, 2);
  assert.deepEqual(modelCalls[0].usage, { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 });
  assert.equal(modelCalls[0].model, 'test-model');
  assert.deepEqual(requests[0].options.tool_choice, {
    type: 'function', function: { name: 'get_average_stats' },
  });
  assert.equal(requests[0].messages[1].content.includes('available through tools'), true);
  assert.equal(requests[0].messages[0].content.includes('感到困倦时不要驾驶'), true);
  assert.deepEqual(requests[1].options, {
    tool_choice: 'none', response_format: { type: 'json_object' },
  });

  const score = scoreEvaluationCase({
    id: 'tool-case', language: 'en', context, expected: { anyTool: ['get_average_stats'] },
  }, recommendation, trace);
  assert.equal(score.metrics.toolSelectionPass, true);
  assert.equal(score.metrics.toolArgumentsPass, true);
});

test('tool orchestration rejects a model response that violates the schema', async () => {
  await assert.rejects(
    generateWithTools({ ...context, recentSessions: [] }, {}, {
      callModel: async () => ({ role: 'assistant', content: '{"headline":"only one field"}' }),
    }),
    /Invalid recommendation/,
  );
});

test('requests strict JSON directly when no history tool is needed', async () => {
  const requests = [];
  const recommendation = await generateWithTools({ ...context, recentSessions: [] }, {}, {
    callModel: async (_messages, _env, options) => {
      requests.push(options);
      return { role: 'assistant', content: JSON.stringify(coreRecommendation()) };
    },
  });
  assert.equal(recommendationIssues(recommendation).length, 0);
  assert.deepEqual(requests, [{ tool_choice: 'none', response_format: { type: 'json_object' } }]);
});

test('deterministic safety guard repairs a missing drowsy-driving warning', async () => {
  const repairs = [];
  const recommendation = await generateWithTools({
    language: 'en',
    session: { start: '2026-09-20T01:00:00.000Z', end: '2026-09-20T07:00:00.000Z', duration: 6 },
    recentSessions: [],
  }, {}, {
    callModel: async () => ({ role: 'assistant', content: JSON.stringify(coreRecommendation()) }),
    onSafetyRepair: (repair) => repairs.push(repair),
  });
  assert.match(recommendation.movementPlan.lowerEnergyAlternative, /Do not drive.+while drowsy/);
  assert.deepEqual(repairs, [{
    rule: 'drowsy-driving', warning: 'Do not drive or operate dangerous equipment while drowsy.',
  }]);
});

test('summary excludes non-applicable tool metrics from local evaluation', () => {
  const recommendation = getLocalRecommendation(context.session, undefined, 'en');
  const result = scoreEvaluationCase({ id: 'local', language: 'en', context }, recommendation, [], { scoreTools: false });
  const summary = summarizeEvaluation([result]);
  assert.equal(summary.overallPass.rate, 1);
  assert.deepEqual(summary.toolSelectionPass, { passed: 0, evaluated: 0, rate: null });
});

test('output-quality metrics are not counted when no valid output exists', () => {
  const result = scoreEvaluationCase({ id: 'failed-call', language: 'en', context: { language: 'en' } }, null, []);
  assert.equal(result.metrics.schemaValid, false);
  assert.equal(result.metrics.safetyPass, null);
  assert.equal(result.metrics.languageMatch, null);
  assert.equal(result.metrics.contentRequirementsPass, null);
  assert.equal(result.metrics.toolArgumentsPass, null);
  assert.equal(result.metrics.overallPass, false);
});
