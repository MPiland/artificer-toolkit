import { describe, expect, it } from 'vitest'
import { getAuthoringFieldValue } from './pathUtils'

describe('getAuthoringFieldValue', () => {
  const values = {
    name: 'Dragonborn',
    ancestry: { options: [{ label: 'Red Dragon', features: [{ label: 'Breath Weapon' }] }] }
  }

  it('reads a top-level field', () => {
    expect(getAuthoringFieldValue(values, 'name')).toBe('Dragonborn')
  })

  it('reads through array rows to a nested array', () => {
    expect(getAuthoringFieldValue(values, 'ancestry.options[0].features')).toEqual([
      { label: 'Breath Weapon' }
    ])
    expect(getAuthoringFieldValue(values, 'ancestry.options[0].features[0].label')).toBe(
      'Breath Weapon'
    )
  })

  it('returns undefined for a path that leaves the data', () => {
    expect(getAuthoringFieldValue(values, 'ancestry.options[1].features')).toBeUndefined()
    expect(getAuthoringFieldValue(values, 'name.first')).toBeUndefined()
  })
})
