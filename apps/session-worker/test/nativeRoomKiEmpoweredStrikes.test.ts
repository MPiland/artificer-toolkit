import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { monk } from '@artificer-toolkit/source-data/srd/classes/monk.js'
import { gargoyle } from '@artificer-toolkit/source-data/srd/creatures/gargoyle.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-31.T4l2: Ki-Empowered Strikes makes a Monk's unarmed strikes magical, so a Gargoyle's
 * resistance to nonmagical weapon damage halves a Club hit but not an Unarmed Strike hit.
 */

const MONK_ACTOR_ID = testUuid(0xb30)
const MONK_ID = testUuid(0xb31)
const GARGOYLE_ID = testUuid(0xb32)

/** Zero-based d20 faces: the attack hits; every later die shows 1. */
const HIT_FACE = 18
const LOWEST_FACE = 0

const features = ['Martial Arts', 'Ki-Empowered Strikes'].map((label) => {
  const feature = monk.features?.find((candidate) => candidate.label === label)
  if (!feature) throw new Error(`The SRD ${label} is missing.`)
  return feature
})

afterEach(() => {
  closeTrackedSockets()
})

async function strike(actionLabel: string) {
  const room = await actionRoom({
    autoRoll: 'BOTH',
    rolls: [HIT_FACE],
    fallbackRoll: LOWEST_FACE,
    actors: [
      characterActor({ id: MONK_ACTOR_ID, characterId: MONK_ID }),
      srdCreatureActor({ id: GARGOYLE_ID, creature: gargoyle })
    ],
    characterClassFeatures: features,
    characterPlay: { equipped: true, characterClass: monk, classLevel: 6 },
    characterAction: (action) => action.label.includes(actionLabel)
  })
  const { answer } = await room.startAction(GARGOYLE_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

  const { receipts } = await readRoomHistory(room.room.base.stub)
  const [receipt] = receipts.filter(({ commandType }) => commandType === 'RESOLVE_ACTION')
  const settled = parseReceiptExecution(receipt!)
  if (
    settled.status !== 'COMPLETE' ||
    settled.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
  )
    throw new Error(`Expected a settled ${actionLabel} attack on the Gargoyle.`)
  return settled.applicationOutputs.applications.flatMap((application) =>
    application.kind === 'DAMAGE' ? [application] : []
  )
}

describe('room Ki-Empowered Strikes against nonmagical-resistant targets (SPELLS-31.T4l2)', () => {
  it('deals an Unarmed Strike in full', async () => {
    const [damage] = await strike('Unarmed Strike')
    expect(damage!.requestedAmount).toBeGreaterThan(0)
    expect(damage!.resolvedAmount).toBe(damage!.requestedAmount)
  })

  it('still halves a weapon attack', async () => {
    const [damage] = await strike('Club')
    expect(damage!.requestedAmount).toBeGreaterThan(1)
    expect(damage!.resolvedAmount).toBe(Math.floor(damage!.requestedAmount / 2))
  })
})
