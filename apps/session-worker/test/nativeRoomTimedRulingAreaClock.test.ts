import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { spellWithDuration } from '@artificer-toolkit/rules-runtime/testing/spellWithDuration'
import { massSuggestion } from '@artificer-toolkit/source-data/srd/spells/mass-suggestion.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

const CHARACTER_ACTOR_ID = testUuid(0x850)
const CHARACTER_ID = testUuid(0x851)
const WOLF_IDS = [testUuid(0x852), testUuid(0x853)]
const CLOCK_MINUTE = 20_000
const CURSE_MINUTES = 30 * 1440

afterEach(closeTrackedSockets)

/** Mass Suggestion authored to last 30 days, which only the Campaign clock can bound. */
const lastingSuggestion = spellWithDuration(massSuggestion, { durationKind: 'DAY', amount: 30 })

/** The Character casts it on both Wolves in a Campaign with `campaignClockMinute`; each lands its ruling. */
async function castOnBothWolves(campaignClockMinute: number | null) {
  const room = await actionRoom({
    actors: [
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
      ...WOLF_IDS.map((id) => srdCreatureActor({ id, creature: plainWolf }))
    ],
    characterSpellcasting: { spells: [lastingSuggestion], prepared: [lastingSuggestion.id] },
    characterAction: (action) => action.label.startsWith('Mass Suggestion'),
    campaignClockMinute,
    fallbackRoll: 1
  })
  const { answer } = await room.startActorsAction(WOLF_IDS, ['TARGET_RANGE_UNCHECKED'], false)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const { activeEffects } = await readRoomHistory(room.room.base.stub)
  expect(activeEffects).toHaveLength(WOLF_IDS.length)
  return activeEffects.map(({ lifecycle }) => lifecycle)
}

describe('room area-style cast stamps the Campaign clock (QUALITY-15.T3i3, D222)', () => {
  it('stamps the clock minute plus 30 days on every creature the cast lands on', async () => {
    expect(await castOnBothWolves(CLOCK_MINUTE)).toEqual(
      WOLF_IDS.map(() =>
        expect.objectContaining({
          remainingTicks: null,
          expiresAtCampaignMinute: CLOCK_MINUTE + CURSE_MINUTES
        })
      )
    )
  }, 120000)

  it('stamps no expiry when the Campaign has no clock, so the GM ends them', async () => {
    expect(await castOnBothWolves(null)).toEqual(
      WOLF_IDS.map(() =>
        expect.objectContaining({ remainingTicks: null, expiresAtCampaignMinute: null })
      )
    )
  }, 120000)
})
