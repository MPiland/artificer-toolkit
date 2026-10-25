import { describe, expect, it } from 'vitest'
import { DND5E_SYSTEM_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import {
  guidedSizeOptions,
  readField,
  readString,
  toFeatures,
  toSelectOption
} from './guidedValues'

describe('guidedSizeOptions', () => {
  it('offers the System sizes a Scene models, smallest first, with their labels', () => {
    expect(guidedSizeOptions(DND5E_SYSTEM_ID)).toEqual([
      { label: 'Tiny', value: 'TINY' },
      { label: 'Small', value: 'SMALL' },
      { label: 'Medium', value: 'MEDIUM' },
      { label: 'Large', value: 'LARGE' },
      { label: 'Huge', value: 'HUGE' },
      { label: 'Gargantuan', value: 'GARGANTUAN' }
    ])
  })

  it('offers nothing before a System is chosen', () => {
    expect(guidedSizeOptions(undefined)).toEqual([])
  })
})

describe('readString', () => {
  it('reads a string field and falls back to empty for anything else', () => {
    expect(readString({ label: 'Fireball' }, 'label')).toBe('Fireball')
    expect(readString({ label: 3 }, 'label')).toBe('')
    expect(readString({}, 'label')).toBe('')
  })
})

describe('toSelectOption', () => {
  it('maps an id/label item onto a select option', () => {
    expect(toSelectOption({ id: 'gp', label: 'Gold' })).toEqual({ label: 'Gold', value: 'gp' })
  })
})

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
