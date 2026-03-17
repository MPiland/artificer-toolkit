import type {
  CreatureActionAuthored,
  CreatureAuthored,
  CreatureCompanionProfile,
  CreatureLairProfile,
  CreatureLegendaryProfile,
  CreatureMountProfile,
  CreatureNpcProfile,
} from '#authored'
import type { AbilityCode, SizeCode } from '#core'
import {
  compileFeature,
  compileSpeed,
  type CompiledFeature,
  type CompiledSpeed,
} from '#compilers'

// ─── Compiled action ──────────────────────────────────────────────────────────

export interface CompiledCreatureAction {
  id: string
  label: string
  description: string
  attackBonus?: number
  damage?: string
  recharge?: string
}

// ─── Compiled profiles ────────────────────────────────────────────────────────

export interface CompiledCreatureLegendaryProfile {
  legendaryResistanceCount?: number
  actionsCount: number
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

// ─── Compiled creature ────────────────────────────────────────────────────────

export interface CompiledCreature {
  id: string
  category: string
  creatureTypeId: string
  size: SizeCode
  alignmentId?: string
  tags?: string[]
  abilityScores: Record<AbilityCode, number>
  armorClass: number
  armorClassNote?: string
  hitPoints: number
  hitDice?: string
  speeds: CompiledSpeed[]
  senses?: string[]
  passivePerception?: number
  savingThrowProficiencies?: AbilityCode[]
  skillProficiencies?: string[]
  damageVulnerabilities?: string[]
  damageResistances?: string[]
  damageImmunities?: string[]
  conditionImmunities?: string[]
  languages?: string[]
  challengeRatingId?: string
  xp?: number
  actions?: CompiledCreatureAction[]
  bonusActions?: CompiledCreatureAction[]
  reactions?: CompiledCreatureAction[]
  features?: CompiledFeature[]
  legendaryProfile?: CompiledCreatureLegendaryProfile
  lairProfile?: CompiledCreatureLairProfile
  mountProfile?: CompiledCreatureMountProfile
  companionProfile?: CompiledCreatureCompanionProfile
  npcProfile?: CompiledCreatureNpcProfile
}

// ─── Compile helpers ──────────────────────────────────────────────────────────

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

// ─── Main compile function ────────────────────────────────────────────────────

export function compileCreature(authored: CreatureAuthored): CompiledCreature {
  return {
    id: authored.id,
    category: authored.category,
    creatureTypeId: authored.creatureTypeId,
    size: authored.size,
    alignmentId: authored.alignmentId,
    tags: authored.tags,
    abilityScores: authored.abilityScores,
    armorClass: authored.armorClass,
    armorClassNote: authored.armorClassNote,
    hitPoints: authored.hitPoints,
    hitDice: authored.hitDice,
    speeds: authored.speeds.map(compileSpeed),
    senses: authored.senses,
    passivePerception: authored.passivePerception,
    savingThrowProficiencies: authored.savingThrowProficiencies,
    skillProficiencies: authored.skillProficiencies,
    damageVulnerabilities: authored.damageVulnerabilities,
    damageResistances: authored.damageResistances,
    damageImmunities: authored.damageImmunities,
    conditionImmunities: authored.conditionImmunities,
    languages: authored.languages,
    challengeRatingId: authored.challengeRatingId,
    xp: authored.xp,
    features: authored.features?.map(compileFeature),
    actions: authored.actions?.map(compileAction),
    bonusActions: authored.bonusActions?.map(compileAction),
    reactions: authored.reactions?.map(compileAction),
    legendaryProfile: authored.legendaryProfile
      ? compileLegendaryProfile(authored.legendaryProfile)
      : undefined,
    lairProfile: authored.lairProfile
      ? compileLairProfile(authored.lairProfile)
      : undefined,
    mountProfile: authored.mountProfile
      ? compileMountProfile(authored.mountProfile)
      : undefined,
    companionProfile: authored.companionProfile
      ? compileCompanionProfile(authored.companionProfile)
      : undefined,
    npcProfile: authored.npcProfile
      ? compileNpcProfile(authored.npcProfile)
      : undefined,
  }
}
