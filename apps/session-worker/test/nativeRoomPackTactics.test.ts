import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

const RAT_ID = testUuid(0xf00)
const TARGET_ID = testUuid(0xf01)
const PACK_MATE_ID = testUuid(0xf02)

const giantRat = srdBaselineContent.subjects.creatures.find(({ label }) => label === 'Giant Rat')
if (!giantRat) throw new Error('The SRD has no Giant Rat.')

const incapacitated = srdSystemRecord.conditionTypes.find(({ code }) => code === 'INCAPACITATED')
if (!incapacitated) throw new Error('The SRD has no Incapacitated Condition.')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * The roll mode of the Giant Rat's Bite on the Wolf. The Rat's pack mate (an enemy of the Wolf)
 * stands `mateColumn` squares from the Rat; the Wolf is at column 1.
 */
async function biteRollMode(input: {
  mateColumn: number
  mateConditionIds?: readonly string[]
  withScene: boolean
}) {
  const room = await actionRoom({
    actors: [
      srdCreatureActor({ id: RAT_ID, creature: giantRat }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf }),
      srdCreatureActor({
        id: PACK_MATE_ID,
        creature: giantRat,
        disposition: 'FRIENDLY',
        conditionIds: input.mateConditionIds
      })
    ],
    positions: { [PACK_MATE_ID]: { x: 150 + 100 * input.mateColumn, y: 150 } },
    ownerFeatureId: creatureFeature(giantRat, 'Bite').id
  })
  const { answer } = input.withScene
    ? await room.startAction(TARGET_ID, [], room.sceneContext())
    : await room.startAction(TARGET_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the attack roll.')
  return decision.pending.request.rollMode
}

describe('Pack Tactics authored as attack roll advantage, in the room (SPELLS-33.T6d3a)', () => {
  // Column 0 is the Rat, 1 the Wolf: the mate at column 2 is adjacent to the Wolf, at 5 is 20 ft off.
  it('rolls the attack with advantage when a pack mate stands beside the target', async () => {
    expect(await biteRollMode({ mateColumn: 2, withScene: true })).toBe('ADVANTAGE')
  })

  it('rolls normally when the pack mate stands 20 ft from the target', async () => {
    expect(await biteRollMode({ mateColumn: 5, withScene: true })).toBe('NORMAL')
  })

  it('does not count an incapacitated pack mate', async () => {
    expect(
      await biteRollMode({
        mateColumn: 2,
        mateConditionIds: [incapacitated.id],
        withScene: true
      })
    ).toBe('NORMAL')
  })

  it('rolls normally when the attack names no Scene to measure on', async () => {
    expect(await biteRollMode({ mateColumn: 2, withScene: false })).toBe('NORMAL')
  })
})
