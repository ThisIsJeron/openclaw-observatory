# OpenClaw Observatory - Design Plan

**Goal:** Full observability for Clawdbot/OpenClaw agents — know what's happening, catch failures before users do.

---

## Problem Statement

Right now, agents are black boxes:
- **No visibility** into prompts, context, and tool calls being passed to agents/subagents
- **Silent failures** — agents die without warning or useful diagnostics
- **Context window blindness** — no way to know when approaching limits until it's too late
- **Hung agents** — subagents get stuck with no indication to parent sessions

---

## Architecture

### Event Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Clawdbot GW    │────▶│  Observatory     │────▶│  Storage        │
│  (instrumented) │     │  Collector       │     │  (SQLite/PG)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │  Alert Engine    │
                        │  + Dashboard     │
                        └──────────────────┘
```

### Instrumentation Points in Clawdbot

1. **Session lifecycle** (`gateway/sessions.ts`)
   - `session.created` — new session spawned
   - `session.resumed` — existing session resumed
   - `session.ended` — session closed (reason: user/timeout/error/context_overflow)

2. **Agent turns** (`gateway/agent.ts`)
   - `turn.started` — user/system message received
   - `turn.completed` — agent response generated
   - `turn.failed` — error during turn

3. **Tool calls** (`gateway/tools.ts`)
   - `tool.invoked` — tool call initiated
   - `tool.completed` — tool returned result
   - `tool.failed` — tool error/timeout

4. **Subagent spawns** (`tools/sessions_spawn.ts`)
   - `subagent.spawned` — child session created
   - `subagent.completed` — child finished
   - `subagent.failed` — child error/timeout

5. **Context window** (`gateway/context.ts`)
   - `context.measured` — after each turn, log token counts
   - `context.warning` — threshold exceeded (80%, 95%)
   - `context.overflow` — hit limit, context truncated/failed

6. **Cron/Heartbeat** (`gateway/cron.ts`)
   - `cron.triggered` — job fired
   - `cron.completed` — job finished
   - `heartbeat.poll` — heartbeat check
   - `heartbeat.response` — agent replied (or timed out)

---

## Event Schema

```typescript
interface ObservatoryEvent {
  // Identity
  id: string;              // UUID
  timestamp: string;       // ISO8601
  eventType: string;       // e.g., "turn.completed"
  
  // Session context
  sessionKey: string;      // Primary session identifier
  parentSessionKey?: string; // If subagent
  agentId?: string;        // Agent config used
  channel?: string;        // telegram, discord, webchat, etc.
  
  // Turn context (when applicable)
  turnId?: string;
  messageId?: string;
  
  // Token metrics
  tokens?: {
    input: number;
    output: number;
    total: number;
    contextUsed: number;   // Current context window usage
    contextMax: number;    // Model's max context
    percentUsed: number;   // contextUsed / contextMax
  };
  
  // Timing
  timing?: {
    startMs: number;
    endMs: number;
    durationMs: number;
    timeToFirstTokenMs?: number;
  };
  
  // Tool calls (when applicable)
  tool?: {
    name: string;
    parameters: Record<string, unknown>;
    result?: unknown;
    error?: string;
  };
  
  // Error details (when applicable)
  error?: {
    type: string;         // timeout, context_overflow, api_error, tool_error
    message: string;
    stack?: string;
    retriable: boolean;
  };
  
  // Model info
  model?: {
    provider: string;     // anthropic, openai, etc.
    modelId: string;      // claude-opus-4-5, gpt-5.2, etc.
    thinking?: string;    // off, low, high
  };
  
  // Cost tracking
  cost?: {
    inputCost: number;    // USD
    outputCost: number;
    totalCost: number;
  };
  
  // Raw payloads (opt-in, can be huge)
  payload?: {
    userMessage?: string;
    assistantMessage?: string;
    systemPrompt?: string;
    fullContext?: unknown; // Entire messages array
  };
}
```

---

## Key Metrics to Track

### Per-Turn Metrics
| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `tokens.percentUsed` | Context window % | 80% warn, 95% crit |
| `timing.durationMs` | Total turn time | >60s warn, >180s crit |
| `timing.timeToFirstTokenMs` | TTFT | >10s warn |
| `tool.durationMs` | Per-tool latency | >30s warn |

### Session Metrics
| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `turns_count` | Turns in session | >50 warn (context risk) |
| `error_rate` | Errors / total turns | >10% warn |
| `subagent_depth` | Nested subagent level | >3 warn |

### System Metrics
| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `active_sessions` | Concurrent sessions | Capacity planning |
| `hourly_cost` | API spend | Budget alerts |
| `hung_sessions` | No response >5min | Any = crit |

---

## Alerting Rules

### Critical (immediate notification)
- **Context overflow** — session hit token limit
- **Hung agent** — no response for >5 minutes during active turn
- **Repeated failures** — >3 consecutive errors in session
- **Subagent cascade** — subagent spawns >5 levels deep

### Warning (digest or dashboard)
- **Context warning** — >80% context used
- **Slow turns** — >60s response time
- **Tool failures** — any tool error
- **Cost spike** — hourly spend >2x rolling average

### Informational (logged only)
- Session start/end
- Subagent spawn/complete
- Heartbeat activity

---

## Storage Options

### Phase 1: SQLite (local dev)
```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  event_type TEXT NOT NULL,
  session_key TEXT NOT NULL,
  parent_session_key TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  tokens_percent_used REAL,
  duration_ms INTEGER,
  error_type TEXT,
  error_message TEXT,
  tool_name TEXT,
  model_id TEXT,
  cost_total REAL,
  payload JSON
);

CREATE INDEX idx_events_session ON events(session_key);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(timestamp);
```

### Phase 2+: TimescaleDB or ClickHouse
- TimescaleDB: Easy Postgres upgrade path, good for time-series
- ClickHouse: Better for high-volume, complex aggregations

---

## Dashboard Views

### 1. Real-Time Activity
- Active sessions list with status indicators
- Live event stream (filterable)
- Token usage gauges per session
- Error rate sparklines

### 2. Session Drilldown
- Full conversation history with token counts per turn
- Tool call timeline with success/failure
- Context window usage over time (line chart)
- Cost breakdown
- Parent/child session relationships (tree view)

### 3. Historical Analytics
- Daily/weekly turn counts, error rates, costs
- Model usage distribution
- Most expensive sessions
- Most common error types
- Average context utilization by agent

### 4. Debugging View
- "Why did this fail?" — single-session forensics
- Full payload viewer (messages, tools, context)
- Timeline with all events
- Compare to successful similar sessions

---

## Implementation Phases

### Phase 1: Event Logging (Week 1-2)
**Goal:** Get events flowing to SQLite

- [ ] Define TypeScript interfaces for events
- [ ] Add instrumentation hooks in Clawdbot gateway
- [ ] SQLite storage backend
- [ ] Basic CLI for querying events: `clawdbot observatory list --session X`
- [ ] Environment toggle: `OBSERVATORY_ENABLED=true`

**Deliverables:**
- Events written to `~/.clawdbot/observatory.db`
- Can query recent events from CLI

### Phase 2: Web Dashboard (Week 3-4)
**Goal:** Visual exploration of events

- [ ] Simple web UI (React + Tailwind or similar)
- [ ] Real-time WebSocket feed for live events
- [ ] Session list with search/filter
- [ ] Session drilldown view
- [ ] Token usage visualization

**Deliverables:**
- `clawdbot observatory serve` starts local dashboard
- Can drill into any session and see full history

### Phase 3: Alerting (Week 5-6)
**Goal:** Proactive notifications

- [ ] Alert rule engine (config-driven)
- [ ] Integration with Clawdbot's notification system
- [ ] Telegram/Discord/webhook alert delivery
- [ ] Alert suppression and rate limiting

**Deliverables:**
- Alerts fire when thresholds crossed
- Configurable via `~/.clawdbot/config.yml`

### Phase 4: Advanced Analytics (Week 7+)
**Goal:** Insights and optimization

- [ ] Cost attribution by session/user/agent
- [ ] Anomaly detection (unusual patterns)
- [ ] Session replay (recreate conversation)
- [ ] Performance recommendations
- [ ] Export to external observability (Datadog, Grafana)

---

## Open Questions

1. **Payload storage:** Full messages can be huge. Store by default or opt-in?
2. **Retention:** How long to keep events? 7 days? 30 days? Configurable?
3. **Multi-instance:** If running multiple Clawdbot gateways, central collector?
4. **Privacy:** Some sessions have sensitive data. Redaction options?
5. **Performance:** Will instrumentation add latency? (Probably negligible, but measure)

---

## Clawdbot Integration Points

### Gateway Hooks Needed
```typescript
// In gateway/agent.ts
observatory.emit('turn.started', { sessionKey, turnId, tokens: countTokens(messages) });
// ... after completion
observatory.emit('turn.completed', { sessionKey, turnId, tokens, timing, cost });

// In gateway/tools.ts
observatory.emit('tool.invoked', { sessionKey, tool: name, params });
observatory.emit('tool.completed', { sessionKey, tool: name, result, timing });

// In tools/sessions_spawn.ts
observatory.emit('subagent.spawned', { parentSessionKey, childSessionKey, task });
```

### Config Schema Addition
```yaml
observatory:
  enabled: true
  storage: sqlite  # or postgres, clickhouse
  dbPath: ~/.clawdbot/observatory.db
  retention: 30d
  capturePayloads: false  # Privacy-conscious default
  alerts:
    contextWarning: 0.8
    contextCritical: 0.95
    hungTimeoutSec: 300
```

---

## Success Criteria

After Phase 2, you should be able to:
1. See all active sessions and their status
2. Drill into any session and see every message, tool call, and token count
3. Know immediately when an agent hits context limits
4. Debug "why did my agent fail?" in <30 seconds

After Phase 4:
1. Get alerts before users notice problems
2. Track costs per session/agent
3. Identify optimization opportunities (e.g., "this agent uses 2x tokens than average")
4. Replay and compare sessions for debugging

---

## Next Steps

1. Review this plan — anything missing for your use cases?
2. Decide on storage backend (SQLite fine for start)
3. Start with Phase 1: instrument Clawdbot gateway
4. I can help write the instrumentation code once we agree on the plan
