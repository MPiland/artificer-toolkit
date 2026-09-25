import { z } from '../zod.js'
import {
  liveSessionEncounterRulesInputSchema,
  liveSessionEncounterMaintenanceOwnerRequestSchema
} from './liveSessionEncounterRules.js'
import { resolveRuleOccurrenceInputDtoSchema } from './encounterRuleCommands.js'
import { liveSessionRulesRevisionsSchema } from './liveSessionRulesRevisions.js'
import { encounterActorRuleOutputSchema } from './encounterActorRules.js'
import { storedRuleExecutionResultDtoSchema } from '../shared/ruleExecutionResults.js'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '../shared/ruleExecutionPendingSnapshots.js'
import { MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR } from '../shared/activeRuleEffects.js'

/** A completed admitted concentration check and its next sealed decision, never document patches. */
export const liveSessionEncounterConcentrationCommitInputSchema = z.extend(
  z.omit(liveSessionEncounterRulesInputSchema, {
    request: true,
    action: true,
    movement: true
  }),
  {
    concentrationResponse: resolveRuleOccurrenceInputDtoSchema,
    revisions: liveSessionRulesRevisionsSchema,
    occurredAt: z.iso.datetime(),
    execution: storedRuleExecutionResultDtoSchema,
    rules: z.nullable(encounterActorRuleOutputSchema),
    maintenanceOwners: z
      .array(liveSessionEncounterMaintenanceOwnerRequestSchema)
      .check(z.maxLength(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR)),
    pending: z.nullable(serverRuleExecutionPendingSnapshotDtoSchema),
    cleaving: z.nullable(serverRuleExecutionPendingSnapshotDtoSchema)
  }
)
export type LiveSessionEncounterConcentrationCommitInput = z.infer<
  typeof liveSessionEncounterConcentrationCommitInputSchema
>
