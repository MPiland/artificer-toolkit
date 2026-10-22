import type { CompiledDuration } from '@artificer-toolkit/shared/compilers'
import type { ReceiptD20ContributorDto } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import type { RollModeKeep } from '@artificer-toolkit/schema/shared/systemCoreCode'
import {
  FORCED_MOVEMENT_DIRECTION,
  type ForcedMovementDirection
} from '@artificer-toolkit/shared/core'
import type { CompiledEffectOffer } from '@artificer-toolkit/schema/effects/storedEffectOffer'
import type { GrantedAction } from '@artificer-toolkit/schema/effects/grantedAction'
import type { AttackSlotConditionDto } from '@artificer-toolkit/schema/features/attackSlots'
import type { D20AddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'
import type {
  CharacterGrantFoldModifier,
  CharacterGrantFoldSense
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  ActiveEffectSaveTally,
  ActiveEffectSaveThresholds
} from '@artificer-toolkit/schema/shared/activeRuleEffectLifecycle'
import type {
  ActiveRuleEffectDefinitionDto,
  ActiveRuleEffectLifecycleDto,
  RuleGraphSourceIdentityDto,
  ServerRuleExecutionD20PolicyDto,
  ServerPublishedRuleDefinitionDto,
  ServerRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type {
  ActiveEffectConsumeEvent,
  ActiveEffectEndEvent,
  ActiveEffectEndTrigger,
  ActiveEffectRepeatTrigger,
  ActiveGrantHolderEnd,
  GrantConsumeEvent,
  GrantEndEvent
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { CombatPerceptionContributionsDto } from '@artificer-toolkit/schema/shared/combatPerception'
import type { EffectActionCapabilityDescriptor } from './characterActionCapabilityDiscovery.js'
import type { CompiledRuleGraph, RuleValue } from '@artificer-toolkit/shared/rules'
import type {
  CombatPerceptionCapabilityInstance,
  SceneGrid,
  ScenePoint
} from '@artificer-toolkit/shared/vtt'
import type { CombatPerceptionRequirementDto } from '@artificer-toolkit/schema/shared/combatPerception'
import type { ResolvedRuleCapabilityStateDto } from '@artificer-toolkit/schema/shared/ruleState'
import type {
  DamageDispositionDto,
  DamageInterceptionChargeDto,
  DamageInterceptionSaveDto
} from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import type { HitPointMaximumReductionRecoveryTag } from '@artificer-toolkit/schema/effects/hitPointMaximumReduction'
import type { EffectOutcomeTargetPrecondition } from './effectOutcomeRegistry.js'
import type {
  CompiledActionActiveEffectPlan,
  CompiledActionCompilerSource,
  CompiledActionZonePlacement
} from '@artificer-toolkit/schema/projections/characterMechanics'
import type {
  ActorRelationshipModuleAuthored,
  OptionalOnHitAuthored
} from '@artificer-toolkit/shared/authored'

/**
 * A System-owned, bounded recurrence declaration. The Encounter coordinator
 * supplies aggregate provenance, target ownership, and the compiled graph
 * that actually ran; adapters never invent those facts.
 */
export interface CharacterRuleActionActiveEffectPlan {
  authoredEffectId: string
  compiledEntryId: string
  frozenGraphNodeId: string
  /**
   * The independently compiled recurrence graph. It is distinct from the
   * originating action graph whenever the authored lifecycle needs a later
   * evaluation, and is persisted verbatim with the active effect.
   */
  frozenGraph: ServerPublishedRuleDefinitionDto
  capabilityContractVersion: number
  /**
   * The boundary the effect's count decrements at. A modifier grant is counted by the grant tick
   * planner, so it is stored with no recurrence stage of its own.
   */
  recurrenceStage: 'NONE' | 'START_OF_TURN' | 'END_OF_TURN'
  /** Set on a repeat save counted to thresholds; the room stores it in the effect's recurrence. */
  saveThresholds?: ActiveEffectSaveThresholds
  /**
   * The test result paths the effect is made on, which the System lists for the path its outcome is
   * authored on; absent for an effect every resolution makes.
   */
  resultGate?: { paths: readonly string[] }
  /** null means the System owns an indefinite terminal condition. */
  initialRemaining: number | null
  /** Set on a plan of a hit-point-tiered action: it holds only for a target at most this many hit points. */
  hitPointTier?: { atMost: number }
  /**
   * Whose turn boundary counts the effect down: its holder's (the default) or its source's. The
   * grant tick planner counts a source-anchored effect on the source's turns.
   */
  tickAnchor?: 'HOLDER' | 'SOURCE'
  /**
   * The source-bound conditions this effect owns together (Hypnotic Pattern: charmed and
   * incapacitated). The aggregate records each pre-existing baseline when it creates the
   * active-effect row; adapters do not infer condition ownership from labels or later mutable state.
   */
  conditionContributions?: readonly {
    conditionId: string
    /** The acting creature is the condition's source; its active effect records it. */
    recordsSource: boolean
    /** The holder must Dash away from the source; needs `recordsSource`. */
    fleesSource: boolean
  }[]
  /** The events that use up or end the effect owning conditions, once for all of them. */
  lifecycle?: {
    /** The events whose first occurrence uses the effect up, sorted and unique. */
    consumeOnFirstEvents?: readonly ActiveEffectConsumeEvent[]
    /** The events whose first occurrence ends the effect, sorted and unique. */
    endOnEvents?: readonly ActiveEffectEndEvent[]
    /** The structured events that end the effect, unique and in canonical order. */
    endOnTriggers?: readonly ActiveEffectEndTrigger[]
    /** The structured events that repeat the effect's save, unique and in canonical order. */
    repeatTriggers?: readonly ActiveEffectRepeatTrigger[]
  }
  /** The timed APPLY_GRANT modifiers this effect owns, folded into the holder while it lasts. */
  modifierGrantContribution?: null | {
    applyGrantOutcomeId: string
    modifiers: readonly CharacterGrantFoldModifier[]
    senses: readonly CharacterGrantFoldSense[]
    /** Whether the duration already counts the turn the grant is made in ("for the turn"). */
    includesCurrentTurn: boolean
    /**
     * A grant whose holder repeats a save each turn is rolled, counted and ended by the turn-effect
     * kernel with the repeat save, not by the grant tick planner.
     */
    countedByTurnEffects?: boolean
    /** The events whose first occurrence uses the grant up, sorted and unique. */
    consumeOnFirstEvents: readonly GrantConsumeEvent[]
    /** The events that end the grant early, sorted and unique. */
    endOnEvents: readonly GrantEndEvent[]
    /** The condition types that end the grant early while its holder has any, sorted and unique. */
    endOnConditionIds: readonly string[]
    /** The activation its holder pays to end the grant by choice, or null when only the GM can. */
    holderEnd: ActiveGrantHolderEnd | null
    /** Only the effect's source meets its attacker grants and attack consume. */
    fromSourceOnly?: true
    /** The grant is active only during its tick anchor's turn while one tick remains. */
    activeOnlyOnFinalAnchorTurn?: true
    /** The uses the effect counts before it ends; its lifecycle `remainingUses` starts here. */
    uses?: number
    /** The grant the holder keeps for `turns` of its turns when the effect ends, however it ends. */
    onEnd?: { turns: number; modifiers: readonly CharacterGrantFoldModifier[] }
    /** The actions the holder may take while the effect is held. */
    grantedActions?: readonly GrantedAction[]
    /** The choices the effect offers beside its holder's turns, such as moving it when the holder falls. */
    effectOffers?: readonly CompiledEffectOffer[]
  }
  /**
   * The item the action is used on, chosen at use from what its target holds or wears; null for
   * none. See the compiled plan schema for each field.
   */
  chosenItem?: CompiledActionActiveEffectPlan['chosenItem']
  /**
   * A successful check makes the holder's location unknown to the observers that fail to notice it
   * (Hide). The settled check total and the observers it beats are added when the effect is created.
   */
  concealmentContribution?: null | {
    observers: 'NON_ALLIES'
    /** The events whose first occurrence ends the concealment, sorted and unique. */
    consumeOnFirstEvents: readonly GrantConsumeEvent[]
  }
  /**
   * Each target holds a bond with every other target the action settled on (Telepathic Bond). The
   * members are added when the effects are created, from the creatures the cast reached.
   */
  actorLinkContribution?: null | {
    linkOutcomeId: string
    linkKind: 'TELEPATHIC'
    /** Creatures whose Intelligence is this or lower cannot join the bond. */
    excludesIntelligenceAtOrBelow: number
  }
  /**
   * Each target swaps into the Creature of the form the caster chose (Giant Insect), for the
   * duration (D130). The chosen form is a cast-time input; every authored form is listed here.
   */
  creatureFormContribution?: null | {
    formOutcomeId: string
    /** Whether damage past the form's last hit point reduces the origin's (Polymorph) or is lost. */
    excessDamageCarriesOver: boolean
    forms: readonly { id: string; label: string; creatureId: string; maxTargets: number }[]
    /**
     * A rule-filtered choice beside the fixed forms: the cast names the Creature on the command and
     * it must meet this (Polymorph: a beast no higher than the target's challenge rating).
     */
    filter: null | {
      creatureTypeId: string | null
      challengeRatingCapKind: 'TARGET' | 'FIXED'
      maxChallengeRatingId: string | null
      excludedSpeedIds: readonly string[]
    }
  }
  /** Target-owned relationship state selected by the System from the exact action outcome. */
  actorRelationshipContribution?: null | {
    relationshipOutcomeId: string
    /** The most creatures the source holds at once through this outcome. */
    heldAtOnce: number
    /** The hold applies only while this predicate holds over the open Attack action. */
    appliesWhen?: AttackSlotConditionDto
    modules: readonly ActorRelationshipModuleAuthored[]
    /** Concrete state selected at settlement; conditional state is omitted unless evidenced. */
    conditionIds: readonly string[]
    capabilitySuppressions: readonly {
      contributionId: string
      capabilityDefinitionIds: readonly string[]
    }[]
  }
  adapterFacts: Readonly<Record<string, RuleValue>>
  /**
   * The adapter fact the cast's own save DC is stored under when the effect is created (the
   * caster's save DC is unknown until then); null when the plan pins its DC itself or needs none.
   */
  castSaveDcFactKey?: null | string
  /** Cast facts copied into `adapterFacts` when the effect is created (a recurring amount). */
  castFactKeys?: readonly string[]
  /**
   * The recurring graph first runs at the holder's next authored turn boundary, not at cast; the
   * effect is created even though no immediate outcome of the cast carries it (D156).
   */
  recurrenceDeferred?: boolean
  /** The temporary hit points the cast and its recurrences give leave when the effect ends. */
  ownsTemporaryHitPoints?: boolean
  /** Exact System-authored perception contributions carried into the frozen effect definition. */
  perceptionContributions: CombatPerceptionContributionsDto
  /** Exact System-authored maintenance policy, or no maintained state. */
  maintenance: null | {
    definitionId: string
    /** The action compiler retains only source identity; persistence resolves this server-side. */
    definitionChecksum: string | null
    owner: 'SOURCE_ACTOR'
    replacementPolicy: 'REPLACE_SAME_DEFINITION'
    emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY' | 'RETAIN_UNTIL_TERMINAL'
  }
  /**
   * The effects beside the plan's own, in creation order. A save failed by at least `failedBy` also
   * applies conditions (unconscious beside poisoned): a rider holds them as a second active effect,
   * bound to this plan's frozen graph node under its own entry. A gated band's timed conditions
   * after the first each take one with no margin and their own duration; `endsWith` names the
   * effect one lasts only while: the plan's own (`'PRIMARY'`) or an earlier rider, by index (D172).
   */
  marginRiders: readonly {
    compiledEntryId: string
    frozenGraphNodeId: string
    failedBy: number | null
    initialRemaining: number | null
    endsWith: null | 'PRIMARY' | number
    conditionContributions: readonly {
      conditionId: string
      recordsSource: boolean
      fleesSource: boolean
    }[]
    lifecycle: {
      /** The structured events that end the rider, unique and in canonical order. */
      endOnTriggers: readonly ActiveEffectEndTrigger[]
    }
  }[]
  /**
   * The immunity the action leaves on its target against this source (D156, SPELLS-31.T5l): a
   * successful save's, for the result block's duration, or an at-will grant's lockout on every
   * creature the cast meets, until the source Character's long rest. The immunity is a second
   * active effect under a frozen graph of its own, so it rides whichever plan the action makes.
   */
  sourceImmunity?: null | {
    compiledEntryId: string
    frozenGraphNodeId: string
    appliesTo: 'SAVE_SUCCESS' | 'EVERY_TARGET'
    immuneToId: string
    initialRemaining: number | null
    frozenGraph: ServerPublishedRuleDefinitionDto
  }
  /**
   * The effect that holds a repeat offer for the cast's whole Concentration (D166), bound to the
   * chosen item and ended through the chosen-item release. It rides the rider slot under its own
   * node of this plan's frozen graph.
   */
  repeatCarrier?: null | {
    compiledEntryId: string
    frozenGraphNodeId: string
    applyGrantOutcomeId: string
    effectOffers: readonly CompiledEffectOffer[]
  }
}

/** A zone an action leaves on the Scene; see `compiledActionZonePlacementSchema`. */
export type CharacterRuleActionZonePlacementPlan = Omit<
  CompiledActionZonePlacement,
  'entry' | 'sourceGrant' | 'regionComponents'
> & {
  entry: CharacterRuleActionActiveEffectPlan
  sourceGrant?: CharacterRuleActionActiveEffectPlan
  regionComponents?: Array<
    Omit<NonNullable<CompiledActionZonePlacement['regionComponents']>[number], 'entry'> & {
      entry: CharacterRuleActionActiveEffectPlan
    }
  >
}

/** The zones an action places when its caster picks one at cast (D140). */
export type CharacterRuleActionZoneChoicePlan = {
  options: { optionId: string; label: string; zone: CharacterRuleActionZonePlacementPlan }[]
}

/**
 * A System compiler can split a direct action into a bounded evidence TEST
 * followed by the one authored OUTCOME selected by that completed test.
 * The aggregate coordinator owns phase receipts and application timing.
 */
export interface CharacterRuleActionTestTemplate {
  published: ServerPublishedRuleDefinitionDto
  /** Exact immutable source identity of the TEST graph. */
  template: RuleGraphSourceIdentityDto
}

export interface CharacterRuleActionOutcomeTemplate {
  published: ServerPublishedRuleDefinitionDto
  /** Identity of the authored OUTCOME template, distinct from this specialized graph checksum. */
  templateChecksum: string
}

export type CharacterRuleActionExecutionPlan =
  | { kind: 'SINGLE_GRAPH'; published: ServerPublishedRuleDefinitionDto }
  | {
      kind: 'TEST_OUTCOME'
      compilerSource: CompiledActionCompilerSource
      test: CharacterRuleActionTestTemplate
      outcomes: readonly {
        pathCode: string
        template: {
          definitionId: string
          gameSystemId: string
          definitionFamilyKey: string
          checksum: string
        }
      }[]
    }

/** A System adapter uses this only when an authored mechanic is structurally unsupported. */
export class CharacterRuleActionUnsupportedCompilationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CharacterRuleActionUnsupportedCompilationError'
  }
}

/** A System adapter throws this when an attack's target has no defense value to roll against. */
export class CharacterRuleActionTargetDefenseUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CharacterRuleActionTargetDefenseUnavailableError'
  }
}

