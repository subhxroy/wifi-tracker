/**
 * FCM provider — sends push notifications via Firebase Cloud Messaging.
 *
 * Stub mode when FCM_SERVICE_ACCOUNT_PATH is unset: logs and resolves ok.
 */

import { existsSync, readFileSync } from "node:fs";
import type { Alert } from "@sentira/types";
import { logger } from "../logger.js";
import type { SendResult } from "./twilio.js";

export interface FcmConfig {
  serviceAccountPath?: string;
}

interface ServiceAccount {
  clientEmail: string;
  privateKey: string;
  projectId: string;
}

export class FcmProvider {
  readonly configured: boolean;
  private sa: ServiceAccount | null = null;

  constructor(private readonly cfg: FcmConfig) {
    if (cfg.serviceAccountPath && existsSync(cfg.serviceAccountPath)) {
      try {
        const raw = readFileSync(cfg.serviceAccountPath, "utf8");
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        this.sa = {
          clientEmail: String(parsed.client_email ?? ""),
          privateKey: String(parsed.private_key ?? ""),
          projectId: String(parsed.project_id ?? ""),
        };
        this.configured = Boolean(this.sa.projectId);
      } catch (err) {
        logger.warn({ err }, "FCM service account parse failed; falling back to stub");
        this.configured = false;
      }
    } else {
      this.configured = false;
    }
  }

  /**
   * Send push to one or more device tokens. Uses the FCM v1 HTTP API via an
   * OAuth2 access token minted from the service account (self-contained —
   * no admin-sdk dependency).
   */
  async send(tokens: string[], alert: Alert, residentName: string): Promise<SendResult[]> {
    if (!this.configured || tokens.length === 0) {
      const body = alert.message;
      logger.info({ tokens, body }, "[stub] would push (no FCM credentials)");
      return tokens.map((to) => ({ channel: "push", to, ok: true, stubbed: true, messageId: `stub_push_${Date.now()}` }));
    }
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return tokens.map((to) => ({ channel: "push", to, ok: false, error: "no access token", stubbed: false }));
    }
    const url = `https://fcm.googleapis.com/v1/projects/${this.sa!.projectId}/messages:send`;
    const results: SendResult[] = [];
    for (const token of tokens) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: `Sentira — ${alert.severity}`, body: alert.message },
              data: { alertId: alert.id, residentId: alert.residentId, residentName, type: alert.type, severity: alert.severity },
            },
          }),
        });
        if (!res.ok) {
          results.push({ channel: "push", to: token, ok: false, error: `HTTP ${res.status}`, stubbed: false });
        } else {
          const json = (await res.json()) as { name?: string };
          results.push({ channel: "push", to: token, ok: true, messageId: json.name, stubbed: false });
        }
      } catch (err) {
        results.push({ channel: "push", to: token, ok: false, error: (err as Error).message, stubbed: false });
      }
    }
    return results;
  }

  private cachedToken: { value: string; expiresAt: number } | null = null;
  private async getAccessToken(): Promise<string | null> {
    if (!this.sa) return null;
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
      return this.cachedToken.value;
    }
    try {
      const now = Math.floor(Date.now() / 1000);
      const claim = {
        iss: this.sa.clientEmail,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
      };
      const jwt = await signJwtRs256(claim, this.sa.privateKey);
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: jwt,
        }).toString(),
      });
      if (!res.ok) return null;
      const tok = (await res.json()) as { access_token: string };
      this.cachedToken = { value: tok.access_token, expiresAt: (now + 3600) * 1000 };
      return tok.access_token;
    } catch {
      return null;
    }
  }
}

/** Minimal RS256 JWT signer (avoids a google-auth dependency for v1 dev). */
async function signJwtRs256(payload: Record<string, number | string>, pemKey: string): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const input = `${enc(header)}.${enc(payload)}`;
  // Import the PEM private key and sign.
  const normalizedKey = pemKey.replace(/\\n/g, "\n");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(normalizedKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(input));
  return `${input}.${Buffer.from(new Uint8Array(sig)).toString("base64url")}`;
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = Buffer.from(b64, "base64");
  return bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
}
