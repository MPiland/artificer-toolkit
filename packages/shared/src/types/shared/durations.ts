/*
──────────────────────────────────────────────────────────────────────────────
DURATION — HOW LONG AN EFFECT LASTS
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Specifies how long a spell, effect, or condition remains active.

Structure:
----------
• `id` — Stable system-wide ID.
• `label` — Descriptive duration (e.g. "1 minute", "Instantaneous").
• `amount` — Optional numeric length (for consistent sorting/scaling).
• `unitId` — FK to System measurement unit (e.g., second, minute, hour).
• `concentration` — Whether it requires concentration.
*/
export interface Duration {
  id: string
  amount: number | null // int
}
