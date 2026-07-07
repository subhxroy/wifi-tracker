const MIDDLEWARE_URL = process.env.NEXT_PUBLIC_MIDDLEWARE_URL ?? "http://127.0.0.1:4400";
const API_TOKEN = process.env.NEXT_PUBLIC_MIDDLEWARE_TOKEN ?? "";

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (API_TOKEN) h["Authorization"] = `Bearer ${API_TOKEN}`;
  return h;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...headers(), ...init?.headers } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function getOverview() {
  return fetchJson<import("@sentira/types").OverviewSnapshot>(`${MIDDLEWARE_URL}/api/overview`);
}

export async function getResidents() {
  return fetchJson<import("@sentira/types").Resident[]>(`${MIDDLEWARE_URL}/api/residents`);
}

export async function getResidentDetail(id: string) {
  return fetchJson<{ resident: import("@sentira/types").Resident; nodes: import("@sentira/types").NodeHealth[]; recentAlerts: import("@sentira/types").Alert[] }>(`${MIDDLEWARE_URL}/api/residents/${id}`);
}

export async function updateResident(id: string, patch: Partial<import("@sentira/types").Resident>) {
  return fetchJson<import("@sentira/types").Resident>(`${MIDDLEWARE_URL}/api/residents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function getAlerts(params?: { residentId?: string; includeResolved?: boolean; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.residentId) q.set("residentId", params.residentId);
  if (params?.includeResolved) q.set("includeResolved", "true");
  if (params?.limit) q.set("limit", String(params.limit));
  return fetchJson<import("@sentira/types").Alert[]>(`${MIDDLEWARE_URL}/api/alerts?${q}`);
}

export async function getAlert(id: string) {
  return fetchJson<import("@sentira/types").Alert>(`${MIDDLEWARE_URL}/api/alerts/${id}`);
}

export async function acknowledgeAlert(id: string, caregiverId = "dashboard_user") {
  return fetchJson<import("@sentira/types").Alert>(`${MIDDLEWARE_URL}/api/alerts/${id}/acknowledge`, {
    method: "POST",
    body: JSON.stringify({ caregiverId }),
  });
}

export async function escalateAlert(id: string) {
  return fetchJson<import("@sentira/types").Alert>(`${MIDDLEWARE_URL}/api/alerts/${id}/escalate`, {
    method: "POST",
  });
}

export async function markFalseAlarm(id: string, caregiverId = "dashboard_user") {
  return fetchJson<import("@sentira/types").Alert>(`${MIDDLEWARE_URL}/api/alerts/${id}/false-alarm`, {
    method: "POST",
    body: JSON.stringify({ caregiverId }),
  });
}

export async function resolveAlert(id: string, caregiverId = "dashboard_user") {
  return fetchJson<import("@sentira/types").Alert>(`${MIDDLEWARE_URL}/api/alerts/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ caregiverId }),
  });
}

export async function getNodes() {
  return fetchJson<import("@sentira/types").NodeHealth[]>(`${MIDDLEWARE_URL}/api/nodes`);
}

export function sseUrl(): string {
  return `${MIDDLEWARE_URL}/api/events`;
}
