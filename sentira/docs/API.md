# Middleware API Reference

Base URL: `http://<host>:4400`

**Response format:** All endpoints return JSON. Errors follow `{ error: string, detail?: string }`.

**Auth:** Bearer token via `Authorization: Bearer <token>` header when `MIDDLEWARE_API_TOKEN` is set. No auth required when token is empty (local/dev default).

---

## Endpoints

### `GET /health`

Liveness check. Does not verify MQTT connection or provider status — only that the process is running.

```json
{ "status": "ok", "service": "sentira-middleware", "now": 1783418000000 }
```

---

### `GET /api/overview`

Calm snapshot of all residents with status grouping. Used by the dashboard's overview page.

```
Status: normal    → green, no active alerts
Status: attention → MEDIUM alert active (breathing_trend, unusual_activity, sensor_offline)
Status: alert     → HIGH alert active (fall, inactivity)
```

```json
{
  "generatedAt": 1783418000000,
  "residents": [
    {
      "id": "res_alice",
      "name": "Alice Whitfield",
      "room": "Room A",
      "status": "normal",
      "activeAlertId": null,
      "activeAlertType": null,
      "sensorOnline": true,
      "sensorLastSeen": 1783418000000,
      "breathingRate": 16.2,
      "heartRate": 72
    }
  ]
}
```

---

### `GET /api/residents`

List all configured residents with full config (thresholds, escalation chain, channels).

```json
[
  {
    "id": "res_alice",
    "name": "Alice Whitfield",
    "room": "Room A",
    "nodeIds": ["wifi_densepose_a"],
    "thresholds": {
      "fallConfirmWindowSec": 20,
      "inactivityDaySec": 7200,
      "inactivityNightSec": 28800,
      "dayWindow": ["07:00", "22:00"],
      "breathingRange": [12, 22],
      "heartRateRange": [55, 100],
      "vitalsAnomalyWindowSec": 300
    },
    "escalationChain": [
      {
        "id": "cg_priya",
        "name": "Priya (primary nurse)",
        "role": "RN",
        "phone": "+15550000001",
        "whatsapp": "whatsapp:+15550000001",
        "pushTokens": []
      }
    ],
    "notificationChannels": { "sms": true, "whatsapp": true, "push": true },
    "createdAt": 1783414000000,
    "updatedAt": 1783414000000
  }
]
```

---

### `GET /api/residents/:id`

Full resident detail including computed/derived data: sensor node health for their nodes and recent alerts.

```json
{
  "resident": { /* same shape as GET /api/residents entry */ },
  "nodes": [
    {
      "nodeId": "wifi_densepose_a",
      "lastSeen": 1783418000000,
      "online": true,
      "presence": true,
      "breathingRate": 16.2,
      "heartRate": 72,
      "rssi": -65,
      "lastMotion": 1783418000000
    }
  ],
  "recentAlerts": [
    {
      "id": "alt_abc123",
      "type": "fall",
      "severity": "HIGH",
      "status": "resolved",
      "message": "Possible fall detected — please check on Alice Whitfield.",
      "createdAt": 1783417000000,
      "resolvedAt": 1783417100000
    }
  ]
}
```

---

### `PATCH /api/residents/:id`

Update resident thresholds or notification channels.

**Request body:**

```json
{
  "thresholds": {
    "fallConfirmWindowSec": 30,
    "inactivityDaySec": 14400
  },
  "notificationChannels": {
    "sms": false,
    "whatsapp": true,
    "push": true
  }
}
```

All fields optional. Returns updated resident.

---

### `GET /api/alerts`

List alerts. Supports query parameters.

**Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 50 | Max alerts to return |
| `status` | string | — | Filter by status: `active`, `acknowledged`, `resolved`, `escalated`, `false_alarm` |
| `residentId` | string | — | Filter by resident |
| `type` | string | — | Filter by type: `fall`, `inactivity`, `breathing_trend`, `unusual_activity`, `sensor_offline` |

```json
[
  {
    "id": "alt_abc123",
    "residentId": "res_alice",
    "residentName": "Alice Whitfield",
    "nodeId": "wifi_densepose_a",
    "room": "Room A",
    "type": "fall",
    "severity": "HIGH",
    "status": "active",
    "createdAt": 1783417000000,
    "escalationCount": 0,
    "message": "Possible fall detected — please check on Alice Whitfield.",
    "context": {
      "secondsSinceMotion": 45,
      "detail": "Fall signal with no recovery motion in the 20s confirm window."
    },
    "audit": [
      { "timestamp": 1783417000000, "action": "created", "actor": "system" },
      { "timestamp": 1783417000000, "action": "notified_sms", "actor": "system", "detail": "sms→+15550000001" },
      { "timestamp": 1783417000000, "action": "notified_push", "actor": "system", "detail": "push→token_abc" }
    ]
  }
]
```

---

### `GET /api/alerts/:id`

Single alert with full detail, including complete audit trail.

---

### `POST /api/alerts/:id/acknowledge`

Acknowledge an alert. Stops the escalation timer.

**Request body:**

```json
{ "caregiverId": "cg_priya" }
```

Returns updated alert with status `acknowledged`.

---

### `POST /api/alerts/:id/escalate`

Manually escalate an alert. Triggers re-notification with secondary contacts.

**Request body:**

```json
{ "caregiverId": "cg_priya" }
```

Returns updated alert with incremented `escalationCount`.

---

### `POST /api/alerts/:id/false-alarm`

Mark an alert as false alarm. Stops escalation. Distinguishable from `resolved` in analytics.

**Request body:**

```json
{ "caregiverId": "cg_priya" }
```

Returns updated alert with status `false_alarm`. Audit entry includes note about threshold tuning.

---

### `POST /api/alerts/:id/resolve`

Resolve an acknowledged alert. Closes the lifecycle.

**Request body:**

```json
{ "caregiverId": "cg_priya" }
```

Returns updated alert with status `resolved` and `resolvedAt` timestamp.

---

### `GET /api/nodes`

All sensor node health states.

```json
[
  {
    "nodeId": "wifi_densepose_a",
    "lastSeen": 1783418000000,
    "online": true,
    "presence": true,
    "breathingRate": 16.2,
    "heartRate": 72,
    "rssi": -65,
    "lastMotion": 1783418000000
  }
]
```

---

### `GET /api/events`

Server-Sent Events stream. The primary real-time channel for the dashboard.

**Events:**

| Event | Fires when | Payload |
|-------|-----------|---------|
| `alert` | New alert created | `{ type: "alert", alert: Alert }` |
| `alert_updated` | Alert status changes | `{ type: "alert_updated", alert: Alert }` |
| `overview` | Every 5s or on data change | `{ type: "overview", overview: OverviewSnapshot }` |
| `node_health` | Node health state changes | `{ type: "node_health", node: NodeHealth }` |

**Client usage (JavaScript):**

```javascript
const events = new EventSource("/api/events");
events.addEventListener("alert", (e) => {
  const { alert } = JSON.parse(e.data);
  // show notification
});
events.addEventListener("overview", (e) => {
  const { overview } = JSON.parse(e.data);
  // update resident list
});
```

---

## Data Types

### Alert Status Lifecycle

```
pending ──▶ active ──▶ acknowledged ──▶ resolved
                      ▶ escalated      ▶ false_alarm
```

| Status | Meaning |
|--------|---------|
| `pending` | Created, awaiting initial dispatch |
| `active` | Notified, awaiting caregiver action |
| `acknowledged` | Caregiver has seen it, investigating |
| `escalated` | Not acknowledged in timeout — re-notified with escalation |
| `resolved` | Caregiver confirmed situation handled |
| `false_alarm` | Caregiver determined no actual event |

### Audit Actions

| Action | Description |
|--------|-------------|
| `created` | Alert created by rules engine |
| `severity_assigned` | Severity computed from alert type |
| `notified_sms` | SMS sent successfully |
| `notified_whatsapp` | WhatsApp sent successfully |
| `notified_push` | Push notification delivered |
| `notify_failed` | Provider returned error |
| `notify_queued` | Stub mode — logged but not sent |
| `escalated` | Escalation triggered (timeout or manual) |
| `acknowledged` | Caregiver acknowledged |
| `marked_false_alarm` | Caregiver marked false alarm |
| `resolved` | Caregiver resolved |
| `auto_resolved` | System auto-resolved MEDIUM alert |

### SSE Event Types

```typescript
type SseEvent =
  | { type: "alert"; alert: Alert }
  | { type: "alert_updated"; alert: Alert }
  | { type: "overview"; overview: OverviewSnapshot }
  | { type: "node_health"; node: NodeHealth };
```

### Error Response

```json
{ "error": "not_found", "detail": "Alert alt_unknown not found" }
```

| HTTP Code | Error | Meaning |
|-----------|-------|---------|
| 400 | `bad_request` | Malformed body or missing required field |
| 401 | `unauthorized` | Missing or invalid API token |
| 404 | `not_found` | Resource not found |
| 409 | `conflict` | Alert already in terminal state |
| 500 | `internal_error` | Unexpected server error |
