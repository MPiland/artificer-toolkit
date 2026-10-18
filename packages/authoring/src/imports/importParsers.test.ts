import { describe, expect, it } from 'vitest'
import { IMPORT_MAX_FOUNDRY_ITEMS } from '@artificer-toolkit/schema/api/imports'

import {
  parseDndBeyondCharacterPayload,
  parseDndBeyondCharacterUrl,
  parseFoundryActorPayload,
  sanitizeImportedRichText
} from './importParsers.js'

describe('import parsers', () => {
  it('accepts only normal HTTPS D&D Beyond character-sheet links', () => {
    expect(parseDndBeyondCharacterUrl('https://www.dndbeyond.com/characters/74476867')).toBe(
      '74476867'
    )
    expect(
      parseDndBeyondCharacterUrl(
        'https://character-service.dndbeyond.com/character/v5/character/74476867'
      )
    ).toBeNull()
    expect(parseDndBeyondCharacterUrl('https://example.com/characters/74476867')).toBeNull()
    expect(parseDndBeyondCharacterUrl('http://www.dndbeyond.com/characters/74476867')).toBeNull()
  })

  it('maps safe D&D Beyond fields and retains external identifiers for exact matching', () => {
    const parsed = parseDndBeyondCharacterPayload(
      {
        data: {
          id: 74476867,
          name: 'Aria',
          stats: [1, 2, 3, 4, 5, 6].map((id) => ({ id, value: 10 + id })),
          race: { baseRaceId: 3, entityRaceId: 31, fullName: 'High Elf' },
          background: { definition: { id: 4, name: 'Sage' } },
          classes: [{ level: 2, definition: { id: 5, name: 'Wizard' } }],
          inventory: [
            {
              quantity: 2,
              equipped: true,
              definition: {
                id: 6,
                name: 'Dagger',
                isHomebrew: true,
                description: '<p>Custom blade</p>'
              }
            }
          ],
          feats: [
            {
              definition: {
                id: 10,
                name: 'Roadwise',
                isHomebrew: true,
                description: '<p>Never lost</p>'
              }
            }
          ],
          modifiers: { race: [{ type: 'bonus', subType: 'speed', value: 5 }] },
          spells: {
            race: [{ definition: { id: 8, name: 'Light' } }],
            class: null
          },
          classSpells: [
            {
              spells: [
                { definition: { id: 8, name: 'Light' } },
                {
                  definition: {
                    id: 9,
                    name: 'Shield',
                    isHomebrew: true,
                    description: '<p>Custom ward</p>'
                  }
                }
              ]
            }
          ],
          customItems: [
            { id: 6, name: 'Duplicate dagger', description: '<p>Duplicate</p>' },
            { id: 7, name: 'Keepsake', description: '<p>Old coin</p>' }
          ]
        }
      },
      '74476867'
    )

    expect(parsed).toMatchObject({
      externalId: '74476867',
      label: 'Aria',
      abilities: { STRENGTH: 11, CHARISMA: 16 }
    })
    expect(parsed?.references.map((reference) => reference.externalId)).toEqual([
      '3',
      '4',
      '5',
      '6',
      '10',
      '8',
      '9'
    ])
    expect(
      parsed?.customContent.map((content) => `${content.subjectKind}:${content.externalId}`)
    ).toEqual(['EQUIPMENT:6', 'EQUIPMENT:7', 'FEAT:10', 'SPELL:9'])
    expect(parsed?.issues).toContainEqual(
      expect.objectContaining({
        code: 'DND_BEYOND_MECHANICS_NOT_IMPORTED',
        path: ['modifiers'],
        severity: 'INFO',
        correctionRequired: false
      })
    )
    expect(
      parsed?.references
        .filter((reference) => reference.role === 'SPELL')
        .map((reference) => reference.externalId)
    ).toEqual(['8', '9'])
  })

  it('accepts dnd5e character Actors and reports ignored Foundry presentation data', () => {
    const parsed = parseFoundryActorPayload({
      _id: 'actor-1',
      name: 'Aria',
      type: 'character',
      _stats: { systemId: 'dnd5e' },
      prototypeToken: { name: 'Do not import' },
      system: {
        abilities: Object.fromEntries(
          ['str', 'dex', 'con', 'int', 'wis', 'cha'].map((key) => [key, { value: 12 }])
        ),
        attributes: { hp: { value: 8 } },
        details: { biography: { value: '<p>Story</p><script>alert(1)</script>' } }
      },
      items: [
        {
          _id: 'class-1',
          name: 'Wizard',
          type: 'class',
          system: { levels: 2 },
          flags: { core: { sourceId: 'Compendium.dnd5e.classes.Item.wizard' } }
        },
        {
          _id: 'blade-1',
          name: 'Moon Blade',
          type: 'weapon',
          system: {
            quantity: 2,
            equipped: true,
            attunement: 2,
            description: { value: '<p>Forged under starlight.</p>' }
          }
        }
      ]
    })

    expect(parsed?.issues).toContainEqual(
      expect.objectContaining({ code: 'IGNORED_FOUNDRY_PRESENTATION' })
    )
    expect(parsed?.issues).toContainEqual(
      expect.objectContaining({ code: 'FOUNDRY_MECHANICS_REQUIRE_REVIEW' })
    )
    expect(parsed?.description).not.toContain('<script')
    expect(parsed?.references[0]).toMatchObject({
      externalId: 'class-1',
      role: 'CLASS',
      level: 2
    })
    expect(parsed?.references[1]).toMatchObject({
      externalId: 'blade-1',
      role: 'EQUIPMENT',
      quantity: 2,
      equipped: true,
      attuned: true
    })
    expect(parsed?.customContent[0]).toMatchObject({
      externalId: 'blade-1',
      label: 'Moon Blade',
      subjectKind: 'EQUIPMENT'
    })
    expect(
      parseFoundryActorPayload({
        _id: 'actor-2',
        name: 'Wrong system',
        type: 'character',
        _stats: { systemId: 'pf2e' },
        system: {},
        items: []
      })
    ).toBeNull()
    expect(
      parseFoundryActorPayload({
        _id: 'actor-3',
        name: 'Missing system',
        type: 'character',
        system: {},
        items: []
      })
    ).toBeNull()
  })

  it('rejects Foundry actors with too many items before iterating them', () => {
    expect(
      parseFoundryActorPayload({
        _id: 'actor-too-large',
        name: 'Aria',
        type: 'character',
        _stats: { systemId: 'dnd5e' },
        system: {},
        items: Array.from({ length: IMPORT_MAX_FOUNDRY_ITEMS + 1 }, () => ({
          type: 'weapon',
          name: 'Overflow'
        }))
      })
    ).toBeNull()
  })

  describe('custom Equipment mapping', () => {
    const dndBeyondEquipment = (inventory: unknown[], customItems: unknown[] = []) =>
      parseDndBeyondCharacterPayload({ data: { id: 1, name: 'Aria', inventory, customItems } }, '1')
        ?.customContent ?? []
    const homebrew = (definition: Record<string, unknown>) => ({
      quantity: 1,
      equipped: true,
      definition: { isHomebrew: true, description: '', ...definition }
    })
    const foundryEquipment = (items: unknown[]) =>
      parseFoundryActorPayload({
        _id: 'actor-1',
        name: 'Aria',
        type: 'character',
        _stats: { systemId: 'dnd5e' },
        system: {},
        items
      })
    const foundryItem = (type: string, name: string, system: Record<string, unknown>) => ({
      _id: `${name}-id`,
      name,
      type,
      system
    })

    it('maps a D&D Beyond two-handed weapon to a two-handed weapon attack', () => {
      const [greatsword] = dndBeyondEquipment([
        homebrew({
          id: 100,
          name: 'Moonlit Greatsword',
          filterType: 'Weapon',
          attackType: 1,
          range: 5,
          longRange: 5,
          damage: { diceString: '2d6' },
          damageType: 'Slashing',
          canAttune: true,
          magic: true,
          properties: [{ name: 'Heavy' }, { name: 'Two-Handed' }, { name: 'Stealth' }]
        })
      ])
      expect(greatsword?.payload).toMatchObject({
        category: 'WEAPON',
        properties: ['MELEE', 'HEAVY', 'TWO_HANDED', 'MAGIC'],
        requiresAttunement: true
      })
      expect(greatsword?.weaponAttack).toEqual({
        damageTypeName: 'Slashing',
        dice: '2d6',
        grip: 'TWO_HANDED',
        meleeReachFeet: 5
      })
    })

    it('maps a D&D Beyond versatile ranged-thrown weapon with its two-handed dice', () => {
      const [spear] = dndBeyondEquipment([
        homebrew({
          id: 101,
          name: 'Heron Spear',
          filterType: 'Weapon',
          attackType: 1,
          range: 20,
          longRange: 60,
          damage: { diceString: '1d6' },
          damageType: 'Piercing',
          properties: [{ name: 'Thrown' }, { name: 'Versatile', notes: '1d8' }]
        })
      ])
      expect(spear?.payload).toMatchObject({
        category: 'WEAPON',
        properties: ['MELEE', 'THROWN', 'VERSATILE']
      })
      expect(spear?.weaponAttack).toEqual({
        damageTypeName: 'Piercing',
        dice: '1d6',
        versatileDice: '1d8',
        grip: 'ONE_HANDED',
        meleeReachFeet: 5,
        ranged: { normalFeet: 20, longFeet: 60 }
      })
    })

    it('maps a D&D Beyond ranged weapon with its normal and long range', () => {
      const [bow] = dndBeyondEquipment([
        homebrew({
          id: 102,
          name: 'Gale Bow',
          filterType: 'Weapon',
          attackType: 2,
          range: 150,
          longRange: 600,
          damage: { diceString: '1d8' },
          damageType: 'Piercing',
          properties: [{ name: 'Ammunition' }, { name: 'Two-Handed' }]
        })
      ])
      expect(bow?.payload).toMatchObject({
        category: 'WEAPON',
        properties: ['RANGED', 'AMMUNITION', 'TWO_HANDED']
      })
      expect(bow?.weaponAttack).toEqual({
        damageTypeName: 'Piercing',
        dice: '1d8',
        grip: 'TWO_HANDED',
        ranged: { normalFeet: 150, longFeet: 600 }
      })
    })

    it('maps D&D Beyond armor and shields with their armor class and no attack', () => {
      const [armor, shield, gear] = dndBeyondEquipment([
        homebrew({
          id: 110,
          name: 'Dusk Mail',
          filterType: 'Armor',
          armorTypeId: 2,
          armorClass: 14
        }),
        homebrew({
          id: 111,
          name: 'Aegis',
          filterType: 'Armor',
          armorTypeId: 4,
          armorClass: 2
        }),
        homebrew({ id: 112, name: 'Rope', filterType: 'Other Gear' })
      ])
      expect(armor?.payload).toMatchObject({
        category: 'ARMOR',
        properties: ['MEDIUM'],
        armorClass: 14
      })
      expect(shield?.payload).toMatchObject({ category: 'SHIELD', properties: [], armorClass: 2 })
      expect(gear?.payload).toMatchObject({ category: 'ADVENTURING_GEAR', properties: [] })
      expect(gear?.payload).not.toHaveProperty('armorClass')
      expect([armor, shield, gear].map((content) => content?.weaponAttack)).toEqual([
        undefined,
        undefined,
        undefined
      ])
    })

    it('keeps D&D Beyond custom items without type fields as adventuring gear', () => {
      const [keepsake] = dndBeyondEquipment([], [{ id: 7, name: 'Keepsake', description: 'Coin' }])
      expect(keepsake?.payload).toMatchObject({ category: 'ADVENTURING_GEAR', properties: [] })
      expect(keepsake?.weaponAttack).toBeUndefined()
    })

    describe('trimmed real D&D Beyond definitions', () => {
      it('maps a homebrew magic finesse shortsword with its rarity, weight and +1 bonus', () => {
        const [astralTear] = dndBeyondEquipment([
          homebrew({
            id: 200,
            name: 'The Astral Tear Awakened',
            filterType: 'Weapon',
            type: 'Shortsword',
            attackType: 1,
            range: 5,
            longRange: 5,
            damage: { diceString: '1d6' },
            damageType: 'Piercing',
            properties: [{ name: 'Finesse' }, { name: 'Light' }, { name: 'Vex' }],
            magic: true,
            canAttune: true,
            rarity: 'Legendary',
            grantedModifiers: [{ type: 'bonus', subType: 'magic', value: 1 }],
            weight: 2.0,
            cost: null
          })
        ])
        expect(astralTear?.payload).toMatchObject({
          category: 'WEAPON',
          properties: ['MELEE', 'FINESSE', 'LIGHT', 'MAGIC'],
          requiresAttunement: true,
          weight: { amount: 2, unit: 'POUNDS' }
        })
        expect(astralTear).toMatchObject({
          magicBonus: 1,
          rarityName: 'Legendary',
          weaponAttack: {
            damageTypeName: 'Piercing',
            dice: '1d6',
            grip: 'ONE_HANDED',
            meleeReachFeet: 5
          }
        })
        expect(astralTear).not.toHaveProperty('costGold')
      })

      it('maps a versatile longsword, dropping the weapon mastery property, with its price', () => {
        const [longsword] = dndBeyondEquipment([
          homebrew({
            id: 201,
            name: 'Longsword',
            filterType: 'Weapon',
            type: 'Longsword',
            attackType: 1,
            range: 5,
            longRange: 5,
            damage: { diceString: '1d8' },
            damageType: 'Slashing',
            properties: [{ name: 'Versatile', notes: '1d10' }, { name: 'Sap' }],
            magic: false,
            rarity: 'Common',
            weight: 3.0,
            cost: 15.0
          })
        ])
        expect(longsword?.payload).toMatchObject({
          properties: ['MELEE', 'VERSATILE'],
          weight: { amount: 3, unit: 'POUNDS' }
        })
        expect(longsword).toMatchObject({
          costGold: 15,
          rarityName: 'Common',
          weaponAttack: { dice: '1d8', versatileDice: '1d10' }
        })
        expect(longsword).not.toHaveProperty('magicBonus')
      })

      it('maps magic light armor with its +1 armor class bonus', () => {
        const [studdedLeather] = dndBeyondEquipment([
          homebrew({
            id: 202,
            name: 'Studded Leather, +1',
            filterType: 'Armor',
            armorTypeId: 1,
            armorClass: 12,
            magic: true,
            rarity: 'Rare',
            grantedModifiers: [{ type: 'bonus', subType: 'armor-class', value: 1 }],
            weight: 13.0,
            baseArmorName: 'Studded Leather',
            strengthRequirement: 0,
            stealthCheck: 1
          })
        ])
        expect(studdedLeather?.payload).toMatchObject({
          category: 'ARMOR',
          properties: ['LIGHT', 'MAGIC'],
          armorClass: 12
        })
        expect(studdedLeather).toMatchObject({ magicBonus: 1, rarityName: 'Rare' })
        // The real definition states no Strength requirement (0) and no stealth penalty (1).
        expect(studdedLeather).not.toHaveProperty('strengthRequirement')
        expect(studdedLeather).not.toHaveProperty('stealthDisadvantage')
      })

      it('maps a D&D Beyond Strength requirement and stealth penalty on heavy armor', () => {
        const [plate, shield] = dndBeyondEquipment([
          homebrew({
            id: 205,
            name: 'Bastion Plate',
            filterType: 'Armor',
            armorTypeId: 3,
            armorClass: 18,
            strengthRequirement: 15,
            stealthCheck: 2
          }),
          homebrew({
            id: 206,
            name: 'Aegis',
            filterType: 'Armor',
            armorTypeId: 4,
            armorClass: 2,
            strengthRequirement: 13,
            stealthCheck: 2
          })
        ])
        expect(plate).toMatchObject({ strengthRequirement: 15, stealthDisadvantage: true })
        expect(shield).not.toHaveProperty('stealthDisadvantage')
        expect(shield).not.toHaveProperty('strengthRequirement')
      })

      it('maps a tool by its gear type and a wondrous item by its filter type', () => {
        const [tools, goggles] = dndBeyondEquipment([
          homebrew({
            id: 203,
            name: "Thieves' Tools",
            filterType: 'Other Gear',
            type: 'Gear',
            subType: 'Tool',
            gearTypeId: 11,
            magic: false,
            rarity: 'Common',
            weight: 1.0,
            cost: 25.0
          }),
          homebrew({
            id: 204,
            name: 'Goggles of Night',
            filterType: 'Wondrous item',
            type: 'Wondrous item',
            gearTypeId: 10,
            magic: true,
            rarity: 'Uncommon',
            weight: 0,
            grantedModifiers: [{ type: 'sense', subType: 'darkvision', value: 60 }]
          })
        ])
        expect(tools?.payload).toMatchObject({
          category: 'TOOL',
          properties: [],
          weight: { amount: 1, unit: 'POUNDS' }
        })
        expect(tools).toMatchObject({ costGold: 25, rarityName: 'Common' })
        expect(goggles?.payload).toMatchObject({
          category: 'ADVENTURING_GEAR',
          properties: ['WONDEROUS_ITEM', 'MAGIC']
        })
        expect(goggles?.payload).not.toHaveProperty('weight')
        expect(goggles).toMatchObject({ rarityName: 'Uncommon' })
        expect(goggles).not.toHaveProperty('magicBonus')
      })

      it('maps potions and scrolls to their property and leaves rings and wands without one', () => {
        const [potion, scroll, ring, wand] = dndBeyondEquipment(
          ['Potion', 'Scroll', 'Ring', 'Wand'].map((filterType, index) =>
            homebrew({ id: 210 + index, name: filterType, filterType })
          )
        )
        expect(potion?.payload).toMatchObject({ properties: ['POTION'] })
        expect(scroll?.payload).toMatchObject({ properties: ['SCROLL'] })
        expect(ring?.payload).toMatchObject({ properties: [] })
        expect(wand?.payload).toMatchObject({ properties: [] })
      })

      it('keeps the price and weight of a custom item and ignores an unusable price', () => {
        const [flask, bead, claw] = dndBeyondEquipment(
          [],
          [
            { id: 300, name: 'Everlasting Flask', weight: 1.5, cost: 12, quantity: 1 },
            { id: 301, name: 'Bead of Nourishment', weight: null, cost: null, quantity: 10 },
            { id: 302, name: 'Owlbear Claw', weight: 0.0, cost: 0, quantity: 4 }
          ]
        )
        expect(flask?.payload).toMatchObject({
          category: 'ADVENTURING_GEAR',
          weight: { amount: 1.5, unit: 'POUNDS' }
        })
        expect(flask).toMatchObject({ costGold: 12 })
        for (const content of [bead, claw]) {
          expect(content?.payload).not.toHaveProperty('weight')
          expect(content).not.toHaveProperty('costGold')
        }
      })
    })

    it('reports a weapon whose damage cannot be read instead of guessing it', () => {
      const parsed = parseDndBeyondCharacterPayload(
        {
          data: {
            id: 1,
            name: 'Aria',
            inventory: [
              homebrew({
                id: 103,
                name: 'Odd Blade',
                filterType: 'Weapon',
                attackType: 1,
                damage: { diceString: '1d8 + 1d6' },
                damageType: 'Slashing'
              })
            ]
          }
        },
        '1'
      )
      expect(parsed?.customContent[0]?.payload).toMatchObject({ category: 'WEAPON' })
      expect(parsed?.customContent[0]?.weaponAttack).toBeUndefined()
      expect(parsed?.issues).toContainEqual(
        expect.objectContaining({
          code: 'CUSTOM_WEAPON_ATTACK_NOT_IMPORTED',
          severity: 'INFO',
          path: ['inventory', 0, 'definition'],
          correctionRequired: false
        })
      )
    })

    it('maps a Foundry v4 two-handed weapon with array properties', () => {
      const parsed = foundryEquipment([
        foundryItem('weapon', 'Maul of Dawn', {
          type: { value: 'martialM' },
          properties: ['hvy', 'two', 'mgc', 'sil'],
          damage: { base: { number: 2, denomination: 6, types: ['bludgeoning'] } },
          range: { value: 5, units: 'ft' },
          attunement: 'required',
          equipped: true
        })
      ])
      expect(parsed?.customContent[0]?.payload).toMatchObject({
        category: 'WEAPON',
        properties: ['MARTIAL', 'MELEE', 'HEAVY', 'TWO_HANDED', 'MAGIC'],
        requiresAttunement: true
      })
      expect(parsed?.customContent[0]?.weaponAttack).toEqual({
        damageTypeName: 'bludgeoning',
        dice: '2d6',
        grip: 'TWO_HANDED',
        meleeReachFeet: 5
      })
    })

    it('maps a Foundry legacy versatile weapon with object properties and damage parts', () => {
      const parsed = foundryEquipment([
        foundryItem('weapon', 'Old Longsword', {
          type: { value: 'martialM' },
          properties: { ver: true, fin: false },
          damage: { parts: [['1d8 + @mod', 'slashing']], versatile: '1d10 + @mod' }
        })
      ])
      expect(parsed?.customContent[0]?.payload).toMatchObject({
        category: 'WEAPON',
        properties: ['MARTIAL', 'MELEE', 'VERSATILE']
      })
      expect(parsed?.customContent[0]?.weaponAttack).toEqual({
        damageTypeName: 'slashing',
        dice: '1d8',
        versatileDice: '1d10',
        grip: 'ONE_HANDED',
        meleeReachFeet: 5
      })
    })

    it('maps a Foundry ranged weapon, a shield, armor and plain loot', () => {
      const parsed = foundryEquipment([
        foundryItem('weapon', 'Hand Crossbow', {
          type: { value: 'martialR' },
          properties: ['amm', 'lgt', 'lod'],
          damage: { base: { number: 1, denomination: 6, types: ['piercing'] } },
          range: { value: 30, long: 120, units: 'ft' }
        }),
        foundryItem('equipment', 'Ward Shield', {
          type: { value: 'shield' },
          armor: { value: 2 }
        }),
        foundryItem('equipment', 'Hide Coat', {
          type: { value: 'medium' },
          armor: { value: 12 }
        }),
        foundryItem('loot', 'Trinket', {}),
        foundryItem('tool', 'Thieves Tools', {})
      ])
      const [crossbow, shield, armor, loot, tool] = parsed?.customContent ?? []
      expect(crossbow?.payload).toMatchObject({
        category: 'WEAPON',
        properties: ['MARTIAL', 'RANGED', 'AMMUNITION', 'LIGHT', 'LOADING']
      })
      expect(crossbow?.weaponAttack).toEqual({
        damageTypeName: 'piercing',
        dice: '1d6',
        grip: 'ONE_HANDED',
        ranged: { normalFeet: 30, longFeet: 120 }
      })
      expect(shield?.payload).toMatchObject({ category: 'SHIELD', armorClass: 2 })
      expect(armor?.payload).toMatchObject({
        category: 'ARMOR',
        properties: ['MEDIUM'],
        armorClass: 12
      })
      expect(loot?.payload).toMatchObject({ category: 'ADVENTURING_GEAR', properties: [] })
      expect(tool?.payload).toMatchObject({ category: 'TOOL' })
    })

    it('maps a Foundry Strength requirement and stealth disadvantage on armor only', () => {
      const parsed = foundryEquipment([
        foundryItem('equipment', 'Iron Plate', {
          type: { value: 'heavy' },
          armor: { value: 18 },
          strength: 15,
          properties: ['mgc', 'stealthDisadvantage']
        }),
        foundryItem('equipment', 'Quiet Mail', {
          type: { value: 'medium' },
          armor: { value: 14 },
          strength: null,
          properties: ['mgc']
        }),
        foundryItem('equipment', 'Ward Shield', {
          type: { value: 'shield' },
          armor: { value: 2 },
          strength: 13,
          properties: ['stealthDisadvantage']
        })
      ])
      const [plate, quiet, shield] = parsed?.customContent ?? []
      expect(plate).toMatchObject({ strengthRequirement: 15, stealthDisadvantage: true })
      expect(quiet).not.toHaveProperty('strengthRequirement')
      expect(quiet).not.toHaveProperty('stealthDisadvantage')
      expect(shield).not.toHaveProperty('strengthRequirement')
      expect(shield).not.toHaveProperty('stealthDisadvantage')
    })

    it('does not import Foundry weapon damage with more than one damage type', () => {
      const parsed = foundryEquipment([
        foundryItem('weapon', 'Prism Blade', {
          type: { value: 'martialM' },
          damage: { base: { number: 1, denomination: 8, types: ['fire', 'cold'] } }
        })
      ])
      expect(parsed?.customContent[0]?.weaponAttack).toBeUndefined()
      expect(parsed?.issues).toContainEqual(
        expect.objectContaining({ code: 'CUSTOM_WEAPON_ATTACK_NOT_IMPORTED', path: ['items', 0] })
      )
    })
  })

  describe('an imported entry missing its name, level or quantity', () => {
    const incomplete = (path: Array<string | number>) =>
      expect.objectContaining({ severity: 'WARNING', code: 'IMPORTED_ENTRY_INCOMPLETE', path })

    it('warns in the preview and leaves a D&D Beyond entry out instead of inventing a value', () => {
      const parsed = parseDndBeyondCharacterPayload(
        {
          data: {
            id: 1,
            name: 'Aria',
            race: { baseRaceId: 3 },
            background: { definition: { id: 4 } },
            classes: [
              { definition: { id: 5, name: 'Wizard' } },
              { level: 1, definition: { id: 6 } },
              { level: 2, definition: { id: 7, name: 'Cleric' } }
            ],
            inventory: [
              { definition: { id: 8, name: 'Dagger' } },
              { quantity: 1, definition: { id: 9 } }
            ],
            customItems: [{ id: 10 }],
            feats: [{ definition: { id: 11 } }],
            spells: [{ definition: { id: 12 } }]
          }
        },
        '1'
      )
      expect(parsed?.references.map((reference) => reference.label)).toEqual(['Cleric'])
      expect(parsed?.references[0]?.level).toBe(2)
      expect(parsed?.customContent).toEqual([])
      expect(parsed?.issues).toEqual(
        expect.arrayContaining([
          incomplete(['race']),
          incomplete(['background']),
          incomplete(['classes', 0]),
          incomplete(['classes', 1]),
          incomplete(['inventory', 0]),
          incomplete(['inventory', 1]),
          incomplete(['customItems', 0]),
          incomplete(['feats', 0]),
          incomplete(['spells', 0])
        ])
      )
    })

    it('warns in the preview and leaves a Foundry item out instead of inventing a value', () => {
      const parsed = parseFoundryActorPayload({
        _id: 'actor-1',
        name: 'Aria',
        type: 'character',
        _stats: { systemId: 'dnd5e' },
        system: {},
        items: [
          { _id: 'nameless', type: 'loot', system: { quantity: 1 } },
          { _id: 'wizard', name: 'Wizard', type: 'class', system: {} },
          { _id: 'rope', name: 'Rope', type: 'loot', system: {} },
          { _id: 'torch', name: 'Torch', type: 'loot', system: { quantity: 3 } }
        ]
      })
      expect(parsed?.references.map((reference) => [reference.label, reference.quantity])).toEqual([
        ['Torch', 3]
      ])
      expect(parsed?.issues).toEqual(
        expect.arrayContaining([
          incomplete(['items', 0]),
          incomplete(['items', 1]),
          incomplete(['items', 2])
        ])
      )
    })
  })

  it('removes executable markup and attributes from imported rich text', () => {
    const result = sanitizeImportedRichText(
      '<p onclick="steal()" style="color:red">Safe</p><script>alert(1)</script><a href=jav&#x61;script:steal()>link</a><img src=x onerror=steal()>'
    )
    expect(result).toBe('<p>Safe</p><a>link</a>')
  })
})
