# Codebase BRAIN

## Overview

Two projects in this repo:

| Project | Path | Stack | Purpose |
|---------|------|-------|---------|
| **sentira** | `sentira/` | pnpm monorepo — Node.js + Next.js + React | Camera-free elder monitoring via WiFi CSI. Rules engine, caregiver dashboard, mock sensor |
| **bloom-landing** | `bloom-landing/` | Vite + React 19 + Tailwind v4 | Marketing landing page for Sentira (static, deploy to Netlify/Vercel) |

---

## sentira/ Structure

```
sentira/
├── packages/
│   ├── types/src/index.ts          # @sentira/types — shared TS types
│   ├── middleware/src/
│   │   ├── main.ts                 # Entrypoint — boots MQTT, engine, server
│   │   ├── config.ts               # Env-based config singleton
│   │   ├── mqtt.ts                 # MQTT subscriber + topic parser
│   │   ├── engine.ts               # Wires MQTT → rules → alert manager
│   │   ├── rules.ts                # 5 detection rules
│   │   ├── alert-manager.ts        # Alert lifecycle + notification dispatch
│   │   ├── store.ts                # In-memory data store
│   │   ├── server.ts               # Fastify HTTP/SSE server (port 4400)
│   │   ├── heartbeat.ts            # Sensor-offline heartbeat monitor
│   │   ├── seed.ts                 # Demo residents/nodes
│   │   └── providers/              # Twilio, FCM (stub when unconfigured)
│   ├── dashboard/                  # @sentira/dashboard — Next.js 15 App Router
│   │   ├── app/
│   │   │   ├── layout.tsx          # Root layout (Poppins font, data-theme attr, SSE provider)
│   │   │   ├── page.tsx            # /overview — resident status cards + SSE
│   │   │   ├── residents/[id]/page.tsx  # /residents/:id — detail + alerts
│   │   │   ├── alerts/[id]/page.tsx     # /alerts/:id — single alert detail
│   │   │   ├── settings/page.tsx        # /settings — resident/node config
│   │   │   ├── globals.css        # Liquid-glass component classes, dark mode vars
│   │   │   └── tailwind.src.css   # Theme tokens (light + dark), font imports
│   │   ├── components/             # Shared UI: Navbar, ResidentCard, AlertCard, AlertTimeline, etc.
│   │   ├── lib/                    # API client, auth, SSE hook, formatters
│   │   └── next.config.ts         # transpilePackages for @sentira/types
│   └── mock-ruview/src/            # @sentira/mock-ruview — hardware stand-in
│       ├── cli.ts                  # CLI entrypoint (--scenario, --interval)
│       ├── topics.ts               # MQTT topic builders
│       ├── publisher.ts            # MQTT publisher
│       ├── scenarios.ts            # 5 test scenarios
│       └── discovery.ts            # HA discovery config
├── infrastructure/
│   ├── docker/                     # Dockerfiles for middleware
│   └── mosquitto/                  # Mosquitto config (anonymous by default)
├── docs/
│   ├── ARCHITECTURE.md             # System design, data flow, decision records
│   ├── API.md                      # Full HTTP/SSE API reference
│   ├── DEPLOYMENT.md               # Pi + Cloud (Netlify, Railway, HiveMQ) guide
│   └── SECURITY_HARDENING.md       # RuView audit findings, fixes
├── netlify.toml                    # Dashboard deploy config (pnpm filter @sentira/dashboard)
├── railway.json                    # Middleware deploy config (Dockerfile path)
├── docker-compose.yml              # 3-service compose (mosquitto, middleware, dashboard)
├── pnpm-workspace.yaml             # Workspace definition
├── .env.example                    # All env vars with defaults
└── package.json                    # Root scripts (typecheck, local:up, docker:up)
```

## Data Flow

```
ESP32-S3 → UDP:7030 → RuView Sensing Server → MQTT → Mosquitto → @sentira/middleware
                                                                        ↓
                                                                   Rules Engine
                                                                   (fall, inactivity, breathing,
                                                                    unusual activity, sensor offline)
                                                                        ↓
                                                                   Alert Manager
                                                                   (dispatch: SMS/WhatsApp/Push)
                                                                        ↓
                                                                   Store (in-memory)
                                                                        ↓
                                                                   Fastify Server (HTTP + SSE)
                                                                        ↓
                                                                   @sentira/dashboard (Next.js)
                                                                   (4 routes, SSE real-time)
```

## Key Routes — Dashboard

| Route | File | SSE Events |
|-------|------|-----------|
| `/` | `app/page.tsx` | overview, alert, alert_updated, node_health |
| `/residents/[id]` | `app/residents/[id]/page.tsx` | alert, alert_updated |
| `/alerts/[id]` | `app/alerts/[id]/page.tsx` | alert_updated |
| `/settings` | `app/settings/page.tsx` | node_health |

