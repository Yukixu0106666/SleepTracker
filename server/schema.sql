BEGIN;
CREATE TABLE IF NOT EXISTS app_users (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS device_credentials (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(user_id),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sleep_sessions (
  user_id uuid NOT NULL REFERENCES app_users(user_id),
  session_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  duration_hours double precision NOT NULL CHECK (duration_hours > 0 AND duration_hours <= 24),
  timezone text NOT NULL,
  revision integer NOT NULL CHECK (revision IN (1, 2)),
  deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, session_id),
  CHECK (ended_at > started_at AND ended_at <= started_at + interval '24 hours')
);
CREATE TABLE IF NOT EXISTS event_outbox (
  user_id uuid NOT NULL REFERENCES app_users(user_id),
  event_id uuid NOT NULL,
  session_id uuid NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  exported_at timestamptz,
  PRIMARY KEY (user_id, event_id)
);
CREATE INDEX IF NOT EXISTS event_outbox_pending ON event_outbox(received_at) WHERE exported_at IS NULL;
COMMIT;
