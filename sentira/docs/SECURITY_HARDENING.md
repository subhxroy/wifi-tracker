# Sentira Security Hardening

Based on RuView audit (July 2026). Follow these steps before deploying beyond your bench.

---

## 1. Sensing-server auth

**Issue:** `RUVIEW_API_TOKEN` env var is empty by default → all `/api/v1/*` endpoints are open.

**Fix:**
```bash
export RUVIEW_API_TOKEN="$(openssl rand -hex 32)"
```
Add to your sensing-server systemd unit or docker-compose env.

**Scope:** `/api/v1/*` is gated. Note `/ws/sensing` is NEVER gated even with this set — only expose the WebSocket port to trusted LAN clients.

---

## 2. MQTT auth

**Issue:** mosquitto config (`infrastructure/mosquitto/mosquitto.conf`) allows anonymous connections.

**Fix (dev bench only — for production add TLS):**
```bash
# Generate password
docker exec sentira-mosquitto mosquitto_passwd -c /mosquitto/config/passwd sentira

# Update mosquitto.conf
echo "allow_anonymous false
password_file /mosquitto/config/passwd" >> infrastructure/mosquitto/mosquitto.conf

# Restart
docker compose restart mosquitto
```

Update `MQTT_USERNAME` / `MQTT_PASSWORD` in `.env`.

---

## 3. ESP32 firmware hardening

Apply via `provision.py` before deploying any node:

```bash
# Set WiFi password (default: empty)
provision.py --password "<strong-wifi-password>"

# Set OTA PSK (default: unprovisioned → fail-closed, but set it anyway)
provision.py --ota-psk "$(openssl rand -hex 32)"

# Set Seed token for swarm bridge auth
provision.py --seed-token "$(openssl rand -hex 32)"

# Set Soft-AP PSK (default: "ruviewtwt" — shared across all devices)
provision.py --softap-psk "<unique-psk-per-node>"
```

### OTA status endpoint
`GET /ota/status` leaks firmware version and partition info. Currently unauthenticated. Monitor logs for unexpected access; disable OTA server entirely in production if not needed.

---

## 4. WebSocket (/ws/sensing)

**Issue:** The real-time sensing WebSocket is never gated by bearer auth, even when `RUVIEW_API_TOKEN` is set.

**Mitigation:** Run the sensing server with `--bind-addr 127.0.0.1` (default for the WebSocket listener) so it only accepts connections from the local machine. The sentira middleware should be the only consumer, and it runs on the same host.

---

## 5. HMAC — firmware-side placeholder

**Issue:** `rv_mesh.h` declares `RV_AUTH_HMAC_SESSION` but the firmware only appends CRC32, not a real HMAC tag. The real HMAC lives in the Rust `secure_tdm.rs` host-side crate.

**Status:** Not blocking for single-household v1 (ESP32↔Pi traffic stays on trusted LAN). If you need mesh integrity across untrusted links, port the HMAC-SHA256 from `secure_tdm.rs` into the C firmware's `rv_mesh_encode()` function.

---

## 6. Firmware Ed25519 — placeholder

**Issue:** `rvf_verify_signature()` uses SHA-256(pubkey || data), not real Ed25519. Comment: "For full Ed25519, enable CONFIG_MBEDTLS_EDDSA_C".

**Status:** Not blocking for v1. WASM signature verification defaults ON but requires pubkey provisioning.

---

## 7. Network segmentation (recommended)

| Traffic | Port | Restrict to |
|---------|------|-------------|
| ESP32 ↔ Pi (MQTT) | 1883 | VLAN or dedicated AP subnet |
| Pi ↔ Dashboard (SSE/HTTP) | 4400 | LAN only |
| Pi ↔ Internet (Twilio/FCM) | 443 | Pi only |
| Dashboard (browser) | 4300 | Caregiver device |

Use a dedicated 2.4 GHz AP for CSI sensing per §2 of the build spec — this also doubles as network segmentation.

---

## 8. Dashboard-to-middleware auth

Set `MIDDLEWARE_API_TOKEN` in `.env` to a random string. The middleware will then require `Authorization: Bearer <token>` on all API requests. The dashboard reads `NEXT_PUBLIC_MIDDLEWARE_TOKEN` to include it.

---

## Summary checklist for v1

- [ ] Set `RUVIEW_API_TOKEN` on sensing server
- [ ] Enable MQTT password on mosquitto
- [ ] Provision each ESP32 node: WiFi password, OTA PSK, Seed token, Soft-AP PSK
- [ ] Run sensing server with `--bind-addr 127.0.0.1` (or firewall MQTT/WebSocket ports)
- [ ] Set `MIDDLEWARE_API_TOKEN` in `.env`
- [ ] Firewall all ports except 443 (outbound) and 4400/4300 (LAN caregiver devices)
- [ ] Use dedicated AP for CSI sensing

These steps close the gaps identified in the audit for a single-household deployment. The full HMAC rewrite and Ed25519 WASM signing are recommended before any multi-room or hospital pilot.
