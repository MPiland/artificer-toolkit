import type { Actions, Damage, Charge, Range, Shape, Prerequisite, SaveDc } from './shared'
import type { SubfeatureModifier } from './subfeatureModifiers'
import type { SubfeatureProficiency } from './subfeatureProficiencies'
import type { SubfeatureSense } from './subfeatureSenses'
import type { SubfeatureSpell } from './subfeatureSpells'
import type { SubfeatureExpertise } from './subfeatureExpertise'
import type { Feature } from './features'

/*
──────────────────────────────────────────────────────────────────────────────
FEAT export interface — PLAYER-SELECTABLE BONUS TRAITS
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Represents a self-contained game feature that a character can select
outside of their class or race progression — typically as a reward for
leveling up or meeting a prerequisite condition.

Each Feat can include the same mechanical structures as a Feature
(Modifiers, Spells, Senses, etc.), and may optionally grant additional
Features or Subfeatures.

Structure:
----------
• `label`, `description`, `detail` — Descriptive metadata and lore text.
• `categoryId` — FK to a System Option defining feat export interface/category (e.g. Combat, Skill, Magic).
• `attributeIds` — Behavioral attributes tagged for feats (e.g., "Repeatable", "Provides Options").
• `actions`, `damage`, `charges`, `range`, `shape`, `targets`, `saveDc`
  - Define the mechanical behavior of the feat if it grants an activatable ability.
• `modifiers`, `proficiencies`, `expertise`, `senses`, `spells`
  - Subfeatures the feat grants; use standard Feature subfeature types.
• `prerequisites`
  - Conditions that must be met to select the feat.
• `selectionCount`
  - How many selectable sub-options the feat provides (used with "Provides Options" attributes).
• `levelAvailable`
  - Optional field for specifying the minimum level when the feat becomes selectable.
• `features`
  - Optional nested Features that the feat directly grants (e.g., Magic Initiate’s spellcasting feature).
• `systemId` — Sets which ttrpg system this belongs to.
• `userId` — Sets the user that created the content if not master data.
• `masterId` — Used to determine is_master boolean column in table. If not null/empty, then false, else true.

Storage:
--------------
• Stored in `feats`.
• Each subfeature table uses bridges (`feat_subfeatureModifiers`, `feat_subfeatureSpells`, etc.).
• Aggregated in JSON via `vw_feats_agg`.

──────────────────────────────────────────────────────────────────────────────
*/
export interface Feat {
  id: string
  label: string
  description: string
  detail: string | null
  attributeIds: string[] | null
  actions: Actions | null
  damage: Damage | null
  charges: Charge | null
  range: Range | null
  shape: Shape | null
  targets: number | null // int
  modifiers: SubfeatureModifier[] | null
  proficiencies: SubfeatureProficiency[] | null
  expertise: SubfeatureExpertise[] | null
  senses: SubfeatureSense[] | null
  spells: SubfeatureSpell[] | null
  prerequisites: Prerequisite[] | null
  saveDc: SaveDc | null
  selectionCount: number | null // int
  levelAvailable: string | null
  features: Feature[] | null
  userId: string
  systemId: string
}

export interface FeatListItem {
  id: string
  label: string
  description: string
  detail: string | null
  systemId: string
  userId: string
}

type FeatMetaObject = {
  id: string
  featIds: string[]
}

export interface FeatMeta {
  features: FeatMetaObject[]
}
