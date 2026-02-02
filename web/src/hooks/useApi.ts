import { useState, useEffect, useCallback } from 'react';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>(url: string, deps: unknown[] = []) {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [url]);

  useEffect(() => {
    refetch();
  }, [refetch, ...deps]);

  return { ...state, refetch };
}

// Specific API hooks
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

export interface Session {
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

export interface SessionEvent {
  id: string;
  timestamp: string;
  eventType: string;
  gatewayId: string;
  sessionKey: string;
  parentSessionKey: string | null;
  agentId: string | null;
  channel: string | null;
  turnId: string | null;
  messageId: string | null;
  tokens: {
    input: number | null;
    output: number | null;
    total: number | null;
    contextUsed: number | null;
    contextMax: number | null;
    percentUsed: number | null;
  } | null;
  timing: {
    startMs: number | null;
    endMs: number | null;
    durationMs: number | null;
    ttftMs: number | null;
  } | null;
  tool: {
    name: string;
    error: string | null;
  } | null;
  error: {
    type: string;
    message: string | null;
    retriable: boolean | null;
  } | null;
  model: {
    provider: string;
    modelId: string;
  } | null;
  cost: {
    inputCost: number | null;
    outputCost: number | null;
    totalCost: number | null;
  } | null;
  payload: Record<string, unknown> | null;
}

export interface HourlyMetric {
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

export interface Gateway {
  id: string;
  name: string | null;
  firstSeen: string;
  lastSeen: string;
  eventCount: number;
}

export function useMetrics() {
  return useApi<MetricsSummary>('/api/v1/metrics/summary');
}

export function useHourlyMetrics(hours = 24) {
  return useApi<{ metrics: HourlyMetric[]; count: number }>(`/api/v1/metrics/hourly?hours=${hours}`);
}

export function useSessions(options?: { status?: string; gatewayId?: string }) {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.gatewayId) params.set('gatewayId', options.gatewayId);
  const query = params.toString() ? `?${params.toString()}` : '';
  return useApi<{ sessions: Session[]; count: number }>(`/api/v1/sessions${query}`, [options?.status, options?.gatewayId]);
}

export function useSession(sessionKey: string) {
  return useApi<Session>(`/api/v1/sessions/${encodeURIComponent(sessionKey)}`, [sessionKey]);
}

export function useSessionEvents(sessionKey: string) {
  return useApi<{ events: SessionEvent[]; count: number }>(`/api/v1/sessions/${encodeURIComponent(sessionKey)}/events`, [sessionKey]);
}

export function useAlerts(resolved?: boolean) {
  const params = resolved !== undefined ? `?resolved=${resolved}` : '';
  return useApi<{ alerts: Alert[]; count: number }>(`/api/v1/alerts${params}`, [resolved]);
}

export function useGateways() {
  return useApi<{ gateways: Gateway[]; count: number }>('/api/v1/gateways');
}
