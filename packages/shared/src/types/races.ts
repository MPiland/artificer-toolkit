import type { Feature } from './features'
import type { Detail, Speed } from './shared'

/*
──────────────────────────────────────────────────────────────────────────────
RACE TRAITS — PHYSICAL & MOVEMENT ATTRIBUTES
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Encapsulates physical and physiological characteristics of a race.
Includes base size, movement speeds, and optional descriptive traits.

Structure:
----------
• `details` — Narrative or non-mechanical entries (e.g., lifespan).
• `sizeId` — FK to System Option (Small, Medium, Large, etc.).
• `speeds` — One or more movement definitions (e.g., walking, swimming).
*/
export interface RaceTraits {
  details: Detail[] | null
  sizeId: string
  speeds: Speed[]
}

/*
──────────────────────────────────────────────────────────────────────────────
RACE ANCESTRY — DRACONIC OR ELEMENTAL HERITAGE
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Supports races that offer modular choice-based heritages such as
Dragonborn’s Draconic Ancestry. Each ancestry defines multiple
options, each with its own granted Features.

Structure:
----------
• `label`, `description` — Name and lore summary of the ancestry group.
• `options` — List of ancestry choices, each with its own Features.
*/
export interface RaceAncestry {
  label: string
  description: string | null
  options: RaceAncestryOption[]
}

/*
──────────────────────────────────────────────────────────────────────────────
RACE ANCESTRY OPTION — INDIVIDUAL CHOICE
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Represents a selectable ancestry option such as “Red Dragon Ancestry”
or “Blue Dragon Ancestry,” each defining its own Feature grants.

Structure:
----------
• `label`, `description` — Display info for UI and lore.
• `features` — Features granted when this option is selected.
• `userId`, `systemId`, `masterId` — Metadata for versioning and ownership.
*/
export interface RaceAncestryOption {
  id: string
  label: string
  description: string
  position: number // int
  features: Feature[] | null
}

/*
──────────────────────────────────────────────────────────────────────────────
RACE export interface — BASE, SUBRACE, VARIANT, & HYBRID SPECIES
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines all playable and non-playable species (races) within a game system.
Races may represent:
• **Base Races** — self-contained, independent species.
• **Subraces** — inherit and extend a base race’s features.
• **Variants** — inherit but replace specific parent features.
• **Hybrids** — standalone mixed-heritage species (e.g., Half-Elf, Half-Orc).

Races can grant Features, contain Trait data (size, speed, details), and
optionally link to modular Ancestries for choice-driven systems such as
Draconic Ancestry.

Structure:
----------
• `label`, `quote`, `description` — Descriptive and flavor information.
• `categoryId` — FK to a System Option defining the race category
  ("Base", "Subrace", "Variant", "Hybrid").
• `lineageIds` — Optional cross-lineage references for narrative or hybrid lore.
• `ancestryId` — FK to an ancestry definition (e.g., Draconic Ancestry).
• `details` — Supplementary information like height, lifespan, etc.
• `traits` — Encapsulates physical attributes such as size and speed.
• `features` — Mechanical effects the race grants.
• `replacesFeatureIds` — Defines parent features replaced by a variant or subrace.
• `systemId` — Sets which ttrpg system this belongs to.
• `userId` — Sets the user that created the content if not master data.
• `masterId` — Used to determine is_master boolean column in table. If not null/empty, then false, else true.

Inheritance Behavior:
---------------------
| Category | Inheritance | Notes |
|-----------|--------------|-------|
| Base | None | Fully self-contained. |
| Subrace | Inherits + Adds | Merges parent and subrace features. |
| Variant | Inherits + Replaces | Removes replaced features, adds new ones. |
| Hybrid | None | Independent species with lineage references only. |

Store:
--------------
• Stored in `races`.
• Linked subrecords:
  - `race_traits` → size, speeds, details.
  - `race_ancestries` → ancestry group definitions.
  - `race_ancestry_options` → selectable ancestry features.
• Aggregated in JSON via `vw_races_agg`.

──────────────────────────────────────────────────────────────────────────────
*/
export interface Race {
  id: string
  label: string
  quote: string | null
  description: string | null
  playable: string
  categoryId: string
  parentRaceId: string | null
  ancestry: RaceAncestry
  traits: RaceTraits | null
  features: Feature[] | null
  userId: string
  systemId: string
}

export interface RaceListItem {
  id: string
  label: string
  quote: string | null
  description: string
  details: Detail[] | null
  userId: string
  systemId: string
}

type RaceMetaObject = {
  raceIds: string[]
  id: string
}

export interface RaceMeta {
  categories: RaceMetaObject[]
  playable: RaceMetaObject[]
  lineages: RaceMetaObject[]
  features: RaceMetaObject[]
}
