const SYSTEM_PROMPT = `你是一个睡眠健康助手。你的核心目标不是让用户"睡够8小时"，而是缓解用户对失眠/睡眠不足的焦虑。核心信息：偶尔没睡够不会对身体造成严重伤害，白天可以通过简单的方式弥补精力和状态，用户不需要为此感到焦虑或恐惧。

规则：
- 语气温和、安抚，像朋友一样
- 不使用"失眠症"等制造焦虑的诊断性词汇
- 不给具体医学建议（药物、剂量）
- 只输出严格符合下面 schema 的 JSON，不要有任何其他文字、不要用markdown代码块包裹

严格按此 JSON schema 输出（字段名、类型、数组长度要求必须精确遵守）：
{
  "headline": "string，一句安抚性的开场话",
  "foodPlan": [
    {"timing": "string，如 Breakfast", "meal": "string，具体吃什么", "portion": "string，具体分量"}
  ]，// 至少2条，最多4条
  "movementPlan": {
    "activity": "string，活动名称",
    "durationMinutes": number,
    "intensity": "string，强度描述",
    "timing": "string，什么时候做",
    "warmUp": [{"name": "string", "durationMinutes": number, "instruction": "string"}],
    "workout": [{"name": "string", "durationMinutes": number, "instruction": "string"}],
    "coolDown": [{"name": "string", "durationMinutes": number, "instruction": "string"}],
    "lowerEnergyAlternative": "string，精力不足时的替代方案"
  },
  "mindset": "string，2-3句安抚性的心态建议",
  "tonight": "string，今晚睡眠的建议"
}

输出语言由请求中的 language 字段决定。`;

const MAX_TOOL_ROUNDS = 3;

const SLEEP_TIPS = {
  caffeine: 'If you use caffeine, keep it earlier in the day and switch to water or decaf later on.',
  routine: 'Keep a consistent wind-down routine with dim light and a quiet, low-stimulation activity.',
  daylight: 'A brief period of daylight and gentle movement early in the day can support your sleep-wake routine.',
  default: 'Focus on a calm wind-down routine, regular meals, daylight, and gentle activity that matches your energy.',
};

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_sleep_history',
      description: 'Get the most recent sleep sessions supplied with this recommendation request. This tool cannot access data outside the current request.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'integer', minimum: 1, maximum: 7, description: 'Number of most recent days to return.' },
        },
        required: ['days'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_average_stats',
      description: 'Calculate average sleep duration and average bedtime in UTC from the sessions supplied with this recommendation request.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_sleep_tips',
      description: 'Look up a general wellness sleep tip from the gateway built-in knowledge base. It is not medical advice.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', enum: ['caffeine', 'routine', 'daylight', 'general'] },
        },
        required: ['topic'],
        additionalProperties: false,
      },
    },
  },
];

function asRecentSessions(recentSessions) {
  return Array.isArray(recentSessions)
    ? recentSessions.filter((session) => Number.isFinite(Number(session?.duration))).slice(-7)
    : [];
}

function averageBedtimeUtc(sessions) {
  const bedtimes = sessions
    .map((session) => new Date(session.start))
    .filter((date) => !Number.isNaN(date.getTime()))
    .map((date) => date.getUTCHours() * 60 + date.getUTCMinutes());
  if (!bedtimes.length) return null;

  const averageMinutes = Math.round(bedtimes.reduce((sum, minutes) => sum + minutes, 0) / bedtimes.length);
  const hour = Math.floor(averageMinutes / 60) % 24;
  return `${String(hour).padStart(2, '0')}:${String(averageMinutes % 60).padStart(2, '0')}`;
}

