import { describe, it, expect } from 'vitest'

import {
  dnd5e2014RulesSystem,
  runEngine,
  type CharacterBuildSnapshot,
  type CharacterAssemblyRegistry
} from '@artificer-toolkit/shared'

function makeSnapshot(overrides: Partial<CharacterBuildSnapshot> = {}): CharacterBuildSnapshot {
  return {
    characterId: 'char-001',
    systemId: 'dnd5e2014',
    totalLevel: 3,
    classes: [{ classId: 'fighter', level: 3 }],
    abilities: {
      STR: 16,
      DEX: 12,
      CON: 14,
      INT: 10,
      WIS: 10,
      CHA: 8
    },
    hitpoints: [
      { classId: 'fighter', classLevel: 1, value: 12 },
      { classId: 'fighter', classLevel: 2, value: 8 },
      { classId: 'fighter', classLevel: 3, value: 8 }
    ],
    features: [],
    equipmentItems: [],
    ...overrides
  }
}

function makeEmptyRegistry(): CharacterAssemblyRegistry {
  return {
    features: {},
    classes: {},
    feats: {},
    races: {},
    equipment: {},
    spells: {}
  }
}
/* Armor class resolution from equipped armor. */

describe('runEngine - armor class resolution', () => {
  it('plate armor (HEAVY, base 18) -> AC 18, no DEX bonus', () => {
    const snapshot = makeSnapshot({
      abilities: { STR: 16, DEX: 16, CON: 14, INT: 10, WIS: 10, CHA: 8 },
      equipmentItems: [
        {
          instanceId: 'inst-plate',
          contentRef: {
            definitionId: 'plate-armor',
            binding: { kind: 'ACTIVE' },
            systemId: 'dnd5e2014'
          },
          equippedState: { slot: 'ARMOR' },
          attuned: false,
          compiledItem: {
            id: 'plate-armor',
            category: 'ARMOR',
            properties: ['HEAVY'],
            armorClass: 18,
            cost: { amount: 1500, currencyId: 'gp' },
            weight: { amount: 65, unit: 'LB' },
            rarityId: 'common'
          } as never
        }
      ]
    })

    const output = runEngine(snapshot, makeEmptyRegistry(), dnd5e2014RulesSystem)
    expect(output.derivedStats.armorClass).toBe(18)
  })

  it('chain mail (MEDIUM, base 16) with DEX 16 -> AC 18 (capped at +2)', () => {
    const snapshot = makeSnapshot({
      abilities: { STR: 16, DEX: 16, CON: 14, INT: 10, WIS: 10, CHA: 8 },
      equipmentItems: [
        {
          instanceId: 'inst-chain',
          contentRef: {
            definitionId: 'chain-mail',
            binding: { kind: 'ACTIVE' },
            systemId: 'dnd5e2014'
          },
          equippedState: { slot: 'ARMOR' },
          attuned: false,
          compiledItem: {
            id: 'chain-mail',
            category: 'ARMOR',
            properties: ['MEDIUM'],
            armorClass: 16,
            cost: { amount: 75, currencyId: 'gp' },
            weight: { amount: 55, unit: 'LB' },
            rarityId: 'common',
            modifiers: [
              {
                id: 'chain-mail-dex-bonus',
                grantKind: 'MODIFIER_GRANT',
                order: 1,
                selectionKind: 'GRANTED',
                valueDomainCode: 'ARMOR_CLASS',
                domain: {},
                modifierKind: 'ABILITY_MODIFIER_BONUS',
                scope: 'GLOBAL',
                payload: { ability: 'DEXTERITY', max: 2 }
              }
            ]
          } as never
        }
      ]
    })

    const output = runEngine(snapshot, makeEmptyRegistry(), dnd5e2014RulesSystem)
    expect(output.derivedStats.armorClass).toBe(18) // 16 + min(3, 2) = 18
  })

  it('leather armor (LIGHT, base 11) with DEX 16 -> AC 14 (full DEX +3)', () => {
    const snapshot = makeSnapshot({
      abilities: { STR: 10, DEX: 16, CON: 14, INT: 10, WIS: 10, CHA: 8 },
      equipmentItems: [
        {
          instanceId: 'inst-leather',
          contentRef: {
            definitionId: 'leather-armor',
            binding: { kind: 'ACTIVE' },
            systemId: 'dnd5e2014'
          },
          equippedState: { slot: 'ARMOR' },
          attuned: false,
          compiledItem: {
            id: 'leather-armor',
            category: 'ARMOR',
            properties: ['LIGHT'],
            armorClass: 11,
            cost: { amount: 10, currencyId: 'gp' },
            weight: { amount: 10, unit: 'LB' },
            rarityId: 'common',
            modifiers: [
              {
                id: 'leather-armor-dex-bonus',
                grantKind: 'MODIFIER_GRANT',
                order: 1,
                selectionKind: 'GRANTED',
                valueDomainCode: 'ARMOR_CLASS',
                domain: {},
                modifierKind: 'ABILITY_MODIFIER_BONUS',
                scope: 'GLOBAL',
                payload: { ability: 'DEXTERITY' }
              }
            ]
          } as never
        }
      ]
    })

    const output = runEngine(snapshot, makeEmptyRegistry(), dnd5e2014RulesSystem)
    expect(output.derivedStats.armorClass).toBe(14) // 11 + 3
  })

  it('shield only adds +2 to unarmored AC', () => {
    const snapshot = makeSnapshot({
      abilities: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 8 },
      equipmentItems: [
        {
          instanceId: 'inst-shield',
          contentRef: {
            definitionId: 'shield',
            binding: { kind: 'ACTIVE' },
            systemId: 'dnd5e2014'
          },
          equippedState: { slot: 'SHIELD' },
          attuned: false,
          compiledItem: {
            id: 'shield',
            category: 'SHIELD',
            properties: [],
            armorClass: 2,
            cost: { amount: 10, currencyId: 'gp' },
            weight: { amount: 6, unit: 'LB' },
            rarityId: 'common'
          } as never
        }
      ]
    })

    const output = runEngine(snapshot, makeEmptyRegistry(), dnd5e2014RulesSystem)
    // Unarmored: 10 + 1 (DEX) + 2 (shield) = 13
    expect(output.derivedStats.armorClass).toBe(13)
  })
})

