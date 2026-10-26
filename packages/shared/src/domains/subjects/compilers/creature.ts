import type {
  CreatureAuthored,
  CreatureCompanionProfile,
  CreatureEquipmentLoadoutEntry,
  CreatureMountProfile,
  CreatureNpcProfile,
  SpeedAuthored
} from '#authored'
import { EQUIPMENT_SLOT_CODES, HAND_CONFLICT_MESSAGE, resolveHandOccupancy } from '#core'
import {
  compileFeature,
  compileProficiencyGrant,
  type CompiledFeature,
  type CompiledProficiencyGrant
} from '#compilers'

export interface CompiledCreatureMountProfile {
  mountType: 'CONTROLLED' | 'INDEPENDENT'
  capacity?: number
  riderCount?: number
  notes?: string
}

export interface CompiledCreatureCompanionProfile {
  bondType: 'FAMILIAR' | 'ANIMAL_COMPANION' | 'SUMMON'
  initiativeMode: 'USES_PC_INITIATIVE' | 'OWN_INITIATIVE'
  notes?: string
}

export interface CompiledCreatureNpcProfile {
  bonds?: string[]
  flaws?: string[]
  ideals?: string[]
  personalityTraits?: string[]
}

export interface CompiledCreatureEquipmentLoadoutEntry extends CreatureEquipmentLoadoutEntry {}

export interface CompiledCreatureBase {
  id: string
  category: string
  creatureTypeId?: string
  size?: string
  alignmentId?: string
  tags?: string[]
  speeds: SpeedAuthored[]
  features?: CompiledFeature[]
  proficiencies?: CompiledProficiencyGrant[]
  equipmentLoadout?: CompiledCreatureEquipmentLoadoutEntry[]
  mountProfile?: CompiledCreatureMountProfile
  companionProfile?: CompiledCreatureCompanionProfile
}

export interface CompiledCreature extends CompiledCreatureBase {
  creatureTypeId: string
  size: string
  abilityScores: Record<string, number>
  naturalArmorBonus: number
  hitPoints: number
  hitDice?: CreatureAuthored['hitDice']
  senses?: CreatureAuthored['senses']
  passivePerception?: number
  damageVulnerabilities?: string[]
  damageResistances?: string[]
  damageImmunities?: string[]
  qualifiedDamageDefenses?: CreatureAuthored['qualifiedDamageDefenses']
  conditionImmunities?: string[]
  challengeRatingId?: string
  xp?: number
  npcProfile?: CompiledCreatureNpcProfile
  cost?: CreatureAuthored['cost']
  carryingCapacity?: CreatureAuthored['carryingCapacity']
  logisticsNotes?: string[]
}

function compileMountProfile(authored: CreatureMountProfile): CompiledCreatureMountProfile {
  return {
    mountType: authored.mountType,
    capacity: authored.capacity,
    riderCount: authored.riderCount,
    notes: authored.notes
  }
}

function compileCompanionProfile(
  authored: CreatureCompanionProfile
): CompiledCreatureCompanionProfile {
  return {
    bondType: authored.bondType,
    initiativeMode: authored.initiativeMode,
    notes: authored.notes
  }
}

function compileNpcProfile(authored: CreatureNpcProfile): CompiledCreatureNpcProfile {
  return {
    bonds: authored.bonds,
    flaws: authored.flaws,
    ideals: authored.ideals,
    personalityTraits: authored.personalityTraits
  }
}

function hasActionInvocation(feature: NonNullable<CreatureAuthored['features']>[number]): boolean {
  return [
    ...(feature.effects ?? []),
    ...(feature.options?.flatMap((option) => option.effects ?? []) ?? [])
  ].some((effect) => effect.invocation.kind !== 'PASSIVE')
}

const POSTGRES_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function requirePostgresUuid(creatureId: string, field: string, value: unknown): string {
  if (typeof value !== 'string' || !POSTGRES_UUID_PATTERN.test(value)) {
    throw new Error(`Creature "${creatureId}" has invalid ${field}.`)
  }
  return value
}

function compileEquipmentLoadout(
  authored: CreatureAuthored
): CompiledCreatureEquipmentLoadoutEntry[] | undefined {
  if (authored.equipmentLoadout == null) return undefined
  if (!Array.isArray(authored.equipmentLoadout)) {
    throw new Error(`Creature "${authored.id}" has invalid equipment loadout.`)
  }
  if (authored.equipmentLoadout.length === 0) return undefined

  const featuresById = new Map((authored.features ?? []).map((feature) => [feature.id, feature]))
  const occurrenceIds = new Set<string>()
  const actionFeatureIds = new Set<string>()

  const loadout = authored.equipmentLoadout.map((entry) => {
    const entryId = requirePostgresUuid(authored.id, 'equipment loadout entry ID', entry.id)
    const equipmentId = requirePostgresUuid(
      authored.id,
      'equipment loadout equipment ID',
      entry.equipmentId
    )
    if (!Number.isInteger(entry.quantity) || entry.quantity <= 0) {
      throw new Error(
        `Creature "${authored.id}" equipment loadout entry "${entryId}" must have a positive integer quantity.`
      )
    }
    if (!EQUIPMENT_SLOT_CODES.includes(entry.useState)) {
      throw new Error(
        `Creature "${authored.id}" equipment loadout entry "${entryId}" has invalid use state.`
      )
    }
    if (typeof entry.attuned !== 'boolean') {
      throw new Error(
        `Creature "${authored.id}" equipment loadout entry "${entryId}" must declare attunement.`
      )
    }
    if (!Array.isArray(entry.actionFeatureIds)) {
      throw new Error(
        `Creature "${authored.id}" equipment loadout entry "${entryId}" has invalid action Feature bindings.`
      )
    }

    if (occurrenceIds.has(entryId)) {
      throw new Error(
        `Creature "${authored.id}" has duplicate equipment loadout entry "${entryId}".`
      )
    }
    occurrenceIds.add(entryId)

    if (entry.useState !== 'CARRIED' && entry.quantity !== 1) {
      throw new Error(
        `Creature "${authored.id}" equipment loadout entry "${entryId}" must have quantity 1 when ${entry.useState}.`
      )
    }

    for (const featureId of entry.actionFeatureIds) {
      requirePostgresUuid(authored.id, 'equipment loadout action Feature ID', featureId)
      if (actionFeatureIds.has(featureId)) {
        throw new Error(
          `Creature "${authored.id}" binds action Feature "${featureId}" to multiple equipment loadout entries.`
        )
      }
      actionFeatureIds.add(featureId)

      const feature = featuresById.get(featureId)
      if (!feature) {
        throw new Error(
          `Creature "${authored.id}" equipment loadout entry "${entryId}" references missing action Feature "${featureId}".`
        )
      }
      if (!hasActionInvocation(feature)) {
        throw new Error(
          `Creature "${authored.id}" equipment loadout entry "${entryId}" references Feature "${featureId}" without an ACTION invocation.`
        )
      }
    }

    return {
      id: entryId,
      equipmentId,
      quantity: entry.quantity,
      useState: entry.useState,
      attuned: entry.attuned,
      actionFeatureIds: [...entry.actionFeatureIds]
    }
  })

  // Equipment is not resolved here, so only the hands themselves are checked.
  const [conflict] = resolveHandOccupancy(
    loadout.map((entry) => ({ id: entry.id, slot: entry.useState, twoHanded: false }))
  ).conflicts
  if (conflict) {
    throw new Error(
      `Creature "${authored.id}" equipment loadout entry "${conflict.itemId}": ${HAND_CONFLICT_MESSAGE[conflict.code]}`
    )
  }
  return loadout
}

function compileBase(authored: CreatureAuthored): CompiledCreatureBase {
  return {
    id: authored.id,
    category: authored.category,
    creatureTypeId: authored.creatureTypeId,
    size: authored.size,
    alignmentId: authored.alignmentId,
    tags: authored.tags,
    speeds: authored.speeds,
    features: authored.features?.map(compileFeature),
    proficiencies: authored.proficiencies?.map(compileProficiencyGrant),
    equipmentLoadout: compileEquipmentLoadout(authored),
    mountProfile: authored.mountProfile ? compileMountProfile(authored.mountProfile) : undefined,
    companionProfile: authored.companionProfile
      ? compileCompanionProfile(authored.companionProfile)
      : undefined
  }
}

function compileCreatureFields(authored: CreatureAuthored): CompiledCreature {
  return {
    ...compileBase(authored),
    creatureTypeId: authored.creatureTypeId,
    size: authored.size,
    abilityScores: authored.abilityScores,
    naturalArmorBonus: authored.naturalArmorBonus,
    hitPoints: authored.hitPoints,
    hitDice: authored.hitDice,
    senses: authored.senses,
    passivePerception: authored.passivePerception,
    damageVulnerabilities: authored.damageVulnerabilities,
    damageResistances: authored.damageResistances,
    damageImmunities: authored.damageImmunities,
    qualifiedDamageDefenses: authored.qualifiedDamageDefenses,
    conditionImmunities: authored.conditionImmunities,
    challengeRatingId: authored.challengeRatingId,
    xp: authored.xp,
    npcProfile: authored.npcProfile ? compileNpcProfile(authored.npcProfile) : undefined,
    cost: authored.cost,
    carryingCapacity: authored.carryingCapacity,
    logisticsNotes: authored.logisticsNotes
  }
}

export function compileCreature(authored: CreatureAuthored): CompiledCreature {
  return compileCreatureFields(authored)
}