interface CharacterHitPointOutcomeApplicationBase {
  sourceNodeId: string
  sourceOperationKey: string
  authoredPath: string | null
  resolvedPath: string | null
  requestedAmount: number
  resolvedAmount: number
  appliedAmount: number
  beforeCurrentHitPoints: number
  afterCurrentHitPoints: number
  beforeTemporaryHitPoints: number
  afterTemporaryHitPoints: number
  maximumHitPoints: number
  targetActorId: string
}

export type CharacterHitPointOutcomeApplication =
  | (CharacterHitPointOutcomeApplicationBase & { kind: 'HEAL' })
  | (CharacterHitPointOutcomeApplicationBase & {
      kind: 'TEMPORARY_HIT_POINTS'
      /** The active effect the temporary hit points belong to, absent when none (D156). */
      sourceActiveEffectId?: string
    })
  | (CharacterHitPointOutcomeApplicationBase & {
      kind: 'DAMAGE'
      damageTypeId: string
      damageDisposition: DamageDispositionDto
      /** A critical hit: damage at 0 hit points adds two death save failures (D96). */
      critical: boolean
      /** The held effect whose damage interception left the target above 0 hit points instead. */
      interceptedBy?: string
      /** The saves the blow's interceptions asked of the holder, in the order they were rolled. */
      interceptionSaves?: DamageInterceptionSaveDto[]
      /** The charge the intercepting feature spent, when it is limited-use. */
      interceptionCharge?: DamageInterceptionChargeDto
    })

