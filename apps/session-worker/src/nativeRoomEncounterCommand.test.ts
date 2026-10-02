import { describe, expect, it } from 'vitest'
import type { EncounterCommandInputDto } from '@artificer-toolkit/schema/api/encounters'
import {
  CONVEX_RECORDED_ENCOUNTER_COMMAND_TYPES,
  ROOM_LOCAL_ENCOUNTER_COMMAND_TYPES
} from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import { LIVE_SESSION_TRY_AGAIN_MESSAGE } from '@artificer-toolkit/schema/api/liveSessionCommands'
import { LiveSessionRouteError } from './liveSessionRoutes.js'
import { encounterCommandRefusal, roomEncounterPlanner } from './nativeRoomEncounterCommand.js'

const commandTypes = [
  'UPDATE_ACTOR',
  'REMOVE_ACTOR',
  'REINFORCE',
  'REPLACE_CREATURE_EQUIPMENT',
  'SET_INITIATIVE',
  'ROLL_ACTOR_INITIATIVE',
  'REORDER',
  'START',
  'ADVANCE_TURN',
  'PREVIOUS_TURN',
  'SET_CURRENT_ACTOR',
  'SET_ROUND',
  'REPLACE_OPTIONAL_COMBAT_RULES',
  'ADJUST_FEATURE_RESOURCE',
  'UPSERT_REMINDER',
  'REMOVE_REMINDER',
  'ROLL_ENEMY_ACTION',
  'SET_HEALTH_DISPLAY_DEFAULT',
  'COMPLETE',
  'RESOLVE_ACTION',
  'USE_BASIC_ACTION',
  'RESOLVE_RULE_OCCURRENCE',
  'VOID_RULE_OCCURRENCE',
  'REVERT_LAST_ACTION',
  'ROLL_RULE_EVIDENCE'
] as const satisfies readonly EncounterCommandInputDto['type'][]
// Every Encounter command type is listed: a new one fails to compile until it is placed.
const everyType: [
  Exclude<EncounterCommandInputDto['type'], (typeof commandTypes)[number]>
] extends [never]
  ? true
  : never = true

describe('room Encounter command planners', () => {
  it('commits every non-decision command in room SQLite (D78)', () => {
    expect(everyType).toBe(true)
    const local = new Set<string>(ROOM_LOCAL_ENCOUNTER_COMMAND_TYPES)
    expect(commandTypes.filter((type) => !local.has(type))).toEqual([
      'RESOLVE_RULE_OCCURRENCE',
      'VOID_RULE_OCCURRENCE'
    ])
  })

  it('keeps the legacy planner naming the GM tools the protected Convex path records', () => {
    const convex = commandTypes.filter((type) => roomEncounterPlanner({ type }) === 'CONVEX')
    expect(convex.sort()).toEqual([...CONVEX_RECORDED_ENCOUNTER_COMMAND_TYPES].sort())
    // Convex records GM tools with no dice and no derived mechanics beyond actor recalculation (D41).
    expect(convex.sort()).toEqual([
      'ADJUST_FEATURE_RESOURCE',
      'COMPLETE',
      'PREVIOUS_TURN',
      'REINFORCE',
      'REMOVE_ACTOR',
      'REMOVE_REMINDER',
      'REORDER',
      'REPLACE_CREATURE_EQUIPMENT',
      'REPLACE_OPTIONAL_COMBAT_RULES',
      'REVERT_LAST_ACTION',
      'SET_CURRENT_ACTOR',
      'SET_HEALTH_DISPLAY_DEFAULT',
      'SET_INITIATIVE',
      'SET_ROUND',
      'UPDATE_ACTOR',
      'UPSERT_REMINDER'
    ])
    expect(
      Object.fromEntries(
        commandTypes
          .filter((type) => roomEncounterPlanner({ type }) !== 'CONVEX')
          .map((type) => [type, roomEncounterPlanner({ type })])
      )
    ).toEqual({
      START: 'TURN',
      ADVANCE_TURN: 'TURN',
      RESOLVE_ACTION: 'ACTION',
      USE_BASIC_ACTION: 'BASIC_ACTION',
      ROLL_ACTOR_INITIATIVE: 'ROLL',
      ROLL_ENEMY_ACTION: 'ROLL',
      ROLL_RULE_EVIDENCE: 'ROLL',
      RESOLVE_RULE_OCCURRENCE: 'DECISION',
      VOID_RULE_OCCURRENCE: 'DECISION'
    })
    expect(roomEncounterPlanner({ type: 'RESOLVE_ACTION', optionalCombatIntent: {} })).toBe(
      'DISARM'
    )
  })
})

describe('encounterCommandRefusal', () => {
  it('offers a retry when Convex ran out of time and keeps STALE_STATE for real staleness (D47)', () => {
    expect(encounterCommandRefusal(new LiveSessionRouteError(503))).toEqual({
      code: 'UNAVAILABLE',
      message: LIVE_SESSION_TRY_AGAIN_MESSAGE
    })
    expect(encounterCommandRefusal(new LiveSessionRouteError(409))).toMatchObject({
      code: 'STALE_STATE'
    })
    expect(encounterCommandRefusal(new LiveSessionRouteError(0))).toEqual({
      code: 'UNAVAILABLE',
      message: 'The Encounter command could not be completed.'
    })
  })
})
