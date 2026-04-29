import pg from 'pg'

/** @type {import('pg').Pool | null} */
let pool = null

const url = process.env.DATABASE_URL?.trim()

if (url) {
  pool = new pg.Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30_000,
  })
  pool.on('error', (err) => {
    console.error('[pg] pool error:', err.message)
  })
}

export function getPool() {
  return pool
}

export async function initPgSchema() {
  if (!pool) return
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bw_audit_events (
      id BIGSERIAL PRIMARY KEY,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      action TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      target TEXT,
      ip TEXT,
      meta JSONB
    );
    CREATE INDEX IF NOT EXISTS bw_audit_ts ON bw_audit_events (ts DESC);
  `)
  console.log('[api] PostgreSQL: audit table ready (bw_audit_events)')
}
