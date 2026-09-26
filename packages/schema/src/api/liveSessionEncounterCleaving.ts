import { z } from '../zod.js'
import { MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR } from '../shared/activeRuleEffects.js'
import {
  serverAggregateChoicePendingSnapshotDtoSchema,
  type ServerAggregateChoicePendingSnapshotDto
} from '../shared/ruleExecutionPendingSnapshots.js'
import { storedRuleExecutionResultDtoSchema } from '../shared/ruleExecutionResults.js'
import { resolveRuleOccurrenceInputDtoSchema } from './encounterRuleCommands.js'
import { encounterActorRuleOutputSchema } from './encounterActorRules.js'
import {
  liveSessionEncounterConcentrationFields,
  type LiveSessionEncounterActionCommitInput
} from './liveSessionEncounterAction.js'
import {
  liveSessionEncounterMaintenanceOwnerRequestSchema,
  liveSessionEncounterRulesInputSchema
} from './liveSessionEncounterRules.js'
import { liveSessionRulesRevisionsSchema } from './liveSessionRulesRevisions.js'

/**
 * A planned Cleaving answer: the completed choice receipt, the Concentration checks its damage
 * raised, and the next sealed choice. Convex re-applies the damage and records; it never evaluates.
 */
export type LiveSessionEncounterCleavingCommitInput = Omit<
  z.infer<typeof liveSessionEncounterRulesInputSchema>,
  'request' | 'concentrationResponse' | 'turnCommand' | 'action' | 'movement'
> & {
  response: z.infer<typeof resolveRuleOccurrenceInputDtoSchema>
  revisions: z.infer<typeof liveSessionRulesRevisionsSchema>
  occurredAt: string
  execution: z.infer<typeof storedRuleExecutionResultDtoSchema>
  rules: z.infer<typeof encounterActorRuleOutputSchema>
  maintenanceOwners: z.infer<typeof liveSessionEncounterMaintenanceOwnerRequestSchema>[]
  cleaving: ServerAggregateChoicePendingSnapshotDto | null
} & Pick<LiveSessionEncounterActionCommitInput, 'concentration' | 'pendingConcentration'>

export const liveSessionEncounterCleavingCommitInputSchema: z.ZodMiniType<LiveSessionEncounterCleavingCommitInput> =
  z.extend(
    z.omit(liveSessionEncounterRulesInputSchema, {
      request: true,
      concentrationResponse: true,
      turnCommand: true,
      action: true,
      movement: true
    }),
    {
      response: resolveRuleOccurrenceInputDtoSchema,
      revisions: liveSessionRulesRevisionsSchema,
      occurredAt: z.iso.datetime(),
      execution: storedRuleExecutionResultDtoSchema,
      rules: encounterActorRuleOutputSchema,
      maintenanceOwners: z
        .array(liveSessionEncounterMaintenanceOwnerRequestSchema)
        .check(z.maxLength(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR)),
      ...liveSessionEncounterConcentrationFields,
      cleaving: z.nullable(serverAggregateChoicePendingSnapshotDtoSchema)
    }
  )
