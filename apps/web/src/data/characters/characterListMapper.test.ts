import { describe, expect, it } from 'vitest'
import {
  buildCharacterListFilters,
  mapCharacterListToAuthoredItems,
  mapCharacterListToActiveAuthoredItems,
  mapCharacterListToDraftAuthoredItems,
  summarizeCharacterList
} from './characterListMapper'
import { characterListFixture } from '#app/domains/characters/character.fixtures'

describe('character list mapper', () => {
  it('maps active and draft-only characters into authored list rows', () => {
    const items = mapCharacterListToAuthoredItems(characterListFixture)

    expect(items.find((item) => item.id === 'character-owned')).toMatchObject({
      name: 'Astra Vale',
      statusLabel: 'Active',
      filterValues: {
        status: 'ACTIVE',
        draftState: 'ACTIVE'
      }
    })
    expect(items.find((item) => item.id === 'character-draft')).toMatchObject({
      name: 'Untitled Character',
      statusLabel: 'Draft',
      statusTone: 'draft',
      filterValues: {
        status: 'DRAFT',
        draftState: 'DRAFT_ONLY'
      }
    })
  })

  it('splits draft-only character rows out of the active panel', () => {
    expect(mapCharacterListToActiveAuthoredItems(characterListFixture).map((item) => item.id)).toEqual([
      'character-owned'
    ])
    expect(mapCharacterListToDraftAuthoredItems(characterListFixture).map((item) => item.id)).toEqual([
      'character-draft'
    ])
  })

  it('builds status and draft-state filters from list data', () => {
    expect(buildCharacterListFilters(characterListFixture)).toEqual([
      {
        key: 'status',
        label: 'Status',
        placeholder: 'Any status',
        options: [
          { value: 'ACTIVE', label: 'Active' },
          { value: 'DRAFT', label: 'Draft' }
        ]
      },
      {
        key: 'draftState',
        label: 'Draft',
        placeholder: 'Any draft state',
        options: [
          { value: 'ACTIVE', label: 'No draft' },
          { value: 'DRAFT_ONLY', label: 'Draft only' }
        ]
      }
    ])
  })

  it('summarizes active and draft rows', () => {
    expect(summarizeCharacterList(characterListFixture)).toBe('2 characters / 1 active / 1 drafts')
  })

  it('summarizes active-with-draft rows as draft work', () => {
    expect(summarizeCharacterList({
      ...characterListFixture,
      items: [
        ...characterListFixture.items,
        {
          ...characterListFixture.items[0],
          id: 'character-active-with-draft',
          draft: {
            characterId: 'character-active-with-draft',
            publicId: 'character-active-with-draft',
            userId: 'user-1',
            systemId: characterListFixture.items[0].systemId,
            label: 'Active With Draft',
            status: 'DRAFT',
            draftState: 'ACTIVE_WITH_DRAFT',
            baseActiveUpdatedAt: '2026-05-03 10:15:30.123456+00',
            createdAt: '2026-05-03T00:00:00.000Z',
            updatedAt: '2026-05-03T00:00:00.000Z'
          }
        }
      ]
    })).toBe('3 characters / 1 active / 2 drafts')
  })
})
