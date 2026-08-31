import { vi } from 'vitest'
import type { CharacterAuthored } from '@artificer-toolkit/shared'
import { CharacterStartingEquipmentSource } from '@artificer-toolkit/shared'
import { InMemoryDb } from './helpers/in-memory-db.js'

vi.mock('kysely', () => ({
  sql: (sql: TemplateStringsArray, ...values: unknown[]) => ({
    execute: async (db: InMemoryDb) => {
      const statement = sql
        .map((piece, index) => `${piece}${index < values.length ? String(values[index]) : ''}`)
        .join('')
      const lowered = statement.toLowerCase()
      const queryTable = lowered.includes('character_spell_slot_state')
        ? 'character_spell_slot_state'
        : lowered.includes('character_conditions')
          ? 'character_conditions'
          : lowered.includes('character_exhaustion')
            ? 'character_exhaustion'
            : null

      if (lowered.includes('from inventory_items')) {
        const ownerId = values[0]
        const rows = await db
          .selectFrom('inventory_items')
          .selectAll()
          .where('owner_id', '=', ownerId)
          .execute()
        return { rows }
      }
      if (lowered.includes('from inventory_currency_balances')) {
        return { rows: [] }
      }

      if (!queryTable) {
        throw new Error(`Unhandled SQL in test mock: ${statement}`)
      }

      const characterId = values[0]
      if (typeof characterId !== 'string') {
        throw new TypeError('Expected the character query to bind a string character ID.')
      }

      const rows = await db
        .selectFrom(queryTable)
        .selectAll()
        .where('character_id', '=', characterId)
        .execute()

      return { rows }
    }
  })
}))

