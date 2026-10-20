import { describe, expect, it } from 'vitest'

import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'

import { planCharacterInitiativeRestores } from '../encounterInitiativeRestores.js'
import { evaluateSrdCharacter, srdFeature } from '../testing/dnd5eSrdCharacter.js'

type Resource = CharacterRulePolicyOutput['resources'][number]

/** An authored-grant pool of `maximum` uses with `used` spent, as the policy resolves it. */
function pool(grantId: string, chargeId: string, maximum: number, used: number): Resource {
  const poolId = createCharacterResourceOwnerKey({
    kind: 'AUTHORED_GRANT',
    resourceGrantId: grantId
  })
  return {
    ownerKind: 'AUTHORED_GRANT',
    resourceGrantId: grantId,
    availableAtLevel: 1,
    activeSourceLevel: 1,
    sequence: 0,
    poolId,
    resourceDefinitionId: grantId,
    chargeId,
    chargeCalculationId: poolId,
    state: 'RESOLVED',
    maximum,
    rawUsed: used,
    effectiveUsed: used,
    remaining: Math.max(0, maximum - used),
    reasonCode: 'CALCULATED',
    baseContribution: { sourceId: grantId, value: maximum },
    bonusContributions: [],
    resetKind: 'SHORT_REST',
    resetResolution: { baseResetKind: 'SHORT_REST', appliedGrantId: null, source: null }
  }
}

describe('initiative restore sources from the SRD', () => {
  it.each([
    { className: 'Monk', featureLabel: 'Perfect Self', floor: 4 },
    { className: 'Bard', featureLabel: 'Superior Inspiration', floor: 1 }
  ])(
    'a $className with $featureLabel carries one restore at floor $floor',
    ({ className, featureLabel, floor }) => {
      const [source, ...rest] = evaluateSrdCharacter({
        classes: [{ label: className, level: 20 }],
        features: [srdFeature({ owner: 'CLASS', classLabel: className, featureLabel, level: 20 })]
      }).initiativeRestoreSources
      expect(rest).toEqual([])
      expect(source).toMatchObject({ floor, whenAtOrBelow: 0 })
    }
  )

  it('a Character without the feature carries none', () => {
    expect(
      evaluateSrdCharacter({ classes: [{ label: 'Monk', level: 20 }] }).initiativeRestoreSources
    ).toEqual([])
  })
})

describe('planning Character initiative restores', () => {
  const source = { chargeId: 'ki', floor: 4, whenAtOrBelow: 0 }

  it('raises an empty pool to the floor', () => {
    const ki = pool('ki', 'ki', 20, 20)
    expect(planCharacterInitiativeRestores({ sources: [source], resources: [ki] })).toEqual([
      {
        poolId: ki.poolId,
        chargeId: 'ki',
        owner: { kind: 'AUTHORED_GRANT', resourceGrantId: 'ki' },
        beforeUsed: 20,
        afterUsed: 16,
        beforeRemaining: 0,
        afterRemaining: 4
      }
    ])
  })

  it('never raises a pool past its maximum', () => {
    const [restore] = planCharacterInitiativeRestores({
      sources: [{ ...source, floor: 4 }],
      resources: [pool('ki', 'ki', 2, 2)]
    })
    expect(restore).toMatchObject({ afterRemaining: 2, afterUsed: 0 })
  })

  it('restores nothing while uses remain above the threshold', () => {
    expect(
      planCharacterInitiativeRestores({ sources: [source], resources: [pool('ki', 'ki', 20, 19)] })
    ).toEqual([])
  })

  it('honours a higher threshold and never lowers a pool already above the floor', () => {
    const atOne = pool('ki', 'ki', 20, 19)
    expect(
      planCharacterInitiativeRestores({
        sources: [{ ...source, whenAtOrBelow: 1 }],
        resources: [atOne]
      })
    ).toMatchObject([{ beforeRemaining: 1, afterRemaining: 4 }])
    expect(
      planCharacterInitiativeRestores({
        sources: [{ chargeId: 'ki', floor: 1, whenAtOrBelow: 1 }],
        resources: [atOne]
      })
    ).toEqual([])
  })

  it('skips a charge the Character has no resolved pool for', () => {
    expect(
      planCharacterInitiativeRestores({
        sources: [source],
        resources: [{ ...pool('ki', 'ki', 20, 20), state: 'UNRESOLVED', maximum: null } as Resource]
      })
    ).toEqual([])
    expect(planCharacterInitiativeRestores({ sources: [source], resources: [] })).toEqual([])
  })

  it('refuses a charge that resolves to two pools', () => {
    expect(() =>
      planCharacterInitiativeRestores({
        sources: [source],
        resources: [pool('ki-a', 'ki', 20, 20), pool('ki-b', 'ki', 20, 20)]
      })
    ).toThrow('An initiative restore names more than one pool.')
  })

  it('folds two sources on one pool into one restore from the original state', () => {
    const [restore, ...rest] = planCharacterInitiativeRestores({
      sources: [
        { ...source, floor: 2 },
        { ...source, floor: 4 }
      ],
      resources: [pool('ki', 'ki', 20, 20)]
    })
    expect(rest).toEqual([])
    expect(restore).toMatchObject({
      beforeUsed: 20,
      beforeRemaining: 0,
      afterUsed: 16,
      afterRemaining: 4
    })
  })
})