## Key Routes — Middleware API (port 4400)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| GET | `/api/overview` | Calm snapshot of all residents |
| GET | `/api/residents` | List all residents |
| GET | `/api/residents/:id` | Resident detail + nodes + recent alerts |
| PATCH | `/api/residents/:id` | Update thresholds/channels |
| GET | `/api/alerts` | List alerts (filterable) |
| GET | `/api/alerts/:id` | Single alert detail |
| POST | `/api/alerts/:id/acknowledge` | Acknowledge alert |
| POST | `/api/alerts/:id/escalate` | Manual escalate |
| POST | `/api/alerts/:id/false-alarm` | Mark false alarm |
| POST | `/api/alerts/:id/resolve` | Resolve alert |
| GET | `/api/nodes` | All node health states |
| GET | `/api/events` | SSE stream (4 event types) |

## Detection Rules

| Rule | Severity | Key Logic |
|------|----------|-----------|
| Fall | HIGH | Two-stage: fast-fall spike + no recovery in 20s window. Book-drop filter |
| Inactivity | HIGH | Presence ON + zero motion exceeding day (2h) / night (8h) threshold |
| Breathing Trend | MEDIUM | 3+ out-of-range readings in 5 min window. Labeled "trend estimate" |
| Unusual Activity | MEDIUM | RuView `elderly_inactivity_anomaly` semantic. Baseline deviation |
| Sensor Offline | MEDIUM | Node silent for 90s. Checked every 15s by heartbeat monitor |

## Alert Lifecycle

```
pending → active → acknowledged → resolved
                  → escalated (unacknowledged 180s)
                  → false_alarm
```

- HIGH: SMS + WhatsApp + push (parallel, all primary contacts)
- MEDIUM: push + dashboard only. Auto-resolve when condition clears
- Escalation: re-notify + add secondary contacts every 180s until acknowledged

## Alert Types

`fall` | `inactivity` | `breathing_trend` | `unusual_activity` | `sensor_offline`

## Resident Configuration

Each resident has: thresholds (fall window, inactivity day/night, vitals ranges), escalation chain (ordered contacts), notification channels (sms/whatsapp/push booleans), node IDs.

## Design Constraints

1. **Camera-free**: No image types, video pipeline, or camera APIs. Privacy is core.
2. **Supplemental, not medical**: Alerts hedged ("possible X detected — please check"). Vitals = trend estimates.
3. **No autonomous emergency calls**: All alerts require human ack before external action.
4. **Single-household scope**: 1-3 rooms, 1-2 residents, 2-4 caregivers. In-memory store.
5. **Stub mode**: Every external service is optional. Unconfigured providers log instead of send.

## Dashboard Theme System

- Light/dark mode via `data-theme="light"|"dark"` on `<html>` element
- CSS variables in `app/tailwind.src.css` under `:root` and `[data-theme="dark"]`
- Liquid-glass component classes in `globals.css`:
  - `.liquid-glass` — subtle `::before` gradient border
  - `.liquid-glass-strong` — thicker gradient border
  - `.glass-pill` — small pill variant
- Fonts: Poppins (display, font-display class), Source Serif 4 (serif accent)
- Color tokens: canvas, paper, hairline, muted, subtle (all adapt in dark mode)
- Navbar: `bg-paper/80 backdrop-blur-xl` with theme toggle (Sun/Moon icons)

## deployment

| Target | Platform | Config |
|--------|----------|--------|
| Dashboard | Netlify | `sentira/netlify.toml` — `pnpm --filter @sentira/dashboard build` |
| Middleware | Railway | `sentira/railway.json` — Docker build from `infrastructure/docker/middleware.Dockerfile` |
| Landing Page | Netlify/Vercel | `bloom-landing/` — `npm run build` → `dist/` |
| All-in-one | Raspberry Pi | `docker compose up -d` from `sentira/` |
| MQTT Broker | HiveMQ Cloud (free) | Broker URL + TLS credentials in middleware env |

---

## bloom-landing/

```
bloom-landing/
├── index.html         # HTML shell (Google Fonts, title "Sentira")
├── vite.config.ts     # Tailwind v4 + React plugin
├── tsconfig.json      # Strict TS, Bundler resolution
├── package.json       # React 19, lucide-react, tailwindcss 4.1
├── src/
│   ├── main.tsx       # React DOM render
│   ├── App.tsx        # Sentira landing page (two-panel, video bg, pills, features)
│   └── index.css      # Tailwind v4 import + liquid-glass layers
└── dist/              # Build output (206 KB JS + 16 KB CSS)
```

- Standalone Vite SPA (not in pnpm workspace)
- Tailwind v4 via `@tailwindcss/vite` plugin
- Lucide icons (WifiHigh, Bell, Activity, etc.)
- Video background from CloudFront (atmospheric stock footage)
- Build: `cd bloom-landing && npm run build`
- Same liquid-glass aesthetic as sentira dashboard (CSS layers in index.css)
