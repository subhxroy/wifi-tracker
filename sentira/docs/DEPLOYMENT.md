# Deployment Guide

## Single-Raspberry-Pi Deployment

The recommended deployment: a Raspberry Pi 4 (4GB+) running Docker Compose with all three services.

### Prerequisites

- Raspberry Pi 4 or 5 (4GB+ RAM recommended)
- Raspberry Pi OS Lite (64-bit, Bookworm) or Ubuntu Server 24.04
- Docker + Docker Compose v2
- Static LAN IP for the Pi (configure via DHCP reservation or `/etc/dhcpcd.conf`)

### Step 1: OS Setup

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker compose version
```

### Step 2: Clone & Configure

```bash
git clone https://github.com/subhxroy/sentira.git
cd sentira/sentira

# Copy and edit configuration
cp .env.example .env
nano .env
```

Configure at minimum:

```ini
MQTT_HOST=127.0.0.1
MQTT_PORT=1883
RUVIEW_NODE_PREFIX=wifi_densepose
MIDDLEWARE_PORT=4400
NEXT_PUBLIC_MIDDLEWARE_URL=http://<pi-lan-ip>:4400
```

### Step 3: Start Services

```bash
docker compose up -d

# Check logs
docker compose logs -f

# Verify
curl http://127.0.0.1:4400/health
# → {"status":"ok","service":"sentira-middleware",...}
```

### Step 4: Provision ESP32 Nodes

```bash
cd ruview/firmware/esp32-csi-node

# Install ESP-IDF prerequisites
python3 -m venv ~/esp-idf-venv
pip install esptool pyserial

# Provision and flash
python3 provision.py --ssid MyWiFi --password wifipass --ota-server http://<pi-lan-ip>:8032
```

See RuView firmware documentation for detailed provisioning instructions.

### Step 5: Access Dashboard

```
http://<pi-lan-ip>:4300
```

## Production Hardening

### 1. MQTT Authentication

```bash
# Create Mosquitto password file
docker exec -it sentira-mosquitto mosquitto_passwd -c /mosquitto/config/passwd ruview

# Update mosquitto.conf
echo "allow_anonymous false" >> infrastructure/mosquitto/mosquitto.conf
echo "password_file /mosquitto/config/passwd" >> infrastructure/mosquitto/mosquitto.conf

# Set credentials in .env
MQTT_USERNAME=ruview
MQTT_PASSWORD=<password>
```

### 2. Middleware API Token

```bash
# Generate random token
openssl rand -hex 32

# Set in .env
MIDDLEWARE_API_TOKEN=<token>
```

### 3. RuView API Token

```bash
# Generate and set on sensing server
RUVIEW_API_TOKEN=$(openssl rand -hex 32)

# The firmware connects to:
# http://<sensing-server>:8032/api/sensing?token=<token>
```

### 4. Network Segmentation

| Service | Port | Restrict to |
|---------|------|-------------|
| Mosquitto MQTT | 1883 | ESP32 nodes + middleware only |
| Mosquitto WS | 9001 | Localhost only (or disable) |
| Middleware API | 4400 | Dashboard + caregiver LAN |
| Dashboard UI | 4300 | Caregiver LAN |
| ESP32 OTA | 8032 | Local + sensing server only |

### 5. SSH + Firewall

```bash
# UFW on the Pi
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow from <caregiver-lan> to any port 4300
sudo ufw allow from <caregiver-lan> to any port 4400
sudo ufw allow from <esp32-lan> to any port 1883
sudo ufw enable
```

## Hybrid Dev Mode

Run MQTT in Docker and everything else on the host machine for faster iteration:

```bash
# Terminal 1: MQTT broker
docker compose up -d mosquitto

# Terminal 2: Middleware
pnpm --filter @sentira/middleware start

# Terminal 3: Dashboard
pnpm --filter @sentira/dashboard dev