export interface CharacterConditionApplyOutcomeApplication {
  sourceNodeId: string
  sourceOperationKey: string
  authoredPath: string | null
  resolvedPath: string | null
  kind: 'CONDITION_APPLY'
  conditionId: string
  targetActorId: string
}

/** A System-authorized removal of an exact normalized condition. */
export interface CharacterConditionRemoveOutcomeApplication {
  sourceNodeId: string
  sourceOperationKey: string
  authoredPath: string | null
  resolvedPath: string | null
  kind: 'CONDITION_REMOVE'
  conditionId: string
  sourceActiveEffectId: string
  targetActorId: string
}

/** An ended effect's temporary hit points leave its holder while it is still their source (D156). */
export interface CharacterTemporaryHitPointsReleaseApplication {
  sourceNodeId: string
  sourceOperationKey: string
  authoredPath: string | null
  resolvedPath: string | null
  kind: 'TEMPORARY_HIT_POINTS_RELEASE'
  sourceActiveEffectId: string
  targetActorId: string
}

/** The holder's state an ended effect releases: its sole-owned conditions and its temporary hit points. */
export type CharacterEndedEffectReleaseApplication =
  | CharacterConditionRemoveOutcomeApplication
  | CharacterTemporaryHitPointsReleaseApplication

/** A System-authorized stabilize: a dying Character becomes stable, anything else is unchanged. */
export interface CharacterStabilizeOutcomeApplication {
  sourceNodeId: string
  sourceOperationKey: string
  authoredPath: string | null
  resolvedPath: string | null
  kind: 'STABILIZE'
  targetActorId: string
}

