# Sentira

**Camera-free elder monitoring** built on [RuView](https://github.com/ruvnet/ruview) WiFi CSI sensing. Privacy-preserving, supplemental alert layer for caregivers — not a medical device.

```
┌─────────────────────────────────────────────────────────────┐
│                      Living Room                              │
│   ┌──────┐   CSI frames   ┌──────────────┐   MQTT           │
│   │ ESP  │ ──────────────▶│  Sensing      │ ──────▶       │
│   │ S3   │    UDP:7030    │  Server       │                 │
│   └──────┘                └──────────────┘                  │
│                              ▲                               │
│                              │ WiFi router (2.4 GHz)         │
└──────────────────────────────┘──────────────────────────────┘
                                    │ MQTT
                                    ▼
                          ┌──────────────────┐
                          │   Mosquitto       │
                          │   (MQTT Broker)   │
                          └────────┬─────────┘
                                   │
                          ┌────────▼─────────┐
                          │   Sentira         │
                          │   Middleware       │──▶ Twilio (SMS/WhatsApp)
                          │   (Rules Engine)  │──▶ FCM (Push)
                          └────────┬─────────┘
                                   │ HTTP / SSE
                          ┌────────▼─────────┐
                          │   Caregiver       │
                          │   Dashboard       │
                          │   (Next.js)       │
                          └──────────────────┘
```

## Quick Start

```bash
# 0. Clone the repo
git clone https://github.com/subhxroy/sentira.git
cd sentira/sentira

# 1. Install dependencies
pnpm install --ignore-scripts

# 2. Start the MQTT broker
docker compose up -d mosquitto

# 3. Start middleware (terminal 1)
pnpm --filter @sentira/middleware start

# 4. Start dashboard (terminal 2)
pnpm --filter @sentira/dashboard dev

# 5. Generate test data (terminal 3)
pnpm --filter @sentira/mock-ruview start
```

- Dashboard: http://localhost:4300
- Middleware health: http://localhost:4400/health
- Sign in with any email (mock auth)

## Architecture

| Package | Role | Port |
|---------|------|------|
| `@sentira/middleware` | Rules engine, alert lifecycle, HTTP/SSE API | 4400 |
| `@sentira/dashboard` | Next.js caregiver UI with real-time SSE updates | 4300 |
| `@sentira/mock-ruview` | Hardware stand-in generating MQTT test scenarios | — |
| `@sentira/types` | Shared TypeScript types (data model, API contracts) | — |
| Mosquitto | MQTT message broker | 1883 / 9001 |

### Detection Rules

| Rule | Severity | Description |
|------|----------|-------------|
| **Fall** | HIGH | Two-stage confirm: fast-fall spike + no recovery motion in 20s window. Single spikes (book drop) are suppressed. |
| **Inactivity** | HIGH | Presence registered + zero motion exceeding threshold (2h day / 8h night). Deduped per resident. |
| **Breathing Trend** | MEDIUM | Sustained (3+ readings) out-of-range breathing for 5 min window. Labeled as trend flag, never clinical readout. |
| **Unusual Activity** | MEDIUM | Triggered by RuView's `elderly_inactivity_anomaly` semantic. Baseline deviation signal. |
| **Sensor Offline** | MEDIUM | Node silent for 90s heartbeat timeout. |

### Alert Lifecycle

```
pending ──▶ active ──▶ acknowledged ──▶ resolved
                      ▶ escalated (unacknowledged for 180s)
```

- **HIGH** alerts: SMS + WhatsApp + push (all channels, all contacts, in parallel)
- **MEDIUM** alerts: push + dashboard only (no SMS — anti alert-fatigue)
- Esclation: unacknowledged HIGH alerts re-notify and add secondary contacts after 180s timeout
- MEDIUM alerts auto-resolve when underlying condition clears

## Configuration

Copy `.env.example` to `.env`. Every field is optional — the system boots in stub mode (in-memory store, logged-not-sent alerts) when credentials are absent.

| Variable | Default | Description |
|----------|---------|-------------|
| `MQTT_HOST` | `127.0.0.1` | MQTT broker address |
| `MQTT_PORT` | `1883` | MQTT broker port |
| `RUVIEW_NODE_PREFIX` | `_wifi_densepose` | Node ID substring for discovery |
| `MIDDLEWARE_PORT` | `4400` | HTTP API port |
| `MIDDLEWARE_API_TOKEN` | _(empty)_ | Bearer token for dashboard→middleware auth |
| `TWILIO_ACCOUNT_SID` | _(empty)_ | Twilio SMS/WhatsApp (stub when empty) |
| `FCM_SERVICE_ACCOUNT_PATH` | _(empty)_ | Firebase push (stub when empty) |
| `FALL_CONFIRM_WINDOW_SECONDS` | `20` | Two-stage fall confirm window |
| `INACTIVITY_DAY_SECONDS` | `7200` | Daytime inactivity threshold (2h) |
| `INACTIVITY_NIGHT_SECONDS` | `28800` | Nighttime inactivity threshold (8h) |
| `HEARTBEAT_TIMEOUT_SECONDS` | `90` | Node silence → sensor offline alert |
| `ESCALATION_TIMEOUT_SECONDS` | `180` | Unacknowledged HIGH alert escalation |

## Production Deployment

```bash
# Single Raspberry Pi / VPS
docker compose up -d

# Verify
curl http://<pi-ip>:4400/health
open http://<pi-ip>:4300
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full deployment guide.

## Development

```bash
# Mosquitto in docker + all packages on host
pnpm local:up

# All in docker
pnpm docker:up

# Type-check everything
pnpm typecheck

# Generate test data
pnpm --filter @sentira/mock-ruview start -- --scenario fall
```

Available mock scenarios: `normal`, `fall`, `inactivity`, `absent`, `vitals_anomaly`.

## Security

RuView firmware has known security gaps documented in [docs/SECURITY_HARDENING.md](docs/SECURITY_HARDENING.md):

| Issue | Status |
|-------|--------|
| Sensing-server auth disabled by default | Fix: set `RUVIEW_API_TOKEN` |
| MQTT anonymous access | Fix: Mosquitto password file |
| WebSocket unauthenticated | Fix: bind to `127.0.0.1` |
| HMAC placeholder (CRC32) on device | Real HMAC-SHA256 in Rust crate |
| Firmware Ed25519 placeholder | Requires `CONFIG_MBEDTLS_EDDSA_C` |

## Philosophy

- **Camera-free by design** — defeats the privacy pitch if cameras are added. Sentira must never request camera access.
- **Supplemental, not medical** — every alert is hedged ("possible X detected — please check on [name]"). Vitals shown as trend estimates, never clinical readouts.
- **No autonomous emergency calls** — all alerts require human ack before any external action.
- **Single-household scope** — 1–3 rooms, 1–2 residents, 2–4 caregivers. No multi-tenant, no RBAC.

## License

MIT
