import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

const SOURCE_ID = testUuid(0xb00)
const WOUNDED_ID = testUuid(0xb01)
const LEADER_ID = testUuid(0xb02)
const CHARACTER_ACTOR_ID = testUuid(0xb03)
const CHARACTER_ID = testUuid(0xb04)
const ATTACKERS = testUuid(0xb10)
const DEFENDERS = testUuid(0xb11)

const bite = biteWolf('SAVE')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Wolf below half its hit points and its side's leader, against the acting Wolf. */
function moraleRoom(options: { kinds?: readonly ('MORALE' | 'DISARM')[] } = {}) {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature: bite, sideId: ATTACKERS }),
      srdCreatureActor({ id: WOUNDED_ID, creature: bite, sideId: DEFENDERS, currentHitPoints: 4 }),
      srdCreatureActor({ id: LEADER_ID, creature: bite, sideId: DEFENDERS }),
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
    ],
    ownerFeatureId: creatureFeature(bite, 'Bite').id,
    optionalCombatKinds: options.kinds ?? ['MORALE'],
    rolls: [0, 0, 0, 0]
  })
}
type Room = Awaited<ReturnType<typeof moraleRoom>>

async function storedMorale(room: Room, actorId: string) {
  const row = (await readRoomHistory(room.room.base.stub)).actors.find(({ id }) => id === actorId)
  const actor = readStoredRunActor(row!)
  return actor.kind === 'CHARACTER' ? undefined : actor.morale
}

async function checkCommand(room: Room, overrides: Record<string, unknown> = {}) {
  return {
    type: 'MORALE_SAVE',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId: WOUNDED_ID,
    triggerKind: 'INDIVIDUAL_SURPRISED',
    leaderActorId: null,
    overwhelmingOpposition: false,
    escapePossible: true,
    roll: { kind: 'AUTO_ROLL' },
    visibility: 'PUBLIC',
    ...overrides
  }
}

async function check(room: Room, overrides: Record<string, unknown> = {}) {
  return room.send(await checkCommand(room, overrides))
}

async function confirm(room: Room, disposition: string, actorId = WOUNDED_ID) {
  return room.send({
    type: 'CONFIRM_MORALE',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId,
    disposition
  })
}

/** The committed command's GM projection of `actorId`. */
function projected(answer: Awaited<ReturnType<Room['send']>>, actorId: string) {
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  if (answer.type !== 'COMMAND_COMMITTED' || answer.delta?.scope !== 'ENCOUNTER')
    throw new Error('Missing the GM’s Encounter answer.')
  const actor = answer.delta.result.projection.actors.find(({ id }) => id === actorId)
  if (!actor) throw new Error('The projection lacks the actor.')
  return actor
}

describe('Morale in the native room (ENCOUNTER-6.1, 6.2)', () => {
  it('offers the half-hit-point trigger from Run state until it is checked and confirmed', async () => {
    const room = await moraleRoom()
    const surprised = projected(await check(room), WOUNDED_ID)
    expect(surprised.moraleOffers).toContainEqual({
      triggerKind: 'INDIVIDUAL_REDUCED_TO_HALF',
      origin: 'RUN_STATE'
    })
    expect(surprised.moraleOffers.map(({ triggerKind }) => triggerKind)).not.toContain(
      'INDIVIDUAL_SURPRISED'
    )

    const checked = projected(
      await check(room, { triggerKind: 'INDIVIDUAL_REDUCED_TO_HALF' }),
      WOUNDED_ID
    )
    expect(checked.morale).toMatchObject({
      triggerKind: 'INDIVIDUAL_REDUCED_TO_HALF',
      scope: 'SUBJECT',
      rollerActorId: WOUNDED_ID,
      disposition: null,
      firedTriggerKinds: ['INDIVIDUAL_REDUCED_TO_HALF', 'INDIVIDUAL_SURPRISED']
    })
    expect(checked.morale?.save?.rawFaces).toEqual([1])

    const confirmed = projected(await confirm(room, 'SURRENDER'), WOUNDED_ID)
    expect(confirmed.morale).toMatchObject({ disposition: 'SURRENDER' })
    expect(confirmed.moraleOffers.map(({ triggerKind }) => triggerKind)).not.toContain(
      'INDIVIDUAL_REDUCED_TO_HALF'
    )
    expect(await storedMorale(room, WOUNDED_ID)).toMatchObject({ disposition: 'SURRENDER' })
  })

  it('has the leader roll a group check and confirms every covered creature together', async () => {
    const room = await moraleRoom()
    const answer = await check(room, { triggerKind: 'GROUP_SURPRISED', leaderActorId: LEADER_ID })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    for (const actorId of [WOUNDED_ID, LEADER_ID])
      expect(await storedMorale(room, actorId)).toMatchObject({
        triggerKind: 'GROUP_SURPRISED',
        scope: 'GROUP',
        rollerActorId: LEADER_ID,
        groupLeaderActorId: LEADER_ID,
        disposition: null
      })
    expect(await storedMorale(room, SOURCE_ID)).toBeUndefined()

    expect((await confirm(room, 'FLEE')).type).toBe('COMMAND_COMMITTED')
    for (const actorId of [WOUNDED_ID, LEADER_ID])
      expect(await storedMorale(room, actorId)).toMatchObject({ disposition: 'FLEE' })
  })

  it('refuses a check while the Morale rule is not on', async () => {
    const room = await moraleRoom({ kinds: ['DISARM'] })
    expect((await check(room)).type).not.toBe('COMMAND_COMMITTED')
    expect(await storedMorale(room, WOUNDED_ID)).toBeUndefined()
  })

  it('refuses a player, a Character target, a second confirmation and a check during a decision', async () => {
    const room = await moraleRoom()
    expect(await room.sendAsPlayer(await checkCommand(room))).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'GM_ONLY'
    })
    expect(await check(room, { actorId: CHARACTER_ACTOR_ID })).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'TARGET_UNAVAILABLE'
    })
    expect((await check(room)).type).toBe('COMMAND_COMMITTED')
    expect((await confirm(room, 'FLEE')).type).toBe('COMMAND_COMMITTED')
    expect(await confirm(room, 'FLEE')).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'TARGET_UNAVAILABLE'
    })

    expect((await room.startAction(WOUNDED_ID)).answer.type).toBe('COMMAND_COMMITTED')
    await room.pendingDecision()
    expect(await check(room, { triggerKind: 'INDIVIDUAL_CANNOT_HARM_OPPOSITION' })).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'PENDING_DECISION'
    })
  })

  it('replays the same command and refuses its id on a different one', async () => {
    const room = await moraleRoom()
    const command = await checkCommand(room)
    expect((await room.send(command)).type).toBe('COMMAND_COMMITTED')
    const version = await room.version()
    expect((await room.send(command)).type).toBe('COMMAND_COMMITTED')
    expect(await room.version()).toBe(version)

    expect(
      await room.send({ ...command, triggerKind: 'INDIVIDUAL_CANNOT_HARM_OPPOSITION' })
    ).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'COMMAND_ID_REUSED' })
  })

  it('keeps a private morale roll off the table’s timeline', async () => {
    const room = await moraleRoom()
    expect((await check(room, { visibility: 'PRIVATE' })).type).toBe('COMMAND_COMMITTED')
    const { commands } = await readRoomHistory(room.room.base.stub)
    expect(commands.find(({ commandType }) => commandType === 'MORALE_SAVE')).toMatchObject({
      visibility: 'PRIVATE'
    })
  })
})
