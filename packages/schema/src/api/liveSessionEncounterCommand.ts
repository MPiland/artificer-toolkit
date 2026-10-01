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

/** Commands whose shared reducers commit against the room's native transaction. */
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
  'ADJUST_FEATURE_RESOURCE',
  'REPLACE_CREATURE_EQUIPMENT',
  'REPLACE_OPTIONAL_COMBAT_RULES',
  'SET_HEALTH_DISPLAY_DEFAULT',
  'COMPLETE'
] as const satisfies readonly EncounterCommandType[]

export type RoomLocalEncounterCommand =
  | Extract<
      EncounterCommandInputDto,
      {
        type: Exclude<
          (typeof ROOM_LOCAL_ENCOUNTER_COMMAND_TYPES)[number],
          'UPDATE_ACTOR' | 'ROLL_ENEMY_ACTION'
        >
      }
    >
  | (Extract<EncounterCommandInputDto, { type: 'UPDATE_ACTOR' }> & {
      characterCommand?: undefined
    })
  | (Extract<EncounterCommandInputDto, { type: 'ROLL_ENEMY_ACTION' }> & {
      visibility: 'PRIVATE'
    })

const roomLocalCommandTypes = new Set<EncounterCommandType>(ROOM_LOCAL_ENCOUNTER_COMMAND_TYPES)

/** A decision joins the native path only after retained evidence identifies an implemented planner. */
export type RoomNativeEncounterCommand =
  | RoomLocalEncounterCommand
  | Extract<EncounterCommandInputDto, { type: 'RESOLVE_RULE_OCCURRENCE' | 'VOID_RULE_OCCURRENCE' }>

export function isRoomLocalEncounterCommand(
  command: EncounterCommandInputDto
): command is RoomLocalEncounterCommand {
  return (
    roomLocalCommandTypes.has(command.type) &&
    (command.type !== 'UPDATE_ACTOR' || command.characterCommand === undefined) &&
    (command.type !== 'ROLL_ENEMY_ACTION' || command.visibility === 'PRIVATE')
  )
}

/**
 * Transitional GM tools Convex still records directly (D41): no dice, and no derived mechanics beyond the
 * deterministic actor recalculation every Convex commit runs anyway. A Character's Sheet command
 * inside `UPDATE_ACTOR` stays with the Sheet's owner (R06.3). Commands listed in
 * ROOM_LOCAL_ENCOUNTER_COMMAND_TYPES commit in room SQLite; their protected Convex path remains
 * for shadow parity until S5 closes.
 * Account cleanup still shares the actor-removal reducer.
 * Dice commands are rolled by the room (`liveSessionEncounterRoll*`).
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

/** A dice command the room rolls with its secure random source (D41); Convex records it. */
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
 * An Encounter command the room sends to Convex in room order: a recorded GM tool, or a
 * movement decision on a Scene the room does not own (D29).
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
