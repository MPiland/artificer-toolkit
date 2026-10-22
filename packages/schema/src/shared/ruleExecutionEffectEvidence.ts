import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'
import { z, lazySchema, lazySchemaParts } from '../zod.js'

import { MAX_ACTIVE_RULE_EFFECTS_PER_OWNER } from './activeRuleEffects.js'
import { activeEffectSaveTallySchema } from './activeRuleEffectLifecycle.js'
import {
  characterMechanicsApplicationDtoSchema,
  characterMechanicsTargetStateDtoSchema,
  characterMechanicsTargetTransitionDtoSchema,
  encounterActorActiveEffectCreateReceiptDtoSchema
} from './ruleExecutionMechanics.js'
import { encounterActionEconomyTransitionDtoSchema } from './ruleExecutionEncounterApplications.js'
import { serverRuleExecutionD20EvidenceDtoSchema } from './ruleExecutionEvidence.js'
import { serverCompletedRuleExecutionDtoSchema } from './ruleExecutionProtocol.js'
import {
  ruleExecutionAggregateVersionSchema as aggregateVersionSchema,
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionContractVersionSchema as contractVersionSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionLocalNodeIdSchema as localNodeIdSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import {
  spatialEffectCurrentnessPinDtoSchema,
  spatialMeleeRetaliationCandidateDtoSchema,
  spatialPendingCandidateDtoSchema,
  spatialTurnCandidateDtoSchema
} from './ruleExecutionSpatial.js'
import { MAX_SPATIAL_CANDIDATES } from './spatialFacts.js'
import {
  movementConcentrationEndDtoSchema,
  movementConcentrationExecutionsDtoSchema
} from './ruleExecutionMovementConcentration.js'

export const turnEffectCharacterTransitionDtoSchema = lazySchema(() =>
  z.strictObject({
    characterId: uuidSchema,
    targetActorId: uuidSchema,
    beforeStreamVersion: aggregateVersionSchema,
    afterStreamVersion: aggregateVersionSchema,
    before: characterMechanicsTargetStateDtoSchema,
    after: characterMechanicsTargetStateDtoSchema
  })
)

const turnEffectExecutionOwnerDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('CHARACTER'), characterId: uuidSchema }),
    z.strictObject({ kind: z.literal('ENCOUNTER_ACTOR') })
  ])
)

export const turnEffectEncounterActorTransitionDtoSchema = lazySchema(() =>
  z.strictObject({
    targetActorId: uuidSchema,
    before: characterMechanicsTargetStateDtoSchema,
    after: characterMechanicsTargetStateDtoSchema
  })
)

const spatialEffectTransitionDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('DELETE'),
      expectedVersion: aggregateVersionSchema,
      definitionChecksum: checksumSchema,
      lifecycleChecksum: checksumSchema,
      placementChecksum: checksumSchema,
      spatialStateChecksum: checksumSchema
    }),
    z.strictObject({
      kind: z.literal('UPDATE'),
      expectedVersion: aggregateVersionSchema,
      afterVersion: aggregateVersionSchema,
      definitionChecksum: checksumSchema,
      lifecycleChecksum: checksumSchema,
      placementChecksum: checksumSchema,
      beforeSpatialStateChecksum: checksumSchema,
      afterSpatialStateChecksum: checksumSchema,
      beforeRevealed: z.literal(false),
      afterRevealed: z.literal(true)
    }),
    z.strictObject({
      kind: z.literal('UNCHANGED'),
      expectedVersion: aggregateVersionSchema,
      definitionChecksum: checksumSchema,
      lifecycleChecksum: checksumSchema,
      placementChecksum: checksumSchema,
      spatialStateChecksum: checksumSchema
    })
  ])
)

export const spatialEffectTransitionEntryDtoSchema = lazySchema(() =>
  z.strictObject({
    effectId: uuidSchema,
    transition: spatialEffectTransitionDtoSchema
  })
)

