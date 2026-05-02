import { describe, expect, it } from 'vitest'
import {
  hasMaterialComponent,
  normalizeSpellForSubmit
} from '../spellAuthoring.utils'
import { spellFixture, spellReferenceFixture } from '../spellAuthoring.fixtures'

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
    }, spellReferenceFixture)

    expect(normalized.label).toBe('Untitled Spell')
    expect(normalized.magicSchoolId).toBe('evocation')
    expect(normalized.materialDescription).toBeUndefined()
  })
})
