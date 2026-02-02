import pg from 'pg';
import { config } from '../config.js';
import type { ObservatoryEvent, EventRow, SessionSummary, HourlyMetrics, AlertRule, Alert } from '../types/events.js';
import { v4 as uuidv4 } from 'uuid';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Test connection
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    // Read and execute schema
    const fs = await import('fs');
    const path = await import('path');
    const schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await client.query(schema);
    console.log('Database schema initialized');
  } finally {
    client.release();
  }
}

export async function insertEvents(events: ObservatoryEvent[]): Promise<void> {
  if (events.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const event of events) {
      const id = event.id || uuidv4();
      const timestamp = event.timestamp || new Date().toISOString();

      await client.query(`
        INSERT INTO events (
          id, timestamp, event_type, gateway_id, session_key, parent_session_key,
          agent_id, channel, turn_id, message_id,
          tokens_input, tokens_output, tokens_total, tokens_context_used,
          tokens_context_max, tokens_percent_used,
          timing_start_ms, timing_end_ms, duration_ms, ttft_ms,
          tool_name, tool_error,
          error_type, error_message, error_retriable,
          model_provider, model_id,
          cost_input, cost_output, cost_total,
          payload
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20,
          $21, $22,
          $23, $24, $25,
          $26, $27,
          $28, $29, $30,
          $31
        )
      `, [
        id,
        timestamp,
        event.eventType,
        event.gatewayId,
        event.sessionKey,
        event.parentSessionKey || null,
        event.agentId || null,
        event.channel || null,
        event.turnId || null,
        event.messageId || null,
        event.tokens?.input ?? null,
        event.tokens?.output ?? null,
        event.tokens?.total ?? null,
        event.tokens?.contextUsed ?? null,
        event.tokens?.contextMax ?? null,
        event.tokens?.percentUsed ?? null,
        event.timing?.startMs ?? null,
        event.timing?.endMs ?? null,
        event.timing?.durationMs ?? null,
        event.timing?.ttftMs ?? null,
        event.tool?.name ?? null,
        event.tool?.error ?? null,
        event.error?.type ?? null,
        event.error?.message ?? null,
        event.error?.retriable ?? null,
        event.model?.provider ?? null,
        event.model?.modelId ?? null,
        event.cost?.inputCost ?? null,
        event.cost?.outputCost ?? null,
        event.cost?.totalCost ?? null,
        event.payload ? JSON.stringify(event.payload) : null,
      ]);

      // Update gateway last_seen
      await client.query(`
        INSERT INTO gateways (id, last_seen, event_count)
        VALUES ($1, NOW(), 1)
        ON CONFLICT (id) DO UPDATE SET
          last_seen = NOW(),
          event_count = gateways.event_count + 1
      `, [event.gatewayId]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getSessions(options: {
  gatewayId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<SessionSummary[]> {
  const { gatewayId, status, limit = 50, offset = 0 } = options;

  let query = 'SELECT * FROM sessions WHERE 1=1';
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (gatewayId) {
    query += ` AND gateway_id = $${paramIndex++}`;
    params.push(gatewayId);
  }

  if (status === 'active') {
    query += ` AND NOT is_ended AND last_event_at > NOW() - INTERVAL '5 minutes'`;
  } else if (status === 'idle') {
    query += ` AND NOT is_ended AND last_event_at <= NOW() - INTERVAL '5 minutes'`;
  } else if (status === 'error') {
    query += ` AND error_count > 0`;
  } else if (status === 'ended') {
    query += ` AND is_ended`;
  }

  query += ` ORDER BY last_event_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(limit, offset);

  const result = await pool.query<SessionSummary>(query, params);
  return result.rows;
}

export async function getSession(sessionKey: string): Promise<SessionSummary | null> {
  const result = await pool.query<SessionSummary>(
    'SELECT * FROM sessions WHERE session_key = $1',
    [sessionKey]
  );
  return result.rows[0] || null;
}

export async function getSessionEvents(sessionKey: string, options: {
  limit?: number;
  offset?: number;
  eventType?: string;
}): Promise<EventRow[]> {
  const { limit = 100, offset = 0, eventType } = options;

  let query = 'SELECT * FROM events WHERE session_key = $1';
  const params: (string | number)[] = [sessionKey];
  let paramIndex = 2;

  if (eventType) {
    query += ` AND event_type = $${paramIndex++}`;
    params.push(eventType);
  }

  query += ` ORDER BY timestamp ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(limit, offset);

  const result = await pool.query<EventRow>(query, params);
  return result.rows;
}

export async function queryEvents(options: {
  eventType?: string;
  gatewayId?: string;
  sessionKey?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}): Promise<EventRow[]> {
  const { eventType, gatewayId, sessionKey, startTime, endTime, limit = 100, offset = 0 } = options;

  let query = 'SELECT * FROM events WHERE 1=1';
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (eventType) {
    query += ` AND event_type = $${paramIndex++}`;
    params.push(eventType);
  }

  if (gatewayId) {
    query += ` AND gateway_id = $${paramIndex++}`;
    params.push(gatewayId);
  }

  if (sessionKey) {
    query += ` AND session_key = $${paramIndex++}`;
    params.push(sessionKey);
  }

  if (startTime) {
    query += ` AND timestamp >= $${paramIndex++}`;
    params.push(startTime);
  }

  if (endTime) {
    query += ` AND timestamp <= $${paramIndex++}`;
    params.push(endTime);
  }

  query += ` ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(limit, offset);

  const result = await pool.query<EventRow>(query, params);
  return result.rows;
}

export async function getMetricsSummary(): Promise<{
  totalSessions: number;
  activeSessions: number;
  totalTurns: number;
  totalErrors: number;
  totalCost: number;
  avgContextPercent: number;
  avgDurationMs: number;
}> {
  const result = await pool.query(`
    SELECT
      COUNT(DISTINCT session_key) AS total_sessions,
      COUNT(DISTINCT session_key) FILTER (
        WHERE timestamp > NOW() - INTERVAL '5 minutes'
      ) AS active_sessions,
      COUNT(*) FILTER (WHERE event_type = 'turn.completed') AS total_turns,
      COUNT(*) FILTER (WHERE error_type IS NOT NULL) AS total_errors,
      COALESCE(SUM(cost_total), 0) AS total_cost,
      COALESCE(AVG(tokens_percent_used) FILTER (WHERE tokens_percent_used IS NOT NULL), 0) AS avg_context_percent,
      COALESCE(AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL), 0) AS avg_duration_ms
    FROM events
    WHERE timestamp > NOW() - INTERVAL '24 hours'
  `);

  const row = result.rows[0];
  return {
    totalSessions: parseInt(row.total_sessions) || 0,
    activeSessions: parseInt(row.active_sessions) || 0,
    totalTurns: parseInt(row.total_turns) || 0,
    totalErrors: parseInt(row.total_errors) || 0,
    totalCost: parseFloat(row.total_cost) || 0,
    avgContextPercent: parseFloat(row.avg_context_percent) || 0,
    avgDurationMs: parseFloat(row.avg_duration_ms) || 0,
  };
}

export async function getHourlyMetrics(hours: number = 24): Promise<HourlyMetrics[]> {
  // Try continuous aggregate first, fall back to direct query
  try {
    const result = await pool.query(`
      SELECT
        hour::text,
        gateway_id,
        turns,
        errors,
        total_cost,
        avg_context_pct,
        avg_duration_ms,
        unique_sessions,
        total_input_tokens,
        total_output_tokens
      FROM hourly_metrics
      WHERE hour > NOW() - INTERVAL '${hours} hours'
      ORDER BY hour DESC
    `);
    return result.rows.map(row => ({
      hour: row.hour,
      gatewayId: row.gateway_id,
      turns: parseInt(row.turns) || 0,
      errors: parseInt(row.errors) || 0,
      totalCost: parseFloat(row.total_cost) || 0,
      avgContextPct: parseFloat(row.avg_context_pct) || 0,
      avgDurationMs: parseFloat(row.avg_duration_ms) || 0,
      uniqueSessions: parseInt(row.unique_sessions) || 0,
      totalInputTokens: parseInt(row.total_input_tokens) || 0,
      totalOutputTokens: parseInt(row.total_output_tokens) || 0,
    }));
  } catch {
    // Fall back to direct query if continuous aggregate doesn't exist
    const result = await pool.query(`
      SELECT
        date_trunc('hour', timestamp)::text AS hour,
        gateway_id,
        COUNT(*) FILTER (WHERE event_type = 'turn.completed') AS turns,
        COUNT(*) FILTER (WHERE error_type IS NOT NULL) AS errors,
        COALESCE(SUM(cost_total), 0) AS total_cost,
        COALESCE(AVG(tokens_percent_used) FILTER (WHERE tokens_percent_used IS NOT NULL), 0) AS avg_context_pct,
        COALESCE(AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL), 0) AS avg_duration_ms,
        COUNT(DISTINCT session_key) AS unique_sessions,
        COALESCE(SUM(tokens_input), 0) AS total_input_tokens,
        COALESCE(SUM(tokens_output), 0) AS total_output_tokens
      FROM events
      WHERE timestamp > NOW() - INTERVAL '${hours} hours'
      GROUP BY date_trunc('hour', timestamp), gateway_id
      ORDER BY hour DESC
    `);
    return result.rows.map(row => ({
      hour: row.hour,
      gatewayId: row.gateway_id,
      turns: parseInt(row.turns) || 0,
      errors: parseInt(row.errors) || 0,
      totalCost: parseFloat(row.total_cost) || 0,
      avgContextPct: parseFloat(row.avg_context_pct) || 0,
      avgDurationMs: parseFloat(row.avg_duration_ms) || 0,
      uniqueSessions: parseInt(row.unique_sessions) || 0,
      totalInputTokens: parseInt(row.total_input_tokens) || 0,
      totalOutputTokens: parseInt(row.total_output_tokens) || 0,
    }));
  }
}

export async function getGateways(): Promise<Array<{
  id: string;
  name: string | null;
  firstSeen: string;
  lastSeen: string;
  eventCount: number;
}>> {
  const result = await pool.query(`
    SELECT id, name, first_seen, last_seen, event_count
    FROM gateways
    ORDER BY last_seen DESC
  `);
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    firstSeen: row.first_seen.toISOString(),
    lastSeen: row.last_seen.toISOString(),
    eventCount: parseInt(row.event_count) || 0,
  }));
}

export async function getAlertRules(): Promise<AlertRule[]> {
  const result = await pool.query(`
    SELECT id, name, condition, severity, message_template, enabled, cooldown_seconds
    FROM alert_rules
    ORDER BY name
  `);
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    condition: row.condition,
    severity: row.severity,
    messageTemplate: row.message_template,
    enabled: row.enabled,
    cooldownSeconds: row.cooldown_seconds,
  }));
}

export async function getAlerts(options: {
  resolved?: boolean;
  limit?: number;
}): Promise<Alert[]> {
  const { resolved, limit = 50 } = options;

  let query = 'SELECT * FROM alerts WHERE 1=1';
  const params: (boolean | number)[] = [];
  let paramIndex = 1;

  if (resolved === false) {
    query += ' AND resolved_at IS NULL';
  } else if (resolved === true) {
    query += ' AND resolved_at IS NOT NULL';
  }

  query += ` ORDER BY triggered_at DESC LIMIT $${paramIndex++}`;
  params.push(limit);

  const result = await pool.query(query, params);
  return result.rows.map(row => ({
    id: row.id,
    ruleId: row.rule_id,
    severity: row.severity,
    message: row.message,
    sessionKey: row.session_key,
    gatewayId: row.gateway_id,
    triggeredAt: row.triggered_at.toISOString(),
    acknowledgedAt: row.acknowledged_at?.toISOString() || null,
    resolvedAt: row.resolved_at?.toISOString() || null,
    metadata: row.metadata,
  }));
}

export async function createAlert(alert: Omit<Alert, 'id' | 'triggeredAt' | 'acknowledgedAt' | 'resolvedAt'>): Promise<Alert> {
  const result = await pool.query(`
    INSERT INTO alerts (rule_id, severity, message, session_key, gateway_id, metadata)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [
    alert.ruleId,
    alert.severity,
    alert.message,
    alert.sessionKey,
    alert.gatewayId,
    alert.metadata ? JSON.stringify(alert.metadata) : null,
  ]);

  const row = result.rows[0];
  return {
    id: row.id,
    ruleId: row.rule_id,
    severity: row.severity,
    message: row.message,
    sessionKey: row.session_key,
    gatewayId: row.gateway_id,
    triggeredAt: row.triggered_at.toISOString(),
    acknowledgedAt: row.acknowledged_at?.toISOString() || null,
    resolvedAt: row.resolved_at?.toISOString() || null,
    metadata: row.metadata,
  };
}

export async function healthCheck(): Promise<{ database: boolean; error?: string }> {
  try {
    await pool.query('SELECT 1');
    return { database: true };
  } catch (err) {
    return { database: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
