import type { Prerequisite } from './shared'

/*
──────────────────────────────────────────────────────────────────────────────
SUBFEATURE SENSE export interface — GRANTED SENSES & SELECTION LOGIC
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines sensory traits that a Feature, Feat, Race, or Class grants to a
character — such as Darkvision, Tremorsense, Blindsight, or Truesight.
This subfeature governs what senses are gained directly or optionally
offered for selection.

Behavioral Attributes (`attributeIds`):
---------------------------------------
Each value in `attributeIds` references a `SystemAttribute` tagged with
`FEATURE_SENSES`. These attributes describe *how* the senses are provided.

Common examples include:
• **Provides Options** — Player can choose one or more senses from the system’s list.
• **All Options** — Automatically grants all available senses.
• **Replace Options at Level** — Optional dynamic behavior for scaling features.

These control UI and engine behavior but don’t define what senses exist.

Structure:
----------
• `attributeIds` — Behavioral flags dictating how the feature behaves in
  the builder or engine (e.g., “Provides Options”, “All Options”).
• `selectionCount` — The number of senses a player may select when
  “Provides Options” applies.
• `subtypeId` — Optional link to subclass or subfeature origin (used for
  features tied to specific class paths).
• `senseIds` — Direct grants of system-defined senses. May contain the
  sentinel value `"all"` when `Grants All` applies.
• `prerequisites` — Conditional logic determining eligibility, usually
  unused in standard 5e content but reserved for extensibility.

Usage Examples:
---------------
• A Dwarf feature grants **Darkvision** automatically:
  - `senseIds`: ["darkvision"]
  - no `Provides Options` attribute required.

• A custom homebrew race grants a choice of **one** sense:
  - `attributeIds`: ["Provides Options"]
  - `selectionCount`: 1
  - `senseIds`: ["darkvision", "tremorsense", "blindsight"]

• A class feature that grants **all** senses defined by the system:
  - `attributeIds`: ["Grants All"]
  - `senseIds`: ["all"]

Storage:
--------
• Stored in the `subfeatureSenses` table.
• Aggregated into JSON via `vw_subfeatureSenses_agg`.
• One row per feature → aggregated into array on parent entity.

──────────────────────────────────────────────────────────────────────────────
*/
export interface SubfeatureSense {
  id: string
  subtypeId: string | null
  attributeIds: string[] | null
  selectionCount: number | null // int
  senseIds: string[] | null
  prerequisites: Prerequisite[] | null
  position: number | null // int
}
