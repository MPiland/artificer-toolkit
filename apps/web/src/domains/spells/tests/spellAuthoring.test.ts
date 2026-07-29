import { describe, expect, it } from 'vitest'
import { hasMaterialComponent, normalizeSpellForSubmit } from '../spellAuthoring.utils'
import { spellFixture } from '../spellAuthoring.fixtures'

describe('Spell authoring runtime', () => {
  it('keeps material description visible when material is selected or existing data is present', () => {
    expect(hasMaterialComponent({ components: ['MATERIAL'] })).toBe(true)
    expect(hasMaterialComponent({ components: [], materialDescription: 'A pearl' })).toBe(true)
    expect(hasMaterialComponent({ components: ['VERBAL'] })).toBe(false)
  })

  it('normalizes spell ownership-insensitive payloads for REST submit', () => {
    const normalized = normalizeSpellForSubmit({
      ...spellFixture,
      label: '',
      magicSchoolId: '',
      components: ['VERBAL'],
      materialDescription: 'Should be cleared'
    })

    expect(normalized.label).toBe('Untitled Spell')
    expect(normalized.magicSchoolId).toBe('')
    expect(normalized.materialDescription).toBeUndefined()
  })

  it('uses the supplied system school fallback when the spell value is blank', () => {
    const normalized = normalizeSpellForSubmit(
      {
        ...spellFixture,
        magicSchoolId: ''
      },
      'school-evocation'
    )

    expect(normalized.magicSchoolId).toBe('school-evocation')
  })
})