export const refineSpatialEffectTransition = (
  effect: z.infer<typeof spatialEffectCurrentnessPinDtoSchema>,
  transition: z.infer<typeof spatialEffectTransitionDtoSchema>,
  context: z.core.$RefinementCtx,
  path: (string | number)[]
) => {
  if (
    transition.expectedVersion !== effect.version ||
    transition.definitionChecksum !== effect.definitionChecksum ||
    transition.lifecycleChecksum !== effect.lifecycleChecksum ||
    transition.placementChecksum !== effect.placementChecksum
  )
    context.addIssue({
      code: 'custom',
      path,
      message: 'Spatial root transition must bind exact locked currentness.'
    })
  if (
    (transition.kind === 'DELETE' && effect.activation !== 'ONE_SHOT') ||
    (transition.kind === 'UPDATE' &&
      (effect.activation !== 'REPEATABLE' ||
        !effect.revealOnTrigger ||
        effect.revealed ||
        transition.afterVersion !== transition.expectedVersion + 1 ||
        transition.beforeSpatialStateChecksum !== effect.spatialStateChecksum ||
        transition.afterSpatialStateChecksum !==
          checksumRuleDocument({ schemaVersion: 1, revealed: true }))) ||
    (transition.kind === 'UNCHANGED' &&
      (effect.activation !== 'REPEATABLE' ||
        (!effect.revealed && effect.revealOnTrigger) ||
        transition.spatialStateChecksum !== effect.spatialStateChecksum)) ||
    (transition.kind === 'DELETE' &&
      transition.spatialStateChecksum !== effect.spatialStateChecksum)
  )
    context.addIssue({
      code: 'custom',
      path,
      message: 'Spatial root transition must use the closed one-shot or reveal-state lifecycle.'
    })
}

/** The target-bound completion every spatial execution carries, whatever contact produced it. */
const spatialExecutionEvidenceFields = lazySchemaParts(() => ({
  execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
  d20: z.nullable(serverRuleExecutionD20EvidenceDtoSchema),
  targetTransition: characterMechanicsTargetTransitionDtoSchema,
  applications: z
    .array(characterMechanicsApplicationDtoSchema)
    .check(z.maxLength(RULE_GRAPH_LIMITS.NODES))
}))

