import { describe, expect, it } from 'vitest'

import {
  characterSheetActionDtoSchema,
  characterSheetCommandInputDtoSchema,
  characterSheetExtrasDtoSchema,
  characterSheetInventoryItemDtoSchema,
  characterSheetProficiencyFactDtoSchema,
  characterSheetResponseDtoSchema,
  characterRestPreviewRequestDtoSchema
} from '../api/characters.js'
import {
  characterCompletedRestResultDtoSchema,
  characterRestHitDiceRollEvidenceDtoSchema
} from '../api/characterSheet.js'
import {
  characterHistoryEntryDtoSchema,
  characterHistoryResponseDtoSchema
} from '../api/characterHistory.js'
import {
  characterHistoryEntryDtoSchema as commandHistoryEntrySchema,
  characterHistoryResponseDtoSchema as commandHistoryResponseSchema
} from '../api/characterSheetCommands.js'

describe('character sheet command contracts', () => {
  it('shares the unchanged history contracts with the standalone history reader', () => {
    expect(commandHistoryEntrySchema).toBe(characterHistoryEntryDtoSchema)
    expect(commandHistoryResponseSchema).toBe(characterHistoryResponseDtoSchema)
    const entry = {
      eventId: 'event-1',
      occurredAt: '2026-09-08T00:00:00.000Z',
      actorId: 'actor-1',
      eventType: 'SOURCE_REMOVED',
      summary: 'Source removed'
    }
    expect(
      characterHistoryResponseDtoSchema.parse({ characterId: 'character-1', entries: [entry] })
    ).toEqual({ characterId: 'character-1', entries: [entry] })
    expect(characterHistoryEntryDtoSchema.safeParse({ ...entry, summary: 12 }).success).toBe(false)
  })

  it('rejects the retired rule-pack upgrade command', () => {
    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'UPGRADE_RULE_PACK',
        commandId: '00000000-0000-4000-8000-000000000001',
        expectedVersion: 3,
        revisionId: '00000000-0000-4000-8000-000000000202'
      }).success
    ).toBe(false)
  })

  it('accepts positive source-charge action costs and rejects zero cost', () => {
    const action = {
      id: 'action-warping-strike',
      label: 'Warping Strike',
      kind: 'ACTION',
      availability: { status: 'AVAILABLE' },
      resourceGrantId: 'ITEM_INSTANCE:item-1:astral-tear-charges',
      resourceCost: 2
    } as const

    expect(characterSheetActionDtoSchema.safeParse(action).success).toBe(true)
    expect(characterSheetActionDtoSchema.safeParse({ ...action, resourceCost: 0 }).success).toBe(
      false
    )
  })

  it('requires property codes and authoritative labels in Sheet inventory rows', () => {
    const item = {
      id: 'item-1',
      equipmentId: 'equipment-1',
      label: 'Longsword',
      properties: [{ code: 'ONE_HANDED', label: 'One-Handed' }],
      quantity: 1,
      equippedSlot: 'MAIN_HAND',
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
          viewer: 'CHARACTER_OWNER',
          capabilities: {
            managePlayState: true,
            managePrivateNotes: true,
            manageInventory: true,
            openBuilder: true,
            endActiveEffects: false
          },
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
              label: 'Dexterity',
              short: 'DEX',
              score: 14,
              modifier: 2,
              rollMode: 'NORMAL'
            }
          ],
          facts: [{ label: 'Initiative', value: '+2' }],
          armorClass: 12,
          initiative: 2,
          initiativeRollMode: 'NORMAL',
          rollModes: [
            { code: 'NORMAL', label: 'Normal', keep: 'FIRST' },
            { code: 'ADVANTAGE', label: 'Advantage', keep: 'HIGHER' },
            { code: 'DISADVANTAGE', label: 'Disadvantage', keep: 'LOWER' }
          ],
          proficiencyBonus: 2,
          currentHitPoints: 8,
          maxHitPoints: 12,
          tempHitPoints: 0,
          deathSaves: { successes: 0, failures: 0, stable: false },
          maxHitPointsModifier: 0,
          maxHitPointsModifierAdjustmentId: null,
          maxHitPointsReductions: [],
          activeGrants: [],
          standingEffects: [],
          concentration: null,
          maxHitPointsOverride: null,
          savingThrows: [
            {
              ability: 'DEXTERITY',
              label: 'Dexterity',
              short: 'DEX',
              total: 4,
              rollMode: 'NORMAL',
              proficiency: 'FULL'
            }
          ],
          skills: [
            {
              skillId: 'athletics',
              code: 'ATHLETICS',
              label: 'Athletics',
              ability: 'STRENGTH',
              abilityShort: 'STR',
              total: 4,
              rollMode: 'NORMAL',
              proficiency: 'DOUBLE'
            }
          ],
          exhaustion: {
            label: 'Exhaustion',
            description: 'Exhaustion measures cumulative physical and mental fatigue.',
            level: 0,
            minimumLevel: 0,
            maximumLevel: 6
          },
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
              availability: { status: 'AVAILABLE' },
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
                  trigger: 'RANGED_SPELL_ATTACK',
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
        extras: {
          kindOptions: [],
          originOptions: [],
          items: []
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
          viewer: 'CHARACTER_OWNER',
          capabilities: {
            managePlayState: true,
            managePrivateNotes: true,
            manageInventory: true,
            openBuilder: true,
            endActiveEffects: false
          },
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
          initiativeRollMode: 'NORMAL',
          rollModes: [
            { code: 'NORMAL', label: 'Normal', keep: 'FIRST' },
            { code: 'ADVANTAGE', label: 'Advantage', keep: 'HIGHER' },
            { code: 'DISADVANTAGE', label: 'Disadvantage', keep: 'LOWER' }
          ],
          proficiencyBonus: 2,
          currentHitPoints: 8,
          maxHitPoints: 12,
          tempHitPoints: 0,
          deathSaves: { successes: 0, failures: 0, stable: false },
          maxHitPointsModifier: 0,
          maxHitPointsModifierAdjustmentId: null,
          maxHitPointsReductions: [],
          activeGrants: [],
          standingEffects: [],
          concentration: null,
          maxHitPointsOverride: null,
          savingThrows: [
            {
              ability: 'DEXTERITY',
              label: 'Dexterity',
              short: 'DEX',
              total: 2,
              rollMode: 'NORMAL',
              proficiency: 'INVALID'
            }
          ],
          skills: [],
          exhaustion: {
            label: 'Exhaustion',
            description: 'Exhaustion measures cumulative physical and mental fatigue.',
            level: 0,
            minimumLevel: 0,
            maximumLevel: 6
          },
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
        extras: {
          kindOptions: [],
          originOptions: [],
          items: []
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
        kind: 'RULESET',
        currencyId: 'currency-1',
        amount: -5
      }).success
    ).toBe(true)
  })

  it('keeps effective creature adjustment fields in Sheet extras', () => {
    expect(
      characterSheetExtrasDtoSchema.safeParse({
        kindOptions: [],
        originOptions: [],
        items: [
          {
            id: '00000000-0000-4000-8000-000000000002',
            kind: 'COMPANION',
            kindLabel: 'Companion',
            authoredName: 'Owl',
            displayName: 'Owl',
            isActive: true,
            actions: [],
            features: [],
            equipmentItemIds: [],
            creatureId: '00000000-0000-4000-8000-000000000003',
            relationshipKind: 'COMPANION',
            relationshipLabel: 'Companion',
            originKind: 'WORLD',
            originLabel: 'World',
            size: 'SMALL',
            alignmentId: '00000000-0000-4000-8000-000000000004',
            creatureTypeId: '00000000-0000-4000-8000-000000000005',
            armorClass: 11,
            hitPoints: { current: 1, temp: 0, maximum: 1 },
            hitDice: []
          }
        ]
      }).success
    ).toBe(true)
  })

  it.each([
    ['used hit dice above total', [{ die: 8, total: 1, used: 2, remaining: 0 }]],
    [
      'duplicate hit-die denominations',
      [
        { die: 8, total: 1, used: 0, remaining: 1 },
        { die: 8, total: 2, used: 0, remaining: 2 }
      ]
    ],
    ['inconsistent remaining hit dice', [{ die: 8, total: 2, used: 1, remaining: 2 }]]
  ])('rejects Sheet extras with %s', (_label, hitDice) => {
    expect(
      characterSheetExtrasDtoSchema.safeParse({
        kindOptions: [],
        originOptions: [],
        items: [
          {
            id: '00000000-0000-4000-8000-000000000002',
            kind: 'COMPANION',
            kindLabel: 'Companion',
            authoredName: 'Owl',
            displayName: 'Owl',
            isActive: true,
            actions: [],
            features: [],
            equipmentItemIds: [],
            creatureId: '00000000-0000-4000-8000-000000000003',
            relationshipKind: 'COMPANION',
            relationshipLabel: 'Companion',
            originKind: 'WORLD',
            originLabel: 'World',
            armorClass: 11,
            hitPoints: { current: 1, temp: 0, maximum: 1 },
            hitDice
          }
        ]
      }).success
    ).toBe(false)
  })

  it('rejects invalid creature hit dice updates', () => {
    const baseExtra = {
      kind: 'COMPANION',
      extraId: '00000000-0000-4000-8000-000000000002'
    } as const

    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'UPDATE_SHEET_EXTRA',
        commandId: '00000000-0000-4000-8000-000000000001',
        expectedVersion: 1,
        extra: { ...baseExtra, hitDice: [{ die: 8, total: 1, used: 2 }] }
      }).success
    ).toBe(false)
    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'UPDATE_SHEET_EXTRA',
        commandId: '00000000-0000-4000-8000-000000000001',
        expectedVersion: 1,
        extra: {
          ...baseExtra,
          hitDice: [
            { die: 8, total: 1, used: 0 },
            { die: 8, total: 2, used: 0 }
          ]
        }
      }).success
    ).toBe(false)
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

  it('accepts an explicit known-spell list, including an empty override', () => {
    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'SET_KNOWN_SPELLS',
        commandId: '00000000-0000-4000-8000-000000000001',
        expectedVersion: 3,
        classId: 'class-1',
        spellIds: []
      }).success
    ).toBe(true)
  })

  it('accepts an exact mixed-die rest preview and completion contract', () => {
    const rollEvidence = {
      expression: '1d10 + 1d8 + 4',
      terms: [
        { die: 10, count: 1, modifierPerDie: 2, rolls: [8] },
        { die: 8, count: 1, modifierPerDie: 2, rolls: [3] }
      ],
      total: 15
    }
    const restSelection = {
      restKind: 'SHORT',
      selectedHitDice: [
        { die: 10, count: 1 },
        { die: 8, count: 1 }
      ],
      resetMaximumHitPointModifier: true,
      healingMode: 'MANUAL',
      manualHealingAccepted: true,
      selectedCompanionInstanceIds: ['00000000-0000-4000-8000-000000000002'],
      rollId: '00000000-0000-4000-8000-000000000003',
      rollEvidence
    } as const

    expect(
      characterRestPreviewRequestDtoSchema.safeParse({
        ...restSelection,
        expectedVersion: 3,
        requestRoll: false
      }).success
    ).toBe(true)
    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        ...restSelection,
        type: 'COMPLETE_REST',
        commandId: '00000000-0000-4000-8000-000000000001',
        expectedVersion: 3,
        previewFingerprint: 'preview-3'
      }).success
    ).toBe(true)
    expect(
      characterCompletedRestResultDtoSchema.safeParse({
        restKind: 'SHORT',
        previewFingerprint: 'preview-3',
        hitPoints: {
          currentBefore: 5,
          currentAfter: 20,
          temporaryBefore: 4,
          temporaryAfter: 4,
          healingApplied: 15
        },
        exhaustion: { before: 1, after: 1 },
        spentHitDice: restSelection.selectedHitDice,
        recoveredHitDice: [],
        rollEvidence,
        resetMaximumHitPointModifier: true,
        recoveredResourceIds: ['resource-second-wind'],
        recoveredSpellSlotKeys: [],
        companionRecoveries: [
          {
            companionInstanceId: '00000000-0000-4000-8000-000000000002',
            recoveredHitDice: [],
            recoveredResourceIds: ['resource-companion-feature']
          }
        ]
      }).success
    ).toBe(true)
  })

  it('keeps exhaustion command levels system-neutral for service policy validation', () => {
    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'SET_EXHAUSTION',
        commandId: '00000000-0000-4000-8000-000000000001',
        expectedVersion: 3,
        level: 7
      }).success
    ).toBe(true)
  })

  it.each([
    ['expression', { expression: '1d10 + 1d8 + 3' }],
    [
      'roll count',
      {
        terms: [
          { die: 10, count: 2, modifierPerDie: 2, rolls: [8] },
          { die: 8, count: 1, modifierPerDie: 2, rolls: [3] }
        ],
        expression: '2d10 + 1d8 + 6',
        total: 19
      }
    ],
    [
      'face range',
      {
        terms: [
          { die: 10, count: 1, modifierPerDie: 2, rolls: [11] },
          { die: 8, count: 1, modifierPerDie: 2, rolls: [3] }
        ]
      }
    ],
    ['total', { total: 14 }]
  ])('rejects mixed-die evidence with an invalid %s', (_label, override) => {
    const evidence = {
      expression: '1d10 + 1d8 + 4',
      terms: [
        { die: 10, count: 1, modifierPerDie: 2, rolls: [8] },
        { die: 8, count: 1, modifierPerDie: 2, rolls: [3] }
      ],
      total: 15,
      ...override
    }
    expect(characterRestHitDiceRollEvidenceDtoSchema.safeParse(evidence).success).toBe(false)
  })

  it('rejects server-side rest rolls and duplicate selections', () => {
    expect(
      characterRestPreviewRequestDtoSchema.safeParse({
        restKind: 'SHORT',
        expectedVersion: 3,
        selectedHitDice: [
          { die: 8, count: 1 },
          { die: 8, count: 1 }
        ],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: [],
        rollEvidence: {
          expression: '1d8 + 2',
          terms: [{ die: 8, count: 1, modifierPerDie: 2, rolls: [5] }],
          total: 7
        },
        requestRoll: true
      }).success
    ).toBe(false)
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
