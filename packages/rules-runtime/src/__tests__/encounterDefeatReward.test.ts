import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { SRD_DAMAGE_TYPES, SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  defeatRewardMechanicsBatch,
  defeatTemporaryHitPoints,
  reducedToZeroHitPoints
} from '../encounterDefeatReward.js'
import type { ReceiptApplications } from '../encounterCharacterMechanicsBatch.js'
import { buildMovementTarget } from '../encounterMovementTargets.js'
import { ENCOUNTER_ID, srdCreatureActor } from '../testing/dnd5eSrdEncounter.js'

const KILLER_ID = '00000000-0000-4000-8000-00000000e101'
const CAMPAIGN_ID = '00000000-0000-4000-8000-00000000e102'
const PIERCING = SRD_DAMAGE_TYPES.find(({ code }) => code === 'PIERCING')!.id

const wolf = srdBaselineContent.subjects.creatures.find(({ label }) => label === 'Wolf')!

const damage = (
  before: number,
  after: number,
  extra: { mirrored?: true } = {}
): ReceiptApplications[number] =>
  ({
    kind: 'DAMAGE',
    damageTypeId: PIERCING,
    beforeCurrentHitPoints: before,
    afterCurrentHitPoints: after,
    ...extra
  }) as ReceiptApplications[number]

describe('reducing a creature to 0 hit points (SPELLS-31.T4i2)', () => {
  it('is a damage application that took the creature from above 0 to 0', () => {
    expect(reducedToZeroHitPoints([damage(5, 0)])).toBe(true)
    expect(reducedToZeroHitPoints([damage(5, 1)])).toBe(false)
    expect(reducedToZeroHitPoints([damage(0, 0)])).toBe(false)
    expect(reducedToZeroHitPoints([{ kind: 'HEAL' } as ReceiptApplications[number]])).toBe(false)
  })

  it('ignores damage a mirror passed on', () => {
    expect(reducedToZeroHitPoints([damage(5, 0, { mirrored: true })])).toBe(false)
  })
})

describe('the temporary hit points a defeat grants (SPELLS-31.T4i2)', () => {
  const group = (domainKey: string, effective: number) => ({ domainKey, effective })

  it('is the folded bonus of the holder’s defeat grants', () => {
    expect(
      defeatTemporaryHitPoints([
        group('SKILL_MODIFIER:BONUS', 9),
        group('DEFEAT_TEMPORARY_HIT_POINTS:BONUS', 7)
      ])
    ).toBe(7)
  })

  it('is at least 1 for a holder with the grant and 0 for one without', () => {
    expect(defeatTemporaryHitPoints([group('DEFEAT_TEMPORARY_HIT_POINTS:BONUS', -2)])).toBe(1)
    expect(defeatTemporaryHitPoints([group('SKILL_MODIFIER:BONUS', 9)])).toBe(0)
    expect(defeatTemporaryHitPoints([])).toBe(0)
  })
})

describe('the defeat reward batch (SPELLS-31.T4i2)', () => {
  const killer = srdCreatureActor({ id: KILLER_ID, creature: wolf, currentHitPoints: 4 })
  const target = buildMovementTarget({
    actor: killer,
    activeEffects: [],
    gameSystemId: SRD_SYSTEM_ID,
    campaignId: CAMPAIGN_ID,
    characterFacts: null
  })
  const batch = (amount: number, temporary = 0) =>
    defeatRewardMechanicsBatch({
      state: { id: ENCOUNTER_ID, version: 7 },
      target: { ...target, state: { ...target.state, temporary } },
      amount,
      ordinal: 0,
      occurrenceId: 'occurrence',
      rootCommandId: 'root',
      occurredAt: '2026-11-01T00:00:00.000Z'
    })

  it('grants the killer temporary hit points, keeping the higher pool', () => {
    expect(batch(6, 2).applications).toMatchObject([
      {
        kind: 'TEMPORARY_HIT_POINTS',
        requestedAmount: 6,
        resolvedAmount: 6,
        appliedAmount: 4,
        beforeCurrentHitPoints: 4,
        afterCurrentHitPoints: 4,
        beforeTemporaryHitPoints: 2,
        afterTemporaryHitPoints: 6,
        targetActorId: KILLER_ID
      }
    ])
    expect(batch(1, 2).applications).toMatchObject([
      { appliedAmount: 0, beforeTemporaryHitPoints: 2, afterTemporaryHitPoints: 2 }
    ])
  })
})
