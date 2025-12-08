/*
──────────────────────────────────────────────────────────────────────────────
CHARGE export interface — USAGE LIMITS AND RESET RULES
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Represents how many times a non-spell Feature, Feat, or Equipment ability can
be used and when those uses refresh.

Each parent (Feature, Feat, Equipment, etc.) can have at most one Charge object.

Behavior:
---------
• The `limitId` references a SystemCharge "limit" definition, which determines
  how the number of uses is calculated (Proficiency, Ability Modifier,
  Set Amount, Uses Per Level, Resource Points, etc.).

• The `resetId` references a SystemCharge "reset" definition, which determines
  when those uses refresh (Short Rest, Long Rest, Manual, None).

• Only one limit export interface is active per Charge; the fields used depend on that export interface.

Calculation Fields:
-------------------
• `setAmount` — fixed number of uses if the limit export interface is "Set Amount".
• `usesPerLevel` — explicit level→uses table for "Uses Per Level".
• `abilityId` — ability used for "Ability Modifier" limits.
• `multiplier` / `addAmount` / `minAmount` — optional modifiers applied to the
  calculated number of uses (e.g., prof × 2 + 1, min 1).
• `currentPoints` — pool size if the limit draws from a shared resource system.

Storage:
--------
• Stored in the `charges` table (one per parent entity).
• `charge_limits` and `charge_resets` tables link to system options by string.
• Aggregated into JSON through `vw_charges_agg`.

Evaluation:
-----------
• Character engine interprets the active limit export interface and computes total uses.
• When the character takes a rest, any Charge with a matching reset export interface is
  refreshed automatically.

──────────────────────────────────────────────────────────────────────────────
*/
export interface UsesPerLevel {
  level: number // int
  uses: number // int
}

export interface Charge {
  id: string
  resetId: string | null
  limitId: string | null
  abilityId: string | null
  usesPerLevel: UsesPerLevel[] | null
  minAmount: number | null // int
  addAmount: number | null // int
  setAmount: number | null // int
  multiplier: number | null // int
}
