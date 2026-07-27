import { describe, expect, it } from 'vitest'

import {
  characterSheetCommandInputDtoSchema,
  characterSheetInventoryItemDtoSchema,
  characterSheetProficiencyFactDtoSchema,
  characterSheetResponseDtoSchema
} from '../api/characters.js'

describe('character sheet command contracts', () => {
  it('requires property codes and authoritative labels in Sheet inventory rows', () => {
    const item = {
      id: 'item-1',
      equipmentId: 'equipment-1',
      label: 'Longsword',
      properties: [{ code: 'ONE_HANDED', label: 'One-Handed' }],
      quantity: 1,
      equipped: true,
      attuned: false,
      requiresAttunement: false
    } as const

    expect(characterSheetInventoryItemDtoSchema.safeParse(item).success).toBe(true)
    expect(
      characterSheetInventoryItemDtoSchema.safeParse({
        ...item,
        properties: ['ONE_HANDED']
      }).success
    ).toBe(false)
  })

  it('requires a closed display kind for reference proficiencies', () => {
    const proficiency = {
      kind: 'WEAPON',
      label: 'Martial',
      value: 'Equipment property · Proficient'
    } as const

    expect(characterSheetProficiencyFactDtoSchema.safeParse(proficiency).success).toBe(true)
    expect(
      characterSheetProficiencyFactDtoSchema.safeParse({ ...proficiency, kind: 'SKILL' }).success
    ).toBe(false)
  })

  it('accepts character sheet overview rows with saving throw and skill proficiency values', () => {
    expect(
      characterSheetResponseDtoSchema.safeParse({
        meta: {
          characterId: 'character-1',
          systemId: 'system-1',
          status: 'ACTIVE',
          streamVersion: 1
        },
        identity: {
          label: 'Aria',
          classSummary: 'Fighter 1',
          totalLevel: 1
        },
        overview: {
          abilities: [
            {
              ability: 'DEXTERITY',
              score: 14,
              modifier: 2
            }
          ],
          facts: [{ label: 'Initiative', value: '+2' }],
          armorClass: 12,
          initiative: 2,
          proficiencyBonus: 2,
          currentHitPoints: 8,
          maxHitPoints: 12,
          tempHitPoints: 0,
          maxHitPointsOverride: null,
          savingThrows: [
            {
              ability: 'DEXTERITY',
              label: 'Dexterity',
              total: 4,
              proficiency: 'FULL'
            }
          ],
          skills: [
            {
              skillId: 'athletics',
              code: 'ATHLETICS',
              label: 'Athletics',
              ability: 'STRENGTH',
              total: 4,
              proficiency: 'DOUBLE'
            }
          ],
          exhaustionLevel: 0,
          conditions: [],
          hitDice: [{ die: 8, total: 1, used: 0, remaining: 1 }]
        },
        actions: {
          items: [
            {
              id: 'action-1',
              label: 'Second Wind',
              kind: 'BONUS_ACTION',
              sourceLabel: 'Fighter',
              description: '<p>Regain hit points.</p>',
              rollable: true,
              mechanic: {
                effectId: 'effect-second-wind',
                trigger: 'HEAL',
                activation: { kind: 'BONUS_ACTION', amount: 1 },
                rangeLabel: 'Self',
                outcomes: [
                  {
                    kind: 'HEAL',
                    pathCode: 'PRIMARY',
                    expression: '1d10 + 1',
                    temporary: false,
                    scaling: [{ level: 2, expression: '1d10 + 2' }]
                  }
                ]
              }
            }
          ]
        },
        resources: {
          items: [],
          hitDice: [{ die: 8, total: 1, used: 0, remaining: 1 }]
        },
        spells: {
          saveDc: 13,
          attackBonus: 5,
          slots: [],
          activeGroups: [],
          spells: [
            {
              id: 'spell-fire-bolt',
              label: 'Fire Bolt',
              level: 0,
              mechanics: [
                {
                  effectId: 'effect-fire-bolt',
                  trigger: 'SPELL_ATTACK',
                  activation: { kind: 'ACTION', amount: 1 },
                  rangeLabel: '120 ft',
                  attackBonus: 5,
                  outcomes: [
                    {
                      kind: 'DAMAGE',
                      pathCode: 'HIT',
                      expression: '1d10',
                      damageTypeId: 'damage-fire',
                      damageTypeLabel: 'Fire',
                      scaling: [{ level: 5, expression: '2d10' }]
                    }
                  ]
                }
              ]
            }
          ]
        },
        inventory: {
          items: [],
          currencies: []
        },
        reference: {
          features: [
            {
              id: 'feature-1',
              label: 'Action Surge',
              description: '<p>Take one additional action.</p>',
              attributes: ['LIMITED_USE'],
              sourceLabel: 'Fighter',
              source: { kind: 'CLASS', classId: 'fighter', classLevel: 2 }
            }
          ],
          proficiencies: [],
          defenses: [],
          senses: [],
          conditionOptions: [],
          equipmentOptions: [],
          currencyOptions: []
        },
        notes: {}
      }).success
    ).toBe(true)
  })

  it('rejects invalid proficiency values in overview rows', () => {
    expect(
      characterSheetResponseDtoSchema.safeParse({
        meta: {
          characterId: 'character-1',
          systemId: 'system-1',
          status: 'ACTIVE',
          streamVersion: 1
        },
        identity: {
          label: 'Aria',
          classSummary: 'Fighter 1',
          totalLevel: 1
        },
        overview: {
          abilities: [],
          facts: [],
          armorClass: 12,
          initiative: 2,
          proficiencyBonus: 2,
          currentHitPoints: 8,
          maxHitPoints: 12,
          tempHitPoints: 0,
          maxHitPointsOverride: null,
          savingThrows: [
            {
              ability: 'DEXTERITY',
              label: 'Dexterity',
              total: 2,
              proficiency: 'INVALID'
            }
          ],
          skills: [],
          exhaustionLevel: 0,
          conditions: [],
          hitDice: []
        },
        actions: {
          items: []
        },
        resources: {
          items: [],
          hitDice: []
        },
        spells: {
          saveDc: null,
          attackBonus: null,
          slots: [],
          activeGroups: [],
          spells: []
        },
        inventory: {
          items: [],
          currencies: []
        },
        reference: {
          features: [],
          proficiencies: [],
          defenses: [],
          senses: [],
          conditionOptions: [],
          equipmentOptions: [],
          currencyOptions: []
        },
        notes: {}
      }).success
    ).toBe(false)
  })

  it('rejects fractional currency adjustments', () => {
    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'ADJUST_CURRENCY',
        commandId: '00000000-0000-4000-8000-000000000001',
        expectedVersion: 1,
        currencyId: 'currency-1',
        amount: 0.5
      }).success
    ).toBe(false)
  })

  it('accepts integer currency adjustments', () => {
    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'ADJUST_CURRENCY',
        commandId: '00000000-0000-4000-8000-000000000001',
        expectedVersion: 1,
        currencyId: 'currency-1',
        amount: -5
      }).success
    ).toBe(true)
  })

  it('accepts inspiration play-state commands', () => {
    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'SET_INSPIRATION',
        commandId: '00000000-0000-4000-8000-000000000001',
        expectedVersion: 3,
        inspired: true
      }).success
    ).toBe(true)
  })

  it('accepts adding an inventory item directly to a container', () => {
    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'ADD_INVENTORY_ITEM',
        commandId: '00000000-0000-4000-8000-000000000001',
        expectedVersion: 3,
        equipmentId: 'equipment-rope',
        containerId: 'inventory-backpack',
        quantity: 1
      }).success
    ).toBe(true)
  })

  it('rejects negative note group sort order', () => {
    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'UPDATE_NOTE_GROUP',
        commandId: '00000000-0000-4000-8000-000000000001',
        expectedVersion: 3,
        groupId: '00000000-0000-4000-8000-000000000002',
        sortOrder: -1
      }).success
    ).toBe(false)
  })
})
