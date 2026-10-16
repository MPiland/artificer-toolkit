import { describe, expect, it } from 'vitest'
import { EncounterDomainRejection } from '@artificer-toolkit/encounter-persistence/domainRejections'
import {
  ENCOUNTER_ID,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plainWolf } from './testing/movementPlannerFixture.js'
import { preparedEncounterRoom } from './testing/preparedEncounterRoom.js'
import { uuid } from './testing/roomAggregateFixture.js'

/**
 * ADR 0034 decision 1 for initiative: a player enters or rolls their own actor's initiative once,
 * while it is collected, through the room's real command path; every later change is the GM's.
 */

const GM_ID = uuid(0xf01)
const PLAYER_ID = uuid(0xf02)
const OTHER_PLAYER_ID = uuid(0xf03)
const OWN_ACTOR_ID = uuid(0xf10)
const OTHER_PLAYERS_ACTOR_ID = uuid(0xf11)
const UNCONTROLLED_ACTOR_ID = uuid(0xf12)
const epoch = '2026-09-30T12:00:00.000Z'

async function room() {
  const wolf = (id: string, sourceId: string, controllerUserIds: string[]) => ({
    ...srdCreatureActor({ id, creature: { ...plainWolf, id: sourceId } }),
    controllerUserIds
  })
  const prepared = await preparedEncounterRoom({
    actors: [
      wolf(OWN_ACTOR_ID, uuid(0xf20), [PLAYER_ID]),
      wolf(OTHER_PLAYERS_ACTOR_ID, uuid(0xf21), [OTHER_PLAYER_ID]),
      wolf(UNCONTROLLED_ACTOR_ID, uuid(0xf22), [])
    ],
    members: [
      { userId: GM_ID, role: 'OWNER', membershipEpoch: epoch },
      { userId: PLAYER_ID, role: 'PLAYER', membershipEpoch: epoch },
      { userId: OTHER_PLAYER_ID, role: 'PLAYER', membershipEpoch: epoch }
    ]
  })
  const version = () => prepared.room.documents('encounterRuns')[0]!.version
  const initiativeOf = (actorId: string): unknown => {
    const row = prepared.room.documents('encounterRunActors').find(({ id }) => id === actorId)
    return JSON.parse(row!.stateJson).initiative
  }
  /** The reason the room refused the command; throws when it accepted. */
  const refusal = async (attempt: Promise<unknown>) => {
    const error = await attempt.then(
      () => null,
      (thrown: unknown) => thrown
    )
    if (!(error instanceof EncounterDomainRejection))
      throw error ?? new Error('The room accepted the command.')
    return error.data.reason
  }
  const base = () => ({
    encounterId: ENCOUNTER_ID,
    commandId: crypto.randomUUID(),
    expectedVersion: version()
  })
  const setInitiative = (actorId: string, manualOrder?: number) => ({
    ...base(),
    type: 'SET_INITIATIVE' as const,
    actorId,
    initiative: 14,
    ...(manualOrder === undefined ? {} : { manualOrder })
  })
  const rollInitiative = (actorId: string) => ({
    ...base(),
    type: 'ROLL_ACTOR_INITIATIVE' as const,
    actorId
  })
  return { ...prepared, version, initiativeOf, refusal, setInitiative, rollInitiative }
}

