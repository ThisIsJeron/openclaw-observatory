import { z } from 'zod';

// Token metrics schema
export const TokensSchema = z.object({
  input: z.number().int().nonnegative().optional(),
  output: z.number().int().nonnegative().optional(),
  total: z.number().int().nonnegative().optional(),
  contextUsed: z.number().int().nonnegative().optional(),
  contextMax: z.number().int().nonnegative().optional(),
  percentUsed: z.number().min(0).max(1).optional(),
});

// Timing schema
export const TimingSchema = z.object({
  startMs: z.number().optional(),
  endMs: z.number().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  ttftMs: z.number().int().nonnegative().optional(),
});

// Tool schema
export const ToolSchema = z.object({
  name: z.string(),
  parameters: z.record(z.unknown()).optional(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});

// Error schema
export const ErrorSchema = z.object({
  type: z.string(),
  message: z.string(),
  stack: z.string().optional(),
  retriable: z.boolean().optional(),
});

// Model schema
export const ModelSchema = z.object({
  provider: z.string(),
  modelId: z.string(),
  thinking: z.string().optional(),
});

// Cost schema
export const CostSchema = z.object({
  inputCost: z.number().nonnegative().optional(),
  outputCost: z.number().nonnegative().optional(),
  totalCost: z.number().nonnegative().optional(),
});

// Payload schema
export const PayloadSchema = z.object({
  userMessage: z.string().optional(),
  assistantMessage: z.string().optional(),
});

// Event types
export const EventTypes = [
  'session.created',
  'session.ended',
  'turn.started',
  'turn.completed',
  'turn.failed',
  'tool.invoked',
  'tool.completed',
  'tool.failed',
  'subagent.spawned',
  'subagent.completed',
  'subagent.failed',
  'context.warning',
  'context.overflow',
  'cron.triggered',
  'heartbeat.poll',
] as const;

export type EventType = typeof EventTypes[number];

// Main event schema
export const ObservatoryEventSchema = z.object({
  // Identity
  id: z.string().uuid().optional(),
  timestamp: z.string().datetime().optional(),
  eventType: z.string(),
  gatewayId: z.string(),

  // Session context
  sessionKey: z.string(),
  parentSessionKey: z.string().optional(),
  agentId: z.string().optional(),
  channel: z.string().optional(),

  // Turn context
  turnId: z.string().optional(),
  messageId: z.string().optional(),

  // Metrics
  tokens: TokensSchema.optional(),
  timing: TimingSchema.optional(),
  tool: ToolSchema.optional(),
  error: ErrorSchema.optional(),
  model: ModelSchema.optional(),
  cost: CostSchema.optional(),
  payload: PayloadSchema.optional(),
});

export type ObservatoryEvent = z.infer<typeof ObservatoryEventSchema>;

// Ingest request schema
export const IngestRequestSchema = z.object({
  events: z.array(ObservatoryEventSchema).min(1).max(1000),
});

export type IngestRequest = z.infer<typeof IngestRequestSchema>;

// Database event row type
export interface EventRow {
  id: string;
  timestamp: Date;
  event_type: string;
  gateway_id: string;
  session_key: string;
  parent_session_key: string | null;
  agent_id: string | null;
  channel: string | null;
  turn_id: string | null;
  message_id: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  tokens_total: number | null;
  tokens_context_used: number | null;
  tokens_context_max: number | null;
  tokens_percent_used: number | null;
  timing_start_ms: number | null;
  timing_end_ms: number | null;
  duration_ms: number | null;
  ttft_ms: number | null;
  tool_name: string | null;
  tool_error: string | null;
  error_type: string | null;
  error_message: string | null;
  error_retriable: boolean | null;
  model_provider: string | null;
  model_id: string | null;
  cost_input: number | null;
  cost_output: number | null;
  cost_total: number | null;
  payload: Record<string, unknown> | null;
}

// Session summary type (from sessions view)
export interface SessionSummary {
  session_key: string;
  gateway_id: string;
  parent_session_key: string | null;
  agent_id: string | null;
  channel: string | null;
  started_at: Date;
  last_event_at: Date;
  event_count: number;
  turn_count: number;
  error_count: number;
  total_cost: number;
  max_context_used: number | null;
  context_max: number | null;
  max_context_percent: number | null;
  is_ended: boolean;
}

// API response types
export interface SessionResponse {
  sessionKey: string;
  gatewayId: string;
  parentSessionKey: string | null;
  agentId: string | null;
  channel: string | null;
  startedAt: string;
  lastEventAt: string;
  eventCount: number;
  turnCount: number;
  errorCount: number;
  totalCost: number;
  maxContextUsed: number | null;
  contextMax: number | null;
  maxContextPercent: number | null;
  isEnded: boolean;
  status: 'active' | 'idle' | 'error' | 'ended';
}

export interface MetricsSummary {
  totalSessions: number;
  activeSessions: number;
  totalTurns: number;
  totalErrors: number;
  totalCost: number;
  avgContextPercent: number;
  avgDurationMs: number;
  turnsPerHour: number;
  errorsPerHour: number;
  costPerHour: number;
}

export interface HourlyMetrics {
  hour: string;
  gatewayId: string;
  turns: number;
  errors: number;
  totalCost: number;
  avgContextPct: number;
  avgDurationMs: number;
  uniqueSessions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

// Alert types
export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  messageTemplate: string;
  enabled: boolean;
  cooldownSeconds: number;
}

export interface Alert {
  id: string;
  ruleId: string | null;
  severity: string;
  message: string;
  sessionKey: string | null;
  gatewayId: string | null;
  triggeredAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  metadata: Record<string, unknown> | null;
}
