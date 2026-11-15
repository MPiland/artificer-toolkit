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

/** The Naga casts Geas on the Wolf, whose Wisdom save the room rolls as a 1, in a Campaign with `campaignClockMinute`. */
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
    campaignClockMinute,
    fallbackRoll: 1
  })
  const geas = (await room.actionChoices()).actions.find(({ label }) => label.startsWith('Geas'))
  if (!geas) throw new Error('The room offers the Naga no Geas.')
  const { answer } = await room.startAction(
    WOLF_ID,
    ['TARGET_RANGE_UNCHECKED'],
    null,
    null,
    geas.id,
    NAGA_ID
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
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
