import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { colorSpray } from '@artificer-toolkit/source-data/srd/spells/color-spray.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorConditionIds, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2a1: Color Spray, authored from core options. The cast rolls its hit-point pool and
 * blinds the creatures in the cone from the lowest current hit points up, passing over those that
 * can't see, until the end of the caster's next turn.
 */

const CHARACTER_ACTOR_ID = testUuid(0x8b0)
const CHARACTER_ID = testUuid(0x8b1)
const ALREADY_BLIND_ID = testUuid(0x8b2)
const LOW_ID = testUuid(0x8b3)
const MID_ID = testUuid(0x8b4)
const BYSTANDER_ID = testUuid(0x8b5)

const blinded =
  srdSystemRecord.conditionTypes.find(({ code }) => code === 'BLINDED') ??
  (() => {
    throw new Error('The SRD vocabulary lacks Blinded.')
  })()

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const wolfAt = (id: string, hitPoints: number, conditionIds: string[] = []) =>
  srdCreatureActor({
    id,
    creature: { ...plainWolf, hitPoints },
    currentHitPoints: hitPoints,
    conditionIds
  })

/**
 * The Character at (150, 150) sprays east over the Wolves at x = 250, 350 and 450 on its row; the
 * bystander stands well off it. The six d10 roll 1, 1, 1, 1, 5 and 5, a pool of 14: it blinds the 5
 * and 9 hit-point Wolves (9, 0 left), passing over the 2 hit-point Wolf already blinded, whose 2 would
 * otherwise leave too little for the 9.
 */
function colorSprayRoom() {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      wolfAt(ALREADY_BLIND_ID, 2, [blinded.id]),
      wolfAt(LOW_ID, 5),
      wolfAt(MID_ID, 9),
      wolfAt(BYSTANDER_ID, 3)
    ],
    positions: { [BYSTANDER_ID]: { x: 450, y: 850 } },
    characterSpellcasting: { spells: [colorSpray], prepared: [colorSpray.id] },
    characterAction: (action) => action.label === 'Color Spray (1st level)',
    autoRoll: 'BOTH',
    rolls: [0, 0, 0, 0, 4, 4],
    fallbackRoll: 5
  })
}

type ColorSprayRoom = Awaited<ReturnType<typeof colorSprayRoom>>

async function history(room: ColorSprayRoom) {
  const stored = await readRoomHistory(room.room.base.stub)
  return {
    blind: stored.actors
      .map(({ id }) => id)
      .filter(
        (id) => id !== CHARACTER_ACTOR_ID && readActorConditionIds(stored, id).includes(blinded.id)
      )
      .sort(),
    effectHolders: stored.activeEffects.map(({ targetActorId }) => targetActorId).sort()
  }
}

const SPRAYED = [LOW_ID, MID_ID].sort()

async function castColorSpray(room: ColorSprayRoom) {
  const { answer } = await room.startDirectedAreaAction({ x: 200, y: 150 }, { x: 500, y: 150 })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

describe('room cast of Color Spray (SPELLS-4.T2a1)', () => {
  it('blinds creatures from the lowest current hit points up while the pool lasts, passing over one that cannot see', async () => {
    const room = await colorSprayRoom()

    await castColorSpray(room)

    const after = await history(room)
    expect(after.effectHolders).toEqual(SPRAYED)
    expect(after.blind).toEqual([...SPRAYED, ALREADY_BLIND_ID].sort())
  }, 120000)

  it('ends the blindness at the end of the caster’s next turn', async () => {
    const room = await colorSprayRoom()
    await castColorSpray(room)

    // The caster's turn, then the four Wolves': the round comes back to the caster.
    for (let turn = 0; turn < 5; turn += 1) await room.advanceTurn()
    const throughNextTurn = await history(room)
    expect(throughNextTurn.effectHolders).toEqual(SPRAYED)
    expect(throughNextTurn.blind).toEqual([...SPRAYED, ALREADY_BLIND_ID].sort())

    await room.advanceTurn()

    const ended = await history(room)
    expect(ended.effectHolders).toEqual([])
    expect(ended.blind).toEqual([ALREADY_BLIND_ID])
  }, 120000)
})
