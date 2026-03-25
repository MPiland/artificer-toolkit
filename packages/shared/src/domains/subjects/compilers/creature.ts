import type {
  CreatureActionAuthored,
  CreatureAuthored,
  CreatureCompanionProfile,
  CreatureLairProfile,
  CreatureLegendaryProfile,
  CreatureMountProfile,
  CreatureNpcProfile,
  LogisticsCreatureAuthored,
  StatBlockCreatureAuthored,
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

export interface CompiledCreatureAction {
  id: string
  label: string
  description: string
  attackBonus?: number
  damage?: string
  recharge?: string
}

export interface CompiledCreatureLegendaryProfile {
  legendaryResistanceCount?: number
  actionsCount: number
  /** @deprecated Prefer compiled feature capabilities in the LEGENDARY_ACTIONS section. */
  actions: CompiledCreatureAction[]
}

export interface CompiledCreatureLairProfile {
  lairActions?: CompiledCreatureAction[]
  regionalEffects?: string[]
}

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
  recordKind: CreatureAuthored['recordKind']
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

export interface CompiledStatBlockCreature extends CompiledCreatureBase {
  recordKind: 'STAT_BLOCK'
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
  /** @deprecated Prefer compiled features with `section: ACTIONS`. */
  actions?: CompiledCreatureAction[]
  /** @deprecated Prefer compiled features with `section: BONUS_ACTIONS`. */
  bonusActions?: CompiledCreatureAction[]
  /** @deprecated Prefer compiled features with `section: REACTIONS`. */
  reactions?: CompiledCreatureAction[]
  /** @deprecated Prefer feature-owned charges/resources plus `LEGENDARY_ACTIONS` features. */
  legendaryProfile?: CompiledCreatureLegendaryProfile
  lairProfile?: CompiledCreatureLairProfile
  npcProfile?: CompiledCreatureNpcProfile
}

export interface CompiledLogisticsCreature extends CompiledCreatureBase {
  recordKind: 'LOGISTICS'
  cost?: LogisticsCreatureAuthored['cost']
  carryingCapacity?: LogisticsCreatureAuthored['carryingCapacity']
  logisticsNotes?: string[]
}

export type CompiledCreature = CompiledStatBlockCreature | CompiledLogisticsCreature

function compileAction(authored: CreatureActionAuthored): CompiledCreatureAction {
  return {
    id: authored.id,
    label: authored.label,
    description: authored.description,
    attackBonus: authored.attackBonus,
    damage: authored.damage,
    recharge: authored.recharge,
  }
}

function compileLegendaryProfile(
  authored: CreatureLegendaryProfile
): CompiledCreatureLegendaryProfile {
  return {
    legendaryResistanceCount: authored.legendaryResistanceCount,
    actionsCount: authored.actionsCount,
    actions: authored.actions.map(compileAction),
  }
}

function compileLairProfile(authored: CreatureLairProfile): CompiledCreatureLairProfile {
  return {
    lairActions: authored.lairActions?.map(compileAction),
    regionalEffects: authored.regionalEffects,
  }
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
    recordKind: authored.recordKind,
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

function compileStatBlockCreature(authored: StatBlockCreatureAuthored): CompiledStatBlockCreature {
  return {
    ...compileBase(authored),
    recordKind: 'STAT_BLOCK',
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
    actions: authored.actions?.map(compileAction),
    bonusActions: authored.bonusActions?.map(compileAction),
    reactions: authored.reactions?.map(compileAction),
    legendaryProfile: authored.legendaryProfile
      ? compileLegendaryProfile(authored.legendaryProfile)
      : undefined,
    lairProfile: authored.lairProfile
      ? compileLairProfile(authored.lairProfile)
      : undefined,
    npcProfile: authored.npcProfile
      ? compileNpcProfile(authored.npcProfile)
      : undefined,
  }
}

function compileLogisticsCreature(authored: LogisticsCreatureAuthored): CompiledLogisticsCreature {
  return {
    ...compileBase(authored),
    recordKind: 'LOGISTICS',
    cost: authored.cost,
    carryingCapacity: authored.carryingCapacity,
    logisticsNotes: authored.logisticsNotes,
  }
}

export function compileCreature(authored: CreatureAuthored): CompiledCreature {
  if (authored.recordKind === 'LOGISTICS') {
    return compileLogisticsCreature(authored)
  }

  return compileStatBlockCreature(authored)
}
