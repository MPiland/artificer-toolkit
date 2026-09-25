import type {
  AbilityCode,
  AuthoredRecordStatus,
  CreatureCategoryCode,
  DamageDefenseBypassCode,
  DiceExpression,
  SizeCode
} from '#core'
import type {
  CapacityAuthored,
  CostAuthored,
  DetailAuthored,
  FeatureAuthored,
  ProficiencyGrantAuthored,
  SpeedAuthored
} from '#authored'

/**
 * A resistance or immunity that applies only to attacks without any of `bypassedBy`, as in
 * "bludgeoning, piercing, and slashing from nonmagical attacks that aren't silvered".
 */
export interface CreatureQualifiedDamageDefenseAuthored {
  kind: 'RESISTANCE' | 'IMMUNITY'
  damageTypeIds: string[]
  bypassedBy: DamageDefenseBypassCode[]
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

export interface CreatureEquipmentLoadoutEntry {
  id: string
  equipmentId: string
  quantity: number
  useState: 'CARRIED' | 'HELD' | 'WORN'
  attuned: boolean
  actionFeatureIds: string[]
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
  category: CreatureCategoryCode
  creatureTypeId?: string
  size?: SizeCode
  alignmentId?: string
  tags?: string[]

  speeds: SpeedAuthored[]
  cost?: CostAuthored
  carryingCapacity?: CapacityAuthored
  equipmentLoadout?: CreatureEquipmentLoadoutEntry[]
  logisticsNotes?: string[]
  mountProfile?: CreatureMountProfile
  companionProfile?: CreatureCompanionProfile
}

export interface CreatureAuthored extends CreatureBaseAuthored {
  creatureTypeId: string
  size: SizeCode

  abilityScores: Record<AbilityCode, number>
  armorClass: number
  armorClassNote?: string
  hitPoints: number
  hitDice?: DiceExpression

  senses?: string[]
  passivePerception?: number
  damageVulnerabilities?: string[]
  damageResistances?: string[]
  damageImmunities?: string[]
  qualifiedDamageDefenses?: CreatureQualifiedDamageDefenseAuthored[]
  conditionImmunities?: string[]
  challengeRatingId?: string
  xp?: number
  npcProfile?: CreatureNpcProfile
}
