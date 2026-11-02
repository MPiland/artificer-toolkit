import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { prismaticSpray } from '@artificer-toolkit/source-data/srd/spells/prismatic-spray.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { answerAllSaves, areaReceipts, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2ps-d3 (D204, D208): a Character casts the SRD Prismatic Spray, a 60-foot cone, at three
 * Wolves. Its multi-creature lead reads every row plan of the table before anything rolls
 * (`leadActiveEffectPlans`); then each Wolf's own ray picks the rows it holds. One Wolf's d8 lands on
 * 8 and its two extra rays on indigo and violet, so it holds both lasting rows; one saves; one is
 * struck by violet alone.
 */

const CASTER_ID = testUuid(0xd30)
const CHARACTER_ID = testUuid(0xd31)
const STRUCK_TWICE_ID = testUuid(0xd32)
const SAVED_ID = testUuid(0xd33)
const BLINDED_ID = testUuid(0xd34)
const FAR_ID = testUuid(0xd35)

const conditionId = (code: string) => {
  const entry = srdSystemRecord.conditionTypes.find((type) => type.code === code)
  if (!entry) throw new Error(`Condition ${code} required.`)
  return entry.id
}
const RESTRAINED = conditionId('RESTRAINED')
const BLINDED = conditionId('BLINDED')

/** The origin on the east edge of the caster's token, and a point east of it. */
const EAST = { origin: { x: 200, y: 150 }, toward: { x: 800, y: 150 } }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * The caster at x = 150 and three Wolves east of it on its row, inside the cone, with a fourth well
 * off it. The table dice roll themselves, zero-based, in the order the Wolves' rays settle: the first
 * Wolf's d8 lands on 8 and its rerolls on 6 and 7, the second's on 6, the third's on 7.
 */
function sprayRoom() {
  return actionRoom({
    rolls: [7, 5, 6, 5, 6],
    actors: [
      {
        ...characterActor({ id: CASTER_ID, characterId: CHARACTER_ID }),
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      ...[STRUCK_TWICE_ID, SAVED_ID, BLINDED_ID, FAR_ID].map((id) =>
        srdCreatureActor({ id, creature: plainWolf })
      )
    ],
    positions: { [FAR_ID]: { x: 450, y: 1650 } },
    characterSpellcasting: { spells: [prismaticSpray], prepared: [prismaticSpray.id] },
    characterPlay: { classLevel: 17 },
    characterAction: (action) => action.label.startsWith(prismaticSpray.label)
  })
}

describe('room Prismatic Spray cast by a Character (SPELLS-4.T2ps-d3)', () => {
  it('holds each Wolf the rows its own ray landed on, both lasting rows on a Wolf struck twice', async () => {
    const room = await sprayRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const { command, answer } = await room.startDirectedAreaAction(EAST.origin, EAST.toward)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    expect(decision.pending.saves.map(({ actorId }) => actorId).sort()).toEqual(
      [STRUCK_TWICE_ID, SAVED_ID, BLINDED_ID].sort()
    )
    // Every Wolf fails its Dexterity save with a natural 1 but one, which rolls a 20.
    await answerAllSaves(room, { [SAVED_ID]: 20 })
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()

    const history = await readRoomHistory(room.room.base.stub)
    const { roots, children } = areaReceipts(history)
    expect(roots.map(({ receipt }) => receipt.commandId)).toEqual([command.commandId])
    expect(children).toHaveLength(3)
    const conditionsOf = (id: string) =>
      (
        (vitalsOf(history).find((vitals) => vitals.id === id)?.conditions ?? []) as {
          conditionTypeId: string
        }[]
      )
        .map(({ conditionTypeId }) => conditionTypeId)
        .sort()
    expect(conditionsOf(STRUCK_TWICE_ID)).toEqual([RESTRAINED, BLINDED].sort())
    expect(conditionsOf(BLINDED_ID)).toEqual([BLINDED])
    // Indigo does nothing to a creature that saves, and nothing reaches the Wolf outside the cone.
    for (const id of [SAVED_ID, FAR_ID]) {
      const vitals = (rows: typeof history) => vitalsOf(rows).find((entry) => entry.id === id)
      expect(vitals(history)).toEqual(vitals(before))
    }
  }, 120000)
})
