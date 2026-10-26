import type {
  ProficiencyGrantAuthored,
  FeatureAuthored,
  ChargeAuthored,
  DetailAuthored,
  StartingEquipmentAuthored
} from '#authored'
import type {
  AuthoredRecordStatus,
  ScalingAmountKind,
  RoundingCode,
  SpellcastingAttribute,
  PrepareLimitMethodKind,
  CLASS_CATEGORY,
  ClassAttribute,
  SubclassAttribute
} from '#core'

export interface ClassResourceAuthored {
  id: string
  label: string
  description?: string
  availableAtLevel: number
  order?: number
  charges: ChargeAuthored
}

export interface ClassHitpointAuthored {
  dieConfig: string
}

export interface ClassStartingGoldAuthored {
  multiplier: number // int
  currencyId: string
  dieConfig: string
}

export type ClassPrepareLimitAuthored = {
  methodKinds: PrepareLimitMethodKind[]
  scaling?: ScalingAmountKind
  rounding?: RoundingCode
  perLevel?: {
    classLevel: number
    amount: number
  }[]
}

export interface ClassSpellSlotAuthored {
  spellLevel: number // int
  slotCount: number // int
}

export interface ClassSpellLimitsAuthored {
  classLevel: number
  slots: ClassSpellSlotAuthored[]
  learnedSpellsLimit?: number
  preparedSpellsLimit?: number
  cantripsLimit?: number
}

export interface ClassSpellcastingAuthored {
  spellLimits: ClassSpellLimitsAuthored[]
  availableAtLevel?: number
  order?: number
  details?: DetailAuthored[]
  magicName?: string
  availableSpellIds?: string[]
  ability?: string
  maxSpellLevel: number // int
  attributes?: SpellcastingAttribute[]
  charges: ChargeAuthored
  prepareLimit?: ClassPrepareLimitAuthored
}

export type ClassMulticlassRequirementAuthored = {
  id: string
  ability: string
  min: number // minimum score required
}

export type ClassMulticlassRequirementGroup = {
  id: string
  requirements: ClassMulticlassRequirementAuthored[]
}

export type ClassMulticlassRequirementGroups = {
  groups: ClassMulticlassRequirementGroup[]
}

export interface ClassMulticlassAuthored {
  id: string
  requirementGroups: ClassMulticlassRequirementGroups
  proficiencies?: ProficiencyGrantAuthored[]
}

export interface ClassSpecializationAuthored {
  id: string
  label: string
  order: number // int
}

export type ClassBaseAuthored = {
  id: string
  label: string
  description?: string
  status?: AuthoredRecordStatus
  details?: DetailAuthored[]
  proficiencies?: ProficiencyGrantAuthored[]
  spellcasting?: ClassSpellcastingAuthored
  resources?: ClassResourceAuthored
  features?: FeatureAuthored[]
  userId: string
  systemId: string
}

export type ParentClassAuthored = {
  category: typeof CLASS_CATEGORY.BASE
  attributes?: ClassAttribute[]
  subclassSelectionLevel?: number
  startingGold: ClassStartingGoldAuthored
  startingEquipment: StartingEquipmentAuthored
  hitpoint: ClassHitpointAuthored
  multiclass: ClassMulticlassAuthored
} & ClassBaseAuthored

export type SubclassAuthored = {
  category: typeof CLASS_CATEGORY.SUBCLASS
  attributes?: SubclassAttribute[]
  parentClassId: string
  specializations?: ClassSpecializationAuthored[]
} & ClassBaseAuthored

export type ClassAuthored = ParentClassAuthored | SubclassAuthored
