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
git clone https://github.com/subhxroy/wifi-tracker.git
cd wifi-tracker/sentira

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
| `NEXT_PUBLIC_MIDDLEWARE_URL` | `http://middleware:4400` | `http://127.0.0.1:4400` | API base URL |
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

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Dashboard shows "sensor offline" | MQTT subscription not matching node IDs | Check `RUVIEW_NODE_PREFIX` matches node ID pattern |
| No alerts firing | Mock scenario too short | Use `--interval 1000` for faster data; run `fall` or `inactivity` scenario |
| SMS not sending | Twilio not configured | Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| Alerts not pushed | FCM not configured | Set `FCM_SERVICE_ACCOUNT_PATH` to Firebase service account JSON |
| `docker compose up` fails | Missing `.env` or Docker not installed | Copy `.env.example` to `.env`, verify `docker compose version` |
