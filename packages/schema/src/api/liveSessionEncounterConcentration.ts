import { z, lazySchema } from '../zod.js'
import {
  liveSessionEncounterRulesInputSchema,
  liveSessionEncounterMaintenanceOwnerRequestSchema
} from './liveSessionEncounterRules.js'
import { resolveRuleOccurrenceInputDtoSchema } from './encounterRuleCommands.js'
import { liveSessionRulesRevisionsSchema } from './liveSessionRulesRevisions.js'
import { encounterActorRuleOutputSchema } from './encounterActorRules.js'
import { storedRuleExecutionResultDtoSchema } from '../shared/ruleExecutionResults.js'
import {
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  serverRuleExecutionPendingSnapshotDtoSchema
} from '../shared/ruleExecutionPendingSnapshots.js'
import {
  liveSessionEncounterConcentrationFields,
  type LiveSessionEncounterActionCommitInput
} from './liveSessionEncounterAction.js'
import { MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR } from '../shared/activeRuleEffects.js'

/**
 * A completed admitted concentration check, the remaining checks its commit auto-rolled, and the
 * next sealed decision; never document patches (D23).
 */
export type LiveSessionEncounterConcentrationCommitInput = Omit<
  z.infer<typeof liveSessionEncounterRulesInputSchema>,
  'request' | 'action' | 'movement' | 'concentrationResponse'
> & {
  concentrationResponse: z.infer<typeof resolveRuleOccurrenceInputDtoSchema>
  revisions: z.infer<typeof liveSessionRulesRevisionsSchema>
  occurredAt: string
  execution: z.infer<typeof storedRuleExecutionResultDtoSchema>
  rules: z.infer<typeof encounterActorRuleOutputSchema> | null
  maintenanceOwners: z.infer<typeof liveSessionEncounterMaintenanceOwnerRequestSchema>[]
  cleaving: z.infer<typeof serverRuleExecutionPendingSnapshotDtoSchema> | null
} & Pick<
    LiveSessionEncounterActionCommitInput,
    'concentration' | 'pendingConcentration' | 'concentrationEnds' | 'endedGrants'
  >

/**
 * An admitted concentration check's roll that opened a d20 window (D168): the window the same
 * occurrence now pends on. Nothing settles, so there is no result and no document patch.
 */
export type LiveSessionEncounterConcentrationWindowInput = Omit<
  z.infer<typeof liveSessionEncounterRulesInputSchema>,
  'request' | 'action' | 'movement' | 'concentrationResponse'
> & {
  concentrationResponse: z.infer<typeof resolveRuleOccurrenceInputDtoSchema>
  revisions: z.infer<typeof liveSessionRulesRevisionsSchema>
  occurredAt: string
  snapshot: z.infer<typeof serverKernelRuleExecutionPendingSnapshotDtoSchema>
}

export const liveSessionEncounterConcentrationWindowInputSchema: z.ZodMiniType<LiveSessionEncounterConcentrationWindowInput> =
  lazySchema(() =>
    z.extend(
      z.omit(liveSessionEncounterRulesInputSchema, {
        request: true,
        action: true,
        movement: true
      }),
      {
        concentrationResponse: resolveRuleOccurrenceInputDtoSchema,
        revisions: liveSessionRulesRevisionsSchema,
        occurredAt: z.iso.datetime(),
        snapshot: serverKernelRuleExecutionPendingSnapshotDtoSchema
      }
    )
  )

export const liveSessionEncounterConcentrationCommitInputSchema: z.ZodMiniType<LiveSessionEncounterConcentrationCommitInput> =
  lazySchema(() =>
    z.extend(
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
          .check(z.maxLength(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR * 2)),
        ...liveSessionEncounterConcentrationFields(),
        cleaving: z.nullable(serverRuleExecutionPendingSnapshotDtoSchema)
      }
    )
  )
