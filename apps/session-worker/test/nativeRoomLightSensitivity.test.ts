import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

const DROW_ID = testUuid(0xf10)
const TARGET_ID = testUuid(0xf11)

const drow = (() => {
  const creature = srdBaselineContent.subjects.creatures.find(({ label }) => label === 'Drow')
  if (!creature) throw new Error('The SRD has no Drow.')
  return creature
})()

/** A torch whose bright light covers the whole Scene, wherever the drow stands. */
const TORCH = {
  id: testUuid(0xf12),
  kind: 'POINT' as const,
  position: { x: 150, y: 150 },
  brightRadius: 10_000,
  dimRadius: 12_000,
  color: '#ffcc66',
  intensity: 1
}

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The roll mode of the drow's Shortsword on the Wolf, in a Scene lit as `scene` says. */
async function shortswordRollMode(
  scene: NonNullable<Parameters<typeof actionRoom>[0]['sceneOverrides']>
) {
  const room = await actionRoom({
    actors: [
      srdCreatureActor({ id: DROW_ID, creature: drow }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(drow, 'Shortsword').id,
    sceneOverrides: scene
  })
  const { answer } = await room.startAction(TARGET_ID, [], room.sceneContext())
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the attack roll.')
  return decision.pending.request.rollMode
}

describe('Sunlight Sensitivity authored as attack roll disadvantage, in the room (SPELLS-33.T6d1)', () => {
  it('rolls the attack with disadvantage in daylight at BRIGHT', async () => {
    expect(await shortswordRollMode({ ambientIllumination: 'BRIGHT', daylight: true })).toBe(
      'DISADVANTAGE'
    )
  })

  it('rolls normally in torchlight at BRIGHT on a Scene that is not daylit', async () => {
    expect(
      await shortswordRollMode({
        ambientIllumination: 'ORDINARY_DARKNESS',
        daylight: false,
        lights: [TORCH]
      })
    ).toBe('NORMAL')
  })

  it('rolls normally in a daylit Scene where the drow stands in the dark', async () => {
    expect(
      await shortswordRollMode({ ambientIllumination: 'ORDINARY_DARKNESS', daylight: true })
    ).toBe('NORMAL')
  })
})
