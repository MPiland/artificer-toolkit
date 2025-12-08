/*
──────────────────────────────────────────────────────────────────────────────
CLASS export interface — DEFINES PLAYER CLASSES, SPELLCASTING, MULTICLASSING &
LEVEL RULES — UPDATED TO SUPPORT NESTED MULTICLASS LOGIC (AND/OR GROUPING)
──────────────────────────────────────────────────────────────────────────────
*/

import type { Feature } from './features'
import type { Detail, Charge, StartingEquipment } from './shared'
import type { SubfeatureProficiency } from './subfeatureProficiencies'

/*
Hit points, starting gold, spellcasting definitions (unchanged)
──────────────────────────────────────────────────────────────
*/

export interface Hitpoint {
  abilityId: string
  dieConfig: string
}

export interface StartingGold {
  multiplier: number // int
  currencyId: string
  dieConfig: string
}

export interface PrepareLimit {
  methodIds: string[]
  measurementId: string
  roundingId: string | null
}

export interface SpellSlot {
  spellLevel: number // int
  slotCount: number // int
}

export interface SpellLimits {
  classLevel: number // int
  slots: SpellSlot[]
  spellsLimit: number | null // int
  cantripsLimit: number | null // int
}

export interface Spellcasting {
  spellLimits: SpellLimits[]
  magicName: string | null
  abilityId: string | null
  maxSpellLevel: number | null // int
  attributeIds: string[] | null
  charges: Charge | null
  prepareLimit: PrepareLimit | null
}

/*
──────────────────────────────────────────────────────────────────────────────
Nested Multiclass Requirement Model (supports AND / OR with grouping)
──────────────────────────────────────────────────────────────────────────────
*/

export enum MulticlassType {
  ABILITY = 'ABILITY',
  GROUP = 'GROUP'
}

/* A required minimum ability score */
export interface MulticlassRequirementAbility {
  id: string
  type: MulticlassType
  abilityId: string
  minAmount: number // minimum score required
}

/* Logical operators usable inside group */
export enum MulticlassLogic {
  AND = 'AND',
  OR = 'OR'
}

/*
A group of requirements that can contain:
  • leaf requirements (ability score checks)
  • nested groups (allowing STR AND (DEX OR INT), etc.)
*/
export interface MulticlassRequirementGroup {
  id: string
  type: MulticlassType
  logic: MulticlassLogic
  children: MulticlassRequirement[]
}

/*
Recursive type allowing ability leaves or groups
*/
export type MulticlassRequirement = MulticlassRequirementAbility | MulticlassRequirementGroup

/*
Rules for multiclassing into this class
*/
export interface Multiclass {
  id: string
  requirements: MulticlassRequirement
  proficiencies: SubfeatureProficiency[] | null
}

/*
Represents a subclass or archetype tied to a parent class.
*/
export interface Subtype {
  id: string
  label: string
  position: number // int
}

/*
──────────────────────────────────────────────────────────────────────────────
CLASS ROOT export interface (unchanged except multiclass tweak)
──────────────────────────────────────────────────────────────────────────────
*/

export interface Class {
  id: string
  label: string
  description: string
  attributeIds: string[]
  categoryId: string
  details: Detail[] | null
  hitpoint: Hitpoint
  startingGold: StartingGold | null
  equipment: StartingEquipment | null
  proficiencies: SubfeatureProficiency[] | null
  spellcasting: Spellcasting | null
  multiclass: Multiclass | null
  parentClassId: string | null
  subtypes: Subtype[] | null
  features: Feature[] | null
  userId: string
  systemId: string
}

export interface ClassListItem {
  id: string
  label: string
  description: string
  details: Detail[] | null
  userId: string
  systemId: string
}

type ClassMetaObject = {
  classIds: string[]
  id: string
}

type ClassMultiClassMetaObject = {
  classIds: string[]
  id: string
  amount: number // int
  logic: 'AND' | 'OR'
}

export interface ClassMeta {
  categories: ClassMetaObject[]
  parentClasses: ClassMetaObject[]
  multiclassAbilities: ClassMultiClassMetaObject[]
  features: ClassMetaObject[]
}
