-- OpenClaw Observatory Database Schema
-- TimescaleDB-powered event storage for agent observability

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Main events table (hypertable for time-series)
CREATE TABLE IF NOT EXISTS events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL,
  gateway_id TEXT NOT NULL,
  session_key TEXT NOT NULL,
  parent_session_key TEXT,
  agent_id TEXT,
  channel TEXT,
  turn_id TEXT,
  message_id TEXT,

  -- Token metrics
  tokens_input INTEGER,
  tokens_output INTEGER,
  tokens_total INTEGER,
  tokens_context_used INTEGER,
  tokens_context_max INTEGER,
  tokens_percent_used REAL,

  -- Timing
  timing_start_ms BIGINT,
  timing_end_ms BIGINT,
  duration_ms INTEGER,
  ttft_ms INTEGER,

  -- Tool
  tool_name TEXT,
  tool_error TEXT,

  -- Error
  error_type TEXT,
  error_message TEXT,
  error_retriable BOOLEAN,

  -- Model
  model_provider TEXT,
  model_id TEXT,

  -- Cost
  cost_input REAL,
  cost_output REAL,
  cost_total REAL,

  -- Payloads (JSONB for flexibility)
  payload JSONB,
  
  -- Composite primary key for TimescaleDB compatibility
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable (if timescaledb is available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM create_hypertable('events', 'timestamp', if_not_exists => TRUE);
  END IF;
END
$$;

-- Sessions view for aggregated session data
CREATE OR REPLACE VIEW sessions AS
SELECT
  session_key,
  gateway_id,
  parent_session_key,
  agent_id,
  channel,
  MIN(timestamp) AS started_at,
  MAX(timestamp) AS last_event_at,
  COUNT(*) AS event_count,
  COUNT(*) FILTER (WHERE event_type = 'turn.completed') AS turn_count,
  COUNT(*) FILTER (WHERE error_type IS NOT NULL) AS error_count,
  SUM(COALESCE(cost_total, 0)) AS total_cost,
  MAX(tokens_context_used) AS max_context_used,
  MAX(tokens_context_max) AS context_max,
  MAX(tokens_percent_used) AS max_context_percent,
  BOOL_OR(event_type = 'session.ended') AS is_ended
FROM events
GROUP BY session_key, gateway_id, parent_session_key, agent_id, channel;

-- Gateways table for tracking connected gateways
CREATE TABLE IF NOT EXISTS gateways (
  id TEXT PRIMARY KEY,
  name TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_count BIGINT DEFAULT 0,
  metadata JSONB
);

-- Alert rules configuration
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  condition TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  message_template TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  cooldown_seconds INTEGER DEFAULT 300,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert history
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES alert_rules(id),
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  session_key TEXT,
  gateway_id TEXT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  metadata JSONB
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_events_session ON events (session_key, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_gateway ON events (gateway_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_error ON events (error_type) WHERE error_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_turn ON events (turn_id) WHERE turn_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON alerts (triggered_at DESC) WHERE resolved_at IS NULL;

-- Retention policy (if timescaledb is available) - default 30 days
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM add_retention_policy('events', INTERVAL '30 days', if_not_exists => TRUE);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if policy already exists
  NULL;
END
$$;

-- Continuous aggregates for fast dashboards (if timescaledb is available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    -- Drop and recreate to ensure consistency
    DROP MATERIALIZED VIEW IF EXISTS hourly_metrics CASCADE;

    CREATE MATERIALIZED VIEW hourly_metrics
    WITH (timescaledb.continuous) AS
    SELECT
      time_bucket('1 hour', timestamp) AS hour,
      gateway_id,
      COUNT(*) FILTER (WHERE event_type = 'turn.completed') AS turns,
      COUNT(*) FILTER (WHERE error_type IS NOT NULL) AS errors,
      SUM(COALESCE(cost_total, 0)) AS total_cost,
      AVG(tokens_percent_used) FILTER (WHERE tokens_percent_used IS NOT NULL) AS avg_context_pct,
      AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL) AS avg_duration_ms,
      COUNT(DISTINCT session_key) AS unique_sessions,
      SUM(COALESCE(tokens_input, 0)) AS total_input_tokens,
      SUM(COALESCE(tokens_output, 0)) AS total_output_tokens
    FROM events
    GROUP BY hour, gateway_id
    WITH NO DATA;

    -- Add refresh policy
    PERFORM add_continuous_aggregate_policy('hourly_metrics',
      start_offset => INTERVAL '3 hours',
      end_offset => INTERVAL '1 hour',
      schedule_interval => INTERVAL '1 hour',
      if_not_exists => TRUE
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors during continuous aggregate creation
  RAISE NOTICE 'Could not create continuous aggregate: %', SQLERRM;
END
$$;

-- Insert default alert rules
INSERT INTO alert_rules (name, condition, severity, message_template, cooldown_seconds)
VALUES
  ('Context Warning', 'tokens_percent_used > 0.8', 'warning',
   'Session {session_key} at {tokens_percent_used}% context usage', 300),
  ('Context Critical', 'tokens_percent_used > 0.95', 'critical',
   'Session {session_key} near context limit at {tokens_percent_used}%!', 60),
  ('Turn Failed', 'event_type = turn.failed', 'error',
   'Turn failed in session {session_key}: {error_message}', 60),
  ('Agent Timeout', 'duration_ms > 300000', 'critical',
   'Agent possibly hung in session {session_key} - {duration_ms}ms elapsed', 300)
ON CONFLICT DO NOTHING;
