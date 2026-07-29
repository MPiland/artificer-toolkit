import { describe, it, expect } from 'vitest'

import {
  dnd5e2014RulesSystem,
  dnd5e2014ProficiencyBonus,
  runEngine,
  resolveModifiers,
  type CharacterBuildSnapshot,
  type CharacterAssemblyRegistry,
  type EngineAccumulatedState
} from '@artificer-toolkit/shared'

/* ──────────────────────────────────────────────
 * Test fixtures
 * ────────────────────────────────────────────── */

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
      { classId: 'fighter', classLevel: 1, value: 12 }, // 10 (d10) + CON mod 2
      { classId: 'fighter', classLevel: 2, value: 8 }, // avg 6 + CON mod 2
      { classId: 'fighter', classLevel: 3, value: 8 } // avg 6 + CON mod 2
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

describe('dnd5e2014RulesSystem identity', () => {
  it('identifies executable rules independently of the system content container', () => {
    expect(dnd5e2014RulesSystem.identity).toEqual({
      code: 'dnd5e',
      version: '2014'
    })
  })
})

/* ──────────────────────────────────────────────
 * a. Proficiency bonus table
 * ────────────────────────────────────────────── */

describe('dnd5e2014ProficiencyBonus', () => {
  const cases: [number, number][] = [
    [1, 2],
    [2, 2],
    [4, 2],
    [5, 3],
    [8, 3],
    [9, 4],
    [12, 4],
    [13, 5],
    [16, 5],
    [17, 6],
    [20, 6]
  ]

  it.each(cases)('level %i → +%i', (level, expected) => {
    expect(dnd5e2014ProficiencyBonus(level)).toBe(expected)
  })
})

/* ──────────────────────────────────────────────
 * b. Ability modifier
 * ────────────────────────────────────────────── */

describe('dnd5e2014RulesSystem.abilityModifier', () => {
  const cases: [number, number][] = [
    [1, -5],
    [8, -1],
    [10, 0],
    [11, 0],
    [12, 1],
    [15, 2],
    [16, 3],
    [20, 5]
  ]

  it.each(cases)('score %i → modifier %i', (score, expected) => {
    expect(dnd5e2014RulesSystem.abilityModifier(score)).toBe(expected)
  })
})

/* ──────────────────────────────────────────────
 * c. Modifier stacking
 * ────────────────────────────────────────────── */

