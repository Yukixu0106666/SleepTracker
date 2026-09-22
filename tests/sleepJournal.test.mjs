import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createSleepJournal, JOURNAL_KEY } from '../services/sleepJournal.ts';

const session = { start: '2026-09-13T23:00:00.000Z', end: '2026-09-14T06:00:00.000Z', duration: 7 };
const credential = { userId: randomUUID(), token: 'a'.repeat(64), endpoint: 'https://sleep.test' };
function setup(initial = {}) {
  const values = new Map(Object.entries(initial));
  let fail = false;
  let clock = 100000;
  const storage = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { if (fail) throw new Error('disk full'); values.set(key, value); },
  };
  const create = () => createSleepJournal({ storage, uuid: randomUUID, timezone: () => 'America/Toronto', now: () => clock });
  return { journal: create(), create, values, fail: value => { fail = value; }, advance: ms => { clock += ms; } };
}
const ack = async (_url, options) => new Response(JSON.stringify({ event_id: JSON.parse(options.body).event_id, status: 'accepted' }), { status: 201 });

test('legacy migration keeps history, generates durable IDs once, and queues records', async () => {
  const fixture = setup({ sleepHistory: JSON.stringify([session]) });
  const first = await fixture.journal.history();
  const recovered = fixture.create();
  assert.deepEqual(await recovered.history(), first);
  assert.equal((await recovered.status()).pending, 1);
});

test('concurrent native callbacks deduplicate, distinct concurrent sessions are retained', async () => {
  const { journal } = setup();
  const other = { ...session, start: '2026-09-13T22:00:00.000Z', duration: 8 };
  await Promise.all([journal.add(session), journal.add(session), journal.add(other)]);
  assert.equal((await journal.history()).length, 2);
  assert.equal((await journal.status()).pending, 2);
});

test('failed atomic save exposes neither half of the session/event pair', async () => {
  const fixture = setup();
  await fixture.journal.history();
  fixture.fail(true);
  await assert.rejects(fixture.journal.add(session), /disk full/);
  fixture.fail(false);
  assert.equal((await fixture.journal.history()).length, 0);
  assert.equal((await fixture.journal.status()).pending, 0);
});

test('offline attempt survives restart, respects backoff and retries with the same event ID', async () => {
  const fixture = setup();
  await fixture.journal.add(session);
  await fixture.journal.bind(credential.userId, credential.endpoint);
  let sentId;
  await fixture.journal.flush(credential, async (_url, options) => { sentId = JSON.parse(options.body).event_id; throw new Error('offline'); });
  const recovered = fixture.create();
  await recovered.flush(credential, () => { assert.fail('backoff should delay'); });
  fixture.advance(5000);
  await recovered.flush(credential, async (url, options) => {
    assert.equal(JSON.parse(options.body).event_id, sentId);
    return ack(url, options);
  });
  assert.equal((await recovered.status()).pending, 0);
  assert.equal((await recovered.history()).length, 1);
});

test('a 200 response without a matching acknowledgement never deletes a queue entry', async () => {
  const { journal } = setup();
  await journal.add(session);
  await journal.bind(credential.userId, credential.endpoint);
  await journal.flush(credential, async () => new Response(JSON.stringify({ status: 'accepted', event_id: randomUUID() })));
  assert.equal((await journal.status()).pending, 1);
  assert.equal((await journal.status()).error, 'invalid_ack');
});

test('enqueue and deletion during an in-flight upload are not overwritten by its acknowledgement', async () => {
  const { journal } = setup();
  const stored = await journal.add(session);
  await journal.bind(credential.userId, credential.endpoint);
  let release;
  let reached;
  const started = new Promise(resolve => { reached = resolve; });
  const upload = journal.flush(credential, async (url, options) => {
    reached();
    await new Promise(resolve => { release = resolve; });
    return ack(url, options);
  });
  await started;
  await journal.remove(stored.sessionId);
  await journal.add({ ...session, start: '2026-09-13T22:00:00.000Z', duration: 8 });
  release();
  await upload;
  assert.equal((await journal.status()).pending, 2);
  assert.equal((await journal.history()).length, 1);
  await journal.flush(credential, ack);
  assert.equal((await journal.status()).pending, 0);
});

test('permanent rejection is retained and manual retry can clear it', async () => {
  const { journal } = setup();
  await journal.add(session);
  await journal.bind(credential.userId, credential.endpoint);
  await journal.flush(credential, async () => new Response('{}', { status: 401 }));
  assert.equal((await journal.status()).blocked, 1);
  await journal.flush(credential, () => { assert.fail('blocked event should wait for manual retry'); });
  await journal.flush(credential, ack, true);
  assert.equal((await journal.status()).pending, 0);
});

test('account/server switches cannot upload one user history under another identity', async () => {
  const { journal } = setup();
  await journal.bind(credential.userId, credential.endpoint);
  await assert.rejects(journal.bind(randomUUID(), credential.endpoint), /another account/);
  await assert.rejects(journal.bind(credential.userId, 'https://other.test'), /another account/);
  await assert.rejects(journal.flush({ ...credential, userId: randomUUID() }, ack), /does not match/);
});

test('storage failure after server acknowledgement replays safely as a duplicate', async () => {
  const fixture = setup();
  await fixture.journal.add(session);
  await fixture.journal.bind(credential.userId, credential.endpoint);
  await assert.rejects(fixture.journal.flush(credential, async (url, options) => {
    fixture.fail(true);
    return ack(url, options);
  }), /disk full/);
  fixture.fail(false);
  const persisted = JSON.parse(fixture.values.get(JOURNAL_KEY));
  assert.equal(persisted.queue.length, 1);
  await fixture.create().flush(credential, async (_url, options) => new Response(JSON.stringify({
    event_id: JSON.parse(options.body).event_id, status: 'duplicate',
  })));
  assert.equal((await fixture.journal.status()).pending, 0);
});