describe('SET_INITIATIVE while initiative is collected', () => {
  it('records the controlling player’s own value', async () => {
    const { execute, setInitiative, initiativeOf, version } = await room()
    await execute(PLAYER_ID, setInitiative(OWN_ACTOR_ID))
    expect(initiativeOf(OWN_ACTOR_ID)).toBe(14)
    expect(version()).toBe(1)
  })

  it('refuses a player for an actor another player or nobody controls', async () => {
    const { execute, setInitiative, refusal, version } = await room()
    expect(await refusal(execute(PLAYER_ID, setInitiative(OTHER_PLAYERS_ACTOR_ID)))).toBe(
      'NOT_ACTOR_CONTROLLER'
    )
    expect(await refusal(execute(PLAYER_ID, setInitiative(UNCONTROLLED_ACTOR_ID)))).toBe(
      'NOT_ACTOR_CONTROLLER'
    )
    expect(version()).toBe(0)
  })

  it('keeps the tie-break order the GM’s', async () => {
    const { execute, setInitiative, refusal, version } = await room()
    expect(await refusal(execute(PLAYER_ID, setInitiative(OWN_ACTOR_ID, 0)))).toBe('GM_ONLY')
    expect(version()).toBe(0)
  })

  it('is the GM’s once the order is settled', async () => {
    const {
      execute,
      setInitiative,
      rollInitiative,
      refusal,
      startAndSettleInitiative,
      version,
      initiativeOf
    } = await room()
    await startAndSettleInitiative({
      gmId: GM_ID,
      startCommandId: crypto.randomUUID(),
      answerCommandId: () => crypto.randomUUID()
    })
    const settled = version()
    const before = initiativeOf(OWN_ACTOR_ID)
    expect(await refusal(execute(PLAYER_ID, setInitiative(OWN_ACTOR_ID)))).toBe('GM_ONLY')
    expect(await refusal(execute(PLAYER_ID, rollInitiative(OWN_ACTOR_ID)))).toBe('GM_ONLY')
    expect(version()).toBe(settled)
    expect(initiativeOf(OWN_ACTOR_ID)).toBe(before)
    // The GM's correction is unchanged.
    await execute(GM_ID, setInitiative(OWN_ACTOR_ID))
    expect(initiativeOf(OWN_ACTOR_ID)).toBe(14)
  })

  it('is one entry: a second value is the GM’s', async () => {
    const { execute, setInitiative, refusal, version, initiativeOf } = await room()
    await execute(PLAYER_ID, setInitiative(OWN_ACTOR_ID))
    expect(await refusal(execute(PLAYER_ID, setInitiative(OWN_ACTOR_ID)))).toBe('GM_ONLY')
    expect(version()).toBe(1)
    await execute(GM_ID, { ...setInitiative(OWN_ACTOR_ID), initiative: 3 })
    expect(initiativeOf(OWN_ACTOR_ID)).toBe(3)
  })

  it('refuses a roll after the player entered a value', async () => {
    const { execute, setInitiative, rollInitiative, refusal, version, initiativeOf } = await room()
    await execute(PLAYER_ID, setInitiative(OWN_ACTOR_ID))
    expect(await refusal(execute(PLAYER_ID, rollInitiative(OWN_ACTOR_ID)))).toBe('GM_ONLY')
    expect(version()).toBe(1)
    expect(initiativeOf(OWN_ACTOR_ID)).toBe(14)
  })
})

describe('ROLL_ACTOR_INITIATIVE', () => {
  it('rolls for the controlling player’s own actor', async () => {
    const { execute, rollInitiative, initiativeOf, version } = await room()
    const answer = await execute(PLAYER_ID, rollInitiative(OWN_ACTOR_ID))
    const roll = answer.recipients.get(PLAYER_ID)?.roll
    expect(roll).toBeTruthy()
    expect(initiativeOf(OWN_ACTOR_ID)).toBe(roll?.evidence.total)
    expect(version()).toBe(1)
  })

  it('is one entry: a second roll, or a value after a roll, is the GM’s', async () => {
    const { execute, rollInitiative, setInitiative, refusal, version, initiativeOf } = await room()
    await execute(PLAYER_ID, rollInitiative(OWN_ACTOR_ID))
    const rolled = initiativeOf(OWN_ACTOR_ID)
    expect(await refusal(execute(PLAYER_ID, rollInitiative(OWN_ACTOR_ID)))).toBe('GM_ONLY')
    expect(await refusal(execute(PLAYER_ID, setInitiative(OWN_ACTOR_ID)))).toBe('GM_ONLY')
    expect(version()).toBe(1)
    expect(initiativeOf(OWN_ACTOR_ID)).toBe(rolled)
    // The GM's re-roll is unchanged.
    await execute(GM_ID, rollInitiative(OWN_ACTOR_ID))
    expect(version()).toBe(2)
  })

  it('replays a retried first roll instead of refusing it', async () => {
    const { execute, rollInitiative, version } = await room()
    const command = rollInitiative(OWN_ACTOR_ID)
    await execute(PLAYER_ID, command)
    await execute(PLAYER_ID, command)
    expect(version()).toBe(1)
  })

  it('refuses a player for an actor another player or nobody controls', async () => {
    const { execute, rollInitiative, refusal, version } = await room()
    expect(await refusal(execute(PLAYER_ID, rollInitiative(OTHER_PLAYERS_ACTOR_ID)))).toBe(
      'NOT_ACTOR_CONTROLLER'
    )
    expect(await refusal(execute(PLAYER_ID, rollInitiative(UNCONTROLLED_ACTOR_ID)))).toBe(
      'NOT_ACTOR_CONTROLLER'
    )
    expect(version()).toBe(0)
  })
})
