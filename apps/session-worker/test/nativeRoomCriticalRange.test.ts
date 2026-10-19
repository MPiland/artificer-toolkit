import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  DIVINE_FAVOR_EFFECT,
  criticalThresholdEffect
} from '@artificer-toolkit/rules-runtime/testing/criticalThresholdEffect'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorHitPoints, readRoomHistory, readRoomRollCards } from './roomHistoryReads.js'

const BITER_ID = testUuid(0xad4)
const TARGET_ID = testUuid(0xad5)

afterEach(() => {
  closeTrackedSockets()
})

/**
 * The biter's +4 Bite (1 piercing) hits the target Wolf on an app-rolled raw d20 of 18 (a natural
 * 19), while the biter holds `effect`, which adds a 1d4 radiant die to its hits. The app then rolls
 * that die once, or twice on a critical hit, from the raw faces `damageRolls`.
 */
async function biteOnNatural19(effect: EffectAuthored, damageRolls: readonly number[]) {
  const biter = biteWolf('ATTACK')
  const room = await actionRoom({
    actors: [
      srdCreatureActor({ id: BITER_ID, creature: biter }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(biter, 'Bite').id,
    autoRoll: 'BOTH',
    rolls: [18, ...damageRolls],
    seed: seedModifierGrant({
      sourceActorId: BITER_ID,
      holderActorId: BITER_ID,
      lifecycle: {},
      effect,
      sourceLabel: 'Critical Focus'
    })
  })
  const before = readActorHitPoints(await readRoomHistory(room.room.base.stub), TARGET_ID)
  const { answer } = await room.startAction(TARGET_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const history = await readRoomHistory(room.room.base.stub)
  const damageCards = (await readRoomRollCards(room.room.base.stub)).flatMap(({ roll }) =>
    roll.source.kind === 'DAMAGE' ? [{ label: roll.source.label, total: roll.evidence.total }] : []
  )
  return { lost: before - readActorHitPoints(history, TARGET_ID), damageCards }
}

describe('a lowered critical threshold on an Encounter attack (SPELLS-31.T5d, D158)', () => {
  it('crits on an app-rolled natural 19, doubling the added die: 2 + 4 radiant', async () => {
    const bitten = await biteOnNatural19(criticalThresholdEffect(19), [1, 3])
    expect(bitten.lost).toBe(1 + 2 + 4)
    expect(bitten.damageCards).toEqual(
      expect.arrayContaining([{ label: 'Critical Focus: Radiant damage', total: 6 }])
    )
  })

  it('hits without a crit on a natural 19 when no threshold is granted: one die', async () => {
    const bitten = await biteOnNatural19(DIVINE_FAVOR_EFFECT, [1])
    expect(bitten.lost).toBe(1 + 2)
    expect(bitten.damageCards).toEqual(
      expect.arrayContaining([{ label: 'Critical Focus: Radiant damage', total: 2 }])
    )
  })
})