/** A System-authorized kill: the target is left at 0 hit points and 0 temporary hit points, and a Character's death saves read dead. */
export interface CharacterKillOutcomeApplication {
  sourceNodeId: string
  sourceOperationKey: string
  authoredPath: string | null
  resolvedPath: string | null
  kind: 'KILL'
  targetActorId: string
}

/** A kill a held damage interception negated: nothing changes, and the interception's use is spent. */
export interface CharacterKillNegatedOutcomeApplication {
  sourceNodeId: string
  sourceOperationKey: string
  authoredPath: string | null
  resolvedPath: string | null
  kind: 'KILL_NEGATED'
  targetActorId: string
  negatedBy: string
  /** The charge the negating feature spent, when it is limited-use. */
  interceptionCharge?: DamageInterceptionChargeDto
}

/** A System-authorized departure: the target leaves the Run's play (D128). */
export interface CharacterDepartOutcomeApplication {
  sourceNodeId: string
  sourceOperationKey: string
  authoredPath: string | null
  resolvedPath: string | null
  kind: 'DEPART'
  targetActorId: string
}

/** A System-authorized removal of one exact normalized condition. */
/**
 * A System-authorized reduction sourced from an earlier interpreted damage
 * application. Aggregate mutation and recovery ownership remain outside the
 * adapter so this carries only the pinned mechanical application facts.
 */