describe('runEngine - equipment source state', () => {
  function initiativeItem(
    predicateCode: 'WHILE_SOURCE_CARRIED' | 'WHILE_SOURCE_EQUIPPED' | 'WHILE_SOURCE_ATTUNED',
    state: { equipped: boolean; attuned: boolean }
  ): CharacterBuildSnapshot['equipmentItems'][number] {
    return {
      instanceId: 'instance-lucky-charm',
      contentRef: {
        definitionId: 'lucky-charm',
        binding: { kind: 'ACTIVE' },
        systemId: 'dnd5e2014'
      },
      ...(state.equipped ? { equippedState: { slot: 'GENERIC' as const } } : {}),
      attuned: state.attuned,
      compiledItem: {
        id: 'lucky-charm',
        category: 'ADVENTURING_GEAR',
        properties: [],
        cost: { amount: 1, currencyId: 'gp' },
        weight: { amount: 1, unit: 'LB' },
        rarityId: 'common',
        modifiers: [
          {
            id: `${predicateCode}-initiative`,
            grantKind: 'MODIFIER_GRANT',
            order: 1,
            selectionKind: 'GRANTED',
            valueDomainCode: 'INITIATIVE',
            domain: {},
            modifierKind: 'BONUS',
            scope: 'GLOBAL',
            payload: { valueKind: 'FIXED', amount: 2 },
            restrictions: {
              id: `${predicateCode}-restriction`,
              groups: [
                {
                  id: `${predicateCode}-group`,
                  order: 1,
                  contexts: [
                    {
                      id: `${predicateCode}-context`,
                      order: 1,
                      subject: 'CHARACTER',
                      conditions: [
                        {
                          id: `${predicateCode}-condition`,
                          order: 1,
                          kind: 'PREDICATE',
                          constraint: 'INCLUDE',
                          predicateCode
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        ]
      } as unknown as CharacterBuildSnapshot['equipmentItems'][number]['compiledItem']
    }
  }

  it.each([
    ['WHILE_SOURCE_CARRIED', { equipped: false, attuned: false }, 2],
    ['WHILE_SOURCE_EQUIPPED', { equipped: false, attuned: false }, 0],
    ['WHILE_SOURCE_EQUIPPED', { equipped: true, attuned: false }, 2],
    ['WHILE_SOURCE_ATTUNED', { equipped: true, attuned: false }, 0],
    ['WHILE_SOURCE_ATTUNED', { equipped: true, attuned: true }, 2]
  ] as const)(
    'applies %s modifiers only in the required state',
    (predicateCode, state, expectedBonus) => {
      const snapshot = makeSnapshot({
        abilities: { DEX: 10 },
        equipmentItems: [initiativeItem(predicateCode, state)]
      })

      expect(
        runEngine(snapshot, makeEmptyRegistry(), dnd5e2014RulesSystem).derivedStats.initiative
      ).toBe(expectedBonus)
    }
  )

  it('does not apply an attunement-required item until it is attuned', () => {
    const makeArmor = (attuned: boolean): CharacterBuildSnapshot['equipmentItems'][number] => ({
      instanceId: 'instance-attuned-armor',
      contentRef: {
        definitionId: 'attuned-armor',
        binding: { kind: 'ACTIVE' },
        systemId: 'dnd5e2014'
      },
      equippedState: { slot: 'ARMOR' },
      attuned,
      compiledItem: {
        id: 'attuned-armor',
        category: 'ARMOR',
        properties: ['HEAVY'],
        armorClass: 18,
        rarityId: 'rare',
        requiresAttunement: true
      } as unknown as CharacterBuildSnapshot['equipmentItems'][number]['compiledItem']
    })

    const unattuned = runEngine(
      makeSnapshot({ abilities: { DEX: 12 }, equipmentItems: [makeArmor(false)] }),
      makeEmptyRegistry(),
      dnd5e2014RulesSystem
    )
    const attuned = runEngine(
      makeSnapshot({ abilities: { DEX: 12 }, equipmentItems: [makeArmor(true)] }),
      makeEmptyRegistry(),
      dnd5e2014RulesSystem
    )

    expect(unattuned.derivedStats.armorClass).toBe(11)
    expect(unattuned.activeItemContributions).toEqual([])
    expect(attuned.derivedStats.armorClass).toBe(18)
  })

  it('gates all item benefits behind root character restrictions', () => {
    const restrictedItem: CharacterBuildSnapshot['equipmentItems'][number] = {
      instanceId: 'instance-veteran-charm',
      contentRef: {
        definitionId: 'veteran-charm',
        binding: { kind: 'ACTIVE' },
        systemId: 'dnd5e2014'
      },
      equippedState: { slot: 'GENERIC' },
      attuned: false,
      compiledItem: {
        id: 'veteran-charm',
        category: 'ADVENTURING_GEAR',
        properties: [],
        rarityId: 'uncommon',
        restrictions: {
          id: 'veteran-restriction',
          groups: [
            {
              id: 'veteran-group',
              order: 1,
              contexts: [
                {
                  id: 'veteran-context',
                  order: 1,
                  subject: 'CHARACTER',
                  conditions: [
                    {
                      id: 'veteran-condition',
                      order: 1,
                      kind: 'PREDICATE',
                      constraint: 'INCLUDE',
                      predicateCode: 'CLASS_LEVEL',
                      classIds: ['fighter'],
                      min: 4
                    }
                  ]
                }
              ]
            }
          ]
        },
        modifiers: [
          {
            id: 'veteran-initiative',
            grantKind: 'MODIFIER_GRANT',
            order: 1,
            selectionKind: 'GRANTED',
            valueDomainCode: 'INITIATIVE',
            domain: {},
            modifierKind: 'BONUS',
            scope: 'GLOBAL',
            payload: { valueKind: 'FIXED', amount: 2 }
          }
        ]
      } as unknown as CharacterBuildSnapshot['equipmentItems'][number]['compiledItem']
    }

    const levelThree = runEngine(
      makeSnapshot({
        classes: [{ classId: 'fighter', level: 3 }],
        equipmentItems: [restrictedItem]
      }),
      makeEmptyRegistry(),
      dnd5e2014RulesSystem
    )
    const levelFour = runEngine(
      makeSnapshot({
        classes: [{ classId: 'fighter', level: 4 }],
        equipmentItems: [restrictedItem]
      }),
      makeEmptyRegistry(),
      dnd5e2014RulesSystem
    )

    expect(levelThree.derivedStats.initiative).toBe(1)
    expect(levelFour.derivedStats.initiative).toBe(3)
  })

  it('applies grants owned by eligible equipment features', () => {
    const snapshot = makeSnapshot({
      equipmentItems: [
        {
          instanceId: 'instance-tongues-ring',
          contentRef: {
            definitionId: 'tongues-ring',
            binding: { kind: 'ACTIVE' },
            systemId: 'dnd5e2014'
          },
          equippedState: { slot: 'RING', position: 1 },
          attuned: true,
          compiledItem: {
            id: 'tongues-ring',
            category: 'ADVENTURING_GEAR',
            properties: [],
            rarityId: 'rare',
            requiresAttunement: true,
            features: [
              {
                id: 'tongues-ring-feature',
                order: 1,
                proficiencies: [
                  {
                    id: 'tongues-language-grant',
                    order: 1,
                    grantKind: 'PROFICIENCY_GRANT',
                    selectionKind: 'GRANTED',
                    authoringModeKind: 'SELECTED',
                    proficiencyKind: 'LANGUAGE',
                    languageIds: ['draconic'],
                    level: 'FULL'
                  }
                ]
              }
            ]
          } as unknown as CharacterBuildSnapshot['equipmentItems'][number]['compiledItem']
        }
      ]
    })

    expect(
      runEngine(snapshot, makeEmptyRegistry(), dnd5e2014RulesSystem).proficiencies
    ).toContainEqual(
      expect.objectContaining({
        kind: 'LANGUAGE',
        subjectId: 'draconic',
        scaling: 'FULL'
      })
    )
  })

  it('binds source-charge equipment features to each active item instance', () => {
    const compiledItem = {
      id: 'wand-of-sparks',
      category: 'ADVENTURING_GEAR',
      properties: [],
      rarityId: 'uncommon',
      requiresAttunement: true,
      charges: {
        id: 'wand-of-sparks-charges',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        resetKind: 'DAWN',
        amount: 7
      },
      features: [
        {
          id: 'wand-of-sparks-cast',
          order: 1,
          charges: {
            id: 'wand-of-sparks-cast-charges',
            limitKind: 'SOURCE_CHARGES',
            scalingKind: 'NONE',
            cost: 2
          }
        }
      ]
    } as unknown as CharacterBuildSnapshot['equipmentItems'][number]['compiledItem']
    const equipmentItems = ['instance-wand-one', 'instance-wand-two'].map((instanceId) => ({
      instanceId,
      contentRef: {
        definitionId: 'wand-of-sparks',
        binding: { kind: 'ACTIVE' as const },
        systemId: 'dnd5e2014'
      },
      attuned: true,
      compiledItem
    }))

    const output = runEngine(
      makeSnapshot({ equipmentItems }),
      makeEmptyRegistry(),
      dnd5e2014RulesSystem
    )

    expect(output.equipmentFeatureChargeUses).toEqual([
      {
        featureId: 'wand-of-sparks-cast',
        equipmentId: 'wand-of-sparks',
        itemInstanceId: 'instance-wand-one',
        chargeId: 'wand-of-sparks-charges',
        cost: 2
      },
      {
        featureId: 'wand-of-sparks-cast',
        equipmentId: 'wand-of-sparks',
        itemInstanceId: 'instance-wand-two',
        chargeId: 'wand-of-sparks-charges',
        cost: 2
      }
    ])
  })
})
