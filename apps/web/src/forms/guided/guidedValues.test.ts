import { describe, expect, it } from 'vitest'
import { readField, toFeatures } from './guidedValues'

describe('readField', () => {
  it('reads a field off in-progress values', () => {
    expect(readField({ label: 'Fireball' }, 'label')).toBe('Fireball')
  })

  it('returns undefined for a missing field or non-record values', () => {
    expect(readField({}, 'label')).toBeUndefined()
    expect(readField([], 'label')).toBeUndefined()
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