export interface CharacterHitPointMaximumReductionApplication {
  kind: 'HIT_POINT_MAXIMUM_REDUCTION'
  targetActorId: string
  sourceNodeId: string
  sourceOperationKey: string
  authoredPath: string | null
  resolvedPath: string | null
  sourceDamageNodeId: string
  sourceDamageOperationKey: string
  sourceDamageOutcomeId: string
  reductionAmount: number
  recoveryTags: readonly HitPointMaximumReductionRecoveryTag[]
}

/** One UUID-backed scalar reduction selected by a pinned System graph. */
export interface CharacterScalarReductionApplication {
  kind: 'SCALAR_REDUCTION'
  targetActorId: string
  sourceNodeId: string
  sourceOperationKey: string
  authoredPath: string | null
  resolvedPath: string | null
  valueDefinitionId: string
  reductionAmount: number
  stacking: 'ADDITIVE'
  floor: 0
  recoveryTriggers: readonly ('SHORT_REST' | 'LONG_REST')[]
  terminalConsequence: 'TARGET_DIED'
  sourceOutcomeId: string
}

export type CharacterRuleActionApplication =
  | CharacterHitPointOutcomeApplication
  | CharacterConditionApplyOutcomeApplication
  | CharacterConditionRemoveOutcomeApplication
  | CharacterTemporaryHitPointsReleaseApplication
  | CharacterStabilizeOutcomeApplication
  | CharacterKillOutcomeApplication
  | CharacterKillNegatedOutcomeApplication
  | CharacterDepartOutcomeApplication
  | CharacterHitPointMaximumReductionApplication
  | CharacterScalarReductionApplication

/**
 * A sealed System proposal for later authoritative Scene settlement. It is
 * deliberately separate from Character state applications: this adapter
 * selects a movement consequence but never moves a token or consumes state.
 */
export interface CharacterRuleActionSpatialDirective {
  kind: 'FORCED_MOVEMENT'
  targetActorId: string
  sourceNodeId: string
  sourceOperationKey: string
  /**
   * Away from, or toward, the action's source along the straight line (D105); aside within the
   * source's reach; or in any direction (D157).
   */
  direction: CharacterRuleActionForcedMovementDirection
  /** The distance the target moves unless a blocked square stops it first. */
  feet: number
  /** The target moves at most `feet`, its source choosing how far (D157). */
  upTo: boolean
  /** What the move does where it strikes an object or a creature (D159); null for a move that does nothing there. */
  collision: CharacterRuleActionForcedMovementCollision | null
  targetStateChecksum: string
}

/**
 * The collision an authored forced movement carries (D159): the mover takes `diceConfig` of
 * `damageTypeId` for every full 10 feet it travelled, and a creature it strikes makes the
 * `abilityDefinitionId` save against `dc` or takes the same damage and `conditionId`.
 */
export type CharacterRuleActionForcedMovementCollision = {
  diceConfig: string
  damageTypeId: string
  abilityDefinitionId: string
  dc: number
  conditionId: string
}

export type CharacterRuleActionForcedMovementDirection = ForcedMovementDirection

export function isCharacterRuleActionForcedMovementDirection(
  value: unknown
): value is CharacterRuleActionForcedMovementDirection {
  return Object.values(FORCED_MOVEMENT_DIRECTION).some((direction) => direction === value)
}

/**
 * A System-owned replacement of an already evidenced failed saving throw.
 * The aggregate coordinator authorizes the lifecycle pin; adapters validate
 * the completed action evidence and derive applications without rerolling it.
 */
export interface CharacterRuleActionSaveSuccessReplacement {
  lifecycle: {
    definitionId: string
    definitionVersion: number
    definitionChecksum: string
    choiceGraphDefinitionId: string
    choiceGraphDefinitionVersion: number
    choiceGraphDefinitionChecksum: string
    useOutput: string
    interruptedStage: 'AFTER_FAILED_SAVE_BEFORE_OUTCOME'
    replacement: 'SAVE_SUCCESS'
  }
}

/**
 * Test-outcome rules a target's condition mechanics apply (D94): a hit against it is a critical
 * hit, and its saving throws of these abilities fail without counting the roll.
 */
export type CharacterRuleActionConditionOutcomeRules = {
  hitIsCritical: boolean
  saveAutoFailAbilityIds: readonly string[]
}

