const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function validateEvent(value) {
  const fail = () => { throw new HttpError(400, 'Invalid sleep event'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  const allowed = ['schema_version', 'event_id', 'session_id', 'event_type', 'occurred_at', 'timezone', 'session'];
  if (Object.keys(value).some(key => !allowed.includes(key))) fail();
  if (value.schema_version !== 1 || !UUID.test(value.event_id) || !UUID.test(value.session_id)) fail();
  if (!['sleep.completed', 'sleep.deleted'].includes(value.event_type)) fail();
  if (typeof value.timezone !== 'string' || value.timezone.length > 100) fail();
  try { new Intl.DateTimeFormat('en', { timeZone: value.timezone }); } catch { fail(); }
  const session = value.session;
  if (!session || Object.keys(session).some(key => !['start', 'end', 'duration'].includes(key))) fail();
  for (const date of [value.occurred_at, session.start, session.end]) {
    if (typeof date !== 'string' || !ISO.test(date) || !Number.isFinite(Date.parse(date))) fail();
  }
  const hours = (Date.parse(session.end) - Date.parse(session.start)) / 3600000;
  if (!(hours > 0 && hours <= 24) || !Number.isFinite(session.duration) || Math.abs(hours - session.duration) > 0.02) fail();
  return {
    schema_version: 1,
    event_id: value.event_id.toLowerCase(),
    session_id: value.session_id.toLowerCase(),
    event_type: value.event_type,
    occurred_at: new Date(value.occurred_at).toISOString(),
    timezone: value.timezone,
    session: { start: new Date(session.start).toISOString(), end: new Date(session.end).toISOString(), duration: hours },
  };
}

export async function ingestEvent(pool, userId, event) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize operations for this user's session, including completion/deletion races.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${userId}:${event.session_id}`]);
    const payload = JSON.stringify({ ...event, user_id: userId });
    const inserted = await client.query(`INSERT INTO event_outbox(user_id, event_id, session_id, payload)
      VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING event_id`, [userId, event.event_id, event.session_id, payload]);
    if (!inserted.rowCount) {
      const existing = await client.query('SELECT payload = $3::jsonb AS matches FROM event_outbox WHERE user_id = $1 AND event_id = $2', [userId, event.event_id, payload]);
      if (!existing.rows[0]?.matches) throw new HttpError(409, 'Event ID was already used with different data');
      await client.query('COMMIT');
      return 'duplicate';
    }
    const existing = await client.query('SELECT started_at, ended_at, timezone FROM sleep_sessions WHERE user_id = $1 AND session_id = $2', [userId, event.session_id]);
    if (existing.rowCount) {
      const row = existing.rows[0];
      if (row.started_at.toISOString() !== event.session.start || row.ended_at.toISOString() !== event.session.end || row.timezone !== event.timezone) {
        throw new HttpError(409, 'Session ID was already used with different data');
      }
    }
    const deleted = event.event_type === 'sleep.deleted';
    await client.query(`INSERT INTO sleep_sessions(user_id, session_id, started_at, ended_at, duration_hours, timezone, revision, deleted_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, session_id) DO UPDATE SET revision = EXCLUDED.revision,
        deleted_at = EXCLUDED.deleted_at, updated_at = now()
      WHERE sleep_sessions.revision < EXCLUDED.revision`,
    [userId, event.session_id, event.session.start, event.session.end, event.session.duration, event.timezone, deleted ? 2 : 1, deleted ? event.occurred_at : null]);
    await client.query('COMMIT');
    return 'accepted';
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
