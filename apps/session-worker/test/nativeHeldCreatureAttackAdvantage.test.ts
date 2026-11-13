import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { escapeGrappleEffectDefinition } from '@artificer-toolkit/rules-runtime/testing/escapeGrappleEffectFixture'
import { GRAPPLED_CONDITION_ID } from '@artificer-toolkit/source-data/srd/creatures/shared.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

/**
 * SPELLS-33 T8a (Q30): the Mimic's Grappler is an authored "advantage on attacks against a creature
 * I hold with condition X" grant, so its Bite rolls with advantage against the creature it holds
 * grappled and normally against one it does not hold.
 */

const MIMIC_ID = testUuid(0xf20)
const HELD_ID = testUuid(0xf21)
const mimic = (() => {
  const creature = srdBaselineContent.subjects.creatures.find(({ label }) => label === 'Mimic')
  if (!creature) throw new Error('The SRD has no Mimic.')
  return creature
})()

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The roll mode of the Mimic's Bite on the Wolf, which the Mimic holds grappled when `held`. */
async function biteRollMode(held: boolean) {
  const room = await actionRoom({
    actors: [
      srdCreatureActor({ id: MIMIC_ID, creature: mimic }),
      srdCreatureActor({ id: HELD_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(mimic, 'Bite').id,
    seed: async ({ effects, encounterId, occurredAt }) => {
      if (!held) return
      await effects.create({
        id: testUuid(0xf22),
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: HELD_ID },
        lifecycle: { schemaVersion: 1, remainingTicks: null },
        definition: escapeGrappleEffectDefinition({
          encounterId,
          grapplerId: MIMIC_ID,
          conditionIds: [GRAPPLED_CONDITION_ID],
          dc: 13
        }),
        occurredAt
      })
    }
  })
  const { answer } = await room.startAction(HELD_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the attack roll.')
  return decision.pending.request.rollMode
}

describe('the Mimic Grappler, in the room (SPELLS-33 T8a)', () => {
  it('rolls the Bite with advantage against a creature the Mimic holds grappled', async () => {
    expect(await biteRollMode(true)).toBe('ADVANTAGE')
  }, 60_000)

  it('rolls the Bite normally against a creature the Mimic does not hold', async () => {
    expect(await biteRollMode(false)).toBe('NORMAL')
  }, 60_000)
})
