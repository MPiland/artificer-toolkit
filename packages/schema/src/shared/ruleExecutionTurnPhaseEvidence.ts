import { z, lazySchema, lazySchemaParts } from '../zod.js'

import {
  spatialTurnExecutionDtoSchema,
  turnEffectCharacterTransitionDtoSchema,
  turnEffectEncounterActorTransitionDtoSchema
} from './ruleExecutionEffectEvidence.js'
import { ruleExecutionChecksumSchema as checksumSchema } from './ruleExecutionPrimitives.js'
import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'
import { MAX_SPATIAL_CANDIDATES } from './spatialFacts.js'

/**
 * A turn phase's staged executions, retained until the final transaction re-locks and applies them.
 * Present only when the phase ran: an empty plan is never valid.
 */
export const stagedTurnPlanDtoSchema = <Execution extends z.ZodMiniType>(
  execution: Execution,
  maxExecutions: number
) =>
  z.strictObject({
    selectionChecksum: checksumSchema,
    executions: z.array(execution).check(z.minLength(1)).check(z.maxLength(maxExecutions))
  })

/** A turn phase's terminal evidence: its executions and the owner transitions they produced. */
export const executedTurnPhaseEvidenceDtoSchema = <Execution extends z.ZodMiniType>(
  execution: Execution,
  maxExecutions: number,
  maxTransitions = 2
) =>
  z.strictObject({
    kind: z.literal('EXECUTED'),
    ...stagedTurnPlanDtoSchema(execution, maxExecutions).shape,
    characterTransitions: z
      .array(turnEffectCharacterTransitionDtoSchema)
      .check(z.minLength(0))
      .check(z.maxLength(maxTransitions)),
    encounterActorTransitions: z
      .array(turnEffectEncounterActorTransitionDtoSchema)
      .check(z.minLength(0))
      .check(z.maxLength(maxTransitions))
  })

export const stagedTurnZonePlanDtoSchema = lazySchema(() =>
  stagedTurnPlanDtoSchema(spatialTurnExecutionDtoSchema, MAX_SPATIAL_CANDIDATES)
)

export const executedTurnZonePhaseEvidenceDtoSchema = lazySchema(() =>
  executedTurnPhaseEvidenceDtoSchema(
    spatialTurnExecutionDtoSchema,
    MAX_SPATIAL_CANDIDATES,
    MAX_ENCOUNTER_ACTORS
  )
)

export type StagedTurnZonePlanDto = z.infer<typeof stagedTurnZonePlanDtoSchema>

/**
 * The zone phases a turn adds to its terminal result. A field is omitted when no zone batch ran at
 * that boundary; a present phase always holds at least one execution.
 */
export const turnZoneEffectsEvidenceFields = lazySchemaParts(() => ({
  outgoingZoneEffects: z.optional(executedTurnZonePhaseEvidenceDtoSchema),
  incomingZoneEffects: z.optional(executedTurnZonePhaseEvidenceDtoSchema)
}))

type ZonePhase = z.infer<typeof executedTurnZonePhaseEvidenceDtoSchema>

/**
 * Whether a zone turn candidate follows another in canonical order: by the creature caught, then by
 * zone (D144). A creature's own boundary catches only it; a source's turn start catches many.
 */
export const followsInZoneTurnOrder = (
  previous: { targetActorId: string; effectId: string },
  next: { targetActorId: string; effectId: string }
) =>
  previous.targetActorId < next.targetActorId ||
  (previous.targetActorId === next.targetActorId && previous.effectId < next.effectId)

/** A zone phase is one mechanics batch per creature it caught, each chained in canonical order. */
const refineZonePhase = (phase: ZonePhase, context: z.core.$RefinementCtx, path: string) => {
  // An empty list is already an issue of the executions field; the chain has nothing to check.
  const [firstExecution] = phase.executions
  if (!firstExecution) return
  const spans = new Map<
    string,
    {
      first: (typeof firstExecution)['targetTransition']['before']
      last: (typeof firstExecution)['targetTransition']['after']
    }
  >()
  let chained = true
  for (const [index, execution] of phase.executions.entries()) {
    const previous = phase.executions[index - 1]
    const { candidate } = execution.candidate
    const span = spans.get(candidate.targetActorId)
    if (
      execution.ordinal !== index ||
      execution.candidate.ordinal !== index ||
      execution.candidate.boundaryOrdinal !== firstExecution.candidate.boundaryOrdinal ||
      (previous && !followsInZoneTurnOrder(previous.candidate.candidate, candidate)) ||
      (span && JSON.stringify(span.last) !== JSON.stringify(execution.targetTransition.before))
    )
      chained = false
    spans.set(candidate.targetActorId, {
      first: span?.first ?? execution.targetTransition.before,
      last: execution.targetTransition.after
    })
  }
  const transitions = [...phase.characterTransitions, ...phase.encounterActorTransitions]
  if (
    !chained ||
    transitions.length !== spans.size ||
    transitions.some((transition) => {
      const span = spans.get(transition.targetActorId)
      return (
        !span ||
        JSON.stringify(transition.before) !== JSON.stringify(span.first) ||
        JSON.stringify(transition.after) !== JSON.stringify(span.last)
      )
    }) ||
    new Set(transitions.map((transition) => transition.targetActorId)).size !==
      transitions.length ||
    phase.characterTransitions.some(
      (entry) => entry.afterStreamVersion !== entry.beforeStreamVersion + 1
    )
  )
    context.addIssue({
      code: 'custom',
      path: [path],
      message:
        'A zone turn phase must be one chained mechanics batch per creature it caught, in canonical order.'
    })
}

/** Checks both zone phases of a terminal turn result against its command. */
export const refineTurnZoneEffectsEvidence = (
  result: {
    commandType: 'START' | 'ADVANCE_TURN'
    outgoingZoneEffects?: ZonePhase | undefined
    incomingZoneEffects?: ZonePhase | undefined
  },
  context: z.core.$RefinementCtx
) => {
  if (result.outgoingZoneEffects) {
    if (result.commandType !== 'ADVANCE_TURN')
      context.addIssue({
        code: 'custom',
        path: ['outgoingZoneEffects'],
        message: 'Only an advancing turn has an outgoing zone phase.'
      })
    refineZonePhase(result.outgoingZoneEffects, context, 'outgoingZoneEffects')
  }
  if (result.incomingZoneEffects)
    refineZonePhase(result.incomingZoneEffects, context, 'incomingZoneEffects')
}
