import {
  installedSrdCreature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { guardianNaga } from '@artificer-toolkit/source-data/srd/creatures/guardian-naga.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

const NAGA_ID = testUuid(0x840)
const WOLF_ID = testUuid(0x841)
const CLOCK_MINUTE = 20_000
const GEAS_MINUTES = 30 * 1440

afterEach(closeTrackedSockets)

const naga = installedSrdCreature(guardianNaga)

/** The Naga casts Geas on the Wolf, whose Wisdom save the GM fails, in a Campaign with `campaignClockMinute`. */
async function castGeas(campaignClockMinute: number | null) {
  const bite = naga.features.find(({ label }) => label.startsWith('Bite'))
  if (!bite) throw new Error('The Guardian Naga has no Bite.')
  const room = await actionRoom({
    actors: [
      srdCreatureActor({ id: NAGA_ID, creature: naga }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    ownerFeatureId: bite.id,
    pinSpells: true,
    campaignClockMinute
  })
  const geas = (await room.actionChoices()).actions.find(({ label }) => label.startsWith('Geas'))
  if (!geas) throw new Error('The room offers the Naga no Geas.')
  const { answer } = await room.startAction(WOLF_ID, [], null, null, geas.id, NAGA_ID)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the Wisdom save.')
  const { request } = decision.pending
  const resolved = await room.resolve(decision, {
    kind: 'ENTER_DICE',
    requestId: request.requestId,
    rawFaces: Array.from({ length: request.rollMode === 'NORMAL' ? 1 : 2 }, () => 1),
    rollMode: request.rollMode
  })
  expect(resolved.type, JSON.stringify(resolved)).toBe('COMMAND_COMMITTED')
  const history = await readRoomHistory(room.room.base.stub)
  const [effect] = history.activeEffects
  if (history.activeEffects.length !== 1 || !effect)
    throw new Error('The failed save leaves exactly one Geas effect.')
  return effect.lifecycle
}

describe('room Geas cast stamps the Campaign clock (QUALITY-15.T3i2, D222)', () => {
  it('stamps the clock minute plus 30 days on the effect it plants', async () => {
    expect(await castGeas(CLOCK_MINUTE)).toMatchObject({
      remainingTicks: null,
      expiresAtCampaignMinute: CLOCK_MINUTE + GEAS_MINUTES
    })
  })

  it('stamps no expiry when the Campaign has no clock, so the GM ends it', async () => {
    expect(await castGeas(null)).toMatchObject({
      remainingTicks: null,
      expiresAtCampaignMinute: null
    })
  })
})
