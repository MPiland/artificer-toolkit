import { describe, expect, it } from 'vitest'

import { buildImportedCharacter } from './importedCharacterPayload.js'

describe('buildImportedCharacter', () => {
  it('maps resolved character references and imported play state', () => {
    const character = buildImportedCharacter(
      {
        targetId: 'character-1',
        label: 'Aria',
        parsed: {
          externalId: 'external-1',
          label: 'Aria',
          description: 'A careful scout.',
          profile: { pronouns: 'they/them' },
          abilities: {
            STRENGTH: 10,
            DEXTERITY: 16,
            CONSTITUTION: 14,
            INTELLIGENCE: 12,
            WISDOM: 13,
            CHARISMA: 8
          },
          hitPoints: { current: 11, temp: 3 },
          references: [],
          customContent: [],
          issues: []
        },
        references: [
          { role: 'RACE', subjectKind: 'RACE', label: 'Elf', path: [], subjectId: 'race-1' },
          {
            role: 'BACKGROUND',
            subjectKind: 'BACKGROUND',
            label: 'Scout',
            path: [],
            subjectId: 'background-1'
          },
          {
            role: 'CLASS',
            subjectKind: 'CLASS',
            label: 'Ranger',
            path: [],
            level: 4,
            subjectId: 'class-1'
          },
          {
            role: 'SUBCLASS',
            subjectKind: 'CLASS',
            label: 'Hunter',
            path: [],
            subjectId: 'subclass-1'
          },
          {
            role: 'EQUIPMENT',
            subjectKind: 'EQUIPMENT',
            label: 'Longbow',
            path: [],
            quantity: 2,
            equipped: true,
            attuned: true,
            subjectId: 'equipment-1'
          }
        ]
      },
      'user-1',
      'system-1',
      'catalogue-1',
      () => 'inventory-1'
    )

    expect(character).toMatchObject({
      id: 'character-1',
      label: 'Aria',
      description: 'A careful scout.',
      profile: { pronouns: 'they/them' },
      systemId: 'system-1',
      primaryRulesCatalogueId: 'catalogue-1',
      userId: 'user-1',
      intent: {
        abilities: {
          method: 'MANUAL_ROLLED',
          state: { assignments: expect.arrayContaining([{ ability: 'DEXTERITY', score: 16 }]) }
        },
        race: { raceId: 'race-1' },
        background: { backgroundId: 'background-1' },
        classes: [{ classId: 'class-1', classLevel: 4, subclassId: 'subclass-1' }]
      },
      state: {
        hitpoints: { current: 11, temp: 3 },
        equipment: {
          inventory: [{ id: 'inventory-1', equipmentId: 'equipment-1', quantity: 2 }],
          equipped: ['inventory-1'],
          attuned: ['inventory-1']
        }
      }
    })
  })
})