export interface CharacterRuleActionSystemAdapter {
  gameSystemId: string
  compile(input: { action: EffectActionCapabilityDescriptor }): ServerPublishedRuleDefinitionDto
  /** Chooses the explicit v4 execution arm during projection compilation. */
  compileExecutionPlan?(input: {
    action: EffectActionCapabilityDescriptor
    compilerSource: CompiledActionCompilerSource
  }): CharacterRuleActionExecutionPlan
  /**
   * Returns a portable first evidence phase when this exact compiler source
   * can be safely split. Null retains the legacy single-graph route.
   */
  compileTestTemplate?(input: {
    compilerSource: CompiledActionCompilerSource
  }): CharacterRuleActionTestTemplate | null
  /**
   * The optional on-hit riders merged into this compiled action, each of which its attacker may
   * choose to pay for after a hit (D123). The System owns the compiled effect's shape.
   */
  optionalOnHitRiders(input: { compilerSource: CompiledActionCompilerSource }): readonly {
    riderId: string
    cost: OptionalOnHitAuthored
  }[]
  /** The target preconditions the System's outcome registry declares for these effect kinds (D173 Q1). */
  outcomeTargetPreconditions(input: {
    effectKinds: readonly string[]
  }): readonly EffectOutcomeTargetPrecondition[]
  /** Specializes the one selected authored result path after TEST evidence is terminal. */
  specializeOutcomeTemplate?(input: {
    compilerSource: CompiledActionCompilerSource
    testTemplate: CharacterRuleActionTestTemplate
    selectedPath: string
    facts: Readonly<Record<string, RuleValue>>
    /** The outputs of the completed TEST, which an outcome that depends on its margin reads. */
    testOutputs?: Readonly<Record<string, RuleValue>>
    /** The mode the TEST d20 was settled in, which may differ from the mode the rules derived. */
    testRollMode: string
  }): CharacterRuleActionOutcomeTemplate | null
  /**
   * The zone this action places when its authored outcome is a placed-space manifest (or the zones
   * its caster picks one of, D140), or null for any other action. An unsupported zone throws the unsupported-compilation error.
   */
  compileZonePlacement?(input: {
    action: EffectActionCapabilityDescriptor
    /** The label of the feature that keeps a zone its Effect does not author (a passive melee trait). */
    label?: string
  }): CharacterRuleActionZonePlacementPlan | CharacterRuleActionZoneChoicePlan | null
  /** Returns the exact supported recurring plan for this locked action, if any. */
  activeEffectPlans?(input: {
    action: EffectActionCapabilityDescriptor
    published: ServerPublishedRuleDefinitionDto
  }): readonly CharacterRuleActionActiveEffectPlan[]
  /**
   * The timed grant a passive "when this creature takes damage" feature gives its holder, or null
   * when the feature authors none. An unsupported grant throws the unsupported-compilation error.
   */
  passiveDamageGrantPlan?(input: {
    action: EffectActionCapabilityDescriptor
  }): CharacterRuleActionActiveEffectPlan | null
  /**
   * The immunity a creature that passes a holder's ward leaves on that holder (Nature's Sanctuary),
   * keyed by the ward's grant, or null when the System cannot count the duration.
   */
  incomingGateImmunityPlan?(input: { wardId: string; duration: CompiledDuration }): null | {
    authoredEffectId: string
    capabilityContractVersion: number
    immunity: NonNullable<CharacterRuleActionActiveEffectPlan['sourceImmunity']>
  }
  requiresConditionDefinitionValidation?(input: {
    published: ServerPublishedRuleDefinitionDto
  }): boolean
  validateConditionDefinitions?(input: {
    conditionDefinitionIds: readonly string[]
    published: ServerPublishedRuleDefinitionDto
  }): void
  /**
   * UUID-backed capability definitions needed to bind an optional positional
   * policy. The Encounter owns locking and currentness; Systems select only
   * the definitions their pinned policy understands.
   */
  positionalCapabilityDefinitionIds?(input: {
    automationMode: AutomationModeDto
    optionalCombatSnapshot: unknown
    optionalCombatSnapshotChecksum: string | null
  }): readonly string[]
  /**
   * System policy may provide ordinary, non-authored perception capabilities.
   * The Encounter supplies only an exact observer identity; the returned
   * capability remains a sealed mechanical fact, not homebrew source data.
   */
  combatPerceptionBaselineCapabilities?(input: {
    observerActorId: string
  }): readonly CombatPerceptionCapabilityInstance[]
  /**
   * Reads one immutable recurring-effect perception dependency: it either influences the
   * recurring d20 or gates whether it is attempted. The System owns adapter-fact
   * interpretation; application code never parses it.
   */
  activeEffectPerceptionRequirement?(input: {
    definition: ActiveRuleEffectDefinitionDto
    lifecycle: ActiveRuleEffectLifecycleDto
  }):
    | {
        kind: 'ROLL_INFLUENCE'
        requirement: CombatPerceptionRequirementDto
        influence: string
      }
    | {
        kind: 'ATTEMPT_GATE'
        requirement: CombatPerceptionRequirementDto
        allow: 'WHEN_MET' | 'WHEN_UNMET'
      }
    | null
  bindFacts(input: {
    /** Exact current source mechanic selected under the aggregate lock. */
    actionMechanic: Readonly<Record<string, unknown>> & {
      /** The level a spell is cast at, which selects the authored scaling row of its outcomes. */
      spellCastLevel?: number
      /** The actor's level in each class, which selects class-level scaling rows of its outcomes. */
      classLevels?: Readonly<Record<string, number>>
      /** The optional on-hit riders the player chose (D123), whose merged outcomes then resolve. */
      selectedOptionalRiderIds?: readonly string[]
    }
    /** Exact published graph selected under the aggregate lock. */
    published: ServerPublishedRuleDefinitionDto
    /** Exact current source derived facts selected under the aggregate lock. */
    sourceDerivedFacts: Readonly<Record<string, unknown>>
    /**
     * Exact current source hit points selected under the aggregate lock, which select authored
     * half-hit-point damage dice; an action that authors them fails closed without it.
     */
    sourceHitPoints?: { current: number; maximum: number } | null
    targetActorId: string
    /** Exact current target derived facts selected under the aggregate lock. */
    targetDerivedFacts: Readonly<Record<string, unknown>>
    targetConditionIds: readonly string[]
    /**
     * Outcome rules the target's condition mechanics apply (D94). Omitted applies none.
     */
    conditionOutcomeRules?: CharacterRuleActionConditionOutcomeRules | null
    currentHitPoints: number
    temporaryHitPoints: number
    maximumHitPoints: number
    /** Exact locked effective scalar state keyed by authored value-definition UUID. */
    targetScalarValues: Readonly<Record<string, number>>
    defenses: readonly {
      kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'
      damageTypeId: string
    }[]
    conditionImmunityIds?: readonly string[]
    /** The damage types the target took since its last turn began, which a suppression gate reads. */
    targetDamageTypesTaken?: readonly string[]
    /**
     * The attack was rolled against one of the target's decoys (`ATTACK_DECOYS`): its OUTCOME never
     * runs, because nothing reaches the target itself.
     */
    absorbedByDecoy?: boolean
    /** Exact locked Scene facts for a positional action, or null when none apply. */
    sceneContext?: {
      sceneId: string
      sceneVersion: number
      sourceToken: {
        actorId: string
        height: number
        position: ScenePoint
        rotationDegrees: number
        tokenId: string
        width: number
      }
      targetToken: {
        actorId: string
        height: number
        position: ScenePoint
        rotationDegrees: number
        tokenId: string
        width: number
      }
      grid: SceneGrid
    } | null
    /**
     * Server-derived facts for positional policies. This is intentionally a
     * mechanical projection, never a Scene document or client assertion.
     */
    positionalFacts?: CharacterRuleActionPositionalFacts | null
  }): {
    facts: Readonly<Record<string, RuleValue>>
    /** The System-selected d20 evidence policy for a paused one-stage test. */
    d20RollMode?: string
    /** The face the System keeps for that mode, present whenever `d20RollMode` is. */
    d20Keep?: RollModeKeep
    /**
     * Whose d20 it is, present whenever `d20RollMode` is: the source rolls an attack, the target a
     * saving throw. The roll goes to that actor's controllers (ADR 0034 decision 3).
     */
    d20Roller?: 'SOURCE' | 'TARGET'
    d20Audit?: {
      contributors: readonly ReceiptD20ContributorDto[]
      contributorChecksum: string
      modifier: number
      defenseOrDc: number
      /** The dice the test rolls beside its d20 and adds after the kept die (D156). */
      addedDice: readonly D20AddedDieDto[]
      /** The ability a saving throw is made with; absent on an attack roll. */
      savingThrowAbilityDefinitionId?: string
    }
  }
  /**
   * Binds current target facts for one persisted recurring effect. The
   * immutable definition supplies all authored/source facts; this method must
   * not resolve current authored content.
   */
  bindActiveEffectFacts?(input: {
    activeEffectId: string
    definition: ActiveRuleEffectDefinitionDto
    lifecycle: ActiveRuleEffectLifecycleDto
    targetActorId: string
    targetDerivedFacts: Readonly<Record<string, unknown>>
    targetConditionIds: readonly string[]
    /**
     * Outcome rules the target's condition mechanics apply (D94). Omitted applies none.
     */
    conditionOutcomeRules?: CharacterRuleActionConditionOutcomeRules | null
    currentHitPoints: number
    temporaryHitPoints: number
    maximumHitPoints: number
    /** Exact locked effective scalar state keyed by authored value-definition UUID. */
    targetScalarValues: Readonly<Record<string, number>>
    defenses: readonly {
      kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'
      damageTypeId: string
    }[]
    conditionImmunityIds?: readonly string[]
    /** Current, server-derived result for an authored recurring perception dependency. */
    perception?: {
      requirement: CombatPerceptionRequirementDto
      satisfied: boolean
      checksum: string
    } | null
    /** How the damage that triggered this repeat save tilts its d20 (D167); absent on a turn tick. */
    rollInfluence?: string | null
  }): {
    facts: Readonly<Record<string, RuleValue>>
    evidencePolicy: ServerRuleExecutionD20PolicyDto | null
  }
  /** Rejects protection-dependent fixed effects before kernel execution. */
  preflightActiveEffectTargetProtection?(input: {
    definition: ActiveRuleEffectDefinitionDto
    targetDerivedFacts: Readonly<Record<string, unknown>>
  }): void
  interpret(input: {
    execution: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>
    occurrenceId: string
    published: ServerPublishedRuleDefinitionDto
    targetActorId: string
    currentHitPoints: number
    temporaryHitPoints: number
    maximumHitPoints: number
    defenses: readonly {
      kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'
      damageTypeId: string
    }[]
    conditionImmunityIds?: readonly string[]
  }): readonly CharacterRuleActionApplication[]
  /** Returns sealed spatial proposals only; Scene settlement remains aggregate-owned. */
  interpretSpatial?(input: {
    execution: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>
    occurrenceId: string
    published: ServerPublishedRuleDefinitionDto
    targetActorId: string
  }): readonly CharacterRuleActionSpatialDirective[]
  /**
   * Applies an exact System-authorized successful-save branch from immutable
   * failed-save evidence. It must never issue a new roll or mutate that evidence.
   */
  interpretSaveSuccessReplacement?(input: {
    execution: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>
    occurrenceId: string
    published: ServerPublishedRuleDefinitionDto
    targetActorId: string
    currentHitPoints: number
    temporaryHitPoints: number
    maximumHitPoints: number
    defenses: readonly {
      kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'
      damageTypeId: string
    }[]
    conditionImmunityIds?: readonly string[]
    replacement: CharacterRuleActionSaveSuccessReplacement
  }): readonly CharacterRuleActionApplication[]
  /** Interprets one completed persisted recurring effect against its exact graph. */
  interpretActiveEffect?(input: {
    execution: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>
    occurrenceId: string
    activeEffectId: string
    definition: ActiveRuleEffectDefinitionDto
    lifecycle: ActiveRuleEffectLifecycleDto
    graph: CompiledRuleGraph
    targetActorId: string
    currentHitPoints: number
    temporaryHitPoints: number
    maximumHitPoints: number
    defenses: readonly {
      kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'
      damageTypeId: string
    }[]
    conditionImmunityIds?: readonly string[]
  }): {
    applications: readonly CharacterRuleActionApplication[]
    /** Sealed from the exact frozen graph result, never command input. */
    terminal: boolean
    /** A retained recurring effect may resolve an authorized no-op branch. */
    emptyApplicationAllowed?: boolean
    /** Only a threshold-counted effect: its save tally once this turn's save is counted. */
    saveTally?: ActiveEffectSaveTally
  }
}

