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
      () => 'inventory-1',
      () => ({ category: 'WEAPON', twoHanded: false })
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
          equipped: [{ itemId: 'inventory-1', slot: 'MAIN_HAND' }],
          attuned: ['inventory-1']
        }
      }
    })
  })

  describe('equipped hands (SHEET-8)', () => {
    const equippedReference = (subjectId: string, equipped = true) => ({
      role: 'EQUIPMENT' as const,
      subjectKind: 'EQUIPMENT' as const,
      label: subjectId,
      path: [],
      equipped,
      subjectId
    })
    const importEquipment = (
      subjectIds: string[],
      traits: Record<string, { category: string; twoHanded: boolean }>
    ) => {
      let next = 0
      return buildImportedCharacter(
        {
          targetId: 'character-1',
          label: 'Aria',
          parsed: {
            externalId: 'external-1',
            label: 'Aria',
            references: [],
            customContent: [],
            issues: []
          },
          references: subjectIds.map((subjectId) => equippedReference(subjectId))
        },
        'user-1',
        'system-1',
        'catalogue-1',
        () => `item-${++next}`,
        (equipmentId) => traits[equipmentId]
      ).state.equipment
    }
    const sword = { category: 'WEAPON', twoHanded: false }

    it('fills the main hand, then the off hand, and wears non-held equipment', () => {
      const { equipped } = importEquipment(['sword', 'shield', 'mail'], {
        sword,
        shield: { category: 'SHIELD', twoHanded: false },
        mail: { category: 'ARMOR', twoHanded: false }
      })
      expect(equipped).toEqual([
        { itemId: 'item-1', slot: 'MAIN_HAND' },
        { itemId: 'item-2', slot: 'OFF_HAND' },
        { itemId: 'item-3', slot: 'WORN' }
      ])
    })

    it('leaves an item carried when the hands are full', () => {
      const { inventory, equipped } = importEquipment(['sword', 'axe', 'dagger'], {
        sword,
        axe: sword,
        dagger: sword
      })
      expect(inventory).toHaveLength(3)
      expect(equipped).toEqual([
        { itemId: 'item-1', slot: 'MAIN_HAND' },
        { itemId: 'item-2', slot: 'OFF_HAND' }
      ])
    })

    it('takes the main hand for a two-handed weapon and leaves a second weapon carried', () => {
      const { equipped } = importEquipment(['greatsword', 'sword'], {
        greatsword: { category: 'WEAPON', twoHanded: true },
        sword
      })
      expect(equipped).toEqual([{ itemId: 'item-1', slot: 'MAIN_HAND' }])
    })

    it('leaves an item carried when its Equipment is unknown', () => {
      const { inventory, equipped } = importEquipment(['mystery', 'sword'], { sword })
      expect(inventory).toHaveLength(2)
      expect(equipped).toEqual([{ itemId: 'item-2', slot: 'MAIN_HAND' }])
    })
  })
})
