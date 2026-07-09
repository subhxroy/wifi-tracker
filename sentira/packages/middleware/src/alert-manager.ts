/**
 * Alert manager — owns the alert lifecycle.
 *
 *   pending → active → acknowledged → resolved
 *                      ↘ escalated (after escalationTimeout; still active)
 *
 * Severity drives channel selection:
 *   HIGH:   SMS + WhatsApp + push, in parallel.
 *   MEDIUM: push + dashboard only (no SMS — anti alert-fatigue, per spec §1).
 *
 * Escalation: unacknowledged HIGH alerts re-notify + add the secondary contact
 * after escalationTimeoutSec.
 *
 * Offline resilience: failed sends are queued and retried (Milestone-7 design,
 * built in from day 1).
 */

import type { Alert, AuditAction } from "@sentira/types";
import type { MiddlewareConfig } from "./config.js";
import { logger } from "./logger.js";
import type { Store } from "./store.js";
import { FcmProvider } from "./providers/fcm.js";
import { TwilioProvider, alertBody, contactsForAlert } from "./providers/twilio.js";
import { withAudit } from "./rules.js";

export class AlertManager {
  private twilio: TwilioProvider;
  private fcm: FcmProvider;
  private escalationTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly store: Store,
    private readonly cfg: MiddlewareConfig,
  ) {
    this.twilio = new TwilioProvider(cfg.providers.twilio);
    this.fcm = new FcmProvider(cfg.providers.fcm);
  }

  /** Called by the rules engine when a fresh candidate is produced. */
  async create(candidate: Parameters<Store["createAlert"]>[0]): Promise<Alert> {
    const alert = this.store.createAlert(candidate);
    await this.dispatch(alert);
    this.scheduleEscalation(alert);
    return alert;
  }

  /** Send notifications for an alert, choosing channels by severity. */
  async dispatch(alert: Alert): Promise<void> {
    const resident = this.store.getResident(alert.residentId);
    if (!resident) return;
    const contacts = contactsForAlert(alert, resident.escalationChain);
    const body = alertBody(alert, resident.name);
    const actions: Array<{ action: AuditAction; channel: string }> = [];

    for (const contact of contacts) {
      // HIGH → all channels; MEDIUM → push + dashboard only.
      if (alert.severity === "HIGH") {
        if (resident.notificationChannels.sms && contact.phone) {
          const r = await this.twilio.sendSms(contact.phone, body);
          actions.push({ action: r.ok ? "notified_sms" : r.stubbed ? "notify_queued" : "notify_failed", channel: `sms→${contact.phone}` });
        }
        if (resident.notificationChannels.whatsapp && contact.whatsapp) {
          const r = await this.twilio.sendWhatsapp(contact.whatsapp, body);
          actions.push({ action: r.ok ? "notified_whatsapp" : r.stubbed ? "notify_queued" : "notify_failed", channel: `whatsapp→${contact.whatsapp}` });
        }
      }
      if (resident.notificationChannels.push && contact.pushTokens.length > 0) {
        const results = await this.fcm.send(contact.pushTokens, alert, resident.name);
        for (const r of results) {
          actions.push({ action: r.ok ? "notified_push" : r.stubbed ? "notify_queued" : "notify_failed", channel: `push→${r.to}` });
        }
      }
    }

    this.store.updateAlert(alert.id, (a) => {
      let next = a;
      for (const act of actions) {
        next = withAudit(next, { action: act.action, actor: "system", detail: act.channel });
      }
      return next;
    });
  }

  /** Escalate an unacknowledged HIGH alert. */
  async escalate(alertId: string): Promise<void> {
    const alert = this.store.getAlert(alertId);
    if (!alert) return;
    if (alert.status === "acknowledged" || alert.status === "resolved" || alert.status === "false_alarm") return;

    this.store.updateAlert(alertId, (a) =>
      withAudit({ ...a, status: "escalated", escalationCount: a.escalationCount + 1 }, {
        action: "escalated",
        actor: "system",
        detail: `Unacknowledged for ${this.cfg.thresholds.escalationTimeoutSec}s — notifying next contact.`,
      }),
    );
    const escalated = this.store.getAlert(alertId)!;
    await this.dispatch(escalated);
    this.scheduleEscalation(escalated);
  }

  private scheduleEscalation(alert: Alert): void {
    // Only HIGH alerts escalate. MEDIUM alerts don't page.
    if (alert.severity !== "HIGH") return;
    const existing = this.escalationTimers.get(alert.id);
    if (existing) clearTimeout(existing);
    const ms = this.cfg.thresholds.escalationTimeoutSec * 1000;
    const timer = setTimeout(() => {
      this.escalationTimers.delete(alert.id);
      void this.escalate(alert.id);
    }, ms);
    this.escalationTimers.set(alert.id, timer);
  }

  // --- caregiver actions ---
  acknowledge(alertId: string, caregiverId: string): Alert | undefined {
    this.clearTimer(alertId);
    return this.store.updateAlert(alertId, (a) =>
      withAudit({ ...a, status: "acknowledged", acknowledgedAt: Date.now(), acknowledgedBy: caregiverId }, {
        action: "acknowledged",
        actor: caregiverId,
      }),
    );
  }

  markFalseAlarm(alertId: string, caregiverId: string): Alert | undefined {
    this.clearTimer(alertId);
    return this.store.updateAlert(alertId, (a) =>
      withAudit({ ...a, status: "false_alarm", resolvedAt: Date.now(), acknowledgedAt: a.acknowledgedAt ?? Date.now(), acknowledgedBy: a.acknowledgedBy ?? caregiverId }, {
        action: "marked_false_alarm",
        actor: caregiverId,
        detail: "Caregiver marked this as a false alarm — feeds threshold tuning.",
      }),
    );
  }

  resolve(alertId: string, caregiverId: string): Alert | undefined {
    this.clearTimer(alertId);
    return this.store.updateAlert(alertId, (a) =>
      withAudit({ ...a, status: "resolved", resolvedAt: Date.now() }, { action: "resolved", actor: caregiverId }),
    );
  }

  private clearTimer(alertId: string): void {
    const t = this.escalationTimers.get(alertId);
    if (t) {
      clearTimeout(t);
      this.escalationTimers.delete(alertId);
    }
  }

  /** Auto-resolve MEDIUM alerts when their underlying condition clears. */
  maybeAutoResolve(alertId: string, reason: string): void {
    const alert = this.store.getAlert(alertId);
    if (!alert || alert.status === "resolved" || alert.status === "false_alarm") return;
    if (alert.severity !== "MEDIUM") return;
    this.clearTimer(alertId);
    this.store.updateAlert(alertId, (a) =>
      withAudit({ ...a, status: "resolved", resolvedAt: Date.now() }, { action: "auto_resolved", actor: "system", detail: reason }),
    );
  }
}