describe('runEngine - selected feature options', () => {
  it('applies grants from selected feature options', () => {
    const snapshot = makeSnapshot({
      abilities: {
        STR: 10,
        DEX: 12,
        CON: 14,
        INT: 10,
        WIS: 10,
        CHA: 8
      },
      features: [
        {
          acquisitionId: 'acquisition-feature-asi',
          featureId: 'feature-asi',
          source: { kind: 'CLASS', classId: 'fighter' },
          timing: { kind: 'CLASS_LEVEL', classId: 'fighter', classLevel: 4 },
          selections: [
            {
              selectionKey: 'options',
              values: [{ kind: 'ID', id: 'option-strength-plus-two' }]
            }
          ]
        }
      ]
    })

    const registry: CharacterAssemblyRegistry = {
      ...makeEmptyRegistry(),
      features: {
        'feature-asi': {
          options: [
            {
              id: 'option-strength-plus-two',
              order: 0,
              modifiers: [
                {
                  id: 'modifier-strength-plus-two',
                  grantKind: 'MODIFIER_GRANT',
                  valueDomainCode: 'ABILITY_SCORE',
                  modifierKind: 'BONUS',
                  domain: { ability: 'STRENGTH' },
                  scope: 'GLOBAL',
                  selectionKind: 'GRANTED',
                  payload: { valueKind: 'FIXED', amount: 2 },
                  order: 0
                }
              ],
              proficiencies: [
                {
                  id: 'proficiency-athletics',
                  grantKind: 'PROFICIENCY_GRANT',
                  proficiencyKind: 'SKILL',
                  level: 'FULL',
                  selectionKind: 'GRANTED',
                  authoringModeKind: 'SELECTED',
                  skillIds: ['athletics'],
                  order: 0
                }
              ]
            }
          ]
        }
      }
    }

    const output = runEngine(snapshot, registry, dnd5e2014RulesSystem)

    expect(output.derivedStats.abilityScores.STR).toBe(12)
    expect(output.proficiencies).toContainEqual(
      expect.objectContaining({
        kind: 'SKILL',
        subjectId: 'athletics',
        scaling: 'FULL'
      })
    )
  })

  it('applies Half-Elf Charisma and two distinct selected ability increases', () => {
    const snapshot = makeSnapshot({
      abilities: {
        STR: 10,
        DEX: 12,
        CON: 14,
        INT: 10,
        WIS: 10,
        CHA: 10
      },
      features: [
        {
          acquisitionId: 'acquisition-half-elf-ability-score-increase',
          featureId: 'feature-half-elf-ability-score-increase',
          source: { kind: 'RACE', raceId: 'race-half-elf' },
          timing: { kind: 'IMMEDIATE' },
          selections: [
            {
              selectionKey: 'options',
              values: [
                { kind: 'ID', id: 'option-strength' },
                { kind: 'ID', id: 'option-dexterity' }
              ]
            }
          ]
        }
      ]
    })
    const abilityModifier = (
      id: string,
      ability: 'STRENGTH' | 'DEXTERITY' | 'CHARISMA',
      amount: number
    ) => ({
      id,
      grantKind: 'MODIFIER_GRANT' as const,
      valueDomainCode: 'ABILITY_SCORE' as const,
      modifierKind: 'BONUS' as const,
      domain: { ability },
      scope: 'GLOBAL' as const,
      selectionKind: 'GRANTED' as const,
      payload: { valueKind: 'FIXED' as const, amount },
      order: 0
    })
    const registry: CharacterAssemblyRegistry = {
      ...makeEmptyRegistry(),
      features: {
        'feature-half-elf-ability-score-increase': {
          modifiers: [abilityModifier('modifier-charisma-plus-two', 'CHARISMA', 2)],
          options: [
            {
              id: 'option-strength',
              order: 0,
              modifiers: [abilityModifier('modifier-strength-plus-one', 'STRENGTH', 1)]
            },
            {
              id: 'option-dexterity',
              order: 1,
              modifiers: [abilityModifier('modifier-dexterity-plus-one', 'DEXTERITY', 1)]
            }
          ]
        }
      }
    }

    const output = runEngine(snapshot, registry, dnd5e2014RulesSystem)

    expect(output.derivedStats.abilityScores.CHA).toBe(12)
    expect(output.derivedStats.abilityScores.STR).toBe(11)
    expect(output.derivedStats.abilityScores.DEX).toBe(13)
  })

  it('applies class grants once when multiple class features are active', () => {
    const snapshot = makeSnapshot({
      features: [
        {
          featureId: 'feature-one',
          source: { kind: 'CLASS', classId: 'fighter' },
          timing: { kind: 'CLASS_LEVEL', classId: 'fighter', classLevel: 1 }
        },
        {
          featureId: 'feature-two',
          source: { kind: 'CLASS', classId: 'fighter' },
          timing: { kind: 'CLASS_LEVEL', classId: 'fighter', classLevel: 2 }
        }
      ]
    })

    const output = runEngine(
      snapshot,
      {
        ...makeEmptyRegistry(),
        classes: {
          fighter: {
            proficiencies: [
              {
                id: 'fighter-athletics',
                grantKind: 'PROFICIENCY_GRANT',
                proficiencyKind: 'SKILL',
                level: 'FULL',
                selectionKind: 'GRANTED',
                scalingKind: 'NONE',
                authoringModeKind: 'SELECTED',
                skillIds: ['athletics'],
                order: 0
              }
            ]
          } as unknown as CharacterAssemblyRegistry['classes'][string]
        }
      },
      dnd5e2014RulesSystem
    )

    expect(
      output.proficiencies.filter((proficiency) => proficiency.subjectId === 'athletics')
    ).toHaveLength(1)
  })
})

