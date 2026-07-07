# Architecture

Sentira is a pnpm monorepo with 4 packages, orchestrated via Docker Compose for local and Raspberry Pi deployment.

## System Overview

```
┌─────────┐    UDP:7030     ┌──────────────┐   MQTT (TLS)    ┌───────────┐
│ ESP32-S3 ├─────────────▶  │  RuView       ├──────────────▶ │ Mosquitto │
│ (CSI)    │   CSI frames   │  Sensing      │                │  Broker   │
└─────────┘                │  Server       │                └─────┬─────┘
                            │  (v2 Rust)   │                      │
                            └──────────────┘                      │
                                                                   │ MQTT
                                                                   ▼
                                                          ┌──────────────┐
                                                          │  @sentira/   │
                                                          │  middleware   │
                                                          │              │
                                                          │ ┌──────────┐ │
                                                          │ │ MQTT     │─┼─▶ SensorReading
                                                          │ │Ingestor  │ │
                                                          │ └────┬─────┘ │
                                                          │      ▼       │
                                                          │ ┌──────────┐ │
                                                          │ │ Engine   │─┼─▶ alert candidates
                                                          │ │ (rules)  │ │
                                                          │ └────┬─────┘ │
                                                          │      ▼       │
                                                          │ ┌──────────┐ │
                                                          │ │ Alert    │─┼─▶ SMS/WhatsApp/Push
                                                          │ │ Manager  │ │
                                                          │ └────┬─────┘ │
                                                          │      ▼       │
                                                          │ ┌──────────┐ │
                                                          │ │ Store    │ │
                                                          │ │(in-mem)  │ │
                                                          │ └──────────┘ │
                                                          │      ▼       │
                                                          │ ┌──────────┐ │
                                                          │ │ Server   │─┼─▶ HTTP + SSE
                                                          │ │(Fastify) │ │
                                                          │ └──────────┘ │
                                                          └──────┬───────┘
                                                                 │ HTTP/SSE
                                                                 ▼
                                                          ┌──────────────┐
                                                          │ @sentira/    │
                                                          │ dashboard    │
                                                          │ (Next.js 15) │
                                                          │              │
                                                          │ /overview    │
                                                          │ /residents   │
                                                          │ /alerts      │
                                                          │ /settings    │
                                                          └──────────────┘
```

## Data Flow

### 1. Ingestion

RuView sensing server publishes Home Assistant auto-discovery MQTT messages:

```
homeassistant/<component>/<node_id>/<slug>/state
```

Example: `homeassistant/binary_sensor/wifi_densepose_a/presence/state` → `ON`

The MQTT Ingestor (`mqtt.ts`) subscribes to `<prefix>/+/<nodePrefix>*/+/state`, parses the topic, normalises payloads into `SensorReading` objects, and feeds them to the engine.

### 2. Rules Evaluation

Each reading is evaluated against 5 rules (`rules.ts`) in sequence:

```
healthRule        → updates node health (presence, vitals, motion, RSSI)
fallRule          → two-stage fall detection
inactivityRule    → present-but-not-moving detection
breathingTrendRule → sustained vitals anomaly
unusualActivityRule → baseline deviation (RuView semantic)
```

Each rule returns an `AlertCandidate[]` and an optional `healthPatch`.

### 3. Alert Lifecycle

```
pending ──▶ active ──▶ acknowledged ──▶ resolved
                      ▶ escalated (after escalation timeout)
│              │               │              │
create()    dispatch()    acknowledge()   resolve()
                      markFalseAlarm()
```

- **create**: inserts Alert with status `pending`, then immediately transitions to `active` via `dispatch()` which sends notifications.
- **dispatch**: chooses channels by severity:
  - HIGH → SMS + WhatsApp + push to escalation chain contacts (in parallel)
  - MEDIUM → push + dashboard only
  - Provider failures are queued and retried.
