import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createPool } from './database.mjs';

// Administrative CLI only; no public registration endpoint or shared app secret.
const pool = createPool();
try {
  const [command = 'create', userId = randomUUID()] = process.argv.slice(2);
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Expected a user UUID');
  if (command === 'revoke') {
    const result = await pool.query('UPDATE device_credentials SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
    console.log(`Revoked ${result.rowCount} credentials for ${userId}`);
  } else if (command === 'create') {
    const token = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO app_users(user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
      await client.query("INSERT INTO device_credentials(token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '90 days')", [hash, userId]);
      await client.query('COMMIT');
      console.log(JSON.stringify({ user_id: userId, token, expires_in_days: 90 }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  } else throw new Error('Use create [user UUID] or revoke <user UUID>');
} finally { await pool.end(); }