describe('resolveModifiers', () => {
  const rules = dnd5e2014RulesSystem

  it('two additive BONUS modifiers stack', () => {
    const entries: EngineAccumulatedState['modifierEntries'] = [
      {
        domainKey: 'ABILITY_SCORE:BONUS',
        modifierKind: 'BONUS',
        grant: { id: 'bonus-one', modifierKind: 'BONUS', payload: { value: 2 } } as never,
        source: { kind: 'SYSTEM', systemId: 'test' }
      },
      {
        domainKey: 'ABILITY_SCORE:BONUS',
        modifierKind: 'BONUS',
        grant: { id: 'bonus-two', modifierKind: 'BONUS', payload: { value: 2 } } as never,
        source: { kind: 'SYSTEM', systemId: 'test' }
      }
    ]

    const result = resolveModifiers(entries, rules)
    expect(result['ABILITY_SCORE:BONUS']).toBe(4)
  })

  it('SET_VALUE uses last value', () => {
    const entries: EngineAccumulatedState['modifierEntries'] = [
      {
        domainKey: 'ARMOR_CLASS:SET_VALUE',
        modifierKind: 'SET_VALUE',
        grant: { id: 'set-one', modifierKind: 'SET_VALUE', payload: { value: 13 } } as never,
        source: { kind: 'SYSTEM', systemId: 'test' }
      },
      {
        domainKey: 'ARMOR_CLASS:SET_VALUE',
        modifierKind: 'SET_VALUE',
        grant: { id: 'set-two', modifierKind: 'SET_VALUE', payload: { value: 11 } } as never,
        source: { kind: 'SYSTEM', systemId: 'test' }
      }
    ]

    const result = resolveModifiers(entries, rules)
    expect(result['ARMOR_CLASS:SET_VALUE']).toBe(11)
  })

  it('ADVANTAGE is boolean — any truthy value = 1', () => {
    const entries: EngineAccumulatedState['modifierEntries'] = [
      {
        domainKey: 'ATTACK_ROLL:ADVANTAGE',
        modifierKind: 'ADVANTAGE',
        grant: { id: 'advantage-one', modifierKind: 'ADVANTAGE' } as never,
        source: { kind: 'SYSTEM', systemId: 'test' }
      }
    ]

    const result = resolveModifiers(entries, rules)
    expect(result['ATTACK_ROLL:ADVANTAGE']).toBe(1)
  })

  it('no entries for a key → key absent from result', () => {
    const result = resolveModifiers([], rules)
    expect(result['ABILITY_SCORE:BONUS']).toBeUndefined()
  })
})

/* ──────────────────────────────────────────────
 * d. runEngine full pipeline — level 3 Fighter
 * ────────────────────────────────────────────── */

