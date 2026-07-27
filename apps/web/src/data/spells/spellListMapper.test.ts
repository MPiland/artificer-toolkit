import { describe, expect, it } from 'vitest'
import {
  buildSpellListFilters,
  mapSpellListToAuthoredItems,
  spellListSortOptions,
  summarizeSpellList
} from './spellListMapper'
import { foundationVars } from '#css/foundations.css'
import type { SpellListResponseDto } from '#lib/api'

const response: SpellListResponseDto = {
  items: [
    {
      id: 'magic-missile',
      publicId: 'magic-missile',
      activeRevisionId: 'magic-missile-active-revision',
      label: 'Magic Missile',
      description: 'Force darts.',
      status: 'ACTIVE',
      userId: 'master',
      systemId: 'dnd5e-2014',
      level: 1,
      magicSchoolId: 'school-evocation',
      castingTimeUnit: 'ACTION',
      castingTimeAmount: 1,
      provenance: { kind: 'MASTER', ownerUserId: null },
      permissions: { canView: true, canEdit: false, canCopy: true, canDelete: false }
    },
    {
      id: 'ember-lace',
      publicId: 'ember-lace',
      activeRevisionId: 'ember-lace-active-revision',
      label: 'Ember Lace',
      description: 'Homebrew fire spell.',
      status: 'DRAFT',
      userId: 'user-1',
      systemId: 'dnd5e-2014',
      level: 3,
      magicSchoolId: 'school-evocation',
      castingTimeUnit: 'ACTION',
      castingTimeAmount: 1,
      provenance: { kind: 'OWNED', ownerUserId: 'user-1' },
      permissions: { canView: true, canEdit: true, canCopy: true, canDelete: true }
    }
  ],
  drafts: [],
  meta: {
    classes: [{ id: 'class-wizard', label: 'Wizard', spellIds: ['magic-missile', 'ember-lace'] }],
    schools: [
      { id: 'school-evocation', label: 'Evocation', spellIds: ['magic-missile', 'ember-lace'] }
    ],
    levels: [
      { id: 1, spellIds: ['magic-missile'] },
      { id: 3, spellIds: ['ember-lace'] }
    ]
  }
}

describe('spell list mapper', () => {
  it('maps provenance and permissions into authored list display items', () => {
    const items = mapSpellListToAuthoredItems(response)

    expect(items[0]).toMatchObject({
      name: 'Magic Missile',
      sourceKind: 'master',
      attributes: {
        level: '1',
        school: 'Evocation',
        classes: ['Wizard']
      },
      sortValues: {
        school: 'Evocation'
      },
      accentColor: foundationVars.color.school.evocation,
      accentLabel: 'Evocation school',
      permissions: {
        canEdit: false,
        canCopy: true
      }
    })
    expect(items[1]).toMatchObject({
      name: 'Ember Lace',
      sourceKind: 'owned',
      permissions: {
        canEdit: true,
        canDelete: true
      }
    })
  })

  it('builds filters and summary from the DTO response', () => {
    const filters = buildSpellListFilters(response)

    expect(filters.map((filter) => filter.key)).toEqual(['school', 'level', 'class'])
    expect(filters[0]?.options[0]).toEqual({ value: 'school-evocation', label: 'Evocation' })
    expect(filters[2]?.options[0]).toEqual({ value: 'class-wizard', label: 'Wizard' })
    expect(spellListSortOptions).toContainEqual({ value: 'school', label: 'School' })
    expect(spellListSortOptions).not.toContainEqual({ value: 'status', label: 'Status' })
    expect(summarizeSpellList(response)).toBe('2 spells / 1 SRD / 1 homebrew')
  })
})