const refineSpatialExecutionEvidence = (
  value: {
    candidate: {
      effect: z.infer<typeof spatialEffectCurrentnessPinDtoSchema>
      target: z.infer<typeof spatialPendingCandidateDtoSchema>['target']
      candidate: { targetActorId: string }
    }
    execution: z.infer<typeof serverCompletedRuleExecutionDtoSchema>
    d20: z.infer<typeof serverRuleExecutionD20EvidenceDtoSchema> | null
    targetTransition: { checksum: string }
    applications: z.infer<typeof characterMechanicsApplicationDtoSchema>[]
  },
  context: z.core.$RefinementCtx
) => {
  const effect = value.candidate.effect
  const evidence = value.execution.evidence
  if (
    evidence.source.definitionId !== effect.authoredEffectId ||
    evidence.source.checksum !== effect.frozenSourceChecksum ||
    evidence.capabilityContractVersion !== effect.capabilityContractVersion ||
    JSON.stringify(value.execution.outputs) !== JSON.stringify(evidence.outputs)
  )
    context.addIssue({
      code: 'custom',
      path: ['execution', 'evidence'],
      message: 'Spatial execution evidence must bind the frozen effect graph identity.'
    })
  const bindings =
    evidence.sourceEntryBindings?.filter(
      (binding) =>
        binding.sourceEntryId === effect.compiledEntryId &&
        binding.nodeId === effect.frozenGraphNodeId
    ) ?? []
  const sourceTraces = evidence.trace.filter((trace) => trace.nodeId === effect.frozenGraphNodeId)
  if (bindings.length !== 1 || sourceTraces.length !== 1)
    context.addIssue({
      code: 'custom',
      path: ['execution', 'evidence', 'sourceEntryBindings'],
      message: 'Spatial execution evidence must retain one frozen source-entry binding.'
    })
  if (value.targetTransition.checksum !== value.candidate.target.targetStateChecksum)
    context.addIssue({
      code: 'custom',
      path: ['targetTransition', 'checksum'],
      message: 'Spatial target transition must bind the exact frozen target currentness checksum.'
    })
  const d20RequestTraces = evidence.trace.filter(
    (trace) =>
      trace.operation.key === 'evidence.integer-range' &&
      trace.operation.contractVersion === 1 &&
      trace.inputs.min === 1 &&
      trace.inputs.max === 20 &&
      trace.evidence?.kind === 'INTEGER_RANGE'
  )
  const d20ResultTraces = evidence.trace.filter(
    (trace) =>
      typeof trace.inputs.naturalD20 === 'number' &&
      typeof trace.inputs.modifier === 'number' &&
      typeof trace.inputs.threshold === 'number' &&
      typeof trace.inputs.contributorChecksum === 'string' &&
      typeof trace.outputs.contributorChecksum === 'string' &&
      typeof trace.outputs.total === 'number' &&
      typeof trace.outputs.resultPath === 'string'
  )
  const hasD20Trace = d20RequestTraces.length > 0 || d20ResultTraces.length > 0
  if (
    (value.d20 === null && hasD20Trace) ||
    (value.d20 !== null && (d20RequestTraces.length !== 1 || d20ResultTraces.length !== 1))
  )
    context.addIssue({
      code: 'custom',
      path: ['d20'],
      message: 'Spatial d20 receipt presence must match its completed trace.'
    })
  if (value.d20 !== null) {
    const d20 = value.d20
    const requestMatches = d20RequestTraces.filter(
      (trace) =>
        trace.evidence?.requestId === d20.requestId && trace.evidence?.value === d20.selectedNatural
    )
    const resultMatches = d20ResultTraces.filter(
      (trace) =>
        trace.outputs.targetActorId === value.candidate.candidate.targetActorId &&
        trace.inputs.naturalD20 === d20.selectedNatural &&
        trace.inputs.modifier === d20.modifier &&
        trace.inputs.threshold === d20.defenseOrDc &&
        trace.inputs.contributorChecksum === d20.contributorChecksum &&
        trace.outputs.contributorChecksum === d20.contributorChecksum &&
        trace.outputs.total === d20.total &&
        trace.outputs.resultPath === d20.resultPath
    )
    if (requestMatches.length !== 1 || resultMatches.length !== 1)
      context.addIssue({
        code: 'custom',
        path: ['d20'],
        message: 'Spatial d20 evidence must bind the exact completed trace.'
      })
  }
  const authorizedCandidates = evidence.trace
    .map((trace, traceIndex) => ({ trace, traceIndex }))
    .filter(
      ({ trace }) =>
        trace.outputs.applicationCandidate === true && trace.outputs.authorized === true
    )
  if (
    authorizedCandidates.some(
      ({ trace }) => trace.outputs.targetStateChecksum !== value.targetTransition.checksum
    )
  )
    context.addIssue({
      code: 'custom',
      path: ['applications'],
      message: 'Spatial application candidate checksum is invalid.'
    })
  const boundTraceIndexes = new Set<number>()
  let priorTraceIndex = -1
  for (const application of value.applications) {
    const matches = authorizedCandidates.filter(
      ({ trace }) =>
        trace.nodeId === application.sourceNodeId &&
        trace.operation.key === application.sourceOperationKey &&
        trace.outputs.targetActorId === value.candidate.candidate.targetActorId &&
        (trace.outputs.authoredPath ?? null) === application.authoredPath &&
        (trace.outputs.resolvedPath ?? null) === application.resolvedPath &&
        (application.kind === 'TEMPORARY_HIT_POINTS_RELEASE'
          ? false
          : application.kind === 'CONDITION_APPLY' || application.kind === 'CONDITION_REMOVE'
            ? trace.outputs.conditionId === application.conditionId
            : application.kind === 'STABILIZE' ||
                application.kind === 'KILL' ||
                application.kind === 'KILL_NEGATED' ||
                application.kind === 'DEPART'
              ? true
              : application.kind === 'SCALAR_REDUCTION'
                ? trace.outputs.amount === application.reductionAmount
                : trace.outputs.amount === application.requestedAmount &&
                  (application.kind !== 'DAMAGE' ||
                    trace.outputs.damageTypeId === application.damageTypeId))
    )
    if (
      !evidence.sourceEntryBindings?.some(
        (binding) => binding.nodeId === application.sourceNodeId
      ) ||
      matches.length !== 1 ||
      matches[0]!.traceIndex <= priorTraceIndex ||
      boundTraceIndexes.has(matches[0]!.traceIndex)
    )
      context.addIssue({
        code: 'custom',
        path: ['applications'],
        message: 'Spatial applications must bind ordered authorized effect trace candidates.'
      })
    else {
      priorTraceIndex = matches[0]!.traceIndex
      boundTraceIndexes.add(matches[0]!.traceIndex)
    }
  }
  if (
    authorizedCandidates.length !== boundTraceIndexes.size ||
    authorizedCandidates.some(({ traceIndex }) => !boundTraceIndexes.has(traceIndex))
  )
    context.addIssue({
      code: 'custom',
      path: ['applications'],
      message: 'Spatial applications must cover every authorized effect trace candidate.'
    })
}

