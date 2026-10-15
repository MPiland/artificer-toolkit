import { z, lazySchema } from '../zod.js'
import { MAX_ACTIVE_RULE_EFFECTS_PER_OWNER } from '../shared/activeRuleEffects.js'
import {
  type ActiveRuleEffectRecord,
  activeRuleEffectRecordSchema
} from '../projections/activeRuleEffectPersistence.js'
import { encounterRuleWarningsDtoSchema } from '../shared/encounterRuleWarnings.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  type EncounterConcealmentCheckPendingContextDto,
  encounterBasicActionCheckPendingContextDtoSchema,
  encounterConcealmentCheckPendingContextDtoSchema,
  encounterEscapeCheckPendingContextDtoSchema
} from '../shared/ruleExecutionDirectActionPendingContexts.js'
import { encounterActionEconomyTransitionDtoSchema } from '../shared/ruleExecutionEncounterApplications.js'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '../shared/ruleExecutionPendingSnapshots.js'
import { storedRuleExecutionResultDtoSchema } from '../shared/ruleExecutionResults.js'
import { encounterActorRuleOutputSchema } from './encounterActorRules.js'
import {
  escapeRelationshipInputDtoSchema,
  resolveCheckActionInputDtoSchema,
  resolveRuleOccurrenceInputDtoSchema
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

/** A settled stabilizing check (First Aid): the frozen check, its stored result and the app roll it used. */
const stabilizeCheckSettlementSchema = lazySchema(() =>
  z.strictObject({
    context: encounterBasicActionCheckPendingContextDtoSchema,
    execution: storedRuleExecutionResultDtoSchema,
    /** The recorded app roll the d20 settled with, whose card exists; null for an entered or auto-rolled die. */
    appRollId: z.nullable(postgresUuidSchema)
  })
)

/**
 * A settled concealment check (Hide, Search): the frozen check, its stored result, the app roll it
 * used and the concealment a successful Hide stores on its roller.
 */
export type ConcealmentCheckSettlement = {
  context: EncounterConcealmentCheckPendingContextDto
  execution: z.infer<typeof storedRuleExecutionResultDtoSchema>
  appRollId: z.infer<typeof postgresUuidSchema> | null
  createdEffect: ActiveRuleEffectRecord | null
}

// Explicitly typed so the commit inputs stay within the compiler's declaration size limit (TS7056).
const concealmentCheckSettlementSchema: z.ZodMiniType<ConcealmentCheckSettlement> = lazySchema(() =>
  z.strictObject({
    context: encounterConcealmentCheckPendingContextDtoSchema,
    execution: storedRuleExecutionResultDtoSchema,
    appRollId: z.nullable(postgresUuidSchema),
    createdEffect: z.nullable(activeRuleEffectRecordSchema)
  })
)

const basicActionCheckSettlementSchema = lazySchema(() =>
  z.union([stabilizeCheckSettlementSchema, concealmentCheckSettlementSchema])
)

/**
 * A room-planned basic action (Q11). Convex checks it against the current Run and records it: the
 * allowance use, the effects added to the actor and a movement bonus for the current turn. It never
 * evaluates the action's rules. A stabilizing action also carries its check: waiting on the helper's
 * d20, or settled by an auto-roll.
 */
export const liveSessionEncounterBasicActionCommitInputSchema = lazySchema(() =>
  z.extend(basicActionScope, {
    command: resolveCheckActionInputDtoSchema,
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
    /** The helper's one-check grants (Help) the check used up; the commit deletes them. */
    consumedGrants: z
      .array(activeRuleEffectRecordSchema)
      .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)),
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

/** A settled Escape check: the frozen check, its stored result and the app roll it used. */
const escapeCheckSettlementSchema = lazySchema(() =>
  z.strictObject({
    context: encounterEscapeCheckPendingContextDtoSchema,
    execution: storedRuleExecutionResultDtoSchema,
    appRollId: z.nullable(postgresUuidSchema)
  })
)

/**
 * A room-planned Escape (D105): the activation it spent and its d20 check, waiting on the holder's
 * roll or settled by an auto-roll. Convex checks it against the current Run and records it; a
 * settled escape also ends the relationship effect and the conditions it owned.
 */
export const liveSessionEncounterEscapeCommitInputSchema = lazySchema(() =>
  z.extend(basicActionScope, {
    command: escapeRelationshipInputDtoSchema,
    revisions: liveSessionRulesRevisionsSchema,
    occurredAt: z.iso.datetime(),
    actionEconomy: z.nullable(encounterActionEconomyTransitionDtoSchema),
    /** Warnings the command acknowledged and the room overrode. */
    ruleOverrides: encounterRuleWarningsDtoSchema,
    /** The holder's one-check grants (Help) the check used up; the commit deletes them. */
    consumedGrants: z
      .array(activeRuleEffectRecordSchema)
      .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)),
    check: z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('PENDING'),
        snapshot: serverKernelRuleExecutionPendingSnapshotDtoSchema
      }),
      z.strictObject({ kind: z.literal('SETTLED'), settlement: escapeCheckSettlementSchema })
    ]),
    rules: encounterActorRuleOutputSchema
  })
)

/** The holder's d20 for a pending Escape check; it settles the check. */
export const liveSessionEncounterEscapeResponseCommitInputSchema = lazySchema(() =>
  z.extend(basicActionScope, {
    command: resolveRuleOccurrenceInputDtoSchema,
    revisions: liveSessionRulesRevisionsSchema,
    occurredAt: z.iso.datetime(),
    settlement: escapeCheckSettlementSchema,
    rules: encounterActorRuleOutputSchema
  })
)

export type LiveSessionEncounterEscapeCommitInput = z.infer<
  typeof liveSessionEncounterEscapeCommitInputSchema
>
export type LiveSessionEncounterEscapeResponseCommitInput = z.infer<
  typeof liveSessionEncounterEscapeResponseCommitInputSchema
>
export type StabilizeCheckSettlement = z.infer<typeof stabilizeCheckSettlementSchema>
export type LiveSessionEncounterBasicActionCommitInput = z.infer<
  typeof liveSessionEncounterBasicActionCommitInputSchema
>
export type LiveSessionEncounterBasicActionResponseCommitInput = z.infer<
  typeof liveSessionEncounterBasicActionResponseCommitInputSchema
>
