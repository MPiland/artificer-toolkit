import { describe, expect, it } from 'vitest'
import {
  buildCharacterListFilters,
  mapCharacterListToAuthoredItems,
  summarizeCharacterList
} from './characterListMapper'
import { characterListFixture } from '#app/domains/characters/character.fixtures'

describe('character list mapper', () => {
  it('maps active and draft-only characters into authored list rows', () => {
    const items = mapCharacterListToAuthoredItems(characterListFixture)

    expect(items.find((item) => item.id === 'character-owned')).toMatchObject({
      name: 'Astra Vale',
      badges: ['Active'],
      filterValues: {
        status: 'ACTIVE',
        draftState: 'ACTIVE'
      }
    })
    expect(items.find((item) => item.id === 'character-draft')).toMatchObject({
      name: 'Untitled Character',
      badges: ['Draft'],
      filterValues: {
        status: 'DRAFT',
        draftState: 'DRAFT_ONLY'
      }
    })
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
})
