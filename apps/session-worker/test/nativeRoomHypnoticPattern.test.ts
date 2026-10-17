import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { hypnoticPattern } from '@artificer-toolkit/source-data/srd/spells/hypnotic-pattern.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-27.T9: Hypnotic Pattern, authored from core options. A creature that fails its Wisdom
 * save holds charmed, incapacitated and a speed of 0 through one effect that ends on any damage or
 * when another creature uses an action to rouse it; the GM's undo restores them together.
 */

const CASTER_ID = testUuid(0x9a0)
const CHARACTER_ID = testUuid(0x9a1)
const ATTACKER_ID = testUuid(0x9a2)
const FIRST_ID = testUuid(0x9a3)
const SECOND_ID = testUuid(0x9a4)
const ENTRANCED = [FIRST_ID, SECOND_ID].sort()

const missingVocabulary = (name: string): never => {
  throw new Error(`The SRD vocabulary lacks ${name}.`)
}
const conditionTypeId = (code: string) =>
  srdSystemRecord.conditionTypes.find((condition) => condition.code === code)?.id ??
  missingVocabulary(code)
const [CHARMED, INCAPACITATED] = [conditionTypeId('CHARMED'), conditionTypeId('INCAPACITATED')]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const attacker = srdCreatureActor({ id: ATTACKER_ID, creature: plainWolf })
const entranced = [FIRST_ID, SECOND_ID].map((id) => srdCreatureActor({ id, creature: plainWolf }))

/**
 * The Character casts Hypnotic Pattern at x = 1150; the two Wolves stand inside its cube and the
 * attacker beside the Character stays outside it. Rolls are zero-based: the two saves roll natural
 * 1s, then the attacker's Bite hits with a natural 19.
 */
function hypnoticRoom() {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CASTER_ID, characterId: CHARACTER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      attacker,
      ...entranced
    ],
    positions: {
      [ATTACKER_ID]: { x: 300, y: 150 },
      [FIRST_ID]: { x: 1100, y: 150 },
      [SECOND_ID]: { x: 1200, y: 150 }
    },
    characterSpellcasting: { spells: [hypnoticPattern], prepared: [hypnoticPattern.id] },
    characterAction: (action) => action.label === 'Hypnotic Pattern (3rd level)',
    autoRoll: 'GAME_MASTER',
    rolls: [0, 0, 18],
    fallbackRoll: 5
  })
}

type HypnoticRoom = Awaited<ReturnType<typeof hypnoticRoom>>

async function history(room: HypnoticRoom) {
  const stored = await readRoomHistory(room.room.base.stub)
  const held = (heldConditionTypeId: string) =>
    vitalsOf(stored)
      .filter(({ conditions }) =>
        ((conditions ?? []) as { conditionTypeId: string }[]).some(
          (condition) => condition.conditionTypeId === heldConditionTypeId
        )
      )
      .map(({ id }) => id)
      .sort()
  return {
    charmed: held(CHARMED),
    incapacitated: held(INCAPACITATED),
    effectHolders: stored.activeEffects.map(({ targetActorId }) => targetActorId).sort()
  }
}

/** The walking budget the GM's Encounter session shows `actorId` this turn. */
async function walkBudget(room: HypnoticRoom, actorId: string) {
  const { base } = room.room
  const first = base.messages.length
  base.socket.send(JSON.stringify({ type: 'SUBSCRIBE_ENCOUNTER_SESSION', timeline: false }))
  const state = await vi.waitFor(() => {
    const message = base.messages
      .slice(first)
      .find((candidate) => candidate.type === 'ENCOUNTER_SESSION')
    if (message?.type !== 'ENCOUNTER_SESSION' || !message.session.held)
      throw new Error('The room has not sent the held Encounter session.')
    return message.session.state
  })
  return state.turnMovement
    .find((movement) => movement.actorId === actorId)
    ?.allowances.find(({ code }) => code === 'WALK')?.budget
}

/** The Character casts Hypnotic Pattern; both Wolves fail their Wisdom saves. */
async function castHypnoticPattern(room: HypnoticRoom) {
  const { answer } = await room.startAreaAction({ x: 1150, y: 150 })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  for (;;) {
    const decision = await readPendingActionDecision(room.room.base.stub)
    if (decision?.pending.kind !== 'AREA_SAVES') break
    const [save] = decision.pending.saves
    if (!save) break
    const answered = await room.send(
      room.resolveCommand(decision, {
        kind: 'ENTER_DICE',
        requestId: save.request.requestId,
        rawFaces: [1],
        rollMode: save.request.rollMode
      })
    )
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
  }
}

