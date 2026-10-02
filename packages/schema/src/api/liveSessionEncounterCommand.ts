import { z, lazySchema } from '../zod.js'
import {
  encounterCommandResultDtoSchema,
  encounterCommandInputDtoSchema,
  rollEncounterActorInitiativeInputDtoSchema,
  rollEncounterEnemyActionInputDtoSchema,
  type EncounterCommandInputDto
} from './encounters.js'
import {
  resolveRuleOccurrenceInputDtoSchema,
  rollRuleEvidenceInputDtoSchema,
  voidRuleOccurrenceInputDtoSchema
} from './encounterRuleCommands.js'
import { liveSessionBootstrapInputSchema } from './liveSessionState.js'

/**
 * Which room planner owns a pending occurrence. Convex derives it with the native resume
 * precedence; `VOID` means Convex records a GM void that declines nothing (a cancel or a refusal).
 */
export const liveSessionEncounterRouteSchema = lazySchema(() =>
  z.enum(['ACTION', 'TURN', 'CONCENTRATION', 'CLEAVING', 'DISARM', 'MOVEMENT', 'VOID'])
)

export const liveSessionEncounterRouteInputSchema = lazySchema(() =>
  z.extend(liveSessionBootstrapInputSchema, {
    command: z.discriminatedUnion('type', [
      resolveRuleOccurrenceInputDtoSchema,
      voidRuleOccurrenceInputDtoSchema
    ])
  })
)

/**
 * A GM void that declines a turn or Cleaving choice names the decline the room plans on `route`,
 * the same answer a GM decline would give (ADR 0034 decision 2). A movement decline settles
 * through the room's movement path (D26) and carries none.
 */
export const liveSessionEncounterRouteResponseSchema = lazySchema(() =>
  z.strictObject({
    route: liveSessionEncounterRouteSchema,
    decline: z.nullable(resolveRuleOccurrenceInputDtoSchema)
  })
)

type EncounterCommandType = z.infer<typeof encounterCommandInputDtoSchema>['type']

/**
 * Commands whose shared reducers commit against the room's native transaction: every ACTIVE-Run
 * command except a decision, which the room routes by its retained evidence (D78).
 */
export const ROOM_LOCAL_ENCOUNTER_COMMAND_TYPES = [
  'START',
  'ADVANCE_TURN',
  'USE_BASIC_ACTION',
  'RESOLVE_ACTION',
  'REORDER',
  'REMOVE_ACTOR',
  'REINFORCE',
  'REVERT_LAST_ACTION',
  'UPDATE_ACTOR',
  'UPSERT_REMINDER',
  'REMOVE_REMINDER',
  'PREVIOUS_TURN',
  'SET_CURRENT_ACTOR',
  'SET_ROUND',
  'SET_INITIATIVE',
  'ROLL_ACTOR_INITIATIVE',
  'ROLL_ENEMY_ACTION',
  'ROLL_RULE_EVIDENCE',
  'ADJUST_FEATURE_RESOURCE',
  'REPLACE_CREATURE_EQUIPMENT',
  'REPLACE_OPTIONAL_COMBAT_RULES',
  'SET_HEALTH_DISPLAY_DEFAULT',
  'COMPLETE'
] as const satisfies readonly EncounterCommandType[]

export type RoomLocalEncounterCommand = Extract<
  EncounterCommandInputDto,
  { type: (typeof ROOM_LOCAL_ENCOUNTER_COMMAND_TYPES)[number] }
>

const roomLocalCommandTypes = new Set<EncounterCommandType>(ROOM_LOCAL_ENCOUNTER_COMMAND_TYPES)

/**
 * A decision commits natively when retained evidence names its planner; otherwise the room refuses
 * it as Convex would (stale or unavailable).
 */
export type RoomNativeEncounterCommand =
  | RoomLocalEncounterCommand
  | Extract<EncounterCommandInputDto, { type: 'RESOLVE_RULE_OCCURRENCE' | 'VOID_RULE_OCCURRENCE' }>

export function isRoomLocalEncounterCommand(
  command: EncounterCommandInputDto
): command is RoomLocalEncounterCommand {
  return roomLocalCommandTypes.has(command.type)
}

/**
 * GM tools the protected Convex per-command path still records (D41) for a Run the room does not
 * hold. The room commits every ACTIVE-Run Encounter command in its own SQLite (D78) and no longer
 * sends these to Convex; the Convex path is retired in S6c3.
 */
export const CONVEX_RECORDED_ENCOUNTER_COMMAND_TYPES = [
  'UPDATE_ACTOR',
  'REMOVE_ACTOR',
  'REINFORCE',
  'REPLACE_CREATURE_EQUIPMENT',
  'ADJUST_FEATURE_RESOURCE',
  'REVERT_LAST_ACTION',
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
 * A dice command the room rolled with its secure random source (D41) for Convex to record. The room
 * now records every dice command itself (D78); this route is retired in S6c3.
 */
export const liveSessionEncounterRollInputSchema = lazySchema(() =>
  z.extend(liveSessionBootstrapInputSchema, {
    command: z.discriminatedUnion('type', [
      rollRuleEvidenceInputDtoSchema,
      rollEncounterActorInitiativeInputDtoSchema,
      rollEncounterEnemyActionInputDtoSchema
    ])
  })
)

/** The dice a roll command draws, in draw order, as each die's size; the room draws each once. */
export const liveSessionEncounterRollDiceSchema = lazySchema(() =>
  z.strictObject({
    dice: z.array(z.number().check(z.int()).check(z.positive()))
  })
)

/** A roll command with the room's draws: each in `[0, size)` for the die at its position. */
export const liveSessionEncounterRollCommitInputSchema = lazySchema(() =>
  z.extend(liveSessionEncounterRollInputSchema, {
    draws: z.array(z.number().check(z.int()).check(z.nonnegative()))
  })
)

/**
 * An Encounter command Convex records for the room in room order. The room commits every
 * ACTIVE-Run command itself (D78) and no longer sends it; the route is retired in S6c3.
 */
export const liveSessionEncounterCommandInputSchema = lazySchema(() =>
  z.extend(liveSessionBootstrapInputSchema, {
    command: encounterCommandInputDtoSchema
  })
)

/** A GM void Convex settles without a planner: its stored result, or a decline to record. */
export const liveSessionEncounterVoidInputSchema = lazySchema(() =>
  z.extend(liveSessionBootstrapInputSchema, {
    command: voidRuleOccurrenceInputDtoSchema
  })
)

export const liveSessionEncounterVoidPreparedSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('COMPLETE'), result: encounterCommandResultDtoSchema }),
    z.strictObject({ kind: z.literal('RECORD') })
  ])
)

export type LiveSessionEncounterRoute = z.infer<typeof liveSessionEncounterRouteSchema>
export type LiveSessionEncounterRouteInput = z.infer<typeof liveSessionEncounterRouteInputSchema>
export type LiveSessionEncounterRouteResponse = z.infer<
  typeof liveSessionEncounterRouteResponseSchema
>
export type LiveSessionEncounterCommandInput = z.infer<
  typeof liveSessionEncounterCommandInputSchema
>
export type LiveSessionEncounterVoidInput = z.infer<typeof liveSessionEncounterVoidInputSchema>
export type LiveSessionEncounterRollInput = z.infer<typeof liveSessionEncounterRollInputSchema>
