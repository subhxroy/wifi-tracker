# WiFi Tracker — Camera-Free Elder Monitoring

[GitHub](https://github.com/subhxroy/wifi-tracker) &middot; [Issues](https://github.com/subhxroy/wifi-tracker/issues)

Two separate projects that stack together:

```
wifi-tracker/
├── ruview/       Upstream WiFi sensing platform (MIT, by rUv)
└── sentira/      Caregiver monitoring app built on RuView's MQTT feed
```

## How They Connect

```
┌────────────────────────────────────────────────────────────────────┐
│  ruview/                                                           │
│                                                                   │
│  ESP32-S3 ($9) → CSI frames → sensing-server → MQTT              │
│                                                                   │
│  Publishes to: homeassistant/<type>/wifi_densepose_<mac>/<slug>/state
│  (21 entity types: presence, breathing_rate, fall, motion, ...)   │
└──────────────────────────────┬────────────────────────────────────┘
                               │ MQTT (LAN)
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│  sentira/                                                         │
│                                                                   │
│  Subscribes: homeassistant/+/+/+/state  (filters by node prefix) │
│  Rules engine → alert manager → SMS / WhatsApp / Push / Dashboard │
│                                                                   │
│  Links: http://<pi-ip>:4400 (API)  ·  http://<pi-ip>:4300 (UI)   │
└────────────────────────────────────────────────────────────────────┘
```

**They are separate folders, not coupled at the code level.** The connection is purely via MQTT on your LAN:

| Layer | ruview/ | sentira/ |
|-------|---------|----------|
| Code language | Rust (v2) + C (ESP32 firmware) | TypeScript (Node.js + Next.js) |
| Build system | Cargo + ESP-IDF | pnpm monorepo |
| Runs on | ESP32-S3 + optional Pi | Raspberry Pi (Docker or host) |
| MQTT role | Publisher (sensor data) | Subscriber (consumes and alerts) |
| Needs each other? | No (RuView works alone with HA) | Yes (needs RuView MQTT feed or mock) |
| Folder contents | Firmware, Rust crates, 182 ADRs, CI | Middleware, dashboard, mock, types |

## Integration Path

```bash
# Clone first
git clone https://github.com/subhxroy/wifi-tracker.git
cd wifi-tracker

# Option A — Docker (all-in-one, recommended for Pi)
cd sentira
docker compose up -d
# Dashboard at http://<pi-ip>:4300

# Option B — Hybrid dev (MQTT in Docker, code on host)
cd sentira
docker compose up -d mosquitto
pnpm install --ignore-scripts
pnpm --filter @sentira/middleware start   # terminal 1
pnpm --filter @sentira/dashboard dev      # terminal 2
pnpm --filter @sentira/mock-ruview start  # terminal 3 (test data)

# Then flash ESP32 with RuView firmware for real sensing:
cd ../ruview/firmware/esp32-csi-node
python3 provision.py --ssid MyWiFi --password secret --target-ip <pi-ip>
# RuView sensing server publishes to <pi-ip>:1883
# Sentira subscribes automatically — no config changes needed
```

## MQTT Topic Contract

Sentira subscribes to the format RuView's sensing server publishes:

```
homeassistant/<component>/wifi_densepose_<mac>/<slug>/state
```

| Part | Values |
|------|--------|
| `<component>` | `binary_sensor`, `sensor`, `event` |
| `<mac>` | ESP32 MAC address (e.g. `aabbccddeeff`) |
| `<slug>` | `presence`, `breathing_rate`, `heart_rate`, `fall`, `motion_level`, `motion_energy`, `no_movement`, `someone_sleeping`, `possible_distress`, `room_active`, `elderly_inactivity_anomaly`, `meeting_in_progress`, `bathroom_occupied`, `fall_risk_elevated`, `bed_exit`, `multi_room_transition`, `person_count`, `presence_score`, `rssi`, `zone_occupancy`, `pose` |

Configure via `RUVIEW_NODE_PREFIX` in `.env` (default: `wifi_densepose` — matches RuView's node ID format `wifi_densepose_<mac>`).

## Attribution & License (Important)

This project **uses** [RuView](https://github.com/ruvnet/ruview) as an **upstream dependency**. RuView is a separate project with its own MIT license and copyright holder. We do not fork, modify, or redistribute RuView's code.

| Component | License | Copyright | Relationship |
|-----------|---------|-----------|-------------|
| `ruview/` (firmware + Rust crates) | [MIT](ruview/LICENSE) | © 2024 rUv | Upstream; imported as-is, run as separate process |
| `sentira/` (middleware + dashboard) | MIT (ours) | Our own | Separate project consuming RuView's MQTT output |
| MQTT topic contract | Open protocol | — | Standard HA auto-discovery, used by many projects |

**What we consume from RuView:**
- MQTT state messages from the sensing server (21 entity kinds)
- ESP32 firmware (flashed to hardware, run as a separate device)
- The entity taxonomy and HA discovery format

**What RuView does not provide (Sentira's original work):**
- Alert lifecycle with escalation chains and multi-channel notification routing
- Caregiver dashboard with real-time SSE, audit trails, and per-resident thresholds
- Detection rules optimised for elder monitoring (two-stage fall confirm, day/night inactivity split)
- Provider abstraction with stub mode (Twilio, FCM, all optional)

Both are MIT. Use, modify, and distribute freely with attribution.

## Hardware

| Component | Cost | Role |
|-----------|------|------|
| ESP32-S3 (8MB flash) | ~$9 | WiFi CSI sensing node (RuView firmware) |
| WiFi router (2.4 GHz) | — | Radio source for CSI |
| Raspberry Pi 4+ (4GB) | ~$45 | Runs sentira middleware + dashboard |
| Optional: additional ESP32 | ~$9/ea | Multi-room coverage |

No cameras. No wearables. No cloud required.

## Quick Reference

```bash
# Clone
git clone https://github.com/subhxroy/wifi-tracker.git
cd wifi-tracker

# Sentira commands (run from sentira/)
pnpm typecheck              # type-check all packages
pnpm docker:up             # start all services
pnpm docker:logs           # follow logs
pnpm local:up              # Mosquitto in Docker + packages on host

# Mock sensor data
pnpm --filter @sentira/mock-ruview start                       # normal baseline
pnpm --filter @sentira/mock-ruview start -- --scenario fall    # fall detection test
pnpm --filter @sentira/mock-ruview start -- --scenario inactivity # inactivity test

# Endpoints
curl http://localhost:4400/health      # middleware health
curl http://localhost:4400/api/overview # resident status
open http://localhost:4300             # dashboard
```

See individual READMEs for full documentation:
- [RuView](ruview/README.md) — hardware build, provisioning, sensing server, Home Assistant
- [Sentira](sentira/README.md) — architecture, config, dashboard, API, deployment
