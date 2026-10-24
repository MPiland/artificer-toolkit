import type {
  EffectAuthored,
  NonManifestOutcomeAuthored,
  ShapeAuthored,
  SpeedAuthored
} from '#authored'
import {
  EFFECT_KIND,
  MANIFEST_KIND,
  type AbilityCode,
  type ManifestKind,
  type LengthUnitCode,
  type NumericExpr,
  type ShapeMeasurementValueAuthored,
  type SizeCode,
  type Trigger
} from '#core'

export type ManifestBehaviorAuthored<TTrigger extends Trigger = Trigger> = EffectAuthored<
  TTrigger,
  NonManifestOutcomeAuthored
>

export type ManifestNestedBehaviorAuthored<TTrigger extends Trigger = Trigger> =
  ManifestBehaviorAuthored<TTrigger>

export const SUMMON_DAMAGEABILITY_KIND = {
  NORMAL: 'NORMAL',
  INVULNERABLE: 'INVULNERABLE',
  SPECIAL: 'SPECIAL'
} as const

export const SUMMON_VISIBILITY_KIND = {
  VISIBLE: 'VISIBLE',
  INVISIBLE: 'INVISIBLE',
  SPECIAL: 'SPECIAL'
} as const

export type SummonDamageabilityKind = keyof typeof SUMMON_DAMAGEABILITY_KIND
export type SummonVisibilityKind = keyof typeof SUMMON_VISIBILITY_KIND
export type SummonAbilityScoreCode = AbilityCode

export const MANIFEST_BLOCKING_RULE = {
  NONMAGICAL_RANGED_ATTACKS: 'NONMAGICAL_RANGED_ATTACKS',
  MAGICAL_RANGED_ATTACKS: 'MAGICAL_RANGED_ATTACKS',
  SPELLS: 'SPELLS',
  THREE_QUARTERS_COVER: 'THREE_QUARTERS_COVER',
  BLOCKS_SIGHT: 'BLOCKS_SIGHT'
} as const

export const MANIFEST_BLOCKING_RULE_OPTIONS = [
  { code: MANIFEST_BLOCKING_RULE.NONMAGICAL_RANGED_ATTACKS, label: 'Nonmagical Ranged Attacks' },
  { code: MANIFEST_BLOCKING_RULE.MAGICAL_RANGED_ATTACKS, label: 'Magical Ranged Attacks' },
  { code: MANIFEST_BLOCKING_RULE.SPELLS, label: 'Spells' },
  { code: MANIFEST_BLOCKING_RULE.THREE_QUARTERS_COVER, label: 'Three-Quarters Cover' },
  { code: MANIFEST_BLOCKING_RULE.BLOCKS_SIGHT, label: 'Blocks Sight' }
] as const

export const MANIFEST_REQUIRED_SIGHT = {
  OCCUPANT_SEES_SOURCE: 'OCCUPANT_SEES_SOURCE',
  SOURCE_SEES_OCCUPANT: 'SOURCE_SEES_OCCUPANT'
} as const

export const MANIFEST_REQUIRED_SIGHT_OPTIONS = [
  { code: MANIFEST_REQUIRED_SIGHT.OCCUPANT_SEES_SOURCE, label: 'Occupant Sees the Source' },
  { code: MANIFEST_REQUIRED_SIGHT.SOURCE_SEES_OCCUPANT, label: 'Source Sees the Occupant' }
] as const

export const MANIFEST_SUPPRESSION_IMMUNITY = {
  ANTIMAGIC_FIELD: 'ANTIMAGIC_FIELD'
} as const

export const MANIFEST_SUPPRESSION_IMMUNITY_OPTIONS = [
  { code: MANIFEST_SUPPRESSION_IMMUNITY.ANTIMAGIC_FIELD, label: 'Antimagic Field' }
] as const

export const MANIFEST_PROPERTY = {
  NO_HEAT: 'NO_HEAT',
  NO_OXYGEN_USE: 'NO_OXYGEN_USE',
  CANNOT_BE_SMOTHERED: 'CANNOT_BE_SMOTHERED',
  CANNOT_BE_QUENCHED: 'CANNOT_BE_QUENCHED',
  CAN_BE_COVERED_OR_HIDDEN: 'CAN_BE_COVERED_OR_HIDDEN'
} as const

export const MANIFEST_PROPERTY_OPTIONS = [
  { code: MANIFEST_PROPERTY.NO_HEAT, label: 'Produces No Heat' },
  { code: MANIFEST_PROPERTY.NO_OXYGEN_USE, label: 'Uses No Oxygen' },
  { code: MANIFEST_PROPERTY.CANNOT_BE_SMOTHERED, label: 'Cannot Be Smothered' },
  { code: MANIFEST_PROPERTY.CANNOT_BE_QUENCHED, label: 'Cannot Be Quenched' },
  { code: MANIFEST_PROPERTY.CAN_BE_COVERED_OR_HIDDEN, label: 'Can Be Covered or Hidden' }
] as const

