import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { brandingSmite } from '@artificer-toolkit/source-data/srd/spells/branding-smite.js'
import { huntersMark } from '@artificer-toolkit/source-data/srd/spells/hunters-mark.js'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorHitPoints, readRoomHistory, readRoomRollCards } from './roomHistoryReads.js'

const BITER_ID = testUuid(0xad8)
const TARGET_ID = testUuid(0xad9)

afterEach(() => {
  closeTrackedSockets()
})

/**
 * The biter's +4 Bite (1 piercing) hits the target Wolf on an app-rolled natural 15, while
 * `holderActorId` holds the real planned grant of `spell`, placed by the biter. `rolls` follow the
 * d20 with the added dice, as raw dice (a face less one).
 */
async function biteUnder(spell: SpellAuthored, holderActorId: string, rolls: readonly number[]) {
  const biter = biteWolf('ATTACK')
  const room = await actionRoom({
    actors: [
      srdCreatureActor({ id: BITER_ID, creature: biter }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(biter, 'Bite').id,
    autoRoll: 'BOTH',
    rolls: [14, ...rolls],
    seed: seedModifierGrant({
      sourceActorId: BITER_ID,
      holderActorId,
      lifecycle: {},
      effect: spell.effects?.[0],
      sourceLabel: spell.label
    })
  })
  const before = readActorHitPoints(await readRoomHistory(room.room.base.stub), TARGET_ID)
  const { answer } = await room.startAction(TARGET_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const history = await readRoomHistory(room.room.base.stub)
  const damageCards = (await readRoomRollCards(room.room.base.stub)).flatMap(({ roll }) =>
    roll.source.kind === 'DAMAGE' ? [{ label: roll.source.label, total: roll.evidence.total }] : []
  )
  return {
    lost: before - readActorHitPoints(history, TARGET_ID),
    activeEffectIds: history.activeEffects.map(({ id }) => id),
    damageCards
  }
}

describe('a rolled damage die on an Encounter attack (SPELLS-4.T2d, D156)', () => {
  it("deals Hunter's Mark's d6 when the marker bites the marked Wolf, carded under the spell", async () => {
    const bitten = await biteUnder(huntersMark, TARGET_ID, [3])
    expect(bitten.lost).toBe(1 + 4)
    expect(bitten.damageCards).toEqual(
      expect.arrayContaining([
        { label: "Hunter's Mark: Piercing damage", total: 4 },
        expect.objectContaining({ total: 1 })
      ])
    )
    expect(bitten.activeEffectIds).toHaveLength(1)
  })

  it('deals Branding Smite’s 2d6 radiant on the hit and ends it', async () => {
    const bitten = await biteUnder(brandingSmite, BITER_ID, [1, 4])
    expect(bitten.lost).toBe(1 + 2 + 5)
    expect(bitten.damageCards).toEqual(
      expect.arrayContaining([{ label: 'Branding Smite: Radiant damage', total: 7 }])
    )
    expect(bitten.activeEffectIds).toEqual([])
  })
})
