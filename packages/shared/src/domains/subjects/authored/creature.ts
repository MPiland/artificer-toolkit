import type { AbilityCode, SizeCode, CreatureRecordKindCode, CreatureCategoryCode, AuthoredRecordStatus } from '#core'
import type {
  CapacityAuthored,
  CostAuthored,
  DetailAuthored,
  FeatureAuthored,
  ProficiencyGrantAuthored,
  SpeedAuthored
} from '#authored'

/**
 * @deprecated Prefer feature-owned effects with feature section metadata.
 * This remains only as a transitional creature stat-block surface.
 */
export interface CreatureActionAuthored {
  id: string
  label: string
  description: string
  attackBonus?: number
  damage?: string
  recharge?: string
}

export interface CreatureLegendaryProfile {
  legendaryResistanceCount?: number
  actionsCount: number
}

export interface CreatureLairProfile {
  lairActions?: CreatureActionAuthored[]
  regionalEffects?: string[]
}

export interface CreatureMountProfile {
  mountType: 'CONTROLLED' | 'INDEPENDENT'
  capacity?: number
  riderCount?: number
  notes?: string
}

export interface CreatureCompanionProfile {
  bondType: 'FAMILIAR' | 'ANIMAL_COMPANION' | 'SUMMON'
  initiativeMode: 'USES_PC_INITIATIVE' | 'OWN_INITIATIVE'
  notes?: string
}

export interface CreatureNpcProfile {
  bonds?: string[]
  flaws?: string[]
  ideals?: string[]
  personalityTraits?: string[]
}

export interface CreatureBaseAuthored {
  id: string
  label: string
  quote?: string
  description?: string
  status?: AuthoredRecordStatus
  details?: DetailAuthored[]
  features?: FeatureAuthored[]
  proficiencies?: ProficiencyGrantAuthored[]
  userId: string
  systemId: string

  /**
   * Internal persistence compatibility only. Creature authoring is category-driven
   * and should not expose stat-block/logistics choices in the UI.
   */
  recordKind?: CreatureRecordKindCode
  category: CreatureCategoryCode
  creatureTypeId?: string
  size?: SizeCode
  alignmentId?: string
  tags?: string[]

  speeds: SpeedAuthored[]
  cost?: CostAuthored
  carryingCapacity?: CapacityAuthored
  logisticsNotes?: string[]
  mountProfile?: CreatureMountProfile
  companionProfile?: CreatureCompanionProfile
}

export interface CreatureAuthored extends CreatureBaseAuthored {
  recordKind?: CreatureRecordKindCode
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

  /** @deprecated Prefer features with `section: ACTIONS`. */
  actions?: CreatureActionAuthored[]
  /** @deprecated Prefer features with `section: BONUS_ACTIONS`. */
  bonusActions?: CreatureActionAuthored[]
  /** @deprecated Prefer features with `section: REACTIONS`. */
  reactions?: CreatureActionAuthored[]

  /** @deprecated Prefer feature-owned charges/resources plus `LEGENDARY_ACTIONS` features. */
  legendaryProfile?: CreatureLegendaryProfile
  lairProfile?: CreatureLairProfile
  npcProfile?: CreatureNpcProfile
}

export interface StatBlockCreatureAuthored extends CreatureAuthored {
  recordKind?: 'STAT_BLOCK'
}

export interface LogisticsCreatureAuthored extends CreatureAuthored {
  recordKind: 'LOGISTICS'
}
