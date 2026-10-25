import { describe, expect, it } from 'vitest'
import {
  guidedField,
  readGuidedValues,
  readString,
  toDetails,
  toFeatures,
  toSelectOption
} from './guidedValues'

describe('readString', () => {
  it('reads a string and falls back to empty for anything else', () => {
    expect(readString('Fireball')).toBe('Fireball')
    expect(readString(3)).toBe('')
    expect(readString(undefined)).toBe('')
  })
})

describe('toSelectOption', () => {
  it('maps an id/label item onto a select option', () => {
    expect(toSelectOption({ id: 'gp', label: 'Gold' })).toEqual({ label: 'Gold', value: 'gp' })
  })
})

describe('readGuidedValues', () => {
  it('reads in-progress values as the domain values', () => {
    const values = { label: 'Fireball', level: 3 }

    expect(readGuidedValues('spell', values).label).toBe('Fireball')
  })

  it('reads a partial draft without requiring every field', () => {
    expect(readGuidedValues('feat', {}).label).toBeUndefined()
  })

  it('reads an array as an empty draft', () => {
    expect(readGuidedValues('feat', []).label).toBeUndefined()
  })
})

describe('guidedField', () => {
  it('names a top-level field of the domain', () => {
    expect(guidedField('feat', 'label')).toBe('label')
  })

  it('appends nested keys and array indexes', () => {
    expect(guidedField('race', 'speeds', 0, 'speedId')).toBe('speeds[0].speedId')
    expect(guidedField('vehicle', 'cost', 'amount')).toBe('cost.amount')
  })
})

describe('toFeatures', () => {
  it('keeps feature-shaped rows and drops everything else', () => {
    const feature = { id: 'f1', order: 1, label: 'Darkvision' }

    expect(toFeatures([feature, { id: 'f2' }, 'x', null, []])).toEqual([feature])
  })

  it('returns an empty list for a non-array', () => {
    expect(toFeatures(undefined)).toEqual([])
    expect(toFeatures({ id: 'f1', order: 1 })).toEqual([])
  })
})

describe('toDetails', () => {
  it('keeps detail-shaped rows and drops everything else', () => {
    const detail = { id: 'd1', label: 'Core outcome', description: 'Gain a bonus.', order: 1 }

    expect(toDetails([detail, { id: 'd2' }, 'x', null])).toEqual([detail])
  })

  it('returns an empty list for a non-array', () => {
    expect(toDetails(undefined)).toEqual([])
  })
})
