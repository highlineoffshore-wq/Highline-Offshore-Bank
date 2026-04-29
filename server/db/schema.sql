-- Optional PostgreSQL schema for this banking API (audit + future user migration).
-- Apply with: psql "$DATABASE_URL" -f server/db/schema.sql
-- Or start with docker compose and set DATABASE_URL in server/.env

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

-- Future: migrate users-store.json into normalized tables, e.g.:
-- CREATE TABLE bw_users (
--   id TEXT PRIMARY KEY,
--   email CITEXT UNIQUE NOT NULL,
--   password_hash TEXT NOT NULL,
--   display_name TEXT NOT NULL,
--   banking JSONB NOT NULL DEFAULT '{}',
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
