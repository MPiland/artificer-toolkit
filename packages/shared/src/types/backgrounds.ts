/*
──────────────────────────────────────────────────────────────────────────────
BACKGROUND export interface — CHARACTER ORIGIN & STARTING PACKAGE
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Represents a character’s origin, upbringing, or pre-adventuring experience.
Backgrounds grant proficiencies, starting equipment, and one or more
unique features, defining non-class aspects of a character’s identity.

Structure:
----------
• `label` / `description`
  - Core display information for selection screens and export.
  - `label` is the visible name of the background.
  - `description` provides flavor text or thematic context.

• `details`
  - Freeform descriptive entries such as “Suggested Characteristics,”
    “Personality Traits,” or “Origin Notes.”
  - Each detail record uses the shared `Detail` export interface for flexible
    labeling and display control.

• `equipment`
  - References a `StartingEquipment` record defining the possible loadouts
    granted by the background. This includes multiple sets, groups, and options
    that determine what items or currencies the character begins with.

• `proficiencies`
  - Grants the character skill or tool proficiencies associated with
    the background.
  - Uses the same `SubfeatureProficiency` export interface as Class features for schema
    and ETL consistency.
  - Supports attributes such as “Provides Options” or “All Options” for
    user customization in the builder.

• `features`
  - A background may grant one or more special features (e.g., *Criminal Contact*,
    *Researcher*, *Rustic Hospitality*). Each uses the full `Feature` export interface,
    allowing them to contain nested options, proficiencies, or modifiers.

• `userId`, `systemId`, `masterId`
  - Standard relational identifiers.
• `systemId` — Sets which ttrpg system this belongs to.
• `userId` — Sets the user that created the content if not master data.
• `masterId` — Used to determine is_master boolean column in table. If not null/empty, then false, else true.

Behavior:
---------
• Backgrounds are selectable during character creation.
• Granted features and proficiencies merge into the character’s base profile.
• Equipment loadouts are handled via the `StartingEquipment` tree and can
  include gold, items, or category-limited choices.

Storage:
--------
• Stored in `backgrounds`.
• Nested feature data stored in `features` and connected with bridges (`background_features`).
• Proficiency data stores in `subfeatureProficiencies` and connected with bridges (`background_subfeatureProficiencies`).
• Aggregated into JSON through `vw_backgrounds_agg`.

──────────────────────────────────────────────────────────────────────────────
*/

import type { Feature } from './features'
import type { Detail, StartingEquipment } from './shared'
import type { SubfeatureProficiency } from './subfeatureProficiencies'

export interface Background {
  id: string
  label: string
  description: string | null
  details: Detail[] | null
  equipment: StartingEquipment | null
  proficiencies: SubfeatureProficiency[] | null
  features: Feature[] | null
  userId: string
  systemId: string
}

export interface BackgroundListItem {
  id: string
  label: string
  description: string | null
  details: Detail[] | null
  userId: string
  systemId: string
}

type BackgroundMetaObject = {
  id: string
  backgroundIds: string[]
}

export interface BackgroundMeta {
  features: BackgroundMetaObject[]
}