/** One target-bound execution of an Encounter/Scene-owned spatial root. */
export const spatialMovementExecutionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      ordinal: z
        .number()
        .check(z.int())
        .check(z.gte(0))
        .check(z.lte(MAX_SPATIAL_CANDIDATES - 1)),
      candidate: spatialPendingCandidateDtoSchema,
      concentrationEnd: z.optional(movementConcentrationEndDtoSchema),
      concentrationChecks: z.optional(movementConcentrationExecutionsDtoSchema),
      ...spatialExecutionEvidenceFields()
    })
    .check(z.superRefine(refineSpatialExecutionEvidence))
)

/** One target-bound execution of a zone against the creature whose turn boundary caught it. */
export const spatialTurnExecutionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      ordinal: z
        .number()
        .check(z.int())
        .check(z.gte(0))
        .check(z.lte(MAX_SPATIAL_CANDIDATES - 1)),
      candidate: spatialTurnCandidateDtoSchema,
      /** The Action the creature lost by failing the zone's save; null when it lost none. */
      actionEconomy: z.nullable(encounterActionEconomyTransitionDtoSchema),
      ...spatialExecutionEvidenceFields()
    })
    .check(z.superRefine(refineSpatialExecutionEvidence))
)

/** One execution of a zone against the attacker that hit its source with a melee attack (D153). */
export const spatialMeleeRetaliationExecutionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      ordinal: z
        .number()
        .check(z.int())
        .check(z.gte(0))
        .check(z.lte(MAX_SPATIAL_CANDIDATES - 1)),
      candidate: spatialMeleeRetaliationCandidateDtoSchema,
      ...spatialExecutionEvidenceFields()
    })
    .check(z.superRefine(refineSpatialExecutionEvidence))
)

/**
 * The zones a melee hit set off against its attacker, recorded on the attack's receipt: the
 * selection pin the commit re-derives from the locked Scene and each execution in order.
 */
export const meleeRetaliationEvidenceDtoSchema = lazySchema(() =>
  z
    .strictObject({
      selectionChecksum: checksumSchema,
      executions: z
        .array(spatialMeleeRetaliationExecutionDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(MAX_SPATIAL_CANDIDATES)),
      /** Timed grants the attacker's own passive damage triggers made from the zones' damage; undo deletes them. */
      grantEffectTransitions: z._default(
        z.array(encounterActorActiveEffectCreateReceiptDtoSchema).check(z.maxLength(4)),
        []
      ),
      /** Conditions the damage-ended effects released from the attacker; undo gives them back with the effects. */
      releasedConditionIds: z._default(
        z
          .array(z.string().check(z.minLength(1)))
          .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)),
        []
      )
    })
    .check(
      z.superRefine((value, context) => {
        const attackers = new Set(
          value.executions.map(({ candidate }) => candidate.candidate.targetActorId)
        )
        if (
          attackers.size !== 1 ||
          value.executions.some((execution, index) => execution.ordinal !== index)
        )
          context.addIssue({
            code: 'custom',
            path: ['executions'],
            message: 'Melee retaliation executions catch one attacker in order.'
          })
      })
    )
)

