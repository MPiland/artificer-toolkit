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
      createdEffect: z.nullable(activeRuleEffectRecordSchema)
    })
  )
