import { describe, it, expect } from 'vitest'

import {
  dnd5e2014RulesSystem,
  dnd5e2014ProficiencyBonus,
  runEngine,
  resolveModifiers,
  type CharacterBuildSnapshot,
  type CharacterAssemblyRegistry,
  type EngineAccumulatedState,
} from '@artificer-toolkit/shared'

/* ──────────────────────────────────────────────
 * Test fixtures
 * ────────────────────────────────────────────── */

function makeSnapshot(
  overrides: Partial<CharacterBuildSnapshot> = {}
): CharacterBuildSnapshot {
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
      CHA: 8,
    },
    hitpoints: [
      { classId: 'fighter', classLevel: 1, value: 12 }, // 10 (d10) + CON mod 2
      { classId: 'fighter', classLevel: 2, value: 8 },  // avg 6 + CON mod 2
      { classId: 'fighter', classLevel: 3, value: 8 },  // avg 6 + CON mod 2
    ],
    features: [],
    equippedItems: [],
    ...overrides,
  }
}

function makeEmptyRegistry(): CharacterAssemblyRegistry {
  return {
    features: {},
    classes: {},
    feats: {},
    races: {},
    equipment: {},
    spells: {},
  }
}

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
    [20, 6],
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
    [20, 5],
  ]

  it.each(cases)('score %i → modifier %i', (score, expected) => {
    expect(dnd5e2014RulesSystem.abilityModifier(score)).toBe(expected)
  })
})

/* ──────────────────────────────────────────────
 * c. Modifier stacking
 * ────────────────────────────────────────────── */

