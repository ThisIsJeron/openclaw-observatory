# OpenClaw Observatory

Self-hosted observability platform for Clawdbot/OpenClaw agents. Monitor context windows, failures, costs, and agent state across one or many gateway instances.

## Features

- **Real-time Dashboard** - Monitor active sessions, turns, errors, and costs
- **Session Drilldown** - Full conversation timeline with token usage per turn
- **Context Tracking** - Visual alerts when approaching context limits
- **Multi-gateway** - Monitor multiple OpenClaw instances from one Observatory
- **Alerting** - Webhook notifications for context warnings, failures, and hung agents
- **Cost Tracking** - Aggregate API spend across all sessions
- **Grafana Ready** - Optional advanced dashboards and alerting

## Quick Start

```bash
# Clone the repository
git clone https://github.com/thisisjeron/openclaw-observatory.git
cd openclaw-observatory

# Start Observatory + TimescaleDB
docker-compose up -d

# With Grafana (optional)
docker-compose --profile full up -d
```

**Dashboard:** http://localhost:3200
**Grafana:** http://localhost:3000 (with `--profile full`)

## One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/thisisjeron/openclaw-observatory/main/scripts/install.sh | bash
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Generate a secure token
OBSERVATORY_TOKEN=$(openssl rand -hex 32)

# Alert webhook (Slack, Discord, etc.)
ALERT_WEBHOOK_URL=https://hooks.slack.com/...

# Grafana password
GRAFANA_PASSWORD=admin

# Data retention
RETENTION_DAYS=30
```

## Gateway Integration

Configure your Clawdbot to send events to Observatory:

```yaml
# In Clawdbot's config.yml
observatory:
  enabled: true
  endpoint: "http://observatory:3200/api/v1/ingest"
  token: "your-auth-token"
  gatewayId: "clawdbot-main"
  batchSize: 10
  flushIntervalMs: 5000
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/ingest` | Event ingestion (batch) |
| `GET /api/v1/sessions` | List sessions |
| `GET /api/v1/sessions/:key` | Session details |
| `GET /api/v1/sessions/:key/events` | Session events |
| `GET /api/v1/events` | Query events |
| `GET /api/v1/metrics/summary` | Aggregate metrics |
| `GET /api/v1/gateways` | Connected gateways |
| `GET /api/v1/alerts` | Alert history |
| `GET /api/v1/health` | Health check |
| `WS /api/v1/stream` | Real-time event stream |

## Event Types

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

## Built-in Alerts

- **Context Warning** - Session at 80%+ context usage
- **Context Critical** - Session at 95%+ context usage
- **Turn Failed** - Error during turn processing
- **Agent Timeout** - Agent taking >5 minutes (possibly hung)

## Development

```bash
# Install dependencies
npm install
cd web && npm install && cd ..

# Start development server
npm run dev

# Build for production
npm run build
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Observatory Stack                                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐      │
│  │ observatory  │ │ timescaledb  │ │ grafana (optional)   │      │
│  │ :3200        │ │ :5432        │ │ :3000                │      │
│  │ - collector  │ │ - events     │ │ - dashboards         │      │
│  │ - web UI     │ │ - metrics    │ │ - alerting           │      │
│  │ - alerts     │ │ - retention  │ │                      │      │
│  └──────────────┘ └──────────────┘ └──────────────────────┘      │
└──────────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │ HTTP POST /ingest  │                    │
         │                    │                    │
┌────────┴───────┐   ┌───────┴────────┐   ┌──────┴───────┐
│ OpenClaw       │   │ OpenClaw       │   │ OpenClaw     │
│ (gateway #1)   │   │ (gateway #2)   │   │ (gateway #3) │
└────────────────┘   └────────────────┘   └──────────────┘
```

## Tech Stack

- **Backend:** Node.js, Fastify, TypeScript
- **Database:** TimescaleDB (PostgreSQL + time-series)
- **Frontend:** React, Tailwind CSS, Recharts
- **Containerization:** Docker, Docker Compose

## License

MIT
