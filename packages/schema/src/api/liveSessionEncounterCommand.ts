import { z } from '../zod.js'
import { encounterCommandResultDtoSchema, encounterCommandInputDtoSchema } from './encounters.js'
import {
  resolveRuleOccurrenceInputDtoSchema,
  voidRuleOccurrenceInputDtoSchema
} from './encounterRuleCommands.js'
import { liveSessionBootstrapInputSchema } from './liveSessionState.js'

/**
 * Which room planner owns a pending occurrence. Convex derives it with the native resume
 * precedence; `VOID` means Convex records a GM void that declines nothing (a cancel or a refusal).
 */
export const liveSessionEncounterRouteSchema = z.enum([
  'ACTION',
  'TURN',
  'CONCENTRATION',
  'CLEAVING',
  'DISARM',
  'MOVEMENT',
  'VOID'
])

export const liveSessionEncounterRouteInputSchema = z.extend(liveSessionBootstrapInputSchema, {
  command: z.discriminatedUnion('type', [
    resolveRuleOccurrenceInputDtoSchema,
    voidRuleOccurrenceInputDtoSchema
  ])
})

/**
 * A GM void that declines a turn or Cleaving choice names the decline the room plans on `route`,
 * the same answer a GM decline would give (ADR 0034 decision 2). A movement decline settles
 * through the room's movement path (D26) and carries none.
 */
export const liveSessionEncounterRouteResponseSchema = z.strictObject({
  route: liveSessionEncounterRouteSchema,
  decline: z.nullable(resolveRuleOccurrenceInputDtoSchema)
})

type EncounterCommandType = z.infer<typeof encounterCommandInputDtoSchema>['type']

/**
 * GM bookkeeping Convex records directly: no dice, no rules evaluation, no derived mechanics. A
 * Character's Sheet command inside `UPDATE_ACTOR` stays with the Sheet's owner (R06.3), and actor
 * removal is the lifecycle cleanup account deletion shares.
 */
export const CONVEX_RECORDED_ENCOUNTER_COMMAND_TYPES = [
  'UPDATE_ACTOR',
  'REMOVE_ACTOR',
  'SET_INITIATIVE',
  'REORDER',
  'PREVIOUS_TURN',
  'SET_CURRENT_ACTOR',
  'SET_ROUND',
  'REPLACE_OPTIONAL_COMBAT_RULES',
  'UPSERT_REMINDER',
  'REMOVE_REMINDER',
  'SET_HEALTH_DISPLAY_DEFAULT',
  'COMPLETE'
] as const satisfies readonly EncounterCommandType[]

/**
 * GM tool commands with dice or derived actor rules that have no room planner yet, so Convex
 * still evaluates them (open R06.1 work, reported with this list).
 */
export const CONVEX_EVALUATED_ENCOUNTER_COMMAND_TYPES = [
  'ROLL_RULE_EVIDENCE',
  'ROLL_ACTOR_INITIATIVE',
  'ROLL_ENEMY_ACTION',
  'ADJUST_FEATURE_RESOURCE',
  'REPLACE_CREATURE_EQUIPMENT',
  'REINFORCE',
  'REVERT_LAST_ACTION'
] as const satisfies readonly EncounterCommandType[]

/**
 * An Encounter command the room sends to Convex in room order: one of the lists above, or a
 * movement decision on a Scene the room does not own (D29).
 */
export const liveSessionEncounterCommandInputSchema = z.extend(liveSessionBootstrapInputSchema, {
  command: encounterCommandInputDtoSchema
})

/** A GM void Convex settles without a planner: its stored result, or a decline to record. */
export const liveSessionEncounterVoidInputSchema = z.extend(liveSessionBootstrapInputSchema, {
  command: voidRuleOccurrenceInputDtoSchema
})

export const liveSessionEncounterVoidPreparedSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('COMPLETE'), result: encounterCommandResultDtoSchema }),
  z.strictObject({ kind: z.literal('RECORD') })
])

export type LiveSessionEncounterRoute = z.infer<typeof liveSessionEncounterRouteSchema>
export type LiveSessionEncounterRouteInput = z.infer<typeof liveSessionEncounterRouteInputSchema>
export type LiveSessionEncounterRouteResponse = z.infer<
  typeof liveSessionEncounterRouteResponseSchema
>
export type LiveSessionEncounterCommandInput = z.infer<
  typeof liveSessionEncounterCommandInputSchema
>
export type LiveSessionEncounterVoidInput = z.infer<typeof liveSessionEncounterVoidInputSchema>
