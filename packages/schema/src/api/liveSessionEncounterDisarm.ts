import { z } from '../zod.js'
import { serverOptionalCombatContestPendingContextDtoSchema } from '../shared/ruleExecutionOptionalCombatPending.js'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '../shared/ruleExecutionPendingSnapshots.js'
import { storedRuleExecutionResultDtoSchema } from '../shared/ruleExecutionResults.js'
import { encounterActorRuleOutputSchema } from './encounterActorRules.js'
import {
  resolveEncounterActionInputDtoSchema,
  resolveRuleOccurrenceInputDtoSchema
} from './encounterRuleCommands.js'
import { liveSessionEncounterRulesInputSchema } from './liveSessionEncounterRules.js'
import { liveSessionRulesRevisionsSchema } from './liveSessionRulesRevisions.js'

const disarmScope = z.extend(
  z.omit(liveSessionEncounterRulesInputSchema, {
    request: true,
    concentrationResponse: true,
    turnCommand: true,
    action: true,
    movement: true
  }),
  {
    /** The Disarm itself, or a participant's d20 answer to it. */
    command: z.discriminatedUnion('type', [
      resolveEncounterActionInputDtoSchema,
      resolveRuleOccurrenceInputDtoSchema
    ]),
    revisions: liveSessionRulesRevisionsSchema
  }
)

/** A room-planned Disarm waiting on a participant's d20: the sealed contest, nothing applied. */
export const liveSessionEncounterDisarmPendingInputSchema = z.extend(disarmScope, {
  snapshot: serverKernelRuleExecutionPendingSnapshotDtoSchema
})

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
  contest: z.infer<typeof serverOptionalCombatContestPendingContextDtoSchema>
  execution: z.infer<typeof storedRuleExecutionResultDtoSchema>
  rules: z.infer<typeof encounterActorRuleOutputSchema>
}

export const liveSessionEncounterDisarmCommitInputSchema: z.ZodMiniType<LiveSessionEncounterDisarmCommitInput> =
  z.extend(disarmScope, {
    occurredAt: z.iso.datetime(),
    contest: serverOptionalCombatContestPendingContextDtoSchema,
    execution: storedRuleExecutionResultDtoSchema,
    rules: encounterActorRuleOutputSchema
  })