- **escalate**: unacknowledged HIGH alerts after 180s → re-notify + add secondary contacts.
- **auto-resolve**: MEDIUM alerts (breathing_trend, unusual_activity, sensor_offline) auto-resolve when their underlying condition clears.

### 4. HTTP / SSE API

Fastify server (`server.ts`) serving:
- REST endpoints for dashboard CRUD
- SSE endpoint (`/api/events`) for real-time pushes
- CORS enabled for all origins (stub mode) or configurable via `CORS_ORIGIN`

### 5. Dashboard (Next.js 15)

App Router with 4 routes:

| Route | Data Source | Real-time |
|-------|-------------|-----------|
| `/` | `GET /api/overview` | SSE `overview` events |
| `/residents/:id` | `GET /api/residents/:id` + `GET /api/alerts` | SSE `alert` / `alert_updated` |
| `/alerts/:id` | `GET /api/alerts/:id` | SSE `alert_updated` |
| `/settings` | `GET /api/residents` + `GET /api/nodes` | SSE `node_health` |

The dashboard uses Server-Sent Events via a custom `useSse` hook that maintains a persistent connection to `GET /api/events`.

## Key Design Decisions

### Why MQTT (not HTTP) for sensor data?

RuView already publishes via MQTT with HA auto-discovery. Using MQTT means:
- The sensor data pipeline works without Sentira (dashboard is optional)
- Data persists on broker during restarts
- Other subscribers (Home Assistant, Node-RED) can consume the same data
- Sentira adds no latency to the raw data path

### Why in-memory store (not PostgreSQL)?

Single-household scope (1–3 rooms, 1–2 residents). The store holds:
- Latest ~500 readings per node (ring buffer, pruned on insert)
- Active alerts (typically 0–5)
- Resident definitions (loaded from seed data)
- Node health states

For a household, this fits comfortably in ~50MB RAM. A database would add deployment complexity with no benefit at this scale. The store is designed so a persistent backend can be swapped in without changing the alert lifecycle.

### Why no cameras?

The core value proposition is privacy. If cameras are added, Sentira becomes "another surveillance system" — defeating the reason a family would choose it over a camera-based alternative. This constraint is enforced at the architecture level: no image types, no video pipeline, no camera API surfaces.

### Why stub mode?

Every field in `.env` is optional. Without Twilio credentials, SMS/WhatsApp calls log instead of sending. Without FCM, push is logged. Without MQTT, the engine bootstraps in a disconnected state. This makes the system instantly runnable for evaluation without provisioning any external services.

## Monorepo Layout

```
sentira/
├── packages/
│   ├── types/              # @sentira/types — shared type definitions
│   │   └── src/index.ts    # SensorReading, Alert, Resident, NodeHealth, etc.
│   ├── middleware/          # @sentira/middleware — rules engine + API
│   │   └── src/
│   │       ├── main.ts     # Entrypoint
│   │       ├── config.ts   # Env-based configuration
│   │       ├── engine.ts   # Wires MQTT → rules → alert manager
│   │       ├── rules.ts    # Detection rules (5 rules)
│   │       ├── alert-manager.ts # Alert lifecycle + notification dispatch
│   │       ├── store.ts    # In-memory data store
│   │       ├── mqtt.ts     # MQTT subscriber + topic parser
│   │       ├── server.ts   # Fastify HTTP/SSE server
│   │       ├── heartbeat.ts # Sensor-offline detection
│   │       ├── seed.ts     # Demo data
│   │       └── providers/  # Twilio, FCM (stub when unconfigured)
│   ├── dashboard/          # @sentira/dashboard — Next.js caregiver UI
│   │   ├── app/            # App Router pages
│   │   ├── components/     # Shared UI components
│   │   └── lib/            # API client, auth, SSE hook, formatters
│   └── mock-ruview/        # @sentira/mock-ruview — hardware stand-in
│       └── src/
│           ├── cli.ts      # CLI entrypoint
│           ├── topics.ts   # MQTT topic builders
│           ├── publisher.ts # MQTT publisher
│           ├── scenarios.ts # 5 test scenarios
│           └── discovery.ts # HA discovery config
├── infrastructure/
│   ├── docker/             # Dockerfiles
│   └── mosquitto/          # Mosquitto config
├── docs/                   # Documentation
├── docker-compose.yml      # 3-service compose
└── .env.example            # Configuration template
```

