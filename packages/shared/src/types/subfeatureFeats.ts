import type { Prerequisite } from './shared'

/*
──────────────────────────────────────────────────────────────────────────────
SUBFEATURE FEAT export interface — FEAT GRANT OR SELECTION DEFINITIONS
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines how a Feature (or Subfeature) grants or allows the selection of Feats
to a character. This export interface is used for cases such as:
- A Class feature that lets the player choose a Feat (e.g., Fighter’s bonus feat)
- A Race or Background that automatically grants one or more Feats
- A magic item that bestows a specific Feat

Behavior Conventions:
---------------------
Behavior is controlled by `attributeIds` following the shared **Choice Array
Convention**:

| Attributes            | featIds State | Behavior                            |
|-----------------------|---------------|-------------------------------------|
| none                  | [IDs]         | Grants those specific Feats         |
| Provides Options      | [IDs]         | Player may select from that subset  |
| All Options           | (omitted/any) | Automatically grants all eligible Feats |
| Provides + All Options| (any)         | Player may select from *any Feat*   |

Structure:
----------
• `attributeIds`: Flags controlling behavior (e.g. Provides Options, All Options)
• `featIds`: Specific Feat IDs granted or selectable (may be omitted for All Options)
• `selectionCount`: How many Feats the player may choose if options are provided
• `subtypeId`: Optional FK for subclass or subtype context
• `prerequisites`: List of rule conditions gating access to these Feats

Storage:
--------
• Stored in the `subfeatureFeats` table.
• Aggregated into JSON via `vw_subfeatureFeats_agg`.
• One row per feature → aggregated into array on parent entity.

──────────────────────────────────────────────────────────────────────────────
*/
export interface SubfeatureFeat {
  id: string
  attributeIds: string[] | null
  featIds: string[]
  selectionCount: number | null // int
  subtypeId: string | null
  prerequisites: Prerequisite[] | null
  position: number | null // int
}
