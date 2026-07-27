import { describe, expect, it } from 'vitest'
import type { SpellListResponseDto } from '@artificer-toolkit/schema/api/content'
import { getSpellDetailReferenceDataFromList } from './referenceData'

describe('spell reference data', () => {
  it('derives detail references from cached spell list metadata', () => {
    const references = getSpellDetailReferenceDataFromList({
      items: [],
      drafts: [],
      meta: {
        classes: [{ id: 'class-wizard', label: 'Wizard', spellIds: ['spell-acid-arrow'] }],
        schools: [{ id: 'school-evocation', label: 'Evocation', spellIds: ['spell-acid-arrow'] }]
      }
    } satisfies SpellListResponseDto)

    expect(references).toEqual({
      magicSchools: [{ value: 'school-evocation', label: 'Evocation' }],
      classes: [{ value: 'class-wizard', label: 'Wizard' }],
      damageTypes: [],
      conditionTypes: []
    })
  })

  it('falls back to ids when cached metadata has no label', () => {
    const references = getSpellDetailReferenceDataFromList({
      items: [],
      drafts: [],
      meta: {
        classes: [{ id: 'class-wizard', spellIds: [] }],
        schools: [{ id: 'school-evocation', spellIds: [] }]
      }
    } satisfies SpellListResponseDto)

    expect(references.classes[0]).toEqual({ value: 'class-wizard', label: 'class-wizard' })
    expect(references.magicSchools[0]).toEqual({
      value: 'school-evocation',
      label: 'school-evocation'
    })
  })
})
