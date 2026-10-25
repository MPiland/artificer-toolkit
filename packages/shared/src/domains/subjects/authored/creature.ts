import type {
  AbilityCode,
  AuthoredRecordStatus,
  CreatureCategoryCode,
  DamageDefenseBypassCode,
  DiceExpression,
  EquipmentSlotCode
} from '#core'
import type {
  CapacityAuthored,
  CostAuthored,
  DetailAuthored,
  FeatureAuthored,
  ProficiencyGrantAuthored,
  SenseRangeAuthored,
  SpeedAuthored
} from '#authored'

/**
 * A Sense a Creature has: a System sense definition and its range, as a Character sense grant
 * resolves to. `qualifier` is the printed note after the range and never changes perception.
 */
export interface CreatureSenseAuthored {
  senseDefinitionId: string
  range: SenseRangeAuthored
  qualifier?: string
}

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
  useState: EquipmentSlotCode
  attuned: boolean
  actionFeatureIds: string[]
}

export interface CreatureBaseAuthored {
  id: string
  label: string
  quote?: string
  description?: string
  status?: AuthoredRecordStatus
  details: DetailAuthored[]
  features: FeatureAuthored[]
  proficiencies: ProficiencyGrantAuthored[]
  userId: string
  systemId: string
  category: CreatureCategoryCode
  creatureTypeId?: string
  size?: string
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
  size: string

  abilityScores: Record<AbilityCode, number>
  /** Armor class added to the loadout's armor formula; the Creature's armor class is computed. */
  naturalArmorBonus: number
  hitPoints: number
  hitDice?: DiceExpression

  senses: CreatureSenseAuthored[]
  passivePerception?: number
  damageVulnerabilities: string[]
  damageResistances: string[]
  damageImmunities: string[]
  qualifiedDamageDefenses: CreatureQualifiedDamageDefenseAuthored[]
  conditionImmunities: string[]
  challengeRatingId?: string
  xp?: number
  npcProfile?: CreatureNpcProfile
}
