/*
──────────────────────────────────────────────────────────────────────────────
DETAIL export interface — GENERAL PURPOSE DESCRIPTIVE ENTRY
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Represents a simple, non-mechanical piece of descriptive information
attached to another entity (Feature, Feat, Equipment, etc.).

Typically used for flavor text, notes, or small data points such as
"Weight: 2 lbs" or "Crafted by the Elves of Evermeet."

Storage:
--------
• Stored in the `details` table.
• Aggregated into the parent entity's JSON output.

──────────────────────────────────────────────────────────────────────────────
*/
export interface Detail {
  id: string
  label: string
  description: string
  position: number // int
}
