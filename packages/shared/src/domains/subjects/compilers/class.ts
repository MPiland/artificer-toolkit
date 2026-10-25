import { assertNever } from '#utils'

import type {
  ClassAuthored,
  ClassMulticlassAuthored,
  ClassPrepareLimitAuthored,
  ClassResourceAuthored,
  ClassSpellcastingAuthored,
  ClassSpellLimitsAuthored,
  ClassSpecializationAuthored,
  StartingEquipmentAuthored
} from '#authored'
import {
  type PrepareLimitMethodKind,
  type ScalingAmountKind,
  type RoundingCode,
  type SpellcastingAttribute,
  CLASS_CATEGORY
} from '#core'
import {
  compileFeature,
  type CompiledFeature,
  compileProficiencyGrant,
  type CompiledProficiencyGrant,
  compileCharge,
  type CompiledCharge
} from '#compilers'

export interface CompiledClassResource {
  id: string
  label: string
  order?: number
  availableAtLevel: number
  charges: CompiledCharge
}

export interface CompiledHitpoint {
  dieConfig: string
}

export interface CompiledStartingGold {
  multiplier: number // int
  currencyId: string
  dieConfig: string
}

export type CompiledPrepareLimit = {
  methodKinds: PrepareLimitMethodKind[]
  scaling?: ScalingAmountKind
  rounding?: RoundingCode
  perLevel?: {
    classLevel: number
    amount: number
  }[]
}

export interface CompiledSpellSlot {
  spellLevel: number // int
  slotCount: number // int
}

export interface CompiledSpellLimits {
  classLevel: number
  slots: CompiledSpellSlot[]
  learnedSpellsLimit?: number
  preparedSpellsLimit?: number
  cantripsLimit?: number
}

export interface CompiledSpellcasting {
  magicName?: string
  order?: number
  spellLimits: CompiledSpellLimits[]
  availableAtLevel?: number
  availableSpellIds?: string[]
  ability?: string
  maxSpellLevel: number // int
  attributes?: SpellcastingAttribute[]
  charges?: CompiledCharge
  prepareLimit?: CompiledPrepareLimit
}

export type CompiledMulticlassRequirement = {
  id: string
  ability: string
  min: number // minimum score required
}

export type CompiledMulticlassRequirementGroup = {
  id: string
  requirements: CompiledMulticlassRequirement[]
}

export type CompiledMulticlassRequirementGroups = {
  id: string
  groups: CompiledMulticlassRequirementGroup[]
}

export interface CompiledMulticlass {
  id: string
  requirementGroups: CompiledMulticlassRequirementGroups
  proficiencies?: CompiledProficiencyGrant[]
}

export interface CompiledSpecialization {
  id: string
  label: string
  order: number // int
}

export type CompiledClassBase = {
  id: string
  label: string
  proficiencies?: CompiledProficiencyGrant[]
  spellcasting?: CompiledSpellcasting
  features?: CompiledFeature[]
  resources?: CompiledClassResource
}

export type CompiledClass = CompiledClassBase &
  (
    | {
        category: typeof CLASS_CATEGORY.BASE
        subclassSelectionLevel?: number
        startingGold: CompiledStartingGold
        startingEquipment: StartingEquipmentAuthored
        hitpoint: CompiledHitpoint
        multiclass: CompiledMulticlass
      }
    | {
        category: typeof CLASS_CATEGORY.SUBCLASS
        parentClassId: string
        specializations?: CompiledSpecialization[]
      }
  )

export function compileResource(authored: ClassResourceAuthored): CompiledClassResource {
  return {
    id: authored.id,
    label: authored.label,
    order: authored.order,
    availableAtLevel: authored.availableAtLevel,
    charges: compileCharge(authored.charges)
  }
}

export function compilePrepareLimit(authored: ClassPrepareLimitAuthored): CompiledPrepareLimit {
  return {
    methodKinds: authored.methodKinds,
    scaling: authored.scaling,
    rounding: authored.rounding,
    perLevel: authored.perLevel
  }
}

export function compileSpellLimits(authored: ClassSpellLimitsAuthored): CompiledSpellLimits {
  return {
    classLevel: authored.classLevel,
    slots: authored.slots,
    learnedSpellsLimit: authored.learnedSpellsLimit,
    preparedSpellsLimit: authored.preparedSpellsLimit,
    cantripsLimit: authored.cantripsLimit
  }
}

export function compileSpellcasting(authored: ClassSpellcastingAuthored): CompiledSpellcasting {
  const charges = authored.charges ? compileCharge(authored.charges) : undefined

  const prepareLimit = authored.prepareLimit
    ? compilePrepareLimit(authored.prepareLimit)
    : undefined

  return {
    magicName: authored.magicName,
    order: authored.order,
    spellLimits: authored.spellLimits.map((spellLimit) => compileSpellLimits(spellLimit)),
    availableAtLevel: authored.availableAtLevel,
    availableSpellIds: authored.availableSpellIds,
    ability: authored.ability,
    maxSpellLevel: authored.maxSpellLevel,
    attributes: authored.attributes,
    charges,
    prepareLimit
  }
}

export function compileMulticlass(authored: ClassMulticlassAuthored): CompiledMulticlass {
  return {
    id: authored.id,
    requirementGroups: {
      id: authored.id,
      groups: authored.requirementGroups.groups.map((group) => ({
        id: group.id,
        requirements: group.requirements.map((req) => ({
          id: req.id,
          ability: req.ability,
          min: req.min
        }))
      }))
    },
    proficiencies:
      authored.proficiencies && authored.proficiencies.length
        ? authored.proficiencies.map(compileProficiencyGrant)
        : undefined
  }
}

export function compileSpecialization(
  authored: ClassSpecializationAuthored
): CompiledSpecialization {
  return {
    id: authored.id,
    label: authored.label,
    order: authored.order
  }
}

export function compileClass(authored: ClassAuthored): CompiledClass {
  const proficiencies =
    authored.proficiencies && authored.proficiencies.length
      ? authored.proficiencies.map(compileProficiencyGrant)
      : undefined

  const features =
    authored.features && authored.features.length
      ? authored.features.map(compileFeature)
      : undefined

  const spellcasting = authored.spellcasting
    ? compileSpellcasting(authored.spellcasting)
    : undefined

  const resources = authored.resources ? compileResource(authored.resources) : undefined

  const base: CompiledClassBase = {
    id: authored.id,
    label: authored.label,
    proficiencies,
    features,
    spellcasting,
    resources
  }

  switch (authored.category) {
    case CLASS_CATEGORY.BASE: {
      return {
        ...base,
        category: authored.category,
        subclassSelectionLevel: authored.subclassSelectionLevel,
        startingGold: authored.startingGold,
        startingEquipment: authored.startingEquipment,
        hitpoint: authored.hitpoint,
        multiclass: compileMulticlass(authored.multiclass)
      }
    }

    case CLASS_CATEGORY.SUBCLASS: {
      const specializations =
        authored.specializations && authored.specializations.length
          ? authored.specializations.map((specialization) => compileSpecialization(specialization))
          : undefined
      return {
        ...base,
        category: authored.category,
        parentClassId: authored.parentClassId,
        specializations
      }
    }

    default:
      return assertNever(authored)
  }
}