export const MANIFEST_SPELL_CAPABILITY = {
  OPEN_PORTAL_ON_SOLID_SURFACE: 'OPEN_PORTAL_ON_SOLID_SURFACE',
  SHED_BRIGHT_LIGHT: 'SHED_BRIGHT_LIGHT',
  END_SPELL_OR_MAGICAL_EFFECT: 'END_SPELL_OR_MAGICAL_EFFECT'
} as const

export const MANIFEST_SPELL_CAPABILITY_OPTIONS = [
  { code: MANIFEST_SPELL_CAPABILITY.OPEN_PORTAL_ON_SOLID_SURFACE, label: 'Open Surface Portal' },
  { code: MANIFEST_SPELL_CAPABILITY.SHED_BRIGHT_LIGHT, label: 'Shed Bright Light' },
  { code: MANIFEST_SPELL_CAPABILITY.END_SPELL_OR_MAGICAL_EFFECT, label: 'End Magical Effect' }
] as const

export type ManifestDestructionCriterionAuthored =
  | {
      id: string
      order: number
      kind: 'DAMAGE_THRESHOLD'
      damageTypeId: string
      amount: number
    }
  | {
      id: string
      order: number
      kind: 'STRONG_WIND'
    }
  | {
      id: string
      order: number
      kind: 'WIND_SPEED'
      minimumMilesPerHour: number
      afterRounds: number
    }
  | {
      id: string
      order: number
      kind: 'SPELL_CAPABILITY'
      capability: keyof typeof MANIFEST_SPELL_CAPABILITY
      minimumSpellLevel: number
      exampleSpellIds?: string[]
    }
  | {
      id: string
      order: number
      kind: 'NAMED_OBJECT'
      objectLabel: string
    }

export type ManifestInteractionKind =
  | 'ENTER_OR_PASS_THROUGH'
  | 'MOVE_ACROSS'
  | 'ENTER_SPACE'
  | 'LEAVE_SPACE'
  | 'START_TURN_IN_SPACE'
  | 'END_TURN_IN_SPACE'
  | 'START_OF_SOURCE_TURN'
  | 'MELEE_HIT_ON_SOURCE'
  | 'SOURCE_HIT'
  | 'TARGET_TAKES_FIRE_DAMAGE'
  | 'START_OF_ATTACHED_TARGET_TURN'
  | 'END_OF_ATTACHED_TARGET_NEXT_TURN'

/**
 * A continuous bonus to every saving throw of an occupant the filter matches (D155); a source ability
 * modifier is resolved when the zone is placed and pinned.
 */
export type ManifestOccupantSaveBonusAuthored = {
  id: string
  domain: 'EVERY_SAVING_THROW'
  dispositionFilter: 'ALLIES_AND_SOURCE'
} & (
  | { amountKind: 'FIXED'; amount: number }
  | { amountKind: 'SOURCE_ABILITY_MODIFIER'; ability: AbilityCode; minimum?: number }
)

export type ManifestComponentAuthored = {
  id: string
  order: number
  label: string
  /**
   * Where the component reaches, when not the manifest's own shape: SIDE_BAND covers the shape
   * plus `distance` on the side its caster chooses (beside a wall, inside or outside a ring).
   */
  region?: { kind: 'SIDE_BAND'; distance: { amount: number; unit: LengthUnitCode } }
  interactionKinds?: ManifestInteractionKind[]
  bypassAtHalfSpeed?: boolean
  choosesUnaffected?: boolean
  movementCostMultiplier?: number
  /**
   * The behavior runs once for each whole `amount` a creature moves within the area, at the
   * distance where that step completes, instead of once on entry (D156).
   */
  perDistanceMoved?: { amount: number; unit: LengthUnitCode }
  requiresFullyWithin?: boolean
  /**
   * An occupant is put through the component's save only with this sight between it and the zone's
   * source; one without it succeeds on the save unrolled (Unnerving Mask: the creature must see the
   * devil, and the devil the creature).
   */
  requiredSight?: Array<keyof typeof MANIFEST_REQUIRED_SIGHT>
  /** A target immune to this damage type succeeds on the component's save unrolled. */
  automaticSaveSuccessImmunityDamageTypeId?: string
  occupantSaveBonus?: ManifestOccupantSaveBonusAuthored
  requiresIgnition?: boolean
  maxApplicationsPerTurn?: number
  maxApplicationsTotal?: number
  armorClass?: number
  hitPoints?: number
  behaviors?: ManifestBehaviorAuthored[]
  blockingRules?: Array<keyof typeof MANIFEST_BLOCKING_RULE>
  destructionCriteria?: ManifestDestructionCriterionAuthored[]
  releaseCriteria?: ManifestDestructionCriterionAuthored[]
}

export type ManifestLightAuthored = {
  bright: { amount: number; unit: LengthUnitCode }
  dimAdditional: { amount: number; unit: LengthUnitCode }
}

export type ManifestProximityRuleAuthored = {
  id: string
  events: Array<'MOVE_WITHIN' | 'START_TURN'>
  distance: { amount: number; unit: LengthUnitCode }
  requiresSight: boolean
  behavior: ManifestBehaviorAuthored
}

