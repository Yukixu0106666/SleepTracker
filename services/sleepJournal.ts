// Single durable document: a session and its upload event are committed together.
// Dependencies are injected so crash/retry/concurrency behavior is testable in Node.
export type Session = { start: string; end: string; duration: number };
export type StoredSession = Session & { sessionId: string; timezone: string };
export type SleepEvent = {
  schema_version: 1; event_id: string; session_id: string;
  event_type: 'sleep.completed' | 'sleep.deleted'; occurred_at: string;
  timezone: string; session: Session;
};
type Pending = { event: SleepEvent; attempts: number; nextAttempt: number; error?: string; blocked?: boolean };
type Journal = {
  version: 1; history: StoredSession[]; queue: Pending[];
  ownerId?: string; endpoint?: string; lastSyncedAt?: string;
};
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
type Credentials = { token: string; userId: string; endpoint: string };
export const JOURNAL_KEY = 'sleepJournal.v1';

export function createSleepJournal({ storage, uuid, now = Date.now, timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }: {
  storage: Storage; uuid: () => string; now?: () => number; timezone?: () => string;
}) {
  let tail: Promise<unknown> = Promise.resolve();
  let flight: Promise<void> | undefined;
  function locked<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation);
    tail = result.catch(() => undefined);
    return result;
  }
  const save = (state: Journal) => storage.setItem(JOURNAL_KEY, JSON.stringify(state));
  function eventFor(session: StoredSession, type: SleepEvent['event_type']): Pending {
    return { event: {
      schema_version: 1, event_id: uuid(), session_id: session.sessionId,
      event_type: type, occurred_at: new Date(now()).toISOString(), timezone: session.timezone,
      session: { start: session.start, end: session.end, duration: session.duration },
    }, attempts: 0, nextAttempt: 0 };
  }
  async function read(): Promise<Journal> {
    const raw = await storage.getItem(JOURNAL_KEY);
    if (raw) {
      const state = JSON.parse(raw) as Journal;
      if (state.version !== 1 || !Array.isArray(state.history) || !Array.isArray(state.queue)) throw new Error('Invalid sleep journal');
      return state;
    }
    const legacy = await storage.getItem('sleepHistory');
    const sessions = legacy ? JSON.parse(legacy) as Session[] : [];
    if (!Array.isArray(sessions)) throw new Error('Invalid legacy sleep history');
    const history = sessions.map(session => ({ ...session, sessionId: uuid(), timezone: timezone() }));
    const state: Journal = { version: 1, history, queue: history.map(session => eventFor(session, 'sleep.completed')) };
    await save(state);
    return state;
  }
  return {
    history: () => locked(async () => (await read()).history),
    status: () => locked(async () => {
      const state = await read();
      return { pending: state.queue.length, blocked: state.queue.filter(item => item.blocked).length,
        error: state.queue.find(item => item.error)?.error, lastSyncedAt: state.lastSyncedAt, ownerId: state.ownerId };
    }),
    add: (session: Session) => locked(async () => {
      const state = await read();
      // Root/widget/sleep screen can all observe the same completed native session.
      const previous = state.history.find(item => item.start === session.start && item.end === session.end);
      if (previous) return previous;
      const deleted = state.queue.find(item => item.event.event_type === 'sleep.deleted' && item.event.session.start === session.start && item.event.session.end === session.end);
      if (deleted) throw new Error('Session was already deleted');
      const stored = { ...session, sessionId: uuid(), timezone: timezone() };
      state.history.push(stored);
      state.queue.push(eventFor(stored, 'sleep.completed'));
      await save(state);
      return stored;
    }),
    remove: (sessionId: string) => locked(async () => {
      const state = await read();
      const session = state.history.find(item => item.sessionId === sessionId);
      if (!session) return;
      state.history = state.history.filter(item => item.sessionId !== sessionId);
      state.queue.push(eventFor(session, 'sleep.deleted'));
      await save(state);
    }),
    bind: (userId: string, endpoint: string) => locked(async () => {
      const state = await read();
      if (state.ownerId && (state.ownerId !== userId || state.endpoint !== endpoint)) throw new Error('This local history is linked to another account or server');
      state.ownerId = userId;
      state.endpoint = endpoint;
      await save(state);
    }),
    flush(credentials: Credentials, request: typeof fetch, force = false): Promise<void> {
      if (flight) return flight;
      flight = (async () => {
        const snapshot = await locked(async () => {
          const state = await read();
          if (state.ownerId !== credentials.userId || state.endpoint !== credentials.endpoint) throw new Error('Connection does not match this local history');
          return state.queue.filter(item => (force || !item.blocked) && (force || item.nextAttempt <= now())).slice(0, 50);
        });
        for (const item of snapshot) {
          let error = 'network';
          let blocked = false;
          let stop = false;
          let acknowledged = false;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          try {
            const response = await request(`${credentials.endpoint}/v1/events`, {
              method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credentials.token}` },
              body: JSON.stringify(item.event), signal: controller.signal,
            });
            if (response.ok) {
              const body = await response.json();
              acknowledged = body.event_id === item.event.event_id && ['accepted', 'duplicate'].includes(body.status);
              if (!acknowledged) { error = 'invalid_ack'; stop = true; }
            } else {
              error = `http_${response.status}`;
              blocked = [400, 401, 403, 409, 413, 415, 422].includes(response.status);
              stop = [401, 403, 429].includes(response.status) || response.status >= 500;
            }
          } catch { stop = true; } finally { clearTimeout(timeout); }
          await locked(async () => {
            const state = await read();
            if (acknowledged) {
              state.queue = state.queue.filter(entry => entry.event.event_id !== item.event.event_id);
              state.lastSyncedAt = new Date(now()).toISOString();
            } else {
              const pending = state.queue.find(entry => entry.event.event_id === item.event.event_id);
              if (pending) {
                pending.attempts += 1;
                pending.nextAttempt = now() + Math.min(3600000, 5000 * 2 ** Math.min(pending.attempts - 1, 10));
                pending.error = error;
                pending.blocked = blocked;
              }
            }
            await save(state);
          });
          if (stop) break;
        }
      })().finally(() => { flight = undefined; });
      return flight;
    },
  };
}