describe('runEngine — level 3 Fighter', () => {
  // STR 16, DEX 12, CON 14, INT 10, WIS 10, CHA 8
  // Proficient: STR saves, CON saves, Athletics (STR skill)
  // HP: 10+8+8 = 26 ... wait: 12 + 8 + 8 = 28 (CON mod already included in values)

  const snapshot = makeSnapshot()
  snapshot.features.push({
    featureId: 'feature-fighter-saves',
    source: { kind: 'CLASS', classId: 'fighter' },
    timing: { kind: 'IMMEDIATE' }
  })

  const registry: CharacterAssemblyRegistry = {
    ...makeEmptyRegistry(),
    classes: {
      fighter: {
        id: 'fighter',
        category: 'BASE',
        hitpoint: { ability: 'CON', dieConfig: '1d10' },
        proficiencies: [
          {
            id: 'prof-str-save',
            order: 1,
            grantKind: 'PROFICIENCY_GRANT',
            proficiencyKind: 'SAVE_ABILITY',
            selectionKind: 'GRANTED',
            authoringModeKind: 'SELECTED',
            abilities: ['STR', 'CON'],
            level: 'FULL'
          } as never,
          {
            id: 'prof-athletics',
            order: 2,
            grantKind: 'PROFICIENCY_GRANT',
            proficiencyKind: 'SKILL',
            selectionKind: 'GRANTED',
            authoringModeKind: 'SELECTED',
            skillIds: ['athletics'],
            level: 'FULL'
          } as never
        ],
        startingGold: { multiplier: 5, currencyId: 'gp', dieConfig: '5d4' },
        startingEquipment: { groups: [] } as never,
        multiclass: {
          id: 'fighter-multiclass',
          requirementGroups: {
            id: 'fighter-multiclass',
            groups: [
              {
                id: 'grp-str',
                requirements: [{ id: 'req-str', ability: 'STR', min: 13 }]
              }
            ]
          }
        } as never
      } as never
    }
  }

  const output = runEngine(snapshot, registry, dnd5e2014RulesSystem)

  it('proficiencyBonus is 2 at level 3', () => {
    expect(output.derivedStats.proficiencyBonus).toBe(2)
  })

  it('abilityModifiers.STR = 3 (score 16)', () => {
    expect(output.derivedStats.abilityModifiers['STR']).toBe(3)
  })

  it('abilityModifiers.DEX = 1 (score 12)', () => {
    expect(output.derivedStats.abilityModifiers['DEX']).toBe(1)
  })

  it('abilityModifiers.CON = 2 (score 14)', () => {
    expect(output.derivedStats.abilityModifiers['CON']).toBe(2)
  })

  it('savingThrows.STR = 5 (modifier 3 + PB 2)', () => {
    expect(output.derivedStats.savingThrows['STR']).toBe(5)
  })

  it('savingThrows.DEX = 1 (modifier 1, not proficient)', () => {
    expect(output.derivedStats.savingThrows['DEX']).toBe(1)
  })

  it('skillBonuses.athletics = 5 (STR mod 3 + PB 2)', () => {
    expect(output.derivedStats.skillBonuses['athletics']).toBe(5)
  })

  it('skillBonuses.stealth = 1 (DEX mod 1, not proficient)', () => {
    expect(output.derivedStats.skillBonuses['stealth']).toBe(1)
  })

  it('maxHitPoints = 28 (12 + 8 + 8 from level entries with CON included)', () => {
    expect(output.derivedStats.maxHitPoints).toBe(28)
  })

  it('armorClass = 11 (10 + DEX mod 1, unarmored)', () => {
    expect(output.derivedStats.armorClass).toBe(11)
  })

  it('initiative = 1 (DEX mod 1)', () => {
    expect(output.derivedStats.initiative).toBe(1)
  })

  it('no spellcasting stats since fighter has no spellcasting', () => {
    expect(output.derivedStats.spellSaveDC).toBeUndefined()
    expect(output.derivedStats.spellAttackBonus).toBeUndefined()
  })
})

/* ──────────────────────────────────────────────
 * e. AC from equipped armor
 * ────────────────────────────────────────────── */

