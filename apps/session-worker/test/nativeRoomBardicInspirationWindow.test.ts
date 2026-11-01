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
import { readRoomHistory, type RoomHistory } from './roomHistoryReads.js'

const SOURCE_ID = testUuid(0x7e0)
const TARGET_ID = testUuid(0x7e1)
const BARD_ID = testUuid(0x7e2)
const INSPIRATION_ID = testUuid(0x7e3)
const saveBite = biteWolf('SAVE')

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

/** A Wolf whose Bite forces a Dexterity save (DC 10) on a Wolf holding a Bard's inspiration die. */
function inspiredRoom(bardLevel: number) {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature: saveBite }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(saveBite, 'Bite').id,
    seed: seedModifierGrant({
      sourceActorId: BARD_ID,
      holderActorId: TARGET_ID,
      lifecycle: {},
      effect: bardicInspiration.effect,
      sourceLabel: bardicInspiration.label,
      sourceClassLevels: { [CLASS_IDS.BARD]: bardLevel },
      id: INSPIRATION_ID
    })
  })
}
type Room = Awaited<ReturnType<typeof inspiredRoom>>

/** The target answers its Bite save with a natural 5, which fails the DC 10 save without the die. */
async function openWindow(room: Room) {
  expect((await room.startAction(TARGET_ID)).answer.type).toBe('COMMAND_COMMITTED')
  const save = await room.pendingDecision()
  if (save.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the save prompt.')
  const { request } = save.pending
  const rolled = await room.resolve(save, {
    kind: 'ENTER_DICE',
    requestId: request.requestId,
    rawFaces: [5],
    rollMode: request.rollMode
  })
  expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_WINDOW') throw new Error('Expected the d20 window.')
  return { decision, pending: decision.pending }
}

const holdsInspiration = async (room: Room) =>
  (await readRoomHistory(room.room.base.stub)).activeEffects.some(
    (effect) => effect.id === INSPIRATION_ID
  )

const damageTaken = (history: RoomHistory) => {
  const batch = areaReceipts(history).children.find(
    ({ outputs }) =>
      outputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' && outputs.targetActorId === TARGET_ID
  )?.outputs
  if (batch?.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH') throw new Error('The Bite left no batch.')
  const { before, after } = batch.targetTransition
  return before.currentHitPoints - after.currentHitPoints
}

describe('Bardic Inspiration spent in the room d20 window', () => {
  it.each([
    [3, 6],
    [5, 8],
    [10, 10],
    [15, 12]
  ])('a level %i Bard offers a d%i once the save is rolled', async (bardLevel, faces) => {
    const room = await inspiredRoom(bardLevel)
    const { pending } = await openWindow(room)
    expect(pending).toMatchObject({
      rollerActorId: TARGET_ID,
      d20: { selectedNatural: 5 },
      options: [{ label: 'Bardic Inspiration', count: 1, faces, sign: 'ADD' }]
    })
    expect(await holdsInspiration(room)).toBe(true)
  })

  it('adds the die to the failed save, which then passes, and spends the inspiration', async () => {
    const room = await inspiredRoom(10)
    const { decision, pending } = await openWindow(room)
    const used = await room.resolve(decision, {
      kind: 'D20_WINDOW_USE',
      requestId: pending.requestId,
      optionId: pending.options[0]!.optionId,
      faces: [10]
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await holdsInspiration(room)).toBe(false)
    expect(damageTaken(await readRoomHistory(room.room.base.stub))).toBe(0)
  })

  it('keeps the inspiration when the holder declines, so the save fails', async () => {
    const room = await inspiredRoom(10)
    const { decision, pending } = await openWindow(room)
    const declined = await room.resolve(decision, {
      kind: 'D20_WINDOW_DECLINE',
      requestId: pending.requestId
    })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    expect(await holdsInspiration(room)).toBe(true)
    expect(damageTaken(await readRoomHistory(room.room.base.stub))).toBe(1)
  })
})
