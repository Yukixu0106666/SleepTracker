import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import pg from 'pg';
import { createIngestionServer } from '../ingestion.mjs';
import { validateEvent } from '../events.mjs';
import { createSleepJournal } from '../../services/sleepJournal.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;
const schema = `ingestion_test_${randomBytes(8).toString('hex')}`;
let admin, pool, server, base, userId, token;
const event = () => ({ schema_version: 1, event_id: randomUUID(), session_id: randomUUID(),
  event_type: 'sleep.completed', occurred_at: '2026-09-14T06:00:00.000Z', timezone: 'America/Toronto',
  session: { start: '2026-09-13T23:00:00.000Z', end: '2026-09-14T06:00:00.000Z', duration: 7 } });

async function identity() {
  const user = randomUUID();
  const secret = randomBytes(32).toString('hex');
  await pool.query('INSERT INTO app_users(user_id) VALUES ($1)', [user]);
  await pool.query("INSERT INTO device_credentials(token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')", [createHash('sha256').update(secret).digest('hex'), user]);
  return { user, secret };
}
const post = (body, secret = token) => fetch(`${base}/v1/events`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` }, body: JSON.stringify(body),
});
const count = async (table, id) => Number((await pool.query(`SELECT count(*) FROM ${table} WHERE session_id = $1`, [id])).rows[0].count);

before(async () => {
  if (!databaseUrl) return;
  admin = new pg.Pool({ connectionString: databaseUrl });
  await admin.query(`CREATE SCHEMA ${schema}`);
  pool = new pg.Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}`, max: 10 });
  await pool.query(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
  ({ user: userId, secret: token } = await identity());
  server = createIngestionServer(pool);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (pool) await pool.end();
  if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
});

test('validation rejects spoofed user, invalid timezone, missing offset, invalid duration', () => {
  for (const bad of [
    { ...event(), user_id: randomUUID() }, { ...event(), timezone: 'Moon/Base' },
    { ...event(), session: { ...event().session, start: '2026-09-13T23:00:00' } },
    { ...event(), session: { ...event().session, duration: 6 } },
    { ...event(), session: { ...event().session, duration: null } },
  ]) assert.throws(() => validateEvent(bad), /Invalid sleep event/);
});

const integration = (name, fn) => test(name, { skip: !databaseUrl && 'Set TEST_DATABASE_URL to run real PostgreSQL tests' }, fn);

integration('API requires credentials and derives identity from the server', async () => {
  assert.equal((await post(event(), '')).status, 401);
  assert.equal((await post(event(), '0'.repeat(64))).status, 401);
  assert.equal((await post({ ...event(), user_id: randomUUID() })).status, 400);
  const response = await fetch(`${base}/v1/me`, { headers: { Authorization: `Bearer ${token}` } });
  assert.deepEqual(await response.json(), { user_id: userId });
});

integration('completion and outbox commit together; 10 concurrent retries produce one record', async () => {
  const value = event();
  const replies = await Promise.all(Array.from({ length: 10 }, () => post(value)));
  assert.equal(replies.filter(reply => reply.status === 201).length, 1);
  assert.equal(replies.filter(reply => reply.status === 200).length, 9);
  assert.equal(await count('sleep_sessions', value.session_id), 1);
  assert.equal(await count('event_outbox', value.session_id), 1);
  const stored = (await pool.query('SELECT payload FROM event_outbox WHERE event_id = $1', [value.event_id])).rows[0].payload;
  assert.equal(stored.user_id, userId);
});

integration('conflicting event or session IDs roll back the outbox insert', async () => {
  const value = event();
  assert.equal((await post(value)).status, 201);
  const conflicting = { ...value, session: { ...value.session, start: '2026-09-13T22:00:00.000Z', duration: 8 } };
  assert.equal((await post(conflicting)).status, 409);
  assert.equal((await post({ ...conflicting, event_id: randomUUID() })).status, 409);
  assert.equal(await count('event_outbox', value.session_id), 1);
});

integration('same client IDs from two users remain isolated', async () => {
  const value = event();
  const other = await identity();
  assert.equal((await post(value)).status, 201);
  assert.equal((await post(value, other.secret)).status, 201);
  assert.equal(await count('sleep_sessions', value.session_id), 2);
});

integration('deletion arriving first cannot be undone by a delayed completion', async () => {
  const completion = event();
  const deletion = { ...completion, event_id: randomUUID(), event_type: 'sleep.deleted' };
  assert.equal((await post(deletion)).status, 201);
  assert.equal((await post(completion)).status, 201);
  assert.equal((await post(deletion)).status, 200);
  const row = (await pool.query('SELECT revision, deleted_at FROM sleep_sessions WHERE session_id = $1', [completion.session_id])).rows[0];
  assert.equal(row.revision, 2);
  assert.ok(row.deleted_at);
});

integration('revoked and expired credentials are rejected', async () => {
  const other = await identity();
  await pool.query('UPDATE device_credentials SET revoked_at = now() WHERE user_id = $1', [other.user]);
  assert.equal((await post(event(), other.secret)).status, 401);
  await pool.query("UPDATE device_credentials SET revoked_at = NULL, expires_at = now() - interval '1 hour' WHERE user_id = $1", [other.user]);
  assert.equal((await post(event(), other.secret)).status, 401);
});

integration('a database failure after outbox insert leaves neither a session nor an event', async () => {
  const value = event();
  await pool.query(`CREATE FUNCTION reject_test_session() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.session_id = '${value.session_id}'::uuid THEN RAISE EXCEPTION 'test failure'; END IF; RETURN NEW; END $$`);
  await pool.query('CREATE TRIGGER reject_test BEFORE INSERT ON sleep_sessions FOR EACH ROW EXECUTE FUNCTION reject_test_session()');
  try {
    assert.equal((await post(value)).status, 503);
    assert.equal(await count('sleep_sessions', value.session_id), 0);
    assert.equal(await count('event_outbox', value.session_id), 0);
  } finally { await pool.query('DROP TRIGGER reject_test ON sleep_sessions'); }
  assert.equal((await post(value)).status, 201);
});

integration('real queue → HTTP → PostgreSQL recovers a lost acknowledgement and sends deletion', async () => {
  const values = new Map();
  const storage = { async getItem(key) { return values.get(key) ?? null; }, async setItem(key, value) { values.set(key, value); } };
  const create = () => createSleepJournal({ storage, uuid: randomUUID, timezone: () => 'America/Toronto' });
  const journal = create();
  const value = event();
  const stored = await journal.add(value.session);
  await journal.bind(userId, base);
  const credentials = { userId, token, endpoint: base };
  await journal.flush(credentials, async (url, options) => {
    const response = await fetch(url, options);
    assert.equal(response.status, 201);
    throw new Error('connection lost after server commit');
  });
  assert.equal((await journal.status()).pending, 1);
  assert.equal(await count('sleep_sessions', stored.sessionId), 1);
  const restarted = create();
  await restarted.flush(credentials, fetch, true);
  assert.equal((await restarted.status()).pending, 0);
  assert.equal(await count('event_outbox', stored.sessionId), 1);
  await restarted.remove(stored.sessionId);
  await restarted.flush(credentials, fetch);
  assert.equal((await restarted.history()).length, 0);
  assert.equal((await restarted.status()).pending, 0);
  assert.equal(await count('event_outbox', stored.sessionId), 2);
});

integration('body limits and malformed JSON return actionable client errors', async () => {
  assert.equal((await post({ padding: 'x'.repeat(17000) })).status, 413);
  const response = await fetch(`${base}/v1/events`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(response.status, 400);
});