export type SummonStatBlockAuthored = {
  size?: SizeCode
  armorClass?: NumericExpr
  armorClassNote?: string
  hitPoints?: NumericExpr
  speeds?: SpeedAuthored[]
  abilityScores?: Partial<Record<SummonAbilityScoreCode, NumericExpr>>
  senses?: string[]
  passivePerception?: NumericExpr
  damageVulnerabilities?: string[]
  damageResistances?: string[]
  damageImmunities?: string[]
  conditionImmunities?: string[]
  damageabilityKind?: SummonDamageabilityKind
  visibilityKind?: SummonVisibilityKind
  occupiesSpace?: boolean
}

type ManifestAuthoredBase = {
  id: string
  effectKind: typeof EFFECT_KIND.MANIFEST
  label?: string
  shape?: ShapeAuthored
  attachmentKind?: 'SOURCE' | 'PRIMARY_TARGET' | 'PLACED_SPACE' | 'TOUCHED_OBJECT'
  maxApplicationsPerTurn?: number
  placementSurfaceKind?: 'LEVEL'
  applicationTargetKind?: 'WEAPON' | 'AMMUNITION'
  applicationCount?: number
  qualifyingDamageTypeIds?: string[]
}

export type ManifestCreatureFormAuthored = {
  id: string
  order: number
  label: string
  creatureId: string
  maxTargets: number
}

/**
 * The rule a caster-chosen Creature must meet to be a form (Polymorph: a beast whose challenge
 * rating does not exceed the target's), checked at cast against the System creature corpus.
 */
export type ManifestCreatureFormFilterAuthored = {
  id: string
  /** The Creature Type the form must have; omitted allows any. */
  creatureTypeId?: string
  /** The cap on the form's challenge rating: the target's own (its level when it has none) or a fixed one. */
  challengeRatingCapKind: 'TARGET' | 'FIXED'
  /** The fixed cap, for `FIXED`. */
  maxChallengeRatingId?: string
  /** Speeds the form may not have. */
  excludedSpeedIds?: string[]
}

type CreatureManifestAuthored = ManifestAuthoredBase & {
  manifestKind: typeof MANIFEST_KIND.CREATURE
  forms?: ManifestCreatureFormAuthored[]
  /** A rule-filtered choice beside the fixed `forms`; the cast names the Creature on the command. */
  formFilter?: ManifestCreatureFormFilterAuthored
  excessDamageCarriesOver?: boolean
  /** The holder's own ability scores the form keeps (Wild Shape: Intelligence, Wisdom, Charisma). */
  retainedAbilityDefinitionIds?: string[]
  /** The holder keeps its own proficiencies (Wild Shape); absent, the form's stat block replaces them (Polymorph). */
  retainsProficiencies?: boolean
  statBlock?: never
  behaviors?: never
}

type SummonManifestAuthored = ManifestAuthoredBase & {
  manifestKind: typeof MANIFEST_KIND.SUMMON
  forms?: never
  formFilter?: never
  excessDamageCarriesOver?: never
  retainedAbilityDefinitionIds?: never
  retainsProficiencies?: never
  statBlock?: SummonStatBlockAuthored
  behaviors?: ManifestBehaviorAuthored[]
}

type NonCreatureManifestAuthored<TKind extends ManifestKind> = ManifestAuthoredBase & {
  manifestKind: TKind
  forms?: never
  formFilter?: never
  excessDamageCarriesOver?: never
  retainedAbilityDefinitionIds?: never
  retainsProficiencies?: never
  statBlock?: never
  behaviors?: ManifestBehaviorAuthored[]
  components?: ManifestComponentAuthored[]
  componentsMustResolveInOrder?: boolean
  destructionMustResolveInOrder?: boolean
  destroyedComponentsRemainDestroyed?: boolean
  placementMustBeUnoccupied?: boolean
  invalidPlacementConsumesInvocation?: boolean
  designatedCreatureImmunity?: boolean
  maximumTargetSize?: SizeCode
  excludesFormlessTargets?: boolean
  proximityRule?: ManifestProximityRuleAuthored
  light?: ManifestLightAuthored
  hollow?: boolean
  wallThickness?: ShapeMeasurementValueAuthored
  spreadsAroundCorners?: boolean
  obscurementKind?: 'LIGHT' | 'HEAVY'
  properties?: Array<keyof typeof MANIFEST_PROPERTY>
  destructionCriteria?: ManifestDestructionCriterionAuthored[]
  suppressionImmunities?: Array<keyof typeof MANIFEST_SUPPRESSION_IMMUNITY>
}

type ZoneManifestAuthored = NonCreatureManifestAuthored<typeof MANIFEST_KIND.ZONE> &
  Required<Pick<ManifestAuthoredBase, 'attachmentKind'>>

export type ManifestAuthored =
  | CreatureManifestAuthored
  | SummonManifestAuthored
  | NonCreatureManifestAuthored<
      Exclude<
        ManifestKind,
        typeof MANIFEST_KIND.CREATURE | typeof MANIFEST_KIND.SUMMON | typeof MANIFEST_KIND.ZONE
      >
    >
  | ZoneManifestAuthored
