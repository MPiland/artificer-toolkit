import type { Feature } from './features'
import type { Damage, Prerequisite, SaveDc, Speed, Range } from './shared'

/*
──────────────────────────────────────────────────────────────────────────────
EQUIPMENT SUPPORTING TYPES — VALUE, RANGE, CONTAINMENT, MEASUREMENT
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines supporting structures shared across Equipment items for measurement,
cost, containment, and other item-level metadata.

Structure:
----------
• `Cost` — Monetary value using system-defined currencies.
• `Weight` — Physical mass for encumbrance.
• `Capacity` — Carrying limit for containers or mounts.
• `Speed` — Movement rate for vehicles or living mounts.
• `Range` — Effective range for ranged weapons.
• `Contains` — Items included inside (e.g., bundles, packs, cases).
──────────────────────────────────────────────────────────────────────────────
*/

/** Item weight for encumbrance or transport calculations */
export interface Weight {
  amount: number // float — item weight
  unitId: string // FK → system_measurements.weight
}

/** Capacity limit (used for containers, vehicles, etc.) */
export interface Capacity {
  amount: number // float — maximum storable weight or volume
  unitId: string // FK → system_measurements.weight or volume
}

/** Item cost in the system’s currency registry */
export interface Cost {
  amount: number // int — numeric price
  currencyId: string // FK → system_currencies.id
}

/** Nested item container or bundle definition */
export interface Contains {
  equipmentId: string // FK → Equipment.id (contained item)
  quantity: number // int — quantity of that item contained
}

/*
──────────────────────────────────────────────────────────────────────────────
EQUIPMENT TYPE — WEAPONS, ARMOR, TOOLS, GEAR, AND MAGIC ITEMS
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines any tangible item a character can own, equip, or use — including
mundane gear, armor, weapons, tools, magic items, and containers.

The Equipment type provides a unified structure for all item categories,
allowing them to share attributes (weight, cost, rarity, etc.) while also
supporting category-specific mechanics such as damage, armor class, or
capacity.

Structure:
----------
• `label`, `description`, `quote` — Descriptive information and flavor text.
• `cost`, `weight`, `capacity` — Basic physical and economic attributes.
• `maxStack` — Max identical items per stack in inventory.
• `categoryId` — FK to a System Option defining equipment type (Weapon, Armor, etc.).
• `rarityId` — FK to a System Option defining rarity (Common, Rare, Legendary).
• `propertyIds` — Properties describing item mechanics (e.g., Finesse, Heavy, Versatile).
• `attributeIds` — Tags or special flags that influence item behavior or filtering.
• `damage`, `saveDc` — Offensive or magical mechanical definitions.
• `primaryAbilityId`, `secondaryAbilityId`, `optionalAbilityId` — Ability references for attack or save scaling.
• `maxBonus` — Highest possible enhancement modifier (e.g., +3).
• `armorClass` — Base armor class value for wearable gear.
• `prerequisites` — Requirements for usage (e.g., class, proficiency, level).
• `speed`, `range` — Used by vehicles, mounts, or ranged weapons.
• `contains` — Defines items included within (bundles, containers, packs).
• `features` — Features granted when this equipment is owned or attuned.
• `userId`, `systemId`, `masterId` — Metadata for ownership and master linkage.

Behavior:
---------
• **Category-Driven Logic**:
  - Weapons use `damage`, `range`, and properties.
  - Armor uses `armorClass`, `maxBonus`, and properties.
  - Tools and gear use `capacity` or `contains`.
  - Magic items may grant `features` or `saveDc` values.

• **Stacking vs Containment**:
  - `maxStack` controls how many identical items can exist in one stack.
  - `contains[]` lists other items contained (for bundles or packs).

Normalization:
--------------
• Stored in `equipment`.
• Containment relationships stored in `equipment_contains`.
• Aggregated in JSON via `vw_equipment_agg`.
• Linked via FKs to:
  - `system_equipment_categories`
  - `system_equipment_properties`
  - `system_equipment_rarities`

──────────────────────────────────────────────────────────────────────────────
*/
export interface Equipment {
  id: string
  label: string
  description: string | null
  quote: string | null
  cost: Cost | null
  weight: Weight | null
  capacity: Capacity | null
  maxStack: number | null
  propertyIds: string[]
  categoryId: string
  rarityId: string
  attributeIds: string[] | null
  damage: Damage | null
  saveDc: SaveDc | null
  primaryAbilityId: string | null
  secondaryAbilityId: string | null
  optionalAbilityId: string | null
  maxBonus: number | null
  armorClass: number | null
  prerequisites: Prerequisite[] | null
  speed: Speed | null
  range: Range | null
  contains: Contains[] | null
  features: Feature[] | null
  userId: string
  systemId: string
}

export interface EquipmentListItem {
  id: string
  label: string
  description: string | null
  quote: string | null
  userId: string
  systemId: string
}

type EquipmentMetaObject = {
  equipmentIds: string[]
  id: string
}

type EquipmentCostMeta = {
  equipmentIds: string[]
  amount: number
  id: string
}

type EquipmentWeightMeta = {
  equipmentIds: string[]
  amount: number
  id: string
}

export interface EquipmentMeta {
  categories: EquipmentMetaObject[]
  properties: EquipmentMetaObject[]
  primaryDamages: EquipmentMetaObject[]
  secondaryDamages: EquipmentMetaObject[]
  versatileDamages: EquipmentMetaObject[]
  armorClasses: EquipmentMetaObject[]
  cost: EquipmentCostMeta[]
  weight: EquipmentWeightMeta[]
  features: EquipmentMetaObject[]
}