describe('resolveModifiers', () => {
  const rules = dnd5e2014RulesSystem

  it('two additive BONUS modifiers stack', () => {
    const entries: EngineAccumulatedState['modifierEntries'] = [
      {
        domainKey: 'ABILITY_SCORE:BONUS',
        modifierKind: 'BONUS',
        grant: { modifierKind: 'BONUS', payload: { value: 2 } } as never,
      },
      {
        domainKey: 'ABILITY_SCORE:BONUS',
        modifierKind: 'BONUS',
        grant: { modifierKind: 'BONUS', payload: { value: 2 } } as never,
      },
    ]

    const result = resolveModifiers(entries, rules)
    expect(result['ABILITY_SCORE:BONUS']).toBe(4)
  })

  it('SET_VALUE uses last value', () => {
    const entries: EngineAccumulatedState['modifierEntries'] = [
      {
        domainKey: 'ARMOR_CLASS:SET_VALUE',
        modifierKind: 'SET_VALUE',
        grant: { modifierKind: 'SET_VALUE', payload: { value: 13 } } as never,
      },
      {
        domainKey: 'ARMOR_CLASS:SET_VALUE',
        modifierKind: 'SET_VALUE',
        grant: { modifierKind: 'SET_VALUE', payload: { value: 11 } } as never,
      },
    ]

    const result = resolveModifiers(entries, rules)
    expect(result['ARMOR_CLASS:SET_VALUE']).toBe(11)
  })

  it('ADVANTAGE is boolean — any truthy value = 1', () => {
    const entries: EngineAccumulatedState['modifierEntries'] = [
      {
        domainKey: 'ATTACK_ROLL:ADVANTAGE',
        modifierKind: 'ADVANTAGE',
        grant: { modifierKind: 'ADVANTAGE' } as never,
      },
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
    timing: { kind: 'IMMEDIATE' },
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
            level: 'FULL',
          } as never,
          {
            id: 'prof-athletics',
            order: 2,
            grantKind: 'PROFICIENCY_GRANT',
            proficiencyKind: 'SKILL',
            selectionKind: 'GRANTED',
            authoringModeKind: 'SELECTED',
            skillIds: ['athletics'],
            level: 'FULL',
          } as never,
        ],
        startingGold: { multiplier: 5, currencyId: 'gp', dieConfig: '5d4' },
        startingEquipment: { groups: [] } as never,
        multiclass: {
          id: 'fighter-multiclass',
          requirementGroups: {
            id: 'fighter-multiclass',
            groups: [{
              id: 'grp-str',
              requirements: [{ id: 'req-str', ability: 'STR', min: 13 }]
            }]
          }
        } as never,
      } as never,
    },
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
      equippedItems: [
        {
          instanceId: 'inst-plate',
          contentRef: { contentId: 'plate-armor', systemId: 'dnd5e2014' },
          equippedState: { slot: 'ARMOR' },
          compiledItem: {
            id: 'plate-armor',
            category: 'ARMOR',
            properties: ['HEAVY'],
            armorClass: 18,
            cost: { amount: 1500, currencyId: 'gp' },
            weight: { amount: 65, unit: 'LB' },
            rarityId: 'common',
          } as never,
        },
      ],
    })

    const output = runEngine(snapshot, makeEmptyRegistry(), dnd5e2014RulesSystem)
    expect(output.derivedStats.armorClass).toBe(18)
  })

  it('chain mail (MEDIUM, base 16) with DEX 16 → AC 18 (capped at +2)', () => {
    const snapshot = makeSnapshot({
      abilities: { STR: 16, DEX: 16, CON: 14, INT: 10, WIS: 10, CHA: 8 },
      equippedItems: [
        {
          instanceId: 'inst-chain',
          contentRef: { contentId: 'chain-mail', systemId: 'dnd5e2014' },
          equippedState: { slot: 'ARMOR' },
          compiledItem: {
            id: 'chain-mail',
            category: 'ARMOR',
            properties: ['MEDIUM'],
            armorClass: 16,
            cost: { amount: 75, currencyId: 'gp' },
            weight: { amount: 55, unit: 'LB' },
            rarityId: 'common',
            modifiers: [{
              id: 'chain-mail-dex-bonus',
              grantKind: 'MODIFIER_GRANT',
              order: 1,
              selectionKind: 'GRANTED',
              valueDomainCode: 'ARMOR_CLASS',
              domain: {},
              modifierKind: 'ABILITY_MODIFIER_BONUS',
              scope: 'GLOBAL',
              payload: { ability: 'DEXTERITY', max: 2 },
            }],
          } as never,
        },
      ],
    })

    const output = runEngine(snapshot, makeEmptyRegistry(), dnd5e2014RulesSystem)
    expect(output.derivedStats.armorClass).toBe(18) // 16 + min(3, 2) = 18
  })

  it('leather armor (LIGHT, base 11) with DEX 16 → AC 14 (full DEX +3)', () => {
    const snapshot = makeSnapshot({
      abilities: { STR: 10, DEX: 16, CON: 14, INT: 10, WIS: 10, CHA: 8 },
      equippedItems: [
        {
          instanceId: 'inst-leather',
          contentRef: { contentId: 'leather-armor', systemId: 'dnd5e2014' },
          equippedState: { slot: 'ARMOR' },
          compiledItem: {
            id: 'leather-armor',
            category: 'ARMOR',
            properties: ['LIGHT'],
            armorClass: 11,
            cost: { amount: 10, currencyId: 'gp' },
            weight: { amount: 10, unit: 'LB' },
            rarityId: 'common',
            modifiers: [{
              id: 'leather-armor-dex-bonus',
              grantKind: 'MODIFIER_GRANT',
              order: 1,
              selectionKind: 'GRANTED',
              valueDomainCode: 'ARMOR_CLASS',
              domain: {},
              modifierKind: 'ABILITY_MODIFIER_BONUS',
              scope: 'GLOBAL',
              payload: { ability: 'DEXTERITY' },
            }],
          } as never,
        },
      ],
    })

    const output = runEngine(snapshot, makeEmptyRegistry(), dnd5e2014RulesSystem)
    expect(output.derivedStats.armorClass).toBe(14) // 11 + 3
  })

  it('shield only adds +2 to unarmored AC', () => {
    const snapshot = makeSnapshot({
      abilities: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 8 },
      equippedItems: [
        {
          instanceId: 'inst-shield',
          contentRef: { contentId: 'shield', systemId: 'dnd5e2014' },
          equippedState: { slot: 'SHIELD' },
          compiledItem: {
            id: 'shield',
            category: 'SHIELD',
            properties: [],
            armorClass: 2,
            cost: { amount: 10, currencyId: 'gp' },
            weight: { amount: 6, unit: 'LB' },
            rarityId: 'common',
          } as never,
        },
      ],
    })

    const output = runEngine(snapshot, makeEmptyRegistry(), dnd5e2014RulesSystem)
    // Unarmored: 10 + 1 (DEX) + 2 (shield) = 13
    expect(output.derivedStats.armorClass).toBe(13)
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