interface CharacterRuleActionPositionalTokenFact {
  actorId: string
  height: number
  position: ScenePoint
  rotationDegrees: number
  tokenId: string
  width: number
}

/**
 * One locked non-source/non-target actor candidate. Relationship and
 * perception are intentionally pair-specific rather than inferred by a
 * System adapter from labels, sides, or presentation state.
 */
export interface CharacterRuleActionPositionalCandidateFact {
  actorId: string
  capabilityState: ResolvedRuleCapabilityStateDto
  capabilityStateChecksum: string
  canSeeTarget: boolean
  perceptionChecksum: string
  sourceRelationship: 'ALLIED' | 'HOSTILE' | 'NEUTRAL'
  targetRelationship: 'ALLIED' | 'HOSTILE' | 'NEUTRAL'
  token: CharacterRuleActionPositionalTokenFact
}

/**
 * Exact action-local positional facts. The dependency checksum is retained
 * with a paused action so resume can reject changed Scene, relationship,
 * capability, or perception state before any RNG or outcome mutation.
 */
export interface CharacterRuleActionPositionalFacts {
  automationMode: AutomationModeDto
  candidates: readonly CharacterRuleActionPositionalCandidateFact[]
  dependencyChecksum: string
  optionalCombatSnapshot: unknown
  optionalCombatSnapshotChecksum: string | null
  sourceCapabilityState: ResolvedRuleCapabilityStateDto
  sourceCapabilityStateChecksum: string
  sourceCanSeeTarget: boolean
  sourcePerceptionChecksum: string
  sourceTargetRelationship: 'ALLIED' | 'HOSTILE' | 'NEUTRAL'
  targetCapabilityState: ResolvedRuleCapabilityStateDto
  targetCapabilityStateChecksum: string
}
