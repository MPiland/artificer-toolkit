import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { bane } from '@artificer-toolkit/source-data/srd/spells/bane.js'
import { bless } from '@artificer-toolkit/source-data/srd/spells/bless.js'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorHitPoints, readRoomHistory, readRoomRollCards } from './roomHistoryReads.js'

const BITER_ID = testUuid(0xad0)
const TARGET_ID = testUuid(0xad1)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * The biter's Bite makes the target Wolf (Dexterity +2) save at DC 10 against 1 damage, while the
 * target holds the real planned grant of `spell` (Bless or Bane). `rolls` are the app's raw dice
 * (a face less one): the d20 first, then the added die.
 */
async function addedDieSaveRoom(spell: SpellAuthored, rolls: readonly number[] = []) {
  const biter = biteWolf('SAVE')
  const biterActor = srdCreatureActor({ id: BITER_ID, creature: biter })
  const room = await actionRoom({
    actors: [biterActor, srdCreatureActor({ id: TARGET_ID, creature: plainWolf })],
    ownerFeatureId: creatureFeature(biter, 'Bite').id,
    rolls,
    seed: seedModifierGrant({
      sourceActorId: TARGET_ID,
      holderActorId: TARGET_ID,
      lifecycle: {},
      effect: spell.effects?.[0],
      sourceLabel: spell.label
    })
  })
  const { answer } = await room.startAction(TARGET_ID, [])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the saving throw.')
  return { room, decision, pending: decision.pending, request: decision.pending.request }
}

const targetHitPoints = async (room: Awaited<ReturnType<typeof actionRoom>>) =>
  readActorHitPoints(await readRoomHistory(room.room.base.stub), TARGET_ID)

describe('a rolled-die grant on an Encounter saving throw (SPELLS-4.T2c1, D156)', () => {
  it('asks for Bless’s d4 with the d20, and the entered d4 turns a failed save into a success', async () => {
    const { room, decision, pending, request } = await addedDieSaveRoom(bless)
    expect(pending.rollerActorId).toBe(TARGET_ID)
    expect(request.addedDice).toEqual([{ label: 'Bless', count: 1, faces: 4, sign: 'ADD' }])
    const before = await targetHitPoints(room)

    // A natural 5 + Dexterity 2 is 7, short of DC 10; Bless's 3 makes it 10.
    const answer = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [5],
      addedFaces: [3],
      rollMode: request.rollMode
    })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await targetHitPoints(room)).toBe(before)
  })

  it('rolls Bane’s d4 with an app-rolled d20, records it as a subtracted term and fails the save', async () => {
    // The app rolls a natural 10 and Bane's 4: 10 + 2 - 4 is 8, short of DC 10.
    const { room, decision, request } = await addedDieSaveRoom(bane, [9, 3])
    expect(request.addedDice).toEqual([{ label: 'Bane', count: 1, faces: 4, sign: 'SUBTRACT' }])
    const before = await targetHitPoints(room)

    const rolled = await room.rollDice(decision)
    expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
    const held = (await readRoomHistory(room.room.base.stub)).evidenceRolls.at(-1)
    expect(held).toMatchObject({ faces: [10], addedFaces: [4] })
    if (!held) throw new Error('The roll was not held.')
    const answer = await room.resolve(decision, {
      kind: 'SYSTEM_ROLL',
      requestId: request.requestId,
      rollId: held.id
    })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await targetHitPoints(room)).toBe(before - 1)

    const [card] = (await readRoomRollCards(room.room.base.stub)).filter(({ roll }) =>
      roll.normalizedExpression.startsWith('1d20')
    )
    expect(card?.roll).toMatchObject({
      normalizedExpression: '1d20+2 - 1d4',
      evidence: {
        terms: [
          { count: 1, die: 20, rolls: [10] },
          { count: 1, die: 4, rolls: [4], subtotal: -4, subtracted: true }
        ],
        total: 8
      }
    })
  })
})
