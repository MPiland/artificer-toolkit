import type { AbilityCode, SizeCode } from '#core'
import type {
  CapacityAuthored,
  CostAuthored,
  DetailAuthored,
  FeatureAuthored,
  ProficiencyGrantAuthored,
  SpeedAuthored,
} from '#authored'

export type CreatureCategory = 'NPC' | 'MONSTER' | 'BEAST' | 'COMPANION' | 'SUMMON'
export type CreatureRecordKind = 'STAT_BLOCK' | 'LOGISTICS'

/**
 * @deprecated Prefer feature-owned capabilities with feature section metadata.
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
  /** @deprecated Prefer feature-owned capabilities in the LEGENDARY_ACTIONS section. */
  actions: CreatureActionAuthored[]
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
  details?: DetailAuthored[]
  features?: FeatureAuthored[]
  proficiencies?: ProficiencyGrantAuthored[]
  userId: string
  systemId: string

  recordKind: CreatureRecordKind
  category: CreatureCategory
  creatureTypeId?: string
  size?: SizeCode
  alignmentId?: string
  tags?: string[]

  speeds: SpeedAuthored[]
  mountProfile?: CreatureMountProfile
  companionProfile?: CreatureCompanionProfile
}

export interface StatBlockCreatureAuthored extends CreatureBaseAuthored {
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

export interface LogisticsCreatureAuthored extends CreatureBaseAuthored {
  recordKind: 'LOGISTICS'

  cost?: CostAuthored
  carryingCapacity?: CapacityAuthored
  logisticsNotes?: string[]

  abilityScores?: never
  armorClass?: never
  armorClassNote?: never
  hitPoints?: never
  hitDice?: never
  senses?: never
  passivePerception?: never
  damageVulnerabilities?: never
  damageResistances?: never
  damageImmunities?: never
  conditionImmunities?: never
  challengeRatingId?: never
  xp?: never
  actions?: never
  bonusActions?: never
  reactions?: never
  legendaryProfile?: never
  lairProfile?: never
  npcProfile?: never
}

export type CreatureAuthored = StatBlockCreatureAuthored | LogisticsCreatureAuthored
