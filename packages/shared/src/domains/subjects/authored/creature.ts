import type { AbilityCode, SizeCode } from '#core'
import type {
  CapacityAuthored,
  CostAuthored,
  DetailAuthored,
  FeatureAuthored,
  SpeedAuthored,
} from '#authored'

export type CreatureCategory = 'NPC' | 'MONSTER' | 'BEAST' | 'COMPANION' | 'SUMMON'
export type CreatureRecordKind = 'STAT_BLOCK' | 'LOGISTICS'

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
  savingThrowProficiencies?: AbilityCode[]
  skillProficiencies?: string[]
  damageVulnerabilities?: string[]
  damageResistances?: string[]
  damageImmunities?: string[]
  conditionImmunities?: string[]

  languages?: string[]
  challengeRatingId?: string
  xp?: number

  actions?: CreatureActionAuthored[]
  bonusActions?: CreatureActionAuthored[]
  reactions?: CreatureActionAuthored[]

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
  savingThrowProficiencies?: never
  skillProficiencies?: never
  damageVulnerabilities?: never
  damageResistances?: never
  damageImmunities?: never
  conditionImmunities?: never
  languages?: never
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
