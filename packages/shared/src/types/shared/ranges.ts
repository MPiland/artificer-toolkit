/*
──────────────────────────────────────────────────────────────────────────────
RANGE — SPELL OR EFFECT RANGE
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines how far an effect can reach, measured in a specific unit
(e.g., 30 ft, Touch, Self, Unlimited).

Structure:
----------
• `id` — Stable system-wide ID.
• `label` — Display name (e.g. "Touch", "30 feet").
• `unitId` — FK to System measurement unit (e.g. feet, meters).
• `amount` — Optional numeric distance for ranged values.
*/
export interface Range {
  id: string
  minAmount: number | null // int
  maxAmount: number | null // int
  distance: number | null // int
  unitId: string | null
}
