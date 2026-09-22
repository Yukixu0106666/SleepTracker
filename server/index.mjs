import http from 'node:http';

const port = Number(process.env.PORT ?? 8787);

const prompt = `You are a supportive sleep-wellness coach, not a doctor. Return only JSON with headline, foodPlan, movementPlan, mindset, and tonight. foodPlan must contain 3 or 4 items with timing, meal, and portion. Name practical ordinary foods and portions. movementPlan must contain activity, durationMinutes, intensity, timing, warmUp, workout, coolDown, and lowerEnergyAlternative. Each warmUp/workout/coolDown item needs name, durationMinutes, and instruction. Make an executable routine with specific repetitions, sets, walking intervals, or stretches. Never diagnose, prescribe treatment, recommend extreme diets, or promise that short sleep has no health impact.`;

function buildUserContext(context) {
  const session = context.session;
  const profile = context.profile ?? {};
  const recentSessions = Array.isArray(context.recentSessions) ? context.recentSessions.slice(-7) : [];
  const durations = recentSessions.map((item) => Number(item.duration)).filter(Number.isFinite);
  const average = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : undefined;

  return [
    session ? `Latest sleep: ${Number(session.duration).toFixed(2)} hours from ${session.start} to ${session.end}.` : 'No latest sleep session is available.',
    `Profile: age ${profile.age || 'not provided'}, height ${profile.height || 'not provided'}, weight ${profile.weight || 'not provided'}.`,
    durations.length ? `Last ${durations.length} sleep durations: ${durations.join(', ')} hours. Average: ${average.toFixed(2)} hours.` : 'No recent sleep trend is available.',
  ].join(' ');
}

async function callGroq(context) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured on the recommendation gateway');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: prompt }, { role: 'user', content: buildUserContext(context) }],
      response_format: { type: 'json_object' },
      temperature: 0.6,
    }),
  });
  if (!response.ok) throw new Error(`Groq returned HTTP ${response.status}`);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('Groq returned no recommendation content');
  return JSON.parse(text);
}

function json(response, status, body) {
  response.writeHead(status, {
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? '*',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    return json(response, 204, {});
  }

  if (request.method === 'GET' && request.url === '/health') {
    return json(response, 200, { status: 'ok' });
  }

  if (request.method !== 'POST' || request.url !== '/v1/recommendations') {
    return json(response, 404, { error: 'Not found' });
  }

  let rawBody = '';
  for await (const chunk of request) rawBody += chunk;

  try {
    const context = JSON.parse(rawBody);
    const recommendation = await callGroq(context);

    return json(response, 200, { recommendation, provider: 'groq' });
  } catch (error) {
    return json(response, 502, { error: error instanceof Error ? error.message : 'Recommendation provider failed' });
  }
});

server.listen(port, () => {
  console.log(`Recommendation gateway listening on :${port}`);
});