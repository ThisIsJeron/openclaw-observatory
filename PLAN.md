# OpenClaw Observatory - Design Plan

**Goal:** Self-hosted observability platform for Clawdbot/OpenClaw agents — monitor context windows, failures, costs, and agent state across one or many gateway instances.

---

## Design Principles

1. **Docker-first** — Single `docker-compose up` deploys everything
2. **Self-hosted** — Runs in your LXC, VPS, or Mac mini — your data stays yours
3. **Multi-gateway** — Monitor multiple OpenClaw instances from one Observatory
4. **Decoupled** — Observatory is a separate service, not bundled with Clawdbot
5. **Batteries included** — Works out of the box, optional Grafana for power users

---

## Problem Statement

Right now, agents are black boxes:
- **No visibility** into prompts, context, and tool calls being passed to agents/subagents
- **Silent failures** — agents die without warning or useful diagnostics
- **Context window blindness** — no way to know when approaching limits until it's too late
- **Hung agents** — subagents get stuck with no indication to parent sessions
- **Cost opacity** — no aggregate view of API spend across sessions

---

## Architecture

### Deployment Model

```
┌──────────────────────────────────────────────────────────────────┐
│  LXC / VM / Mac mini: Observatory                                │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  docker-compose                                             │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │ │
│  │  │ observatory  │ │ timescaledb  │ │ grafana (optional)   │ │ │
│  │  │ :3200        │ │ :5432        │ │ :3000                │ │ │
│  │  │ - collector  │ │ - events     │ │ - dashboards         │ │ │
│  │  │ - web UI     │ │ - metrics    │ │ - alerting           │ │ │
│  │  │ - alerts     │ │ - retention  │ │                      │ │ │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │ HTTP POST /ingest  │                    │
         │                    │                    │
┌────────┴───────┐   ┌───────┴────────┐   ┌──────┴───────┐
│ LXC: OpenClaw  │   │ LXC: OpenClaw  │   │ Mac: OpenClaw│
│ (gateway #1)   │   │ (gateway #2)   │   │ (gateway #3) │
└────────────────┘   └────────────────┘   └──────────────┘
```

### Event Flow

1. **Gateway instrumentation** — Clawdbot emits events via HTTP POST to Observatory
2. **Collector service** — Receives, validates, enriches events
3. **TimescaleDB** — Time-series optimized storage with automatic retention
4. **Web UI** — Built-in dashboard for real-time monitoring and debugging
5. **Grafana** — Optional, for advanced dashboards and alerting

---

## Docker Compose Stack

```yaml
version: "3.8"

services:
  observatory:
    image: ghcr.io/thisisjeron/openclaw-observatory:latest
    build: .
    ports:
      - "3200:3200"
    environment:
      - DATABASE_URL=postgres://observatory:observatory@timescaledb:5432/observatory
      - ALERT_WEBHOOK_URL=${ALERT_WEBHOOK_URL:-}
      - AUTH_TOKEN=${OBSERVATORY_TOKEN:-}
    depends_on:
      - timescaledb
    restart: unless-stopped

  timescaledb:
    image: timescale/timescaledb:latest-pg16
    environment:
      - POSTGRES_USER=observatory
      - POSTGRES_PASSWORD=observatory
      - POSTGRES_DB=observatory
    volumes:
      - timescaledb_data:/var/lib/postgresql/data
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-admin}
      - GF_INSTALL_PLUGINS=grafana-clock-panel
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    depends_on:
      - timescaledb
    restart: unless-stopped
    profiles:
      - full  # Only starts with --profile full

volumes:
  timescaledb_data:
  grafana_data:
```

### Quick Start

```bash
# Minimal (Observatory + TimescaleDB)
docker-compose up -d

# Full stack (+ Grafana)
docker-compose --profile full up -d
```

---

## Observatory Service

### Tech Stack

- **Runtime:** Node.js 20+ (TypeScript)
- **Framework:** Fastify (fast, low overhead)
- **Database:** TimescaleDB (Postgres + time-series extensions)
- **Web UI:** React + Tailwind (embedded, served by Fastify)
- **WebSocket:** Real-time event streaming to dashboard

### API Endpoints

#### Event Ingestion
```
POST /api/v1/ingest
Authorization: Bearer <token>
Content-Type: application/json

{
  "events": [ObservatoryEvent, ...]
}
```

#### Query API
```
GET  /api/v1/sessions                    # List sessions
GET  /api/v1/sessions/:key               # Session details
GET  /api/v1/sessions/:key/events        # Session events
GET  /api/v1/events?type=turn.completed  # Query events
GET  /api/v1/metrics/summary             # Aggregate metrics
GET  /api/v1/health                      # Health check
```

#### WebSocket
```
WS /api/v1/stream
# Real-time event feed for dashboard
```

---

## Event Schema

```typescript
interface ObservatoryEvent {
  // Identity
  id: string;                    // UUID
  timestamp: string;             // ISO8601
  eventType: string;             // e.g., "turn.completed"
  gatewayId: string;             // Which gateway sent this
  
  // Session context
  sessionKey: string;
  parentSessionKey?: string;     // If subagent
  agentId?: string;
  channel?: string;              // telegram, discord, webchat, etc.
  
  // Turn context
  turnId?: string;
  messageId?: string;
  
  // Token metrics
  tokens?: {
    input: number;
    output: number;
    total: number;
    contextUsed: number;
    contextMax: number;
    percentUsed: number;
  };
  
  // Timing
  timing?: {
    startMs: number;
    endMs: number;
    durationMs: number;
    ttftMs?: number;             // Time to first token
  };
  
  // Tool calls
  tool?: {
    name: string;
    parameters?: Record<string, unknown>;
    result?: unknown;
    error?: string;
  };
  
  // Error details
  error?: {
    type: string;               // timeout, context_overflow, api_error, tool_error
    message: string;
    stack?: string;
    retriable: boolean;
  };
  
  // Model info
  model?: {
    provider: string;
    modelId: string;
    thinking?: string;
  };
  
  // Cost tracking
  cost?: {
    inputCost: number;          // USD
    outputCost: number;
    totalCost: number;
  };
  
  // Payloads (opt-in)
  payload?: {
    userMessage?: string;
    assistantMessage?: string;
  };
}
```

### Event Types

| Event | Description |
|-------|-------------|
| `session.created` | New session spawned |
| `session.ended` | Session closed |
| `turn.started` | User/system message received |
| `turn.completed` | Agent response generated |
| `turn.failed` | Error during turn |
| `tool.invoked` | Tool call initiated |
| `tool.completed` | Tool returned result |
| `tool.failed` | Tool error/timeout |
| `subagent.spawned` | Child session created |
| `subagent.completed` | Child finished |
| `subagent.failed` | Child error/timeout |
| `context.warning` | 80%+ context used |
| `context.overflow` | Context limit hit |
| `cron.triggered` | Cron job fired |
| `heartbeat.poll` | Heartbeat check |

---

## Database Schema (TimescaleDB)

```sql
-- Main events table (hypertable for time-series)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL,
  event_type TEXT NOT NULL,
  gateway_id TEXT NOT NULL,
  session_key TEXT NOT NULL,
  parent_session_key TEXT,
  agent_id TEXT,
  channel TEXT,
  turn_id TEXT,
  
  -- Token metrics
  tokens_input INTEGER,
  tokens_output INTEGER,
  tokens_context_used INTEGER,
  tokens_context_max INTEGER,
  tokens_percent_used REAL,
  
  -- Timing
  duration_ms INTEGER,
  ttft_ms INTEGER,
  
  -- Tool
  tool_name TEXT,
  tool_error TEXT,
  
  -- Error
  error_type TEXT,
  error_message TEXT,
  
  -- Model
  model_provider TEXT,
  model_id TEXT,
  
  -- Cost
  cost_total REAL,
  
  -- Payloads (JSONB for flexibility)
  payload JSONB
);

-- Convert to hypertable
SELECT create_hypertable('events', 'timestamp');

-- Retention policy (default 30 days)
SELECT add_retention_policy('events', INTERVAL '30 days');

-- Indexes
CREATE INDEX idx_events_session ON events (session_key, timestamp DESC);
CREATE INDEX idx_events_type ON events (event_type, timestamp DESC);
CREATE INDEX idx_events_gateway ON events (gateway_id, timestamp DESC);
CREATE INDEX idx_events_error ON events (error_type) WHERE error_type IS NOT NULL;

-- Continuous aggregates for fast dashboards
CREATE MATERIALIZED VIEW hourly_metrics
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', timestamp) AS hour,
  gateway_id,
  COUNT(*) FILTER (WHERE event_type = 'turn.completed') AS turns,
  COUNT(*) FILTER (WHERE error_type IS NOT NULL) AS errors,
  SUM(cost_total) AS total_cost,
  AVG(tokens_percent_used) AS avg_context_pct,
  AVG(duration_ms) AS avg_duration_ms,
  COUNT(DISTINCT session_key) AS unique_sessions
FROM events
GROUP BY hour, gateway_id;
```

---

## Web UI Features

### Dashboard Views

1. **Overview**
   - Active sessions count (per gateway)
   - Turns/hour, errors/hour, cost/hour
   - Context usage heatmap
   - Recent alerts

2. **Sessions List**
   - Searchable/filterable table
   - Status indicators (active, idle, error, ended)
   - Token usage bar
   - Quick actions (view, debug)

3. **Session Drilldown**
   - Full conversation timeline
   - Token usage per turn (stacked bar)
   - Tool calls with timing
   - Error details
   - Subagent tree view
   - Cost breakdown

4. **Alerts**
   - Active alerts
   - Alert history
   - Rule configuration

5. **Settings**
   - Gateway management
   - Retention settings
   - Alert rules
   - API tokens

---

## Alerting

### Built-in Alert Rules

```yaml
alerts:
  context_warning:
    condition: tokens_percent_used > 0.8
    severity: warning
    message: "Session {session_key} at {percent}% context"
    
  context_critical:
    condition: tokens_percent_used > 0.95
    severity: critical
    message: "Session {session_key} near context limit!"
    
  hung_agent:
    condition: turn_duration > 300s AND NOT completed
    severity: critical
    message: "Agent hung in session {session_key}"
    
  error_spike:
    condition: error_rate > 0.1 over 5m
    severity: warning
    message: "Error rate spike on {gateway_id}"
    
  cost_spike:
    condition: hourly_cost > 2x rolling_avg
    severity: warning
    message: "Cost spike: ${cost} in last hour"
```

### Alert Delivery

- **Webhook** — POST to any URL (Slack, Discord, PagerDuty, etc.)
- **Clawdbot** — Send to a Clawdbot channel (uses message tool)
- **Email** — SMTP integration (optional)

---

## Clawdbot Gateway Integration

### Configuration

```yaml
# In Clawdbot's config.yml
observatory:
  enabled: true
  endpoint: "http://observatory.local:3200/api/v1/ingest"
  token: "your-auth-token"
  gatewayId: "clawdbot-main"       # Identifies this gateway
  batchSize: 10                     # Events per batch
  flushIntervalMs: 5000             # Max time between flushes
  capturePayloads: false            # Include message content (privacy)
  captureToolParams: true           # Include tool parameters
```

### Instrumentation (Clawdbot side)

```typescript
// observatory-client.ts
class ObservatoryClient {
  private queue: ObservatoryEvent[] = [];
  
  emit(event: Partial<ObservatoryEvent>) {
    this.queue.push({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      gatewayId: this.config.gatewayId,
      ...event
    });
    
    if (this.queue.length >= this.config.batchSize) {
      this.flush();
    }
  }
  
  async flush() {
    if (this.queue.length === 0) return;
    const events = this.queue.splice(0);
    await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ events })
    });
  }
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
**Goal:** Docker stack + event ingestion + basic UI

- [ ] Project scaffolding (TypeScript, Fastify, React)
- [ ] Docker Compose setup (Observatory + TimescaleDB)
- [ ] Database schema + migrations
- [ ] Ingest API endpoint
- [ ] Health check endpoint
- [ ] Basic web UI shell

**Deliverables:**
- `docker-compose up` works
- Can POST events and see them in DB
- Health endpoint returns status

### Phase 2: Dashboard (Week 2)
**Goal:** Useful monitoring UI

- [ ] Sessions list view
- [ ] Session drilldown view
- [ ] Real-time WebSocket feed
- [ ] Token usage visualization
- [ ] Error highlighting

**Deliverables:**
- Can browse sessions and see conversation history
- Real-time updates when events arrive

### Phase 3: Clawdbot Integration (Week 3)
**Goal:** Events flowing from real gateways

- [ ] Observatory client library for Clawdbot
- [ ] Instrument key Clawdbot events
- [ ] Gateway registration/discovery
- [ ] Multi-gateway support in UI

**Deliverables:**
- Configure Clawdbot to send events
- See real session data in Observatory

### Phase 4: Alerting (Week 4)
**Goal:** Proactive notifications

- [ ] Alert rule engine
- [ ] Webhook delivery
- [ ] Clawdbot channel delivery
- [ ] Alert UI (configure, view, silence)

**Deliverables:**
- Alerts fire when thresholds crossed
- Notifications delivered to configured destinations

### Phase 5: Polish & Grafana (Week 5+)
**Goal:** Production-ready

- [ ] Grafana provisioned dashboards
- [ ] Performance optimization
- [ ] Documentation
- [ ] Helm chart (for Kubernetes users)
- [ ] One-line install script

---

## File Structure

```
openclaw-observatory/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Configuration
│   ├── db/
│   │   ├── schema.sql
│   │   ├── migrations/
│   │   └── client.ts
│   ├── api/
│   │   ├── ingest.ts
│   │   ├── sessions.ts
│   │   ├── events.ts
│   │   ├── metrics.ts
│   │   └── websocket.ts
│   ├── alerts/
│   │   ├── engine.ts
│   │   ├── rules.ts
│   │   └── delivery.ts
│   └── types/
│       └── events.ts
├── web/                      # React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   ├── components/
│   │   └── hooks/
│   └── package.json
├── grafana/
│   └── provisioning/
│       ├── dashboards/
│       └── datasources/
└── scripts/
    └── install.sh            # One-line installer
```

---

## Configuration

### Environment Variables

```bash
# .env
DATABASE_URL=postgres://observatory:observatory@timescaledb:5432/observatory
OBSERVATORY_TOKEN=your-secret-token    # For API auth
ALERT_WEBHOOK_URL=https://hooks.slack.com/...
GRAFANA_PASSWORD=admin
RETENTION_DAYS=30
LOG_LEVEL=info
```

---

## Success Criteria

**After Phase 2:**
- [ ] `docker-compose up` deploys working Observatory
- [ ] Can browse sessions and see full conversation history
- [ ] Real-time event streaming works
- [ ] Token usage clearly visualized

**After Phase 4:**
- [ ] Multiple gateways sending events to single Observatory
- [ ] Alerts fire when agents hit context limits
- [ ] Debug "why did this fail?" in <30 seconds
- [ ] Cost tracking across all sessions

**After Phase 5:**
- [ ] One-command install for LXC/Docker
- [ ] Grafana dashboards pre-configured
- [ ] Documentation complete
- [ ] Ready for others to self-host

---

## Open Questions

1. **Auth model:** Single token per Observatory, or per-gateway tokens?
2. **Payload storage:** Store message content by default? (Privacy vs debugging)
3. **Multi-tenant:** Support multiple users/orgs in one Observatory instance?
4. **Clawdbot PR:** Should Observatory client be merged into Clawdbot core?

---

## Next Steps

1. ✅ Plan revised for Docker-first, self-hosted deployment
2. 🚧 Start Phase 1: Scaffold project, Docker setup, ingest API
3. Create Clawdbot integration spec for Phase 3
