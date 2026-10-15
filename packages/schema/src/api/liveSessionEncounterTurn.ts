import { z, lazySchema } from '../zod.js'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '../shared/ruleExecutionPendingSnapshots.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  liveSessionEncounterRulesInputSchema,
  liveSessionEncounterTurnCommandSchema,
  liveSessionEncounterMaintenanceOwnerRequestSchema
} from './liveSessionEncounterRules.js'
import { liveSessionRulesRevisionsSchema } from './liveSessionRulesRevisions.js'
import {
  turnCoordinatorRootDtoSchema,
  type TurnCoordinatorRootDto
} from '../shared/ruleExecutionTurnPending.js'
import {
  pendingCompletedTurnPhaseDtoSchema,
  type PendingCompletedTurnPhaseDto
} from '../shared/ruleExecutionResults.js'
import {
  liveSessionEncounterConcentrationFields,
  type LiveSessionEncounterActionCommitInput
} from './liveSessionEncounterAction.js'
import { encounterActorRuleOutputSchema } from './encounterActorRules.js'
import { MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR } from '../shared/activeRuleEffects.js'

/** Private pending turn output; the DO supplies evidence, never document patches. */
export const liveSessionEncounterTurnPendingInputSchema = lazySchema(() =>
  z.extend(
    z.omit(liveSessionEncounterRulesInputSchema, {
      request: true,
      concentrationResponse: true,
      action: true,
      movement: true
    }),
    {
      command: liveSessionEncounterTurnCommandSchema,
      revisions: liveSessionRulesRevisionsSchema,
      scenes: z
        .array(
          z.strictObject({
            sceneId: postgresUuidSchema,
            sceneVersion: z.number().check(z.int()).check(z.nonnegative()),
            definitionSaveId: postgresUuidSchema
          })
        )
        .check(z.maxLength(1)),
      snapshot: serverRuleExecutionPendingSnapshotDtoSchema
    }
  )
)

export type LiveSessionEncounterTurnPendingInput = z.infer<
  typeof liveSessionEncounterTurnPendingInputSchema
>

/** Closed turn outcomes; the transaction owns initiative, effects, resources and receipts. */
export type LiveSessionEncounterTurnCommitInput = Omit<
  LiveSessionEncounterTurnPendingInput,
  'snapshot'
> &
  Pick<
    LiveSessionEncounterActionCommitInput,
    | 'rules'
    | 'maintenanceOwners'
    | 'concentration'
    | 'pendingConcentration'
    | 'concentrationEnds'
    | 'endedGrants'
  > & {
    occurrenceId: string
    occurredAt: string
    root: TurnCoordinatorRootDto
    incomingTurn: PendingCompletedTurnPhaseDto
  }

export const liveSessionEncounterTurnCommitInputSchema: z.ZodMiniType<LiveSessionEncounterTurnCommitInput> =
  lazySchema(() =>
    z.extend(z.omit(liveSessionEncounterTurnPendingInputSchema, { snapshot: true }), {
      occurrenceId: postgresUuidSchema,
      occurredAt: z.iso.datetime(),
      root: turnCoordinatorRootDtoSchema,
      incomingTurn: pendingCompletedTurnPhaseDtoSchema,
      rules: encounterActorRuleOutputSchema,
      maintenanceOwners: z
        .array(liveSessionEncounterMaintenanceOwnerRequestSchema)
        .check(z.maxLength(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR * 2)),
      ...liveSessionEncounterConcentrationFields()
    })
  )
