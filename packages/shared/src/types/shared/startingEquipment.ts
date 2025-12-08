/*
──────────────────────────────────────────────────────────────────────────────
STARTING EQUIPMENT export interface — CLASS / BACKGROUND LOADOUT DEFINITIONS
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines all possible starting equipment loadouts for a Class, Background,
or similar entity. Each layer breaks down nested choice logic into
normalized tables for easier ETL and re-aggregation.

Conceptual Hierarchy:
---------------------
• `StartingEquipment` — Root container for all loadout sets.
• `EquipmentSet` — A complete predefined variant of starting gear.
• `EquipmentGroup` — A logical group of mutually-exclusive options
  (e.g. "Choose one weapon").
• `EquipmentOption` — A selectable option inside a group.
• `EquipmentOptionItem` — The concrete items or rules the option grants.
• `EquipmentCurrency` — Optional starting currency or gold.

Normalization Note:
-------------------
This structure replaces deeply nested [[[options]]] arrays with explicit
tables, making JSON-to-SQL ETL and re-aggregation predictable.

Key Fields:
-----------
• `selectionAttributeIds` — Marks what export interface of *selection behavior* this
  item represents (e.g. "PROVIDES_SELECTION", "CHOOSE_ANY_WEAPON").
  These are not filters; they signal logic to the builder UI.
• `filterPropertyIds` — Filters available items by equipment properties.
• `categoryId` — Restricts to a single equipment category.
• `equipmentIds` — Explicitly enumerated equipment grants.
• `selectionCount` — How many items the player may pick from this group.
• `position` — Maintains display or processing positioner.

Example:
--------
A Fighter starts with:

• (a) chain mail or (b) leather armor + longbow
• (a) a martial weapon + shield or (b) two martial weapons
• plus 10 gp

──────────────────────────────────────────────────────────────────────────────
*/
export interface StartingEquipment {
  id: string
  sets: EquipmentSet[]
}

export interface EquipmentSet {
  id: string
  position: number // int
  groups: EquipmentGroup[]
}

export interface EquipmentGroup {
  id: string
  position: number // int
  options: EquipmentOption[]
}

export interface EquipmentOption {
  id: string
  position: number // int
  items: EquipmentOptionItem[]
}

export interface EquipmentOptionItem {
  id: string
  position: number // int
  selectionCount: number | null // int
  attributeIds: string[] | null // signals what this item lets you choose
  categoryId: string | null
  equipmentIds: string[]
  propertyIds: string[] | null
  quantity: number | null // int
  currencies: EquipmentCurrency[] | null
}

export interface EquipmentCurrency {
  currencyId: string
  amount: number // int
}