export function buildCharacter(): CharacterAuthored {
  return {
    id: 'character-1',
    label: 'Aria',
    description: 'Initial character state',
    profile: {
      alignmentId: 'alignment-1',
      lifestyleId: 'lifestyle-1',
      faith: 'Selune',
      personalityTraits: 'Always offers a kind word.',
      backstory: 'Raised on the road between two temple cities.',
      notes: 'Carries a weathered journal.'
    },
    systemId: 'system-1',
    primaryRulesCatalogueId: 'catalogue-1',
    userId: 'user-1',
    intent: {
      advancement: {
        method: 'EXPERIENCE',
        experience: 123
      },
      race: {
        raceId: 'race-1',
        subraceId: 'subrace-1'
      },
      ancestrySelections: [
        {
          id: 'ancestry-acq-1',
          ancestryId: 'ancestry-1',
          optionId: 'ancestry-option-1',
          source: {
            kind: 'RACE',
            raceId: 'race-1'
          },
          timing: {
            kind: 'IMMEDIATE'
          }
        }
      ],
      background: {
        backgroundId: 'background-1'
      },
      classes: [
        {
          classId: 'class-1',
          classLevel: 3,
          subclassId: 'subclass-1',
          specializationId: 'specialization-1'
        }
      ],
      abilities: {
        method: 'STANDARD_ARRAY',
        assignments: [
          { ability: 'STRENGTH', option: '15' },
          { ability: 'DEXTERITY', option: '14' }
        ]
      },
      hitpoints: {
        method: 'MANUAL',
        levels: [
          {
            level: 1,
            classId: 'class-1',
            classLevel: 1,
            value: 10,
            rolls: [{ die: 10, value: 7 }],
            overridden: true
          }
        ]
      },
      startingEquipment: {
        class: {
          source: CharacterStartingEquipmentSource.CLASS,
          tookGold: false,
          groups: [
            {
              groupId: 'class-group-1',
              optionId: 'class-option-1',
              selections: [
                {
                  selectionKey: 'class-item-1',
                  equipmentId: 'equipment-1',
                  quantity: 1
                }
              ]
            }
          ],
          applied: true
        },
        background: {
          source: CharacterStartingEquipmentSource.BACKGROUND,
          tookGold: false,
          groups: [
            {
              groupId: 'background-group-1',
              optionId: 'background-option-1',
              selections: [
                {
                  selectionKey: 'background-item-1',
                  equipmentId: 'equipment-2',
                  quantity: 2
                }
              ]
            }
          ],
          applied: false
        }
      },
      featureAcquisitions: [
        {
          id: 'feature-acq-1',
          featureId: 'feature-1',
          source: {
            kind: 'FEATURE',
            featureId: 'feature-1'
          },
          timing: {
            kind: 'IMMEDIATE'
          },
          selections: [
            {
              selectionKey: 'selection-1',
              values: [
                { kind: 'ID', id: 'spell-1' },
                { kind: 'IDS', ids: ['spell-2', 'spell-3'] },
                { kind: 'NUMBER', value: 2 },
                { kind: 'BOOLEAN', value: true }
              ]
            }
          ]
        },
        {
          id: 'feature-acq-2',
          featureId: 'feature-2',
          source: {
            kind: 'OPTION',
            acquiredParentId: 'feature-acq-1',
            optionId: 'option-99'
          },
          timing: {
            kind: 'CLASS_LEVEL',
            classId: 'class-1',
            classLevel: 3
          }
        }
      ],
      chosenGrantSelections: [
        {
          id: 'chosen-grant-selection-1',
          grantId: 'proficiency-grant-1',
          source: {
            kind: 'CLASS',
            classId: 'class-1',
            classLevel: 3
          },
          timing: {
            kind: 'CLASS_LEVEL',
            classId: 'class-1',
            classLevel: 3
          },
          progressionLevel: 3,
          targetIds: ['skill-arcana', 'skill-arcana', 'skill-history']
        }
      ],
      spellSelections: [
        {
          id: 'spell-selection-1',
          source: {
            kind: 'OPTION',
            acquiredParentId: 'feature-acq-1',
            optionId: 'option-99'
          },
          timing: {
            kind: 'CHARACTER_LEVEL',
            level: 4
          },
          spells: ['spell-10', 'spell-11']
        }
      ],
      resourceGrants: [
        {
          id: 'resource-grant-1',
          resourceId: 'resource-1',
          source: {
            kind: 'FEATURE',
            featureId: 'feature-1'
          },
          timing: {
            kind: 'IMMEDIATE'
          }
        }
      ]
    },
    state: {
      equipment: {
        inventory: [
          {
            id: 'inventory-1',
            equipmentId: 'equipment-a',
            quantity: 1
          },
          {
            id: 'inventory-2',
            equipmentId: 'equipment-b',
            quantity: 1,
            containerId: 'inventory-1'
          }
        ],
        equipped: ['inventory-1'],
        attuned: ['inventory-2']
      },
      currency: [
        {
          id: 'currency-group-1',
          containerId: 'inventory-1',
          currencies: [
            {
              currencyId: 'currency-1',
              amount: 50
            }
          ]
        }
      ],
      hitpoints: {
        current: 9,
        temp: 2,
        hitDice: [{ die: 10, total: 3, used: 1 }]
      },
      classes: [
        {
          classId: 'class-1',
          spells: {
            learned: ['spell-10'],
            prepared: ['spell-11']
          }
        }
      ],
      resources: [
        {
          resourceGrantId: 'resource-grant-1',
          used: 1
        }
      ],
      spellSlots: [
        {
          slotKey: 'STANDARD:1',
          used: 1
        }
      ],
      conditions: [
        {
          conditionTypeId: 'condition-1',
          notes: 'Poisoned'
        }
      ],
      exhaustion: {
        level: 2,
        notes: 'Forced march'
      },
      inspiration: true,
      noteGroups: [
        {
          id: 'note-group-session',
          label: 'Session Notes',
          sortOrder: 0,
          kind: 'SESSION'
        }
      ],
      notes: [
        {
          id: 'note-1',
          title: 'The Saltglass Ruins',
          body: 'The western gate bears an artificer sigil.',
          groupId: 'note-group-session',
          pinned: true,
          createdAt: '2026-07-01T12:00:00.000Z',
          updatedAt: '2026-07-02T15:30:00.000Z'
        }
      ],
      creatures: [
        {
          id: 'character-creature-1',
          creatureId: 'creature-1',
          relationshipKind: 'MOUNT',
          originKind: 'WORLD',
          customName: 'Storm',
          isActive: true
        }
      ],
      vehicles: [
        {
          id: 'character-vehicle-1',
          vehicleId: 'vehicle-1',
          customName: 'Dawnrunner'
        }
      ],
      creatureEquipment: {
        'character-creature-1': [{ equipmentItemId: 'inventory-1' }]
      },
      vehicleEquipment: {
        'character-vehicle-1': [{ equipmentItemId: 'inventory-2' }]
      }
    }
  }
}