describe('runEngine — armor class resolution', () => {
  it('plate armor (HEAVY, base 18) → AC 18, no DEX bonus', () => {
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

  it('chain mail (MEDIUM, base 16) with DEX 16 → AC 18 (capped at +2)', () => {
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

  it('leather armor (LIGHT, base 11) with DEX 16 → AC 14 (full DEX +3)', () => {
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
})

/* ──────────────────────────────────────────────
 * f. Determinism
 * ────────────────────────────────────────────── */

describe('runEngine determinism', () => {
  it('identical inputs produce identical outputs', () => {
    const snapshot = makeSnapshot()
    const registry = makeEmptyRegistry()

    const out1 = runEngine(snapshot, registry, dnd5e2014RulesSystem)
    const out2 = runEngine(snapshot, registry, dnd5e2014RulesSystem)

    expect(out1).toEqual(out2)
  })
})

describe('runEngine - class resources', () => {
  it('applies charge reset replacement modifiers to matching resources', () => {
    const snapshot = makeSnapshot({
      totalLevel: 5,
      classes: [{ classId: 'bard', level: 5 }],
      abilities: { CHA: 16 },
      features: [
        {
          featureId: 'font-of-inspiration',
          source: { kind: 'CLASS', classId: 'bard' },
          timing: { kind: 'CLASS_LEVEL', classId: 'bard', classLevel: 5 }
        }
      ]
    })
    const registry: CharacterAssemblyRegistry = {
      ...makeEmptyRegistry(),
      classes: {
        bard: {
          id: 'bard',
          category: 'BASE',
          resources: {
            id: 'bardic-inspiration',
            label: 'Bardic Inspiration',
            availableAtLevel: 1,
            charges: {
              id: 'bardic-inspiration-charge',
              resetKind: 'LONG_REST',
              limitKind: 'ABILITY_MODIFIER',
              scalingKind: 'NONE',
              ability: 'CHA',
              min: 1
            }
          },
          startingGold: { multiplier: 5, currencyId: 'gp', dieConfig: '5d4' },
          startingEquipment: { groups: [] } as never,
          hitpoint: { ability: 'CON', dieConfig: '1d8' },
          multiclass: {
            id: 'bard-multiclass',
            requirementGroups: { id: 'bard-multiclass', groups: [] }
          }
        } as never
      },
      features: {
        'font-of-inspiration': {
          id: 'font-of-inspiration',
          modifiers: [
            {
              id: 'font-reset',
              grantKind: 'MODIFIER_GRANT',
              valueDomainCode: 'CHARGE_RESET',
              domain: {},
              modifierKind: 'REPLACE_CHARGE_RESET_KIND',
              scope: 'SOURCE',
              selectionKind: 'GRANTED',
              payload: { resetKind: 'SHORT_REST' },
              order: 0,
              restrictions: {
                id: 'font-reset-restriction',
                groups: [
                  {
                    id: 'font-reset-group',
                    order: 0,
                    contexts: [
                      {
                        id: 'font-reset-context',
                        order: 0,
                        subject: 'RESOURCE',
                        resourceIds: ['bardic-inspiration'],
                        conditions: []
                      }
                    ]
                  }
                ]
              }
            }
          ]
        } as never
      }
    }

    const output = runEngine(snapshot, registry, dnd5e2014RulesSystem)

    expect(output.resources).toEqual([
      expect.objectContaining({
        resourceId: 'bardic-inspiration',
        label: 'Bardic Inspiration',
        maxCount: 3,
        rechargeOn: 'SHORT_REST'
      })
    ])
  })

  it('resolves selected subclass resources with charge reset replacement modifiers', () => {
    const snapshot = makeSnapshot({
      totalLevel: 5,
      classes: [{ classId: 'fighter', subclassId: 'battle-master', level: 5 }],
      features: [
        {
          featureId: 'improved-combat-superiority',
          source: { kind: 'SUBCLASS', subclassId: 'battle-master' },
          timing: { kind: 'CLASS_LEVEL', classId: 'fighter', classLevel: 5 }
        }
      ]
    })
    const registry: CharacterAssemblyRegistry = {
      ...makeEmptyRegistry(),
      classes: {
        fighter: {
          id: 'fighter',
          category: 'BASE'
        } as never,
        'battle-master': {
          id: 'battle-master',
          category: 'SUBCLASS',
          parentClassId: 'fighter',
          resources: {
            id: 'superiority-dice',
            label: 'Superiority Dice',
            availableAtLevel: 3,
            charges: {
              id: 'superiority-dice-charge',
              resetKind: 'LONG_REST',
              limitKind: 'FIXED_AMOUNT',
              scalingKind: 'NONE',
              amount: 4
            }
          }
        } as never
      },
      features: {
        'improved-combat-superiority': {
          id: 'improved-combat-superiority',
          modifiers: [
            {
              id: 'superiority-dice-reset',
              grantKind: 'MODIFIER_GRANT',
              valueDomainCode: 'CHARGE_RESET',
              domain: {},
              modifierKind: 'REPLACE_CHARGE_RESET_KIND',
              scope: 'SOURCE',
              selectionKind: 'GRANTED',
              payload: { resetKind: 'SHORT_REST' },
              order: 0,
              restrictions: {
                id: 'superiority-dice-reset-restriction',
                groups: [
                  {
                    id: 'superiority-dice-reset-group',
                    order: 0,
                    contexts: [
                      {
                        id: 'superiority-dice-reset-context',
                        order: 0,
                        subject: 'RESOURCE',
                        resourceIds: ['superiority-dice'],
                        conditions: []
                      }
                    ]
                  }
                ]
              }
            }
          ]
        } as never
      }
    }

    const output = runEngine(snapshot, registry, dnd5e2014RulesSystem)

    expect(output.resources).toEqual([
      expect.objectContaining({
        resourceId: 'superiority-dice',
        label: 'Superiority Dice',
        maxCount: 4,
        rechargeOn: 'SHORT_REST',
        sourceFeatureId: 'battle-master'
      })
    ])
  })
})
