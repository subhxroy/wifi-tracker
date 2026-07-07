/**
 * Twilio provider — sends SMS and WhatsApp via the Twilio REST API.
 *
 * When TWILIO_* env vars are absent this provider runs in STUB mode: it logs
 * the would-be send and resolves successfully, so the rest of the alerting
 * pipeline (state machine, audit log, dashboard) exercises end-to-end without
 * a Twilio account.
 */

import type { Alert, EscalationContact } from "@sentira/types";
import { logger } from "../logger.js";

export interface SendResult {
  channel: "sms" | "whatsapp" | "push";
  to: string;
  ok: boolean;
  messageId?: string;
  error?: string;
  stubbed: boolean;
}

export interface TwilioConfig {
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
  whatsappFrom?: string;
}

export class TwilioProvider {
  readonly configured: boolean;
  private readonly baseUrl: string;

  constructor(private readonly cfg: TwilioConfig) {
    this.configured = Boolean(cfg.accountSid && cfg.authToken && cfg.fromNumber);
    this.baseUrl = cfg.accountSid ? `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json` : "";
  }

  async sendSms(to: string, body: string): Promise<SendResult> {
    if (!this.configured || !this.cfg.fromNumber) return stub("sms", to, body);
    return this.post({ To: to, From: this.cfg.fromNumber, Body: body }, "sms", to);
  }

  async sendWhatsapp(to: string, body: string): Promise<SendResult> {
    if (!this.configured || !this.cfg.whatsappFrom) return stub("whatsapp", to, body);
    return this.post(
      { To: `whatsapp:${to.replace(/^whatsapp:/, "")}`, From: this.cfg.whatsappFrom, Body: body },
      "whatsapp",
      to,
    );
  }

  private async post(form: Record<string, string>, channel: "sms" | "whatsapp", to: string): Promise<SendResult> {
    try {
      const auth = Buffer.from(`${this.cfg.accountSid}:${this.cfg.authToken}`).toString("base64");
      const body = new URLSearchParams(form).toString();
      const res = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      if (!res.ok) {
        const text = await res.text();
        return { channel, to, ok: false, error: `HTTP ${res.status}: ${text}`, stubbed: false };
      }
      const json = (await res.json()) as { sid?: string };
      return { channel, to, ok: true, messageId: json.sid, stubbed: false };
    } catch (err) {
      return { channel, to, ok: false, error: (err as Error).message, stubbed: false };
    }
  }
}

function stub(channel: SendResult["channel"], to: string, body: string): SendResult {
  logger.info({ channel, to, body }, "[stub] would send message (no Twilio credentials)");
  return { channel, to, ok: true, stubbed: true, messageId: `stub_${channel}_${Date.now()}` };
}

/** Build the human-facing message body for an alert. */
export function alertBody(alert: Alert, residentName: string): string {
  const head = `Sentira alert (${alert.severity})`;
  const tail = `— Acknowledge in the dashboard. Reply not monitored.`;
  return `${head}: ${alert.message} ${tail} [resident: ${residentName}, room: ${alert.room}]`;
}

export function contactsForAlert(alert: Alert, chain: EscalationContact[]): EscalationContact[] {
  // Escalation round 0 → primary contact; later rounds add the secondary.
  const round = alert.escalationCount;
  if (round === 0) return chain.slice(0, 1);
  return chain.slice(0, Math.min(chain.length, round + 1));
}