# Terminal 4: Mock sensor data
pnpm --filter @sentira/mock-ruview start
```

## Docker-Only Mode

Build and run everything in containers:

```bash
pnpm docker:up
pnpm docker:logs    # tail logs
pnpm docker:down    # stop all
pnpm docker:rebuild # rebuild + restart
```

## Environment Reference

| Variable | Docker default | Dev default | Description |
|----------|---------------|-------------|-------------|
| `MQTT_HOST` | `mosquitto` | `127.0.0.1` | MQTT broker address |
| `MQTT_PORT` | `1883` | `1883` | MQTT broker port |
| `MQTT_USERNAME` | _(empty)_ | _(empty)_ | MQTT auth username |
| `MQTT_PASSWORD` | _(empty)_ | _(empty)_ | MQTT auth password |
| `RUVIEW_NODE_PREFIX` | `wifi_densepose` | `wifi_densepose` | Node ID filter for topics |
| `MIDDLEWARE_PORT` | `4400` | `4400` | HTTP API port |
| `MIDDLEWARE_API_TOKEN` | _(empty)_ | _(empty)_ | Bearer auth token |
| `NEXT_PUBLIC_MIDDLEWARE_URL` | `http://middleware:4400` | `http://127.0.0.1:4400` | API base URL (dashboard) |
| `NEXT_PUBLIC_MIDDLEWARE_API_TOKEN` | _(empty)_ | _(empty)_ | Mirror of `MIDDLEWARE_API_TOKEN` for browser |
| `CORS_ORIGIN` | `*` | `*` | CORS origin (set to dashboard URL in cloud) |
| `LOG_LEVEL` | `info` | `info` | Pino log level |

## Monitoring

```bash
# Container logs
docker compose logs -f middleware

# Health check
curl http://<pi>:4400/health
```

Prometheus and Grafana configs are available in the RuView `monitoring/` directory.

## Upgrading

```bash
git pull
pnpm docker:rebuild
```

## Cloud Deployment

Sentira supports two cloud platforms for hybrid deployment when you want the dashboard accessible from anywhere while keeping the sensing infrastructure on your local network (or connecting via a cloud MQTT broker).

### Principle

```
┌─────────────────────┐    ┌──────────────────┐    ┌───────────────────┐
│  ESP32 on-site LAN  │───▶│   MQTT Broker     │───▶│  Middleware       │
│  (RuView firmware)  │    │ (local or cloud)  │    │ (local or Railway)│
└─────────────────────┘    └──────────────────┘    └────────┬──────────┘
                                                             │ HTTP API
                                                             ▼
                                                  ┌───────────────────┐
                                                  │  Dashboard        │
                                                  │  (Netlify, public)│
                                                  └───────────────────┘
```

### Netlify — Dashboard

The dashboard is a Next.js app that deploys to Netlify with zero server configuration.

**Prerequisites:**
- GitHub repository pushed with the codebase
- Netlify account (free tier works)

**Setup:**

