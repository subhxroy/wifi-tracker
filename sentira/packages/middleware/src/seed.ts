/**
 * Seed data — the demo residents + caregivers the system boots with.
 *
 * In production these live in Firestore; locally they're hydrated into the
 * in-memory store on first boot. The nodeIds match what mock-ruview publishes.
 */

import type { EscalationContact, Resident } from "@sentira/types";

const DEFAULT_THRESHOLDS = {
  fallConfirmWindowSec: 20,
  inactivityDaySec: 7200,
  inactivityNightSec: 28800,
  dayWindow: ["07:00", "22:00"] as [string, string],
  breathingRange: [12, 22] as [number, number],
  heartRateRange: [55, 100] as [number, number],
  vitalsAnomalyWindowSec: 300,
};

function caregiver(partial: Partial<EscalationContact> & { id: string; name: string; role: string }): EscalationContact {
  return { pushTokens: [], ...partial };
}

export function seedResidents(): Resident[] {
  const now = Date.now();
  return [
    {
      id: "res_alice",
      name: "Alice Whitfield",
      room: "Room A",
      nodeIds: ["wifi_densepose_a"],
      thresholds: DEFAULT_THRESHOLDS,
      escalationChain: [
        caregiver({ id: "cg_priya", name: "Priya (primary nurse)", role: "RN", phone: "+15550000001", whatsapp: "whatsapp:+15550000001" }),
        caregiver({ id: "cg_marcus", name: "Marcus (secondary)", role: "Care Aide", phone: "+15550000002" }),
      ],
      notificationChannels: { sms: true, whatsapp: true, push: true },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "res_boris",
      name: "Boris Khan",
      room: "Room B",
      nodeIds: ["wifi_densepose_b"],
      thresholds: DEFAULT_THRESHOLDS,
      escalationChain: [
        caregiver({ id: "cg_dana", name: "Dana (primary nurse)", role: "RN", phone: "+15550000003" }),
        caregiver({ id: "cg_marcus", name: "Marcus (secondary)", role: "Care Aide", phone: "+15550000002" }),
      ],
      notificationChannels: { sms: true, whatsapp: false, push: true },
      createdAt: now,
      updatedAt: now,
    },
  ];
}
