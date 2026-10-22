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
  encounterConcealmentCheckPendingContextDtoSchema,
  encounterEscapeCheckPendingContextDtoSchema
} from '../shared/ruleExecutionDirectActionPendingContexts.js'
import {
  type EncounterCheckActionContextDto,
  checkActionSourceDtoSchema,
  encounterCheckActionContextDtoSchema
} from '../shared/ruleExecutionCheckAction.js'
import { encounterFeatureResourceReceiptDtoSchema } from '../shared/ruleExecutionMechanics.js'
import { encounterActionEconomyTransitionDtoSchema } from '../shared/ruleExecutionEncounterApplications.js'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '../shared/ruleExecutionPendingSnapshots.js'
import { storedRuleExecutionResultDtoSchema } from '../shared/ruleExecutionResults.js'
import { encounterActorRuleOutputSchema } from './encounterActorRules.js'
import {
  endHeldGrantInputDtoSchema,
  escapeRelationshipInputDtoSchema,
  moveHeldEffectInputDtoSchema,
  releaseRelationshipInputDtoSchema,
  resolveCheckActionInputDtoSchema,
  resolveRuleOccurrenceInputDtoSchema
} from './encounterRuleCommands.js'
import {
  type LiveSessionForcedMovement,
  liveSessionForcedMovementsSchema
} from './liveSessionEncounterAction.js'
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

/** The roller's held die a d20 window answer spent (null when declined), which the commit ends. */
const d20WindowSpendSchema = lazySchema(() =>
  z.strictObject({ spentEffect: z.nullable(activeRuleEffectRecordSchema) })
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

/**
 * A settled fixed-DC check action whose success runs an authored outcome (D173): the frozen check,
 * its stored result, the app roll it used and the pushes a success lands on the Scene (D157).
 * `window` is present when the d20 settled through a d20 window.
 */
export type CheckActionSettlement = {
  context: EncounterCheckActionContextDto
  execution: z.infer<typeof storedRuleExecutionResultDtoSchema>
  appRollId: z.infer<typeof postgresUuidSchema> | null
  forcedMovements: LiveSessionForcedMovement[]
  window?: { spentEffect: ActiveRuleEffectRecord | null }
}

const checkActionSettlementSchema: z.ZodMiniType<CheckActionSettlement> = lazySchema(() =>
  z.strictObject({
    context: encounterCheckActionContextDtoSchema,
    execution: storedRuleExecutionResultDtoSchema,
    appRollId: z.nullable(postgresUuidSchema),
    forcedMovements: liveSessionForcedMovementsSchema,
    window: z.optional(d20WindowSpendSchema)
  })
)

const basicActionCheckSettlementSchema = lazySchema(() =>
  z.union([concealmentCheckSettlementSchema, checkActionSettlementSchema])
)

/**
 * A room-planned basic action (Q11). Convex checks it against the current Run and records it: the
 * allowance use, the effects added to the actor and a movement bonus for the current turn. It never
 * evaluates the action's rules. Its check waits on the roller's d20 or is settled by an auto-roll;
 * it is null when the action proceeded over its target's unmet outcome precondition (D173 Q1).
 */
export const liveSessionEncounterBasicActionCommitInputSchema = lazySchema(() =>
  z.extend(basicActionScope, {
    command: resolveCheckActionInputDtoSchema,
    revisions: liveSessionRulesRevisionsSchema,
    occurredAt: z.iso.datetime(),
    /** The exact published catalogue entry, or the Creature feature, the room planned with. */
    source: checkActionSourceDtoSchema,
    /** The charges a Creature feature's check spends; null for a basic action or none. */
    featureResourceConsumption: z.nullable(encounterFeatureResourceReceiptDtoSchema),
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

/**
 * A room-planned pause on a rolled check: the d20 window its roller answers when they hold an
 * after-roll die, or a won check action's outcome dice (D173). Convex checks the d20 as it would at
 * settlement, then records the pause as the occurrence's next pending state instead of completing
 * it. `window` is present when the pause follows a d20 window's answer: the held die it spent.
 */
export const liveSessionEncounterCheckPauseCommitInputSchema = lazySchema(() =>
  z.extend(basicActionScope, {
    command: resolveRuleOccurrenceInputDtoSchema,
    revisions: liveSessionRulesRevisionsSchema,
    occurredAt: z.iso.datetime(),
    snapshot: serverKernelRuleExecutionPendingSnapshotDtoSchema,
    window: z.optional(d20WindowSpendSchema),
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

/**
 * A room-planned end of a held grant (D113): the activation it spent. Convex checks it against the
 * current Run, re-reads the grant's own `holderEnd`, deletes the grant and records the command.
 */
export const liveSessionEncounterEndHeldGrantCommitInputSchema = lazySchema(() =>
  z.extend(basicActionScope, {
    command: endHeldGrantInputDtoSchema,
    revisions: liveSessionRulesRevisionsSchema,
    occurredAt: z.iso.datetime(),
    actionEconomy: z.nullable(encounterActionEconomyTransitionDtoSchema),
    /** Warnings the command acknowledged and the room overrode. */
    ruleOverrides: encounterRuleWarningsDtoSchema,
    rules: encounterActorRuleOutputSchema
  })
)

/**
 * A room-planned move of a held effect to another creature (D160): the activation it spent. Convex
 * re-reads the effect and its offer, checks the new holder, moves the record and records the command.
 */
export const liveSessionEncounterMoveHeldEffectCommitInputSchema = lazySchema(() =>
  z.extend(basicActionScope, {
    command: moveHeldEffectInputDtoSchema,
    revisions: liveSessionRulesRevisionsSchema,
    occurredAt: z.iso.datetime(),
    actionEconomy: z.nullable(encounterActionEconomyTransitionDtoSchema),
    /** Warnings the command acknowledged and the room overrode. */
    ruleOverrides: encounterRuleWarningsDtoSchema,
    rules: encounterActorRuleOutputSchema
  })
)

/**
 * A room-planned release of a relationship by its source (D152): free, so it spends nothing.
 * Convex re-reads the effect's source, ends it and the conditions only it held, and records it.
 */
export const liveSessionEncounterReleaseRelationshipCommitInputSchema = lazySchema(() =>
  z.extend(basicActionScope, {
    command: releaseRelationshipInputDtoSchema,
    revisions: liveSessionRulesRevisionsSchema,
    occurredAt: z.iso.datetime(),
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
export type LiveSessionEncounterEndHeldGrantCommitInput = z.infer<
  typeof liveSessionEncounterEndHeldGrantCommitInputSchema
>
export type LiveSessionEncounterMoveHeldEffectCommitInput = z.infer<
  typeof liveSessionEncounterMoveHeldEffectCommitInputSchema
>
export type LiveSessionEncounterReleaseRelationshipCommitInput = z.infer<
  typeof liveSessionEncounterReleaseRelationshipCommitInputSchema
>
export type LiveSessionEncounterEscapeResponseCommitInput = z.infer<
  typeof liveSessionEncounterEscapeResponseCommitInputSchema
>
export type LiveSessionEncounterBasicActionCommitInput = z.infer<
  typeof liveSessionEncounterBasicActionCommitInputSchema
>
export type LiveSessionEncounterBasicActionResponseCommitInput = z.infer<
  typeof liveSessionEncounterBasicActionResponseCommitInputSchema
>
export type LiveSessionEncounterCheckPauseCommitInput = z.infer<
  typeof liveSessionEncounterCheckPauseCommitInputSchema
>