1. Go to [netlify.com](https://netlify.com) → "Add new site" → "Import an existing project"

2. Connect your GitHub repo

3. Netlify auto-detects `netlify.toml` at the repo root — build settings are preconfigured:
   - **Build command:** `pnpm install --frozen-lockfile && pnpm --filter @sentira/dashboard build`
   - **Publish directory:** `packages/dashboard/.next`

4. Add environment variables in the Netlify dashboard (Site settings → Environment variables):

   | Variable | Example | Description |
   |----------|---------|-------------|
   | `NEXT_PUBLIC_MIDDLEWARE_URL` | `https://sentira-mw.up.railway.app` | Public URL of the middleware API |
   | `NEXT_PUBLIC_MIDDLEWARE_API_TOKEN` | `abc123...` | Mirror of `MIDDLEWARE_API_TOKEN` |

5. Deploy. The site is live on a `*.netlify.app` domain. Add a custom domain in settings.

**Notes:**
- The dashboard is an SSR app via Netlify's Next.js runtime — no manual function setup needed.
- `@sentira/types` is resolved via pnpm workspace and `transpilePackages` in `next.config.ts`.
- The middleware URL must be publicly reachable (or on the same LAN if using Netlify Dev).

---

### Railway — Middleware

Railway hosts the middleware as a Docker container. The MQTT broker can run locally (on the ESP32 LAN) or as a cloud service (HiveMQ Cloud free tier).

**Prerequisites:**
- Railway account (free tier with $5 credit works)
- GitHub repository pushed with the codebase

**Setup:**

1. Go to [railway.app](https://railway.app) → "New Project" → "Deploy from GitHub repo"

2. Select your repo. Railway auto-detects `railway.json` which points to the middleware Dockerfile.

3. The `railway.json` at the repo root configures:
   - Docker build from `infrastructure/docker/middleware.Dockerfile`
   - Health check at `/api/health`
   - Automatic restarts

4. Add environment variables in Railway dashboard (Variables tab):

   | Variable | Example | Description |
   |----------|---------|-------------|
   | `MQTT_HOST` | `xxx.s2.eu.hivemq.cloud` | MQTT broker address |
   | `MQTT_PORT` | `8883` | MQTT port (8883 for TLS) |
   | `MQTT_USERNAME` | `sentira` | MQTT auth username |
   | `MQTT_PASSWORD` | `your-password` | MQTT auth password |
   | `RUVIEW_NODE_PREFIX` | `wifi_densepose` | Node ID filter |
   | `MIDDLEWARE_PORT` | `4400` | HTTP API port |
   | `MIDDLEWARE_API_TOKEN` | `openssl rand -hex 32` | Bearer auth token |
   | `LOG_LEVEL` | `info` | Pino log level |
   | `TWILIO_ACCOUNT_SID` | _(optional)_ | SMS/WhatsApp |
   | `TWILIO_AUTH_TOKEN` | _(optional)_ | |
   | `TWILIO_FROM_NUMBER` | _(optional)_ | |
   | `TWILIO_WHATSAPP_FROM` | _(optional)_ | |
   | `CORS_ORIGIN` | `https://your-site.netlify.app` | Allow dashboard origin |

5. Deploy. Railway provides a `*.railway.app` URL.

---

### Cloud MQTT Broker (HiveMQ Cloud)

When the middleware runs on Railway (or anywhere off the local network), it needs a reachable MQTT broker. Options:

**Option A: HiveMQ Cloud (free, recommended)**

1. Sign up at [hivemq.com/cloud](https://www.hivemq.com/cloud/) (free tier: 100 connections, 10 GB/month)
2. Create a cluster → copy the broker URL (e.g. `xxx.s2.eu.hivemq.cloud`)
3. Create MQTT credentials (username + password)
4. Configure your ESP32 firmware to connect to the HiveMQ broker instead of the local Mosquitto
5. Set `MQTT_HOST`, `MQTT_PORT=8883`, `MQTT_USERNAME`, `MQTT_PASSWORD` in Railway env vars

**Option B: Mosquitto on Railway (advanced)**

Deploy Mosquitto as a separate Railway service:

1. In Railway dashboard, create a new service → "Empty service" → "Dockerfile"
2. Use the official `eclipse-mosquitto:2.0.20` image — Railway uses Dockerfile-based deploy
3. Create a minimal Dockerfile:
   ```dockerfile
   FROM eclipse-mosquitto:2.0.20
   EXPOSE 1883 9001
   ```
4. Railway exposes TCP port 1883 via its TCP proxy.
5. Link the Mosquitto service to the middleware service via Railway's internal networking.

---

### End-to-End Cloud Setup Summary

1. **MQTT:** Set up HiveMQ Cloud → note broker URL + credentials
2. **Railway:** Deploy middleware → set env vars pointing to HiveMQ
3. **Netlify:** Deploy dashboard → set `NEXT_PUBLIC_MIDDLEWARE_URL` pointing to Railway URL
4. **ESP32:** Flash firmware with HiveMQ broker address (or keep on local MQTT if on same LAN)
5. **Verify:** Open Netlify dashboard URL → confirm sensor status and alerts work

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Dashboard shows "sensor offline" | MQTT subscription not matching node IDs | Check `RUVIEW_NODE_PREFIX` matches node ID pattern |
| No alerts firing | Mock scenario too short | Use `--interval 1000` for faster data; run `fall` or `inactivity` scenario |
| SMS not sending | Twilio not configured | Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| Alerts not pushed | FCM not configured | Set `FCM_SERVICE_ACCOUNT_PATH` to Firebase service account JSON |
| `docker compose up` fails | Missing `.env` or Docker not installed | Copy `.env.example` to `.env`, verify `docker compose version` |
