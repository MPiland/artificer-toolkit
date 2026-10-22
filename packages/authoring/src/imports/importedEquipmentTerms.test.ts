import { describe, expect, it } from 'vitest'
import {
  finesseWeaponModifiers,
  finesseWeaponWithRangedModifiers,
  heavyArmorStrengthModifier,
  heavyMeleeWeaponModifiers,
  heavyRangedWeaponModifiers,
  lightArmorModifiers,
  magicArmorModifiers,
  mediumArmorModifiers,
  meleeMagicWeaponModifiers,
  meleeWeaponAbilityModifiers,
  rangedMagicWeaponModifiers,
  rangedWeaponAbilityModifiers,
  stealthDisadvantageModifier,
  thrownMagicWeaponModifiers,
  thrownWeaponAbilityModifiers,
  type EquipmentChildId
} from '@artificer-toolkit/shared/authored'

import {
  SRD_DWARVEN_HERITAGE_ID,
  SRD_GOLD_CURRENCY_ID,
  SRD_STEALTH_SKILL_ID,
  SRD_WALK_SPEED_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { applyImportedEquipmentTerms } from './importedEquipmentTerms.js'

function sequentialIds() {
  let next = 0
  return () => `00000000-0000-4000-8000-${(++next).toString().padStart(12, '0')}`
}

type GrantBuilder = (childId: EquipmentChildId) => unknown[]

/**
 * The grants an import must carry: the shared builders' output, ordered one after another. The
 * builders draw ids from the same sequence the import does, in the same order.
 */
function expectedGrants(...builders: GrantBuilder[]) {
  const createId = sequentialIds()
  return builders
    .flatMap((build) => build(() => createId()))
    .map((grant, index) => ({ ...(grant as Record<string, unknown>), order: index + 1 }))
}

const vocabulary = {
  rarities: [
    { id: 'rarity-common', code: 'COMMON', label: 'Common' },
    { id: 'rarity-very-rare', code: 'VERY_RARE', label: 'Very Rare' },
    { id: 'rarity-legendary', code: 'LEGENDARY', label: 'Legendary' }
  ],
  currencies: [
    { id: 'currency-sp', code: 'SP', label: 'Silver' },
    { id: SRD_GOLD_CURRENCY_ID, code: 'GP', label: 'Gold' }
  ],
  speeds: [
    { id: SRD_WALK_SPEED_ID, code: 'WALK', label: 'Walking Speed' },
    { id: 'speed-fly', code: 'FLY', label: 'Flying Speed' }
  ],
  skills: [
    { id: SRD_STEALTH_SKILL_ID, code: 'STEALTH', label: 'Stealth' },
    { id: 'skill-athletics', code: 'ATHLETICS', label: 'Athletics' }
  ],
  heritages: [{ id: SRD_DWARVEN_HERITAGE_ID, code: 'DWARVEN', label: 'Dwarven' }]
}

type TermsExtra = Partial<
  Pick<
    Parameters<typeof applyImportedEquipmentTerms>[0],
    'magicBonus' | 'rarityName' | 'costGold' | 'strengthRequirement' | 'stealthDisadvantage'
  >
>

function termsResult(
  category: string,
  properties: string[],
  extra: TermsExtra = {},
  system: typeof vocabulary = vocabulary
) {
  return applyImportedEquipmentTerms(
    {
      label: 'Imported item',
      path: ['inventory', 0],
      payload: { kind: 'EQUIPMENT', category, rarityId: '', properties },
      ...extra
    },
    system,
    sequentialIds()
  )
}

function terms(category: string, properties: string[], extra: TermsExtra = {}) {
  return termsResult(category, properties, extra).payload
}

describe('applyImportedEquipmentTerms grants', () => {
  it.each<[string, string[], GrantBuilder]>([
    ['a melee weapon', ['MELEE'], meleeWeaponAbilityModifiers],
    ['a finesse weapon', ['MELEE', 'FINESSE'], finesseWeaponModifiers],
    ['a heavy melee weapon', ['MELEE', 'HEAVY'], heavyMeleeWeaponModifiers],
    ['a thrown weapon', ['MELEE', 'THROWN'], thrownWeaponAbilityModifiers],
    ['a finesse thrown weapon', ['MELEE', 'FINESSE', 'THROWN'], finesseWeaponWithRangedModifiers],
    [
      'a ranged weapon',
      ['RANGED', 'AMMUNITION'],
      (childId) => rangedWeaponAbilityModifiers(childId)
    ],
    ['a heavy ranged weapon', ['RANGED', 'HEAVY'], heavyRangedWeaponModifiers]
  ])(
    'gives %s the grants of the SRD weapon with the same properties',
    (_name, properties, build) => {
      expect(terms('WEAPON', properties).modifiers).toEqual(expectedGrants(build))
    }
  )

  it.each<
    [string, string[], GrantBuilder, (childId: EquipmentChildId, bonus: number) => unknown[]]
  >([
    ['melee', ['MELEE', 'FINESSE'], finesseWeaponModifiers, meleeMagicWeaponModifiers],
    [
      'ranged',
      ['RANGED'],
      (childId) => rangedWeaponAbilityModifiers(childId),
      rangedMagicWeaponModifiers
    ],
    ['thrown', ['MELEE', 'THROWN'], thrownWeaponAbilityModifiers, thrownMagicWeaponModifiers]
  ])('adds the +2 magic bonus grants of a %s weapon', (_name, properties, ability, magic) => {
    expect(terms('WEAPON', properties, { magicBonus: 2 }).modifiers).toEqual(
      expectedGrants(ability, (childId) => magic(childId, 2))
    )
  })

  it('gives light and medium armor the Dexterity grants of the SRD armor', () => {
    expect(terms('ARMOR', ['LIGHT']).modifiers).toEqual(expectedGrants(lightArmorModifiers))
    expect(terms('ARMOR', ['MEDIUM']).modifiers).toEqual(expectedGrants(mediumArmorModifiers))
  })

  it('adds the magic armor class bonus to armor and shields and nothing to plain heavy armor', () => {
    expect(terms('ARMOR', ['LIGHT', 'MAGIC'], { magicBonus: 1 }).modifiers).toEqual(
      expectedGrants(lightArmorModifiers, (childId) => magicArmorModifiers(childId, 1))
    )
    expect(terms('SHIELD', [], { magicBonus: 1 }).modifiers).toEqual(
      expectedGrants((childId) => magicArmorModifiers(childId, 1))
    )
    expect(terms('ARMOR', ['HEAVY'])).not.toHaveProperty('modifiers')
  })

  it('leaves equipment without a grant shape untouched', () => {
    expect(terms('WEAPON', [])).not.toHaveProperty('modifiers')
    expect(terms('ADVENTURING_GEAR', ['MAGIC'], { magicBonus: 1 })).not.toHaveProperty('modifiers')
  })

  it('gives every grant and restriction node its own id', () => {
    const ids = JSON.stringify(
      terms('WEAPON', ['MELEE', 'THROWN'], { magicBonus: 1 }).modifiers
    ).match(/"id":"[^"]+"/g)
    expect(ids?.length).toBeGreaterThan(8)
    expect(new Set(ids).size).toBe(ids?.length)
  })
})

describe('applyImportedEquipmentTerms rarity and price', () => {
  it('resolves the rarity by label or code and the price through the gold currency', () => {
    expect(terms('WEAPON', [], { rarityName: 'Legendary', costGold: 15 })).toMatchObject({
      rarityId: 'rarity-legendary',
      cost: { amount: 15, currencyId: SRD_GOLD_CURRENCY_ID }
    })
    expect(terms('WEAPON', [], { rarityName: 'very rare' })).toMatchObject({
      rarityId: 'rarity-very-rare'
    })
  })

  it('never guesses a rarity or currency the System does not have', () => {
    expect(terms('WEAPON', [], { rarityName: 'Unknown Rarity' })).toMatchObject({ rarityId: '' })
    const withoutGold = applyImportedEquipmentTerms(
      { label: 'Coin purse', path: [], payload: { rarityId: '' }, costGold: 5 },
      { ...vocabulary, rarities: [], currencies: [vocabulary.currencies[0]!] },
      sequentialIds()
    ).payload
    expect(withoutGold).not.toHaveProperty('cost')
    expect(withoutGold).toMatchObject({ rarityId: '' })
  })
})

describe('applyImportedEquipmentTerms definition ids', () => {
  const renamed = {
    ...vocabulary,
    currencies: [{ id: SRD_GOLD_CURRENCY_ID, code: 'GOLD', label: 'Crown' }],
    speeds: [{ id: SRD_WALK_SPEED_ID, code: 'FOOT', label: 'Foot' }],
    skills: [{ id: SRD_STEALTH_SKILL_ID, code: 'SNEAK', label: 'Sneak' }],
    heritages: [{ id: SRD_DWARVEN_HERITAGE_ID, code: 'DEEPFOLK', label: 'Deepfolk' }]
  }

  it('resolves gold, walking speed, Stealth and Dwarven by definition id whatever their codes', () => {
    const result = termsResult(
      'ARMOR',
      ['HEAVY'],
      { costGold: 5, strengthRequirement: 15, stealthDisadvantage: true },
      renamed
    )
    expect(result.payload).toMatchObject({ cost: { amount: 5, currencyId: SRD_GOLD_CURRENCY_ID } })
    expect(result.payload.modifiers).toHaveLength(2)
    expect(result.issues).toEqual([])
  })

  it('does not take a code match for the definition', () => {
    const impostor = {
      ...vocabulary,
      currencies: [{ id: 'other-gp', code: 'GP', label: 'Gold' }],
      skills: [{ id: 'other-stealth', code: 'STEALTH', label: 'Stealth' }]
    }
    const result = termsResult(
      'ARMOR',
      ['HEAVY'],
      { costGold: 5, stealthDisadvantage: true },
      impostor
    )
    expect(result.payload).not.toHaveProperty('cost')
    expect(result.issues).toEqual([expect.objectContaining({ code: 'UNKNOWN_ARMOR_VOCABULARY' })])
  })
})

describe('applyImportedEquipmentTerms armor rules', () => {
  const stealth = (childId: EquipmentChildId) => [
    stealthDisadvantageModifier(childId, SRD_STEALTH_SKILL_ID)
  ]
  const strength = (requirement: number) => (childId: EquipmentChildId) => [
    heavyArmorStrengthModifier(
      childId,
      { walkSpeedId: SRD_WALK_SPEED_ID, dwarvenHeritageId: SRD_DWARVEN_HERITAGE_ID },
      requirement
    )
  ]

  it('gives heavy armor the stealth and Strength grants of the SRD heavy armor', () => {
    const result = termsResult('ARMOR', ['HEAVY'], {
      strengthRequirement: 15,
      stealthDisadvantage: true
    })
    expect(result.payload.modifiers).toEqual(expectedGrants(stealth, strength(15)))
    expect(result.issues).toEqual([])
  })

  it('places the armor rule grants between the Dexterity grants and the magic bonus', () => {
    expect(
      termsResult('ARMOR', ['MEDIUM', 'MAGIC'], {
        strengthRequirement: 13,
        stealthDisadvantage: true,
        magicBonus: 1
      }).payload.modifiers
    ).toEqual(
      expectedGrants(mediumArmorModifiers, stealth, strength(13), (childId) =>
        magicArmorModifiers(childId, 1)
      )
    )
  })

  it('maps each armor rule on its own and never onto a shield or a weapon', () => {
    expect(
      termsResult('ARMOR', ['HEAVY'], { stealthDisadvantage: true }).payload.modifiers
    ).toEqual(expectedGrants(stealth))
    expect(termsResult('ARMOR', ['HEAVY'], { strengthRequirement: 15 }).payload.modifiers).toEqual(
      expectedGrants(strength(15))
    )
    for (const category of ['SHIELD', 'WEAPON'])
      expect(
        termsResult(category, [], { strengthRequirement: 13, stealthDisadvantage: true }).payload
      ).not.toHaveProperty('modifiers')
  })

  it('imports without the grant and reports the missing System vocabulary entry', () => {
    const noStealth = termsResult(
      'ARMOR',
      ['HEAVY'],
      { strengthRequirement: 15, stealthDisadvantage: true },
      { ...vocabulary, skills: [vocabulary.skills[1]!] }
    )
    expect(noStealth.payload.modifiers).toEqual(expectedGrants(strength(15)))
    expect(noStealth.issues).toEqual([
      expect.objectContaining({
        severity: 'WARNING',
        code: 'UNKNOWN_ARMOR_VOCABULARY',
        path: ['inventory', 0],
        correctionRequired: true,
        message: expect.stringContaining('Stealth')
      })
    ])

    for (const missing of [{ speeds: [] }, { heritages: [] }]) {
      const noStrength = termsResult(
        'ARMOR',
        ['HEAVY'],
        { strengthRequirement: 15 },
        { ...vocabulary, ...missing }
      )
      expect(noStrength.payload).not.toHaveProperty('modifiers')
      expect(noStrength.issues).toEqual([
        expect.objectContaining({ code: 'UNKNOWN_ARMOR_VOCABULARY', correctionRequired: true })
      ])
    }
  })
})
