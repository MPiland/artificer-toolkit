import { describe, expect, it } from 'vitest'
import {
  buildSpellListFilters,
  mapSpellListToAuthoredItems,
  summarizeSpellList
} from './spellListMapper'
import type { SpellListResponseDto } from '#lib/api'

const response: SpellListResponseDto = {
  items: [
    {
      id: 'magic-missile',
      label: 'Magic Missile',
      description: 'Force darts.',
      status: 'ACTIVE',
      userId: 'master',
      systemId: 'dnd5e-2014',
      level: 1,
      magicSchoolId: 'Evocation',
      castingTimeUnit: 'ACTION',
      castingTimeAmount: 1,
      provenance: { kind: 'MASTER', ownerUserId: null },
      permissions: { canView: true, canEdit: false, canCopy: true, canDelete: false }
    },
    {
      id: 'ember-lace',
      label: 'Ember Lace',
      description: 'Homebrew fire spell.',
      status: 'DRAFT',
      userId: 'user-1',
      systemId: 'dnd5e-2014',
      level: 3,
      magicSchoolId: 'Evocation',
      castingTimeUnit: 'ACTION',
      castingTimeAmount: 1,
      provenance: { kind: 'OWNED', ownerUserId: 'user-1' },
      permissions: { canView: true, canEdit: true, canCopy: true, canDelete: true }
    }
  ],
  meta: {
    classes: [{ id: 'Wizard', spellIds: ['magic-missile', 'ember-lace'] }],
    schools: [{ id: 'Evocation', spellIds: ['magic-missile', 'ember-lace'] }],
    levels: [{ id: 1, spellIds: ['magic-missile'] }, { id: 3, spellIds: ['ember-lace'] }]
  }
}

describe('spell list mapper', () => {
  it('maps provenance and permissions into authored list display items', () => {
    const items = mapSpellListToAuthoredItems(response)

    expect(items[0]).toMatchObject({
      name: 'Magic Missile',
      sourceKind: 'master',
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
    expect(buildSpellListFilters(response).map((filter) => filter.key)).toEqual(['school', 'level', 'class'])
    expect(summarizeSpellList(response)).toBe('2 spells / 1 SRD / 1 homebrew')
  })
})
