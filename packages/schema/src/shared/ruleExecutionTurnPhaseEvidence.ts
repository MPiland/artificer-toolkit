import { z, lazySchema, lazySchemaParts } from '../zod.js'

import {
  spatialTurnExecutionDtoSchema,
  turnEffectCharacterTransitionDtoSchema,
  turnEffectEncounterActorTransitionDtoSchema
} from './ruleExecutionEffectEvidence.js'
import { ruleExecutionChecksumSchema as checksumSchema } from './ruleExecutionPrimitives.js'
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
  maxExecutions: number
) =>
  z.strictObject({
    kind: z.literal('EXECUTED'),
    ...stagedTurnPlanDtoSchema(execution, maxExecutions).shape,
    characterTransitions: z
      .array(turnEffectCharacterTransitionDtoSchema)
      .check(z.minLength(0))
      .check(z.maxLength(2)),
    encounterActorTransitions: z
      .array(turnEffectEncounterActorTransitionDtoSchema)
      .check(z.minLength(0))
      .check(z.maxLength(2))
  })

export const stagedTurnZonePlanDtoSchema = lazySchema(() =>
  stagedTurnPlanDtoSchema(spatialTurnExecutionDtoSchema, MAX_SPATIAL_CANDIDATES)
)

export const executedTurnZonePhaseEvidenceDtoSchema = lazySchema(() =>
  executedTurnPhaseEvidenceDtoSchema(spatialTurnExecutionDtoSchema, MAX_SPATIAL_CANDIDATES)
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

/** A zone phase is one mechanics batch against the creature whose boundary it is, chained in order. */
const refineZonePhase = (phase: ZonePhase, context: z.core.$RefinementCtx, path: string) => {
  // An empty list is already an issue of the executions field; the chain has nothing to check.
  const [firstExecution] = phase.executions
  if (!firstExecution) return
  const targetActorId = firstExecution.candidate.candidate.targetActorId
  const transitions = [...phase.characterTransitions, ...phase.encounterActorTransitions]
  const first = firstExecution.targetTransition.before
  const last = phase.executions.at(-1)!.targetTransition.after
  let boundary = firstExecution.candidate.boundaryOrdinal
  let chained = true
  let priorEffectId = ''
  for (const [index, execution] of phase.executions.entries()) {
    const previous = phase.executions[index - 1]
    if (
      execution.ordinal !== index ||
      execution.candidate.ordinal !== index ||
      execution.candidate.candidate.targetActorId !== targetActorId ||
      execution.candidate.boundaryOrdinal !== boundary ||
      execution.candidate.candidate.effectId <= priorEffectId ||
      (previous &&
        JSON.stringify(previous.targetTransition.after) !==
          JSON.stringify(execution.targetTransition.before))
    )
      chained = false
    priorEffectId = execution.candidate.candidate.effectId
    boundary = execution.candidate.boundaryOrdinal
  }
  if (
    !chained ||
    transitions.length !== 1 ||
    transitions[0]!.targetActorId !== targetActorId ||
    JSON.stringify(transitions[0]!.before) !== JSON.stringify(first) ||
    JSON.stringify(transitions[0]!.after) !== JSON.stringify(last) ||
    phase.characterTransitions.some(
      (entry) => entry.afterStreamVersion !== entry.beforeStreamVersion + 1
    )
  )
    context.addIssue({
      code: 'custom',
      path: [path],
      message:
        'A zone turn phase must be one chained mechanics batch against its boundary creature.'
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