## Type System

The `@sentira/types` package is the single source of truth shared across all packages. Key types:

| Type | Description |
|------|-------------|
| `SensorReading` | Normalized MQTT reading (timestamp, nodeId, entity, value, state) |
| `Resident` | Resident config with thresholds, escalation chain, notification channels |
| `ResidentThresholds` | Per-resident thresholds (fall window, inactivity, vitals ranges) |
| `Alert` | Full alert lifecycle with audit trail |
| `NodeHealth` | Sensor node health state (lastSeen, vitals, motion, RSSI) |
| `OverviewSnapshot` | Calm overview of all residents with status grouping |
| `SseEvent` | Discriminated union for SSE (`alert`, `alert_updated`, `overview`, `node_health`) |

## Detection Rules Detail

### Fall (Two-Stage Confirm)

```
Stage 1: fast-fall spike detected (entity: "fall", event_type: "trigger")
         └─ Check presence is ON (resident is in room)
         └─ Check no significant motion in confirm window (book-drop filter)
         │
Stage 2 (confirm window): no recovery motion for fallConfirmWindowSec (default 20s)
         └─ HIGH alert created, dispatched to all channels
```

The book-drop filter prevents false positives from dropped objects: if motion (>12) was detected in the window before the spike, the alert is downgraded to a "possible fall-like motion" advisory.

### Inactivity (Day/Night Split)

```
Trigger: entity "no_movement" transitions to ON
         └─ Presence must also be ON (resident in room, not moving)
         └─ Seconds-since-motion must exceed the window
             ├─ Day (07:00–22:00): inactivityDaySec (default 2h)
             └─ Night (22:00–07:00): inactivityNightSec (default 8h)
```

Deduplication: only one active inactivity alert per resident at a time.

### Breathing Trend (Sustained Anomaly)

```
Trigger: entity "breathing_rate" with numeric value
         └─ Value outside resident's breathingRange
         └─ All readings in vitalsAnomalyWindowSec (5 min) are also out of range
         └─ At least 3 readings in the window
         └─ No active breathing_trend alert for this resident
```

Explicitly labeled as "trend estimate, not a clinical reading" in the message.

### Unusual Activity (Baseline Deviation)

```
Trigger: entity "elderly_inactivity_anomaly" state = ON
         └─ No existing active unusual_activity alert for this resident
```

Relies on RuView's learned baseline model. Surface as MEDIUM — dashboard-only alert.

### Sensor Offline (Heartbeat)

```
Trigger: No MQTT message from a node for heartbeatTimeoutSec (90s)
         └─ Checked every 15s by heartbeat monitor
         └─ MEDIUM alert created, push + dashboard only
```

Auto-resolves when the node sends data again.

## Notification Routing

### Channel Selection by Severity

```
Alert created
├─ HIGH ──▶ SMS (primary contacts)
│           WhatsApp (primary contacts)
│           Push (all contacts)
│           Dashboard (always)
│
└─ MEDIUM ──▶ Push (condition-aware)
              Dashboard (always)
              [No SMS — anti alert-fatigue]
```

### Esclation Chain

Each resident has an ordered list of `EscalationContact`s:

1. Primary contacts notified first (all channels for HIGH)
2. If unacknowledged for `escalationTimeoutSec` (180s):
   - Re-notify primary contacts
   - Add secondary contacts to the notification
   - Increment escalation count
   - Continue escalating every timeout until acknowledged

### Stub Mode

When provider credentials are absent, the system operates in stub mode:
- Calls are logged via pino at `info` level
- A mock `notify_queued` audit entry is created
- No external services are contacted
- The `dispatch` method continues normally — the only difference is no bytes leave the machine
