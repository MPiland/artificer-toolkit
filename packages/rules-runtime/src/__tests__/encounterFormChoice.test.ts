import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { bat } from '@artificer-toolkit/source-data/srd/creatures/bat.js'
import { giantCentipede } from '@artificer-toolkit/source-data/srd/creatures/giant-centipede.js'
import { giantSpider } from '@artificer-toolkit/source-data/srd/creatures/giant-spider.js'
import { skeleton } from '@artificer-toolkit/source-data/srd/creatures/skeleton.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { creatureFormFilterRefusal } from '../encounterFormChoice.js'

const snapshotOf = (creature: CreatureAuthored) => ({
  payload: {
    creatureTypeId: creature.creatureTypeId,
    challengeRatingId: creature.challengeRatingId,
    speeds: creature.speeds
  }
})
const codeToId = (code: string) =>
  srdSystemRecord.challengeRatings.find((cr) => cr.code === code)!.id
const flySpeedId = srdSystemRecord.speeds.find(({ code }) => code === 'FLY')!.id

const beastToTarget = {
  creatureTypeId: giantSpider.creatureTypeId,
  challengeRatingCapKind: 'TARGET' as const,
  maxChallengeRatingId: null,
  excludedSpeedIds: [] as string[]
}
const refusal = (
  filter: Parameters<typeof creatureFormFilterRefusal>[0]['filter'],
  form: CreatureAuthored,
  target: { snapshot: unknown; level: number | null }
) =>
  creatureFormFilterRefusal({
    filter,
    form: { snapshot: snapshotOf(form) },
    target,
    system: srdSystemRecord
  })

describe('the rule a filtered creature form must meet (D130, SPELLS-28.1)', () => {
  const wolfTarget = { snapshot: snapshotOf(wolf), level: null }

  it('allows a beast whose challenge rating does not exceed the target', () => {
    expect(refusal(beastToTarget, giantCentipede, wolfTarget)).toBeNull()
    expect(refusal(beastToTarget, wolf, wolfTarget)).toBeNull()
  })

  it('refuses a beast with a higher challenge rating than the target', () => {
    expect(refusal(beastToTarget, giantSpider, wolfTarget)).toBe(
      'That creature is too powerful for this target.'
    )
  })

  it('orders challenge ratings by the System record rank, not by code', () => {
    const reversed = {
      ...srdSystemRecord,
      challengeRatings: srdSystemRecord.challengeRatings.map((entry) => ({
        ...entry,
        rank: -entry.rank
      }))
    }
    const result = creatureFormFilterRefusal({
      filter: beastToTarget,
      form: { snapshot: snapshotOf(giantSpider) },
      target: wolfTarget,
      system: reversed
    })
    expect(result).toBeNull()
  })

  it('refuses a creature of another type', () => {
    expect(refusal(beastToTarget, skeleton, wolfTarget)).toBe(
      'That creature is not a type this action allows.'
    )
  })

  it('caps by the target level when the target has no challenge rating', () => {
    const character = { snapshot: { payload: {} }, level: 1 }
    expect(refusal(beastToTarget, giantSpider, character)).toBeNull()
    expect(refusal(beastToTarget, giantSpider, { ...character, level: 0 })).toBe(
      'That creature is too powerful for this target.'
    )
    expect(refusal(beastToTarget, giantSpider, { snapshot: { payload: {} }, level: null })).toBe(
      'The target has no challenge rating or level to cap the form.'
    )
  })

  it('caps by a fixed challenge rating instead of the target', () => {
    const fixed = {
      ...beastToTarget,
      challengeRatingCapKind: 'FIXED' as const,
      maxChallengeRatingId: codeToId('CR_1_4')
    }
    expect(refusal(fixed, giantCentipede, { snapshot: { payload: {} }, level: null })).toBeNull()
    expect(refusal(fixed, giantSpider, wolfTarget)).toBe(
      'That creature is too powerful for this target.'
    )
  })

  it('refuses a creature that moves in a way the filter excludes', () => {
    const noFlying = { ...beastToTarget, excludedSpeedIds: [flySpeedId] }
    expect(refusal(noFlying, giantCentipede, wolfTarget)).toBeNull()
    expect(refusal(noFlying, bat, { snapshot: snapshotOf(giantSpider), level: null })).toBe(
      'That creature has a way of moving this action does not allow.'
    )
  })

  it('allows any type when the filter names none', () => {
    expect(refusal({ ...beastToTarget, creatureTypeId: null }, skeleton, wolfTarget)).toBeNull()
  })
})
