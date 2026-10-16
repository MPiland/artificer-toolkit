import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'
import type {
  CharacterGrantFoldModifier,
  CharacterGrantFoldSense
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  ActiveRuleEffectDefinitionDto,
  ActiveRuleEffectLifecycleDto,
  RuleGraphSourceIdentityDto,
  ServerRuleExecutionD20PolicyDto,
  ServerPublishedRuleDefinitionDto,
  ServerRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type {
  ActiveGrantHolderEnd,
  GrantConsumeEvent,
  GrantEndEvent
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { CombatPerceptionContributionsDto } from '@artificer-toolkit/schema/shared/combatPerception'
import type { EffectActionCapabilityDescriptor } from './characterActionCapabilityDiscovery.js'
import type { CompiledRuleGraph, RuleValue } from '@artificer-toolkit/shared/rules'
import type { SceneGrid, ScenePoint } from '@artificer-toolkit/shared/vtt'
import type { CombatPerceptionCapabilityInstance } from '@artificer-toolkit/shared/rules'
import type { CombatPerceptionRequirementDto } from '@artificer-toolkit/schema/shared/combatPerception'
import type { ResolvedRuleCapabilityStateDto } from '@artificer-toolkit/schema/shared/ruleState'
import type { DamageDispositionDto } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import type { HitPointMaximumReductionRecoveryTag } from '@artificer-toolkit/schema/effects/hitPointMaximumReduction'
import type {
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
  /** null means the System owns an indefinite terminal condition. */
  initialRemaining: number | null
  /**
   * The source-bound condition this effect owns. The aggregate records the
   * pre-existing baseline when it creates the active-effect row; adapters do
   * not infer condition ownership from labels or later mutable state.
   */
  conditionContribution?: null | { conditionId: string }
  /** The timed APPLY_GRANT modifiers this effect owns, folded into the holder while it lasts. */
  modifierGrantContribution?: null | {
    applyGrantOutcomeId: string
    modifiers: readonly CharacterGrantFoldModifier[]
    senses: readonly CharacterGrantFoldSense[]
    /** Whose turn boundary counts the grant down: its holder's or its source's. */
    tickAnchor: 'HOLDER' | 'SOURCE'
    /** Whether the duration already counts the turn the grant is made in ("for the turn"). */
    includesCurrentTurn: boolean
    /** The events whose first occurrence uses the grant up, sorted and unique. */
    consumeOnFirstEvents: readonly GrantConsumeEvent[]
    /** The events that end the grant early, sorted and unique. */
    endOnEvents: readonly GrantEndEvent[]
    /** The condition types that end the grant early while its holder has any, sorted and unique. */
    endOnConditionIds: readonly string[]
    /** The activation its holder pays to end the grant by choice, or null when only the GM can. */
    holderEnd: ActiveGrantHolderEnd | null
  }
  /**
   * A successful check makes the holder's location unknown to the observers that fail to notice it
   * (Hide). The settled check total and the observers it beats are added when the effect is created.
   */
  concealmentContribution?: null | {
    observers: 'NON_ALLIES'
    /** The events whose first occurrence ends the concealment, sorted and unique. */
    consumeOnFirstEvents: readonly GrantConsumeEvent[]
  }
  /** Target-owned relationship state selected by the System from the exact action outcome. */
  actorRelationshipContribution?: null | {
    relationshipOutcomeId: string
    /** The most creatures the source holds at once through this outcome. */
    heldAtOnce: number
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
}

/** A zone an action leaves on the Scene; see `compiledActionZonePlacementSchema`. */
export type CharacterRuleActionZonePlacementPlan = Omit<CompiledActionZonePlacement, 'entry'> & {
  entry: CharacterRuleActionActiveEffectPlan
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
  | (CharacterHitPointOutcomeApplicationBase & {
      kind: 'HEAL' | 'TEMPORARY_HIT_POINTS'
    })
  | (CharacterHitPointOutcomeApplicationBase & {
      kind: 'DAMAGE'
      damageTypeId: string
      damageDisposition: DamageDispositionDto
      /** A critical hit: damage at 0 hit points adds two death save failures (D96). */
      critical: boolean
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

/** A System-authorized stabilize: a dying Character becomes stable, anything else is unchanged. */
export interface CharacterStabilizeOutcomeApplication {
  sourceNodeId: string
  sourceOperationKey: string
  authoredPath: string | null
  resolvedPath: string | null
  kind: 'STABILIZE'
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
  | CharacterStabilizeOutcomeApplication
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
  authoredPath: string | null
  resolvedPath: string | null
  direction: 'AWAY_FROM_SOURCE' | 'TOWARD_SOURCE' | 'CHOICE'
  distanceMode: 'UP_TO_SPEED' | 'FIXED_DISTANCE'
  amount: number | null
  unit: string | null
  actionEconomy: 'NONE' | 'REACTION'
  targetStateChecksum: string
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
  /** Specializes the one selected authored result path after TEST evidence is terminal. */
  specializeOutcomeTemplate?(input: {
    compilerSource: CompiledActionCompilerSource
    testTemplate: CharacterRuleActionTestTemplate
    selectedPath: string
    facts: Readonly<Record<string, RuleValue>>
  }): CharacterRuleActionOutcomeTemplate | null
  /**
   * The zone this action places when its authored outcome is a placed-space manifest, or null for
   * any other action. An unsupported zone throws the unsupported-compilation error.
   */
  compileZonePlacement?(input: {
    action: EffectActionCapabilityDescriptor
  }): CharacterRuleActionZonePlacementPlan | null
  /** Returns the exact supported recurring plan for this locked action, if any. */
  activeEffectPlans?(input: {
    action: EffectActionCapabilityDescriptor
    published: ServerPublishedRuleDefinitionDto
  }): readonly CharacterRuleActionActiveEffectPlan[]
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
   * Reads one immutable recurring-effect perception dependency. The System
   * owns adapter-fact interpretation; application code never parses it.
   */
  activeEffectPerceptionRequirement?(input: {
    definition: ActiveRuleEffectDefinitionDto
    lifecycle: ActiveRuleEffectLifecycleDto
  }): {
    requirement: CombatPerceptionRequirementDto
    influence: 'ADVANTAGE' | 'DISADVANTAGE'
  } | null
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
    d20RollMode?: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
    /**
     * Whose d20 it is, present whenever `d20RollMode` is: the source rolls an attack, the target a
     * saving throw. The roll goes to that actor's controllers (ADR 0034 decision 3).
     */
    d20Roller?: 'SOURCE' | 'TARGET'
    d20Audit?: {
      contributors: readonly {
        sourceId: string
        grantId: string | null
        domainKey: string | null
        influence: 'ADVANTAGE' | 'DISADVANTAGE'
      }[]
      contributorChecksum: string
      modifier: number
      defenseOrDc: number
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
