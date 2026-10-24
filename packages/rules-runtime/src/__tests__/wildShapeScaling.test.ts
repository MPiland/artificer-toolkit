import { describe, expect, it } from 'vitest'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { druid } from '@artificer-toolkit/source-data/srd/classes/druid.js'
import { bat } from '@artificer-toolkit/source-data/srd/creatures/bat.js'
import { brownBear } from '@artificer-toolkit/source-data/srd/creatures/brown-bear.js'
import { crocodile } from '@artificer-toolkit/source-data/srd/creatures/crocodile.js'
import { giantCentipede } from '@artificer-toolkit/source-data/srd/creatures/giant-centipede.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import {
  SRD_CONDITION_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  creatureFormFilterRefusal,
  resolveCreatureFormDuration,
  resolveCreatureFormFilter
} from '../encounterFormChoice.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

/**
 * SPELLS-31.T4s: the SRD druid's Wild Shape is an authored creature form whose challenge-rating cap, excluded
 * speeds and duration are class-level rows in the plan, resolved at cast from the caster's class levels.
 */

const wildShape = druid.features?.find(({ label }) => label === 'Wild Shape')?.effects?.[0]
if (!wildShape) throw new Error('The druid must author Wild Shape.')

const action = {
  ...characterActionDescriptor(compileEffect({ ...wildShape, id: ACTION_EFFECT_ID })),
  conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id)
}
const [plan, ...rest] =
  dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
    action,
    published: dnd5eCharacterRuleActionSystemAdapter.compile({ action })
  }) ?? []
const contribution = plan?.creatureFormContribution
const filter = contribution?.filter
if (!plan || !contribution || !filter?.scaling)
  throw new Error('Wild Shape must plan a scaled form.')
const druidId = filter.scaling.classId

const snapshotOf = (creature: CreatureAuthored) => ({
  payload: {
    creatureTypeId: creature.creatureTypeId,
    challengeRatingId: creature.challengeRatingId,
    speeds: creature.speeds
  }
})
const refusalAtDruidLevel = (level: number, form: CreatureAuthored) =>
  creatureFormFilterRefusal({
    filter: resolveCreatureFormFilter(filter, { [druidId]: level }),
    form: { snapshot: snapshotOf(form) },
    target: { snapshot: { payload: {} }, level: null },
    system: srdSystemRecord
  })

const TOO_POWERFUL = 'That creature is too powerful for this target.'
const BAD_MOVEMENT = 'That creature has a way of moving this action does not allow.'

describe('the Wild Shape plan from the SRD druid', () => {
  it('plans one scaled beast form', () => {
    expect(rest).toEqual([])
    expect(filter).toMatchObject({ challengeRatingCapKind: 'SCALED' })
    expect(contribution.excessDamageCarriesOver).toBe(true)
  })

  it('caps the form at a quarter challenge rating, with no flying, at druid level 2', () => {
    expect(refusalAtDruidLevel(2, giantCentipede)).toBeNull()
    expect(refusalAtDruidLevel(2, wolf)).toBeNull()
    expect(refusalAtDruidLevel(2, brownBear)).toBe(TOO_POWERFUL)
    expect(refusalAtDruidLevel(2, crocodile)).toBe(BAD_MOVEMENT)
    expect(refusalAtDruidLevel(2, bat)).toBe(BAD_MOVEMENT)
  })

  it('raises the cap to a half challenge rating, still with no flying, at druid level 4', () => {
    expect(refusalAtDruidLevel(4, crocodile)).toBeNull()
    expect(refusalAtDruidLevel(4, brownBear)).toBe(TOO_POWERFUL)
    expect(refusalAtDruidLevel(4, bat)).toBe(BAD_MOVEMENT)
  })

  it('raises the cap to a full challenge rating and allows flying at druid level 8', () => {
    expect(refusalAtDruidLevel(8, brownBear)).toBeNull()
    expect(refusalAtDruidLevel(8, bat)).toBeNull()
  })

  it('holds the base cap for a caster with no druid levels', () => {
    expect(refusalAtDruidLevel(0, brownBear)).toBe(TOO_POWERFUL)
    expect(refusalAtDruidLevel(0, wolf)).toBeNull()
  })

  it('lasts half the druid level in hours, rounded down', () => {
    const hours = (level: number) =>
      resolveCreatureFormDuration(
        plan.initialRemaining ?? 0,
        contribution.initialRemainingScaling,
        {
          [druidId]: level
        }
      ) / 600
    expect([2, 3, 4, 8, 20].map(hours)).toEqual([1, 1, 2, 4, 10])
  })
})
