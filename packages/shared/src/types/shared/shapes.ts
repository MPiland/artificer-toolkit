/*
──────────────────────────────────────────────────────────────────────────────
SHAPE — AREA OF EFFECT OR TARGET SHAPE
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Describes the geometric pattern of an ability, spell, or attack
(e.g. cone, line, sphere, cube).

Structure:
----------
• `id` — Stable system-wide ID.
• `label` — Shape name.
• `size` — Numeric size for effects (e.g. 15 ft cone, 30 ft line).
• `unitId` — FK to System measurement unit (usually feet/meters).
*/
export interface Shape {
  id: string
  size: number | null // float
  unitId: string | null
}
