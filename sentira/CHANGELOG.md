# Changelog

## 0.1.0 (2026-07-07)

Initial release — all core functionality complete.

### Added

#### Detection Engine
- **Fall detection** — two-stage confirm with book-drop suppression and per-resident confirm window
- **Inactivity detection** — day/night split thresholds, presence-gated, deduped per resident
- **Breathing trend detection** — sustained (3+ readings out-of-range for 5min window), labeled as trend flag
- **Unusual activity detection** — triggered by RuView's baseline deviation semantic (`elderly_inactivity_anomaly`)
- **Sensor offline detection** — heartbeat monitor checking every 15s with 90s timeout

#### Alert Lifecycle
- 6-status lifecycle: `pending → active → acknowledged → resolved / escalated / false_alarm`
- Full audit trail with 11 action types tracking every state transition and notification attempt
- Automated escalation: unacknowledged HIGH alerts re-notify + add secondary contacts after 180s
- MEDIUM alerts auto-resolve when underlying condition clears
- Alert message hedging: every message starts with "Possible ..." — never "confirmed"

#### Notification Providers
- **Twilio** — SMS + WhatsApp, in parallel, for HIGH alerts only
- **FCM (Firebase Cloud Messaging)** — push notifications for all severities
- **Stub mode** — all providers gracefully log when credentials are absent
- **Retry queue** — failed sends queued and retried automatically

#### Caregiver Dashboard (Next.js 15)
- **Overview** (`/`) — sign-in gate, active alert banner, resident cards grouped by status (alert/attention/normal)
- **Resident Detail** (`/residents/:id`) — sensor health panel, threshold summary, active alert actions, vitals trend charts (Recharts), alert history table
- **Alert Detail** (`/alerts/:id`) — full alert context, vitals snapshot, 5 action buttons (acknowledge/escalate/false-alarm/resolve), complete audit trail
- **Settings** (`/settings`) — resident list with escalation chains and notification channels, sensor node health table, recent alerts feed, environment info panel
- **Real-time SSE** — all pages update via Server-Sent Events through a shared `useSse` hook
- **Dark theme** — `#0a0a0f` canvas, `#8b7cf6` primary accent, Fraunces headings, Phosphor icons
- **Mock auth** — Firebase stub mode for local development; sign in with any email

#### Mock RuView (Test Fixtures)
- 5 scenarios: `normal`, `fall`, `inactivity`, `absent`, `vitals_anomaly`
- CLI: `--scenario`, `--interval`, `--once`, `--nodes` flags
- Publishes 21 entities per node via HA auto-discovery topics
- Discovery payload generation for Home Assistant integration

#### Infrastructure
- Docker Compose: 3 services (mosquitto, middleware, dashboard)
- Dockerfiles for middleware (Node 20 Alpine, 109MB) and dashboard (Node 20-slim, 212MB)
- Mosquitto config with healthcheck
- Root package.json scripts: `docker:up/down/logs/rebuild`, `local:up/down`, `typecheck`

#### Security
- RuView firmware security audit documented in `docs/SECURITY_HARDENING.md`
- 8 findings with remediation steps in priority order
- Deployment hardening checklist for v1

### Known Issues

- `RUVIEW_NODE_PREFIX` default mismatch between middleware (`_wifi_densepose`) and mock (`wifi_densepose`). Fix: set `RUVIEW_NODE_PREFIX=wifi_densepose` in `.env`.
- Mock auth stores caregiver ID in localStorage. No real Firebase auth implemented.
- In-memory store: all data lost on middleware restart.
- No HTTPS/TLS for dashboard or API. Must be terminated by reverse proxy (Caddy, nginx) in production.
