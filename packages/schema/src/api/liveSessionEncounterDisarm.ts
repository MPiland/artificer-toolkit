import { z, lazySchema } from '../zod.js'
import { MAX_ACTIVE_RULE_EFFECTS_PER_OWNER } from '../shared/activeRuleEffects.js'
import { activeRuleEffectRecordSchema } from '../projections/activeRuleEffectPersistence.js'
import { serverContestCheckPendingContextDtoSchema } from '../shared/ruleExecutionOptionalCombatPending.js'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '../shared/ruleExecutionPendingSnapshots.js'
import { storedRuleExecutionResultDtoSchema } from '../shared/ruleExecutionResults.js'
import { encounterActorRuleOutputSchema } from './encounterActorRules.js'
import {
  escapeRelationshipInputDtoSchema,
  resolveEncounterActionInputDtoSchema,
  resolveRuleOccurrenceInputDtoSchema
} from './encounterRuleCommands.js'
import { liveSessionEncounterRulesInputSchema } from './liveSessionEncounterRules.js'
import {
  liveSessionForcedMovementsSchema,
  type LiveSessionForcedMovement
} from './liveSessionEncounterAction.js'
import {
  ruleExecutionIdentifierSchema,
  ruleExecutionUuidSchema
} from '../shared/ruleExecutionPrimitives.js'
import { liveSessionRulesRevisionsSchema } from './liveSessionRulesRevisions.js'

const disarmScope = lazySchema(() =>
  z.extend(
    z.omit(liveSessionEncounterRulesInputSchema, {
      request: true,
      concentrationResponse: true,
      turnCommand: true,
      action: true,
      movement: true
    }),
    {
      /** The contest itself (an action or a contested escape), or a participant's d20 answer. */
      command: z.discriminatedUnion('type', [
        resolveEncounterActionInputDtoSchema,
        escapeRelationshipInputDtoSchema,
        resolveRuleOccurrenceInputDtoSchema
      ]),
      revisions: liveSessionRulesRevisionsSchema
    }
  )
)

/** A room-planned Disarm waiting on a participant's d20: the sealed contest, nothing applied. */
export const liveSessionEncounterDisarmPendingInputSchema = lazySchema(() =>
  z.extend(disarmScope, {
    snapshot: serverKernelRuleExecutionPendingSnapshotDtoSchema
  })
)

export type LiveSessionEncounterDisarmPendingInput = z.infer<
  typeof liveSessionEncounterDisarmPendingInputSchema
>

/** A condition a won contest's picked outcome applies to its target, as the room planned it (D105). */
export type LiveSessionContestConditionApplication = {
  kind: 'CONDITION_APPLY'
  conditionId: string
  targetActorId: string
  sourceNodeId: string
  sourceOperationKey: string
  authoredPath: string | null
  resolvedPath: string | null
}

/**
 * A room-planned Disarm's settled contest. Convex re-applies the item and ACTION changes it
 * describes and records the receipts; it never rolls or evaluates.
 */
export type LiveSessionEncounterDisarmCommitInput = Omit<
  LiveSessionEncounterDisarmPendingInput,
  'snapshot'
> & {
  occurredAt: string
  contest: z.infer<typeof serverContestCheckPendingContextDtoSchema>
  execution: z.infer<typeof storedRuleExecutionResultDtoSchema>
  rules: z.infer<typeof encounterActorRuleOutputSchema>
  /** The one-roll grants the initiator's attack roll and the defender's check used up; the commit deletes them. */
  consumedGrants: z.infer<typeof activeRuleEffectRecordSchema>[]
  /** The hold effect a won basic action contest (Grapple) creates on its target; null otherwise. */
  createdEffect: z.infer<typeof activeRuleEffectRecordSchema> | null
  /** The conditions a won contest's picked outcome (Shove's Prone) applies to its target. */
  conditionApplications: LiveSessionContestConditionApplication[]
  /** The push a won contest's picked outcome (Shove's 5 feet away) settles on the Scene (D157). */
  forcedMovements: LiveSessionForcedMovement[]
}

export const liveSessionEncounterDisarmCommitInputSchema: z.ZodMiniType<LiveSessionEncounterDisarmCommitInput> =
  lazySchema(() =>
    z.extend(disarmScope, {
      occurredAt: z.iso.datetime(),
      contest: serverContestCheckPendingContextDtoSchema,
      execution: storedRuleExecutionResultDtoSchema,
      rules: encounterActorRuleOutputSchema,
      consumedGrants: z
        .array(activeRuleEffectRecordSchema)
        .check(z.maxLength(2 * MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)),
      createdEffect: z.nullable(activeRuleEffectRecordSchema),
      conditionApplications: z
        .array(
          z.strictObject({
            kind: z.literal('CONDITION_APPLY'),
            conditionId: ruleExecutionUuidSchema,
            targetActorId: ruleExecutionUuidSchema,
            sourceNodeId: ruleExecutionIdentifierSchema,
            sourceOperationKey: ruleExecutionIdentifierSchema,
            authoredPath: z.nullable(ruleExecutionIdentifierSchema),
            resolvedPath: z.nullable(ruleExecutionIdentifierSchema)
          })
        )
        .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)),
      forcedMovements: liveSessionForcedMovementsSchema
    })
  )