export type MeleeRetaliationEvidenceDto = z.infer<typeof meleeRetaliationEvidenceDtoSchema>

/** An attack receipt's retaliation catches its attacker in zones its target holds. */
export function validateMeleeRetaliation(
  value: {
    sourceActorId: string
    targetActorId: string
    meleeRetaliation?: MeleeRetaliationEvidenceDto | undefined
  },
  context: z.core.$RefinementCtx
) {
  if (
    value.meleeRetaliation?.executions.some(
      ({ candidate }) =>
        candidate.candidate.targetActorId !== value.sourceActorId ||
        candidate.candidate.sourceActorId !== value.targetActorId ||
        value.sourceActorId === value.targetActorId
    )
  )
    context.addIssue({
      code: 'custom',
      path: ['meleeRetaliation'],
      message: 'Melee retaliation catches the attacker in zones its target holds.'
    })
}

export const turnEffectExecutionDtoSchema = lazySchema(() =>
  z.strictObject({
    ordinal: z
      .number()
      .check(z.int())
      .check(z.gte(0))
      .check(z.lte(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER * 2 - 1)),
    boundaryOrdinal: integerSchema.check(z.gte(0)).check(z.lte(1)),
    stage: z.enum(['START_OF_TURN', 'END_OF_TURN']),
    targetActorId: uuidSchema,
    owner: turnEffectExecutionOwnerDtoSchema,
    activeEffectId: uuidSchema,
    createdOrdinal: positiveIntegerSchema,
    beforeVersion: aggregateVersionSchema,
    definition: z.strictObject({
      authoredEffectId: uuidSchema,
      compiledEntryId: uuidSchema,
      frozenGraphNodeId: localNodeIdSchema,
      frozenSourceChecksum: checksumSchema,
      capabilityContractVersion: contractVersionSchema,
      definitionChecksum: checksumSchema
    }),
    execution: serverCompletedRuleExecutionDtoSchema,
    d20: z.nullable(serverRuleExecutionD20EvidenceDtoSchema),
    targetTransition: characterMechanicsTargetTransitionDtoSchema,
    applications: z
      .array(characterMechanicsApplicationDtoSchema)
      .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
    lifecycle: z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('UPDATE'),
        expectedVersion: aggregateVersionSchema,
        afterVersion: aggregateVersionSchema,
        beforeRemainingTicks: z.nullable(positiveIntegerSchema),
        afterRemainingTicks: z.nullable(positiveIntegerSchema),
        /** Only a threshold-counted effect: its save tally after this turn's save. */
        afterSaveTally: z.optional(activeEffectSaveTallySchema),
        beforeLifecycleChecksum: checksumSchema,
        afterLifecycleChecksum: checksumSchema
      }),
      z.strictObject({
        kind: z.literal('EXPIRE'),
        expectedVersion: aggregateVersionSchema,
        beforeRemainingTicks: z.nullable(positiveIntegerSchema),
        afterRemainingTicks: z.union([z.literal(0), z.null()]),
        beforeLifecycleChecksum: checksumSchema
      })
    ])
  })
)

export const spatialMovementCharacterTransitionDtoSchema = lazySchema(() =>
  z.strictObject({
    characterId: uuidSchema,
    targetActorId: uuidSchema,
    beforeStreamVersion: aggregateVersionSchema,
    afterStreamVersion: aggregateVersionSchema,
    before: characterMechanicsTargetStateDtoSchema,
    after: characterMechanicsTargetStateDtoSchema
  })
)

export const spatialMovementEncounterActorTransitionDtoSchema = lazySchema(() =>
  z.strictObject({
    targetActorId: uuidSchema,
    before: characterMechanicsTargetStateDtoSchema,
    after: characterMechanicsTargetStateDtoSchema
  })
)
