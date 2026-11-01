import { describe, expect, it } from 'vitest'
import type { CompiledActionSummonPlacement } from '@artificer-toolkit/schema/projections/characterMechanics'
import { summonFormPick, summonPickOptions } from '../spellSummonStatBlock.js'

const GROUP_FORM = {
  id: crypto.randomUUID(),
  label: 'Wolf',
  creatureId: crypto.randomUUID(),
  maxTargets: 8
}
const SINGLE_FORM = {
  id: crypto.randomUUID(),
  label: 'Allosaurus',
  creatureId: crypto.randomUUID(),
  maxTargets: 1
}
const placement = {
  forms: [GROUP_FORM, SINGLE_FORM],
  creatureTypeIds: []
} as unknown as CompiledActionSummonPlacement

describe('summon form count pick (SPELLS-35.T7)', () => {
  it('takes a count from 1 to the form’s maximum and keeps it on the pick', () => {
    expect(summonFormPick(placement, { formId: GROUP_FORM.id, count: 3 })).toMatchObject({
      form: GROUP_FORM,
      count: 3
    })
    expect(summonFormPick(placement, { formId: GROUP_FORM.id, count: 8 })).toMatchObject({
      count: 8
    })
    expect(summonFormPick(placement, { formId: GROUP_FORM.id })).toMatchObject({ count: null })
  })

  it('refuses a count above the maximum, and any count on a form conjured one at a time', () => {
    expect(summonFormPick(placement, { formId: GROUP_FORM.id, count: 9 })).toEqual({
      refusal: 'This creature form is conjured 8 at most.'
    })
    expect(summonFormPick(placement, { formId: SINGLE_FORM.id, count: 1 })).toEqual({
      refusal: 'This creature form is conjured one at a time.'
    })
  })

  it('offers a count maximum only on a form conjured in groups', () => {
    expect(summonPickOptions(placement, []).summonForms).toEqual([
      { id: GROUP_FORM.id, label: 'Wolf', maxCount: 8 },
      { id: SINGLE_FORM.id, label: 'Allosaurus' }
    ])
  })
})
