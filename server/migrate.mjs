import { readFile } from 'node:fs/promises';
import { createPool } from './database.mjs';

const pool = createPool();
try {
  await pool.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  console.log('Sleep ingestion schema ready.');
} finally {
  await pool.end();
}
