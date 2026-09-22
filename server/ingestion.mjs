import http from 'node:http';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createPool } from './database.mjs';
import { HttpError, ingestEvent, validateEvent } from './events.mjs';

export function createIngestionServer(pool, { corsOrigin = process.env.INGESTION_CORS_ORIGIN ?? 'http://localhost:8081' } = {}) {
  const server = http.createServer(async (request, response) => {
    const send = (status, body) => {
      response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': corsOrigin, Vary: 'Origin',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      });
      response.end(JSON.stringify(body));
    };
    try {
      if (request.headers.origin && request.headers.origin !== corsOrigin) throw new HttpError(403, 'Origin not allowed');
      if (request.method === 'OPTIONS') return send(204, {});
      if (request.method === 'GET' && request.url === '/health') {
        await pool.query('SELECT 1');
        return send(200, { status: 'ok' });
      }
      if (!((request.method === 'POST' && request.url === '/v1/events') || (request.method === 'GET' && request.url === '/v1/me'))) {
        throw new HttpError(404, 'Not found');
      }
      const token = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.authorization ?? '')?.[1];
      if (!token) throw new HttpError(401, 'Valid connection credential required');
      const auth = await pool.query(`SELECT user_id FROM device_credentials WHERE token_hash = $1
        AND revoked_at IS NULL AND expires_at > now()`, [createHash('sha256').update(token).digest('hex')]);
      if (!auth.rowCount) throw new HttpError(401, 'Credential expired or revoked');
      const userId = auth.rows[0].user_id;
      if (request.url === '/v1/me') return send(200, { user_id: userId });
      if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new HttpError(415, 'Expected application/json');
      const chunks = [];
      let bytes = 0;
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > 16384) throw new HttpError(413, 'Event exceeds 16 KiB');
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Invalid JSON'); }
      const event = validateEvent(body);
      const status = await ingestEvent(pool, userId, event);
      return send(status === 'accepted' ? 201 : 200, { event_id: event.event_id, status });
    } catch (error) {
      // Do not expose database details, tokens or health data in errors/logs.
      return send(error instanceof HttpError ? error.status : 503, { error: error instanceof HttpError ? error.message : 'Storage temporarily unavailable' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pool = createPool();
  pool.on('error', () => console.error('Database connection interrupted'));
  const server = createIngestionServer(pool);
  const port = Number(process.env.INGESTION_PORT ?? 8788);
  server.listen(port, process.env.INGESTION_HOST ?? '127.0.0.1', () => console.log(`Sleep ingestion API listening on :${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { void pool.end(); }));
}
