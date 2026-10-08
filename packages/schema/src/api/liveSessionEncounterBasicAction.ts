import { z, lazySchema } from '../zod.js'
import {
  encounterAllyAdvantageUsesDtoSchema,
  encounterBasicActionEffectsDtoSchema
} from '../shared/basicActions.js'
import { encounterRuleWarningsDtoSchema } from '../shared/encounterRuleWarnings.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { encounterBasicActionCheckPendingContextDtoSchema } from '../shared/ruleExecutionDirectActionPendingContexts.js'
import { encounterActionEconomyTransitionDtoSchema } from '../shared/ruleExecutionEncounterApplications.js'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '../shared/ruleExecutionPendingSnapshots.js'
import { storedRuleExecutionResultDtoSchema } from '../shared/ruleExecutionResults.js'
import { encounterActorRuleOutputSchema } from './encounterActorRules.js'
import {
  resolveRuleOccurrenceInputDtoSchema,
  useEncounterBasicActionInputDtoSchema
} from './encounterRuleCommands.js'
import { liveSessionEncounterRulesInputSchema } from './liveSessionEncounterRules.js'
import { liveSessionRulesRevisionsSchema } from './liveSessionRulesRevisions.js'

const basicActionScope = lazySchema(() =>
  z.omit(liveSessionEncounterRulesInputSchema, {
    request: true,
    concentrationResponse: true,
    turnCommand: true,
    action: true,
    movement: true
  })
)

/** A settled basic action check: the frozen check, its stored result and the app roll it used. */
const basicActionCheckSettlementSchema = lazySchema(() =>
  z.strictObject({
    context: encounterBasicActionCheckPendingContextDtoSchema,
    execution: storedRuleExecutionResultDtoSchema,
    /** The recorded app roll the d20 settled with, whose card exists; null for an entered or auto-rolled die. */
    appRollId: z.nullable(postgresUuidSchema)
  })
)

/**
 * A room-planned basic action (Q11). Convex checks it against the current Run and records it: the
 * allowance use, the effects added to the actor and a movement bonus for the current turn. It never
 * evaluates the action's rules. A stabilizing action also carries its check: waiting on the helper's
 * d20, or settled by an auto-roll.
 */
export const liveSessionEncounterBasicActionCommitInputSchema = lazySchema(() =>
  z.extend(basicActionScope, {
    command: useEncounterBasicActionInputDtoSchema,
    revisions: liveSessionRulesRevisionsSchema,
    occurredAt: z.iso.datetime(),
    /** The exact published catalogue entry the room planned with. */
    definition: z.strictObject({
      id: postgresUuidSchema,
      version: z.number().check(z.int()).check(z.positive()),
      checksum: z.string().check(z.regex(/^[a-f0-9]{64}$/))
    }),
    actionEconomy: z.nullable(encounterActionEconomyTransitionDtoSchema),
    /** Warnings the command acknowledged and the room overrode. */
    ruleOverrides: encounterRuleWarningsDtoSchema,
    /** Effects appended to the actor's Run resources. */
    effects: encounterBasicActionEffectsDtoSchema,
    /** Adds the actor's speed to its movement budget for the current turn. */
    speedMovementBonus: z.boolean(),
    /** The Helps the check's roll used; the commit removes them. */
    allyAdvantageUses: encounterAllyAdvantageUsesDtoSchema,
    check: z.nullable(
      z.discriminatedUnion('kind', [
        z.strictObject({
          kind: z.literal('PENDING'),
          snapshot: serverKernelRuleExecutionPendingSnapshotDtoSchema
        }),
        z.strictObject({ kind: z.literal('SETTLED'), settlement: basicActionCheckSettlementSchema })
      ])
    ),
    rules: encounterActorRuleOutputSchema
  })
)

/** The helper's d20 for a pending basic action check; it settles the check. */
export const liveSessionEncounterBasicActionResponseCommitInputSchema = lazySchema(() =>
  z.extend(basicActionScope, {
    command: resolveRuleOccurrenceInputDtoSchema,
    revisions: liveSessionRulesRevisionsSchema,
    occurredAt: z.iso.datetime(),
    settlement: basicActionCheckSettlementSchema,
    rules: encounterActorRuleOutputSchema
  })
)

export type LiveSessionEncounterBasicActionCommitInput = z.infer<
  typeof liveSessionEncounterBasicActionCommitInputSchema
>
export type LiveSessionEncounterBasicActionResponseCommitInput = z.infer<
  typeof liveSessionEncounterBasicActionResponseCommitInputSchema
>
