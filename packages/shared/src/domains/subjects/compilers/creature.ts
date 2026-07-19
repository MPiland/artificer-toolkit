import type {
  CreatureAuthored,
  CreatureCompanionProfile,
  CreatureMountProfile,
  CreatureNpcProfile,
} from '#authored'
import type { AbilityCode, SizeCode } from '#core'
import {
  compileFeature,
  compileProficiencyGrant,
  compileSpeed,
  type CompiledFeature,
  type CompiledProficiencyGrant,
  type CompiledSpeed,
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

export interface CompiledCreatureBase {
  id: string
  category: string
  creatureTypeId?: string
  size?: SizeCode
  alignmentId?: string
  tags?: string[]
  speeds: CompiledSpeed[]
  features?: CompiledFeature[]
  proficiencies?: CompiledProficiencyGrant[]
  mountProfile?: CompiledCreatureMountProfile
  companionProfile?: CompiledCreatureCompanionProfile
}

export interface CompiledCreature extends CompiledCreatureBase {
  creatureTypeId: string
  size: SizeCode
  abilityScores: Record<AbilityCode, number>
  armorClass: number
  armorClassNote?: string
  hitPoints: number
  hitDice?: string
  senses?: string[]
  passivePerception?: number
  damageVulnerabilities?: string[]
  damageResistances?: string[]
  damageImmunities?: string[]
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
    notes: authored.notes,
  }
}

function compileCompanionProfile(
  authored: CreatureCompanionProfile
): CompiledCreatureCompanionProfile {
  return {
    bondType: authored.bondType,
    initiativeMode: authored.initiativeMode,
    notes: authored.notes,
  }
}

function compileNpcProfile(authored: CreatureNpcProfile): CompiledCreatureNpcProfile {
  return {
    bonds: authored.bonds,
    flaws: authored.flaws,
    ideals: authored.ideals,
    personalityTraits: authored.personalityTraits,
  }
}

function compileBase(
  authored: CreatureAuthored
): CompiledCreatureBase {
  return {
    id: authored.id,
    category: authored.category,
    creatureTypeId: authored.creatureTypeId,
    size: authored.size,
    alignmentId: authored.alignmentId,
    tags: authored.tags,
    speeds: authored.speeds.map(compileSpeed),
    features: authored.features?.map(compileFeature),
    proficiencies: authored.proficiencies?.map(compileProficiencyGrant),
    mountProfile: authored.mountProfile
      ? compileMountProfile(authored.mountProfile)
      : undefined,
    companionProfile: authored.companionProfile
      ? compileCompanionProfile(authored.companionProfile)
      : undefined,
  }
}

function compileCreatureFields(authored: CreatureAuthored): CompiledCreature {
  return {
    ...compileBase(authored),
    creatureTypeId: authored.creatureTypeId,
    size: authored.size,
    abilityScores: authored.abilityScores,
    armorClass: authored.armorClass,
    armorClassNote: authored.armorClassNote,
    hitPoints: authored.hitPoints,
    hitDice: authored.hitDice,
    senses: authored.senses,
    passivePerception: authored.passivePerception,
    damageVulnerabilities: authored.damageVulnerabilities,
    damageResistances: authored.damageResistances,
    damageImmunities: authored.damageImmunities,
    conditionImmunities: authored.conditionImmunities,
    challengeRatingId: authored.challengeRatingId,
    xp: authored.xp,
    npcProfile: authored.npcProfile
      ? compileNpcProfile(authored.npcProfile)
      : undefined,
    cost: authored.cost,
    carryingCapacity: authored.carryingCapacity,
    logisticsNotes: authored.logisticsNotes,
  }
}

export function compileCreature(authored: CreatureAuthored): CompiledCreature {
  return compileCreatureFields(authored)
}