async function undoLastAction(room: HypnoticRoom) {
  const undone = await room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
}

/** The attacker's Bite at `targetId` on its own turn. */
async function biteHits(room: HypnoticRoom, targetId: string) {
  await room.advanceTurn()
  const bite = plainWolf.features?.find((feature) => feature.label === 'Bite')
  if (!bite) throw new Error('The Wolf has a Bite.')
  const { answer } = await room.startAction(
    targetId,
    ['TARGET_RANGE_UNCHECKED'],
    null,
    null,
    room.featureActionId(attacker, bite.id),
    ATTACKER_ID
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

const rouseDefinition = SRD_BASIC_ACTION_DEFINITIONS.find(
  ({ id }) => id === SRD_BASIC_ACTION_IDS.ROUSE
)
if (rouseDefinition?.document.kind !== 'BASIC_ACTION') throw new Error('Missing Rouse fixture.')
const rouseEffectId = rouseDefinition.document.effects[0]!.id

/** The attacker, on its own turn, uses its action to rouse `targetId`. */
async function rouses(room: HypnoticRoom, targetId: string) {
  await room.advanceTurn()
  const { answer } = await room.startAction(
    targetId,
    ['TARGET_RANGE_UNCHECKED'],
    null,
    null,
    encounterBasicActionId(ATTACKER_ID, SRD_BASIC_ACTION_IDS.ROUSE, rouseEffectId),
    ATTACKER_ID
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

const untouched = { charmed: [], incapacitated: [], effectHolders: [] }
const entrancedBoth = {
  charmed: ENTRANCED,
  incapacitated: ENTRANCED,
  effectHolders: ENTRANCED
}
const onlySecond = {
  charmed: [SECOND_ID],
  incapacitated: [SECOND_ID],
  effectHolders: [SECOND_ID]
}

describe('room cast of Hypnotic Pattern (SPELLS-27.T9)', () => {
  it('charms and incapacitates each creature that fails its save and takes its speed to 0, through one effect', async () => {
    const room = await hypnoticRoom()
    expect(await history(room)).toEqual(untouched)
    expect(await walkBudget(room, FIRST_ID)).toBeGreaterThan(0)

    await castHypnoticPattern(room)

    expect(await history(room)).toEqual(entrancedBoth)
    expect(await walkBudget(room, FIRST_ID)).toBe(0)
    expect(await walkBudget(room, SECOND_ID)).toBe(0)
  }, 120000)

  it('releases a creature’s conditions, effect and speed when it takes damage, leaving the other entranced', async () => {
    const room = await hypnoticRoom()
    await castHypnoticPattern(room)

    await biteHits(room, FIRST_ID)

    expect(await history(room)).toEqual(onlySecond)
    expect(await walkBudget(room, FIRST_ID)).toBeGreaterThan(0)
    expect(await walkBudget(room, SECOND_ID)).toBe(0)
  }, 120000)

  it('gives the creature its conditions, effect and speed 0 back when the damage is undone', async () => {
    const room = await hypnoticRoom()
    await castHypnoticPattern(room)
    await biteHits(room, FIRST_ID)

    await undoLastAction(room)

    expect(await history(room)).toEqual(entrancedBoth)
    expect(await walkBudget(room, FIRST_ID)).toBe(0)
  }, 120000)

  it('releases a creature another creature rouses by an action, leaving the other entranced', async () => {
    const room = await hypnoticRoom()
    await castHypnoticPattern(room)

    await rouses(room, FIRST_ID)

    expect(await history(room)).toEqual(onlySecond)
    expect(await walkBudget(room, FIRST_ID)).toBeGreaterThan(0)
  }, 120000)

  it('releases every creature when the cast is undone', async () => {
    const room = await hypnoticRoom()
    await castHypnoticPattern(room)

    await undoLastAction(room)

    expect(await history(room)).toEqual(untouched)
    expect(await walkBudget(room, FIRST_ID)).toBeGreaterThan(0)
  }, 120000)
})