export function executeTool(name, rawArguments, context) {
  let args;
  try {
    args = rawArguments ? JSON.parse(rawArguments) : {};
  } catch {
    return { error: 'Tool arguments must be valid JSON.' };
  }

  const sessions = asRecentSessions(context.recentSessions);
  if (name === 'get_sleep_history') {
    const days = Math.min(Math.max(Number(args.days) || 1, 1), 7);
    return { sessions: sessions.slice(-days) };
  }

  if (name === 'get_average_stats') {
    if (!sessions.length) return { sessionCount: 0, averageDurationHours: null, averageBedtimeUtc: null };
    const averageDurationHours = sessions.reduce((sum, session) => sum + Number(session.duration), 0) / sessions.length;
    return {
      sessionCount: sessions.length,
      averageDurationHours: Number(averageDurationHours.toFixed(2)),
      averageBedtimeUtc: averageBedtimeUtc(sessions),
    };
  }

  if (name === 'search_sleep_tips') {
    const topic = typeof args.topic === 'string' ? args.topic : 'general';
    return { topic, tip: SLEEP_TIPS[topic] ?? SLEEP_TIPS.default };
  }

  return { error: `Unknown tool: ${name}` };
}

function buildUserPrompt(session, profile, recentSessions) {
  const lines = [];

  if (session) {
    lines.push(`Last night's sleep: duration ${session.duration} hours, from ${session.start} to ${session.end}.`);
  }
  if (profile) {
    const bits = [];
    if (profile.age) bits.push(`age ${profile.age}`);
    if (profile.height) bits.push(`height ${profile.height}`);
    if (profile.weight) bits.push(`weight ${profile.weight}`);
    if (bits.length) lines.push(`User profile: ${bits.join(', ')}.`);
  }
  if (recentSessions && recentSessions.length) {
    const avg = recentSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / recentSessions.length;
    lines.push(`Past ${recentSessions.length} nights average duration: ${avg.toFixed(1)} hours.`);
  }

  lines.push('Generate today\'s recommendation as strict JSON matching the schema.');
  return lines.join('\n');
}

async function callGroq(messages, env, options = {}) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.7,
      ...options,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Groq API error: ${data.error?.message || response.status}`);
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error('Groq returned no response message.');
  return message;
}

async function generateWithTools(context, env) {
  const outputLanguageInstruction = context.language === 'zh'
    ? '所有面向用户的字段值必须使用自然、地道的简体中文（中国大陆）。不要逐字翻译英文，也不要夹杂英文；请使用日常、温和、清楚的中文表达。JSON 字段名必须保持 schema 中的英文名称。'
    : 'All text content must be in English.';
  const messages = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n${outputLanguageInstruction}` },
    { role: 'user', content: buildUserPrompt(context.session, context.profile, context.recentSessions) },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const message = await callGroq(messages, env, { tools: TOOLS, tool_choice: 'auto' });
    messages.push(message);

    if (!message.tool_calls?.length) {
      return JSON.parse(message.content || '');
    }

    for (const toolCall of message.tool_calls) {
      const result = executeTool(toolCall.function.name, toolCall.function.arguments, context);
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
    }
  }

  const finalMessage = await callGroq(messages, env, { tool_choice: 'none', response_format: { type: 'json_object' } });
  return JSON.parse(finalMessage.content || '');
}

function landingPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="SleepTracker helps you notice your sleep patterns and build calmer routines.">
  <title>SleepTracker</title>
  <style>
    :root { --ink: #16252d; --muted: #5e6b70; --paper: #f6f2e9; --night: #183647; --mint: #9ed6c1; --coral: #f38c73; --line: #d7d0c3; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink); font-family: Georgia, "Times New Roman", serif; }
    main { width: min(1080px, calc(100% - 40px)); margin: 0 auto; }
    nav { display: flex; align-items: center; justify-content: space-between; padding: 22px 0; font-family: Arial, sans-serif; }
    .brand { font-weight: 800; letter-spacing: .04em; }
    .status { color: var(--muted); font-size: 13px; }
    .hero { display: grid; grid-template-columns: 1.1fr .9fr; gap: 44px; align-items: center; padding: 72px 0 64px; }
    h1 { font-size: clamp(48px, 7vw, 82px); font-weight: 500; line-height: .94; letter-spacing: -.04em; margin: 0; max-width: 650px; }
    .accent { color: #b95039; font-style: italic; }
    .lede { color: var(--muted); font-family: Arial, sans-serif; font-size: 18px; line-height: 1.6; max-width: 510px; margin: 28px 0; }
    .pill { display: inline-block; border: 1px solid var(--ink); border-radius: 999px; color: var(--ink); font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; padding: 12px 18px; text-decoration: none; }
    .visual { background: var(--night); color: white; min-height: 360px; padding: 24px; position: relative; overflow: hidden; }
    .moon { width: 120px; height: 120px; border-radius: 50%; background: #f6cf86; position: absolute; right: 34px; top: 33px; box-shadow: -24px 18px 0 #183647; }
    .stars { color: var(--mint); font-family: Arial, sans-serif; letter-spacing: 18px; font-size: 22px; }
    .sleep-card { background: #f7f3e9; color: var(--ink); bottom: 24px; left: 24px; padding: 20px; position: absolute; right: 24px; }
    .sleep-card span, .metric-label { color: var(--muted); font-family: Arial, sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .sleep-value { font-size: 44px; line-height: 1; margin: 8px 0; }
    .audience { border-top: 1px solid var(--line); display: grid; grid-template-columns: .85fr 1.15fr; gap: 44px; padding: 58px 0; }
    .eyebrow, .metric-label { color: var(--muted); font-family: Arial, sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .audience h2 { font-size: 38px; font-weight: 500; letter-spacing: -.03em; line-height: 1.05; margin: 12px 0 0; max-width: 310px; }
    .audience p { color: var(--muted); font-family: Arial, sans-serif; font-size: 16px; line-height: 1.65; margin: 0 0 18px; max-width: 570px; }
    .audience strong { color: var(--ink); }
    .metrics { border-top: 1px solid var(--line); display: grid; grid-template-columns: repeat(3, 1fr); margin-bottom: 0; }
    .metric { border-right: 1px solid var(--line); padding: 24px 20px 24px 0; }
    .metric + .metric { padding-left: 20px; }
    .metric:last-child { border-right: 0; }
    .metric h2 { font-size: 20px; font-weight: 500; margin: 10px 0 6px; }
    .metric p { color: var(--muted); font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; margin: 0; }
    .boundary { border-top: 1px solid var(--line); display: grid; grid-template-columns: .85fr 1.15fr; gap: 44px; padding: 38px 0 58px; }
    .boundary h2 { font-size: 25px; font-weight: 500; margin: 0; }
    .boundary p { color: var(--muted); font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; margin: 0; max-width: 590px; }
    footer { border-top: 1px solid var(--line); color: var(--muted); display: flex; font-family: Arial, sans-serif; font-size: 13px; justify-content: space-between; padding: 24px 0 34px; }
    @media (max-width: 720px) { .hero, .audience, .boundary { grid-template-columns: 1fr; gap: 24px; } .hero { padding-top: 42px; } .visual { min-height: 310px; } .metrics { grid-template-columns: 1fr; } .metric, .metric + .metric { border-bottom: 1px solid var(--line); border-right: 0; padding: 20px 0; } footer { gap: 12px; flex-direction: column; } }
  </style>
</head>
<body>
  <main>
    <nav><div class="brand">SLEEPTRACKER</div><div class="status">A calmer way to notice rest</div></nav>
    <section class="hero">
      <div>
        <h1>Rest is not a score. It is a <span class="accent">rhythm.</span></h1>
        <p class="lede">A private sleep companion for people living with restless nights, and for anyone who worries about not being able to sleep.</p>
        <a class="pill" href="/status">Service status</a>
      </div>
      <div class="visual" aria-label="A sleep summary illustration"><div class="stars">. . .</div><div class="moon"></div><div class="sleep-card"><span>Last night</span><div class="sleep-value">7h 12m</div><span>A quiet foundation for today</span></div></div>
    </section>
    <section class="audience">
      <div><div class="eyebrow">Made for</div><h2>Nights that feel harder than they should.</h2></div>
      <div>
        <p><strong>SleepTracker is for people with insomnia symptoms, irregular rest, or recurring anxiety about sleep.</strong> It offers a quieter place to notice what is happening without turning every night into a performance.</p>
        <p>Use it after a difficult night, during a stressful season, or simply when you want a more grounded relationship with rest. You decide what to record and when to look at it.</p>
      </div>
    </section>
    <section class="metrics">
      <article class="metric"><div class="metric-label">Track</div><h2>Start anywhere</h2><p>Record a sleep session in the app, from your Home Screen, or from a Lock Screen control.</p></article>
      <article class="metric"><div class="metric-label">Reflect</div><h2>See your own patterns</h2><p>Keep a simple local sleep history, then receive gentle food, movement, and wind-down ideas for the next day.</p></article>
      <article class="metric"><div class="metric-label">Privacy</div><h2>Built with restraint</h2><p>Your sleep history stays on your device. The recommendation service only uses the data sent for that request.</p></article>
    </section>
    <section class="boundary">
      <h2>Support, not a diagnosis.</h2>
      <p>SleepTracker provides general wellness support and does not diagnose, treat, or replace care for insomnia or other health conditions. If sleep difficulty persists, causes distress, or affects your safety, speak with a qualified healthcare professional.</p>
    </section>
    <footer><span>SleepTracker</span><span>General wellness support, not medical advice.</span></footer>
  </main>
</body>
</html>`;
}

function statusPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Service Status | SleepTracker</title>
  <style>
    :root { --ink: #16252d; --muted: #5e6b70; --paper: #f6f2e9; --mint: #9ed6c1; --line: #d7d0c3; }
    * { box-sizing: border-box; }
    body { align-items: center; background: var(--paper); color: var(--ink); display: flex; font-family: Georgia, "Times New Roman", serif; margin: 0; min-height: 100vh; }
    main { margin: 0 auto; max-width: 680px; padding: 36px 24px; width: 100%; }
    .brand { font-family: Arial, sans-serif; font-size: 13px; font-weight: 800; letter-spacing: .06em; }
    h1 { font-size: clamp(42px, 8vw, 68px); font-weight: 500; letter-spacing: -.04em; line-height: .96; margin: 38px 0 18px; }
    .lede { color: var(--muted); font-family: Arial, sans-serif; font-size: 17px; line-height: 1.6; max-width: 560px; }
    .panel { background: white; border: 1px solid var(--line); margin: 34px 0; padding: 24px; }
    .state { align-items: center; display: flex; font-family: Arial, sans-serif; font-size: 18px; font-weight: 700; gap: 10px; }
    .dot { background: #3b8c6e; border-radius: 50%; box-shadow: 0 0 0 5px var(--mint); height: 10px; width: 10px; }
    .row { border-top: 1px solid var(--line); color: var(--muted); display: flex; font-family: Arial, sans-serif; font-size: 14px; justify-content: space-between; margin-top: 22px; padding-top: 16px; }
    a { color: var(--ink); font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; }
    @media (max-width: 480px) { .row { gap: 8px; flex-direction: column; } }
  </style>
</head>
<body>
  <main>
    <div class="brand">SLEEPTRACKER</div>
    <h1>Everything is running.</h1>
    <p class="lede">The SleepTracker recommendation service is available. Your app can request a daily wellness plan whenever you choose to refresh it.</p>
    <section class="panel" aria-label="Service status">
      <div class="state"><span class="dot" aria-hidden="true"></span>All systems operational</div>
      <div class="row"><span>Recommendation gateway</span><strong>Operational</strong></div>
      <div class="row"><span>Health endpoint</span><strong>Operational</strong></div>
    </section>
    <a href="/">Return to SleepTracker</a>
  </main>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(landingPage(), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    if (request.method === 'GET' && url.pathname === '/status') {
      return new Response(statusPage(), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=60',
        },
      });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ status: 'ok' });
    }

    if (url.pathname !== '/v1/recommendations') {
      return new Response('Not found', { status: 404 });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { session, profile, recentSessions, language } = await request.json();
      const recommendation = await generateWithTools({ session, profile, recentSessions, language }, env);

      return new Response(
        JSON.stringify({ recommendation, provider: 'groq' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: `Gateway error: ${err.message}` }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
};
