import { describe, expect, it } from 'vitest'

import { characterPreparationOptionsResponseDtoSchema } from '../api/characterPreparationOptions.js'

const response = {
  characterId: '00000000-0000-0000-0000-000000000001',
  streamVersion: 4,
  classes: [
    {
      classId: '00000000-0000-0000-0000-000000000002',
      label: 'Cleric',
      preparedSpellLimit: 2,
      eligibleSpellIds: ['00000000-0000-0000-0000-000000000003'],
      preparedSpellIds: []
    }
  ],
  catalogue: {
    kind: 'INLINE',
    spells: [{ spellId: '00000000-0000-0000-0000-000000000003', label: 'Healing Word', level: 1 }]
  }
}

describe('Character preparation-options contract', () => {
  it('accepts bounded lightweight class-scoped options', () => {
    expect(characterPreparationOptionsResponseDtoSchema.parse(response)).toEqual(response)
  })

  it('rejects authored documents and unknown fields', () => {
    expect(() =>
      characterPreparationOptionsResponseDtoSchema.parse({
        ...response,
        classes: [
          {
            ...response.classes[0],
            description: 'Exact document data'
          }
        ]
      })
    ).toThrow()
  })
})
