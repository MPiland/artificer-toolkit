import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { bard } from '@artificer-toolkit/source-data/srd/classes/bard.js'
import { CLASS_IDS } from '@artificer-toolkit/source-data/srd/ids.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { areaReceipts } from './areaRoomReads.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

const SOURCE_ID = testUuid(0x7f0)
const TARGET_ID = testUuid(0x7f1)
const BARD_ID = testUuid(0x7f2)
const INSPIRATION_ID = testUuid(0x7f3)
const attackBite = biteWolf('ATTACK')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const bardicInspiration = (() => {
  const feature = bard.features?.find(({ label }) => label === 'Bardic Inspiration')
  const effect = feature?.effects?.[0]
  if (!feature || !effect) throw new Error('The SRD Bardic Inspiration is missing.')
  return { label: feature.label, effect }
})()

/** A Wolf whose Bite attacks (+4) a Wolf (AC 13); `holderId` holds a Bard's inspiration die. */
function inspiredRoom(holderId: string, bardLevel = 10) {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature: attackBite }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(attackBite, 'Bite').id,
    seed: seedModifierGrant({
      sourceActorId: BARD_ID,
      holderActorId: holderId,
      lifecycle: {},
      effect: bardicInspiration.effect,
      sourceLabel: bardicInspiration.label,
      sourceClassLevels: { [CLASS_IDS.BARD]: bardLevel },
      id: INSPIRATION_ID
    })
  })
}
type Room = Awaited<ReturnType<typeof inspiredRoom>>

/** The attacker answers its Bite attack with a natural 5, which misses AC 13 (5 + 4) without the die. */
async function rollAttack(room: Room) {
  expect((await room.startAction(TARGET_ID)).answer.type).toBe('COMMAND_COMMITTED')
  const attack = await room.pendingDecision()
  if (attack.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the attack prompt.')
  const { request } = attack.pending
  const rolled = await room.resolve(attack, {
    kind: 'ENTER_DICE',
    requestId: request.requestId,
    rawFaces: [5],
    rollMode: request.rollMode
  })
  expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
}

async function openWindow(room: Room) {
  await rollAttack(room)
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_WINDOW') throw new Error('Expected the d20 window.')
  return { decision, pending: decision.pending }
}

const holdsInspiration = async (room: Room) =>
  (await readRoomHistory(room.room.base.stub)).activeEffects.some(
    (effect) => effect.id === INSPIRATION_ID
  )

const targetBatch = async (room: Room) =>
  areaReceipts(await readRoomHistory(room.room.base.stub)).children.find(
    ({ outputs }) =>
      outputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' && outputs.targetActorId === TARGET_ID
  )?.outputs

describe('Bardic Inspiration spent in the room d20 window of an attack roll', () => {
  it.each([
    [3, 6],
    [5, 8],
    [10, 10],
    [15, 12]
  ])(
    "offers the attacker a level %i Bard's d%i once the attack is rolled",
    async (level, faces) => {
      const room = await inspiredRoom(SOURCE_ID, level)
      const { pending } = await openWindow(room)
      expect(pending).toMatchObject({
        rollerActorId: SOURCE_ID,
        d20: { selectedNatural: 5 },
        options: [{ label: 'Bardic Inspiration', count: 1, faces, sign: 'ADD' }]
      })
      expect(await holdsInspiration(room)).toBe(true)
      expect(await targetBatch(room)).toBeUndefined()
    }
  )

  it('adds the die to the missed attack, which then hits, and spends the inspiration', async () => {
    const room = await inspiredRoom(SOURCE_ID)
    const { decision, pending } = await openWindow(room)
    const used = await room.resolve(decision, {
      kind: 'D20_WINDOW_USE',
      requestId: pending.requestId,
      optionId: pending.options[0]!.optionId,
      faces: [10]
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await holdsInspiration(room)).toBe(false)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const batch = await targetBatch(room)
    if (batch?.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
      throw new Error('The Bite left no batch.')
    const { before, after } = batch.targetTransition
    expect(before.currentHitPoints - after.currentHitPoints).toBe(1)
  })

  it('keeps the inspiration when the attacker declines, so the attack misses', async () => {
    const room = await inspiredRoom(SOURCE_ID)
    const { decision, pending } = await openWindow(room)
    const declined = await room.resolve(decision, {
      kind: 'D20_WINDOW_DECLINE',
      requestId: pending.requestId
    })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    expect(await holdsInspiration(room)).toBe(true)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('never pauses an attack whose attacker holds no die', async () => {
    const room = await inspiredRoom(TARGET_ID)
    await rollAttack(room)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await holdsInspiration(room)).toBe(true)
  })
})
