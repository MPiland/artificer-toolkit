import { describe, expect, it } from 'vitest'

import { EQUIPMENT_PROPERTY_CODE } from '@artificer-toolkit/shared/core'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { dagger } from '@artificer-toolkit/source-data/srd/equipment/dagger.js'
import { shortsword } from '@artificer-toolkit/source-data/srd/equipment/shortsword.js'

import {
  damageExpression,
  evaluateSrdCharacter,
  itemAction,
  srdFeature,
  type SrdCharacter
} from './dnd5eSrdCharacter.js'

/** The Club and Shortsword the SRD publishes: a Strength and a finesse Light melee weapon. */
const strengthClub = club
const finesseBlade = shortsword
/** A thrown finesse weapon, whose bonus attack is its melee one. */
const throwingDagger = dagger
/** A Club that is not Light: the style restores the modifier only to a Light weapon's bonus attack. */
const heavyClub: EquipmentAuthored = {
  ...club,
  properties: club.properties?.filter((property) => property !== EQUIPMENT_PROPERTY_CODE.LIGHT)
}

const twoWeaponFighting = srdFeature({
  owner: 'CLASS',
  classLabel: 'Fighter',
  featureLabel: 'Fighting Style',
  level: 1,
  optionLabels: ['Two-Weapon Fighting']
})

function fighter(input: {
  abilities: Parameters<typeof evaluateSrdCharacter>[0]['abilities']
  weapon: EquipmentAuthored
  style?: boolean
}) {
  return evaluateSrdCharacter({
    abilities: input.abilities,
    classes: [{ label: 'Fighter', level: 1 }],
    features: input.style ? [twoWeaponFighting] : [],
    items: [{ label: input.weapon.label, equipped: true }],
    extraEquipment: [input.weapon]
  })
}

/** The weapon's damage expression when attacking as the Action (main hand) or the bonus action (off hand). */
const damage = (
  character: SrdCharacter,
  weapon: EquipmentAuthored,
  activation: 'ACTION' | 'BONUS_ACTION'
) =>
  damageExpression(
    itemAction(character, weapon.label, { attackKind: 'MELEE', activation }).decision
  )

describe('the off-hand attack’s damage ability modifier (two-weapon fighting)', () => {
  it('adds a positive modifier only to the Action attack, and a negative one to both', () => {
    const strong = fighter({ abilities: { STRENGTH: 16 }, weapon: strengthClub })
    expect(damage(strong, strengthClub, 'ACTION')).toBe('1d4 + 3')
    expect(damage(strong, strengthClub, 'BONUS_ACTION')).toBe('1d4')

    const weak = fighter({ abilities: { STRENGTH: 8 }, weapon: strengthClub })
    expect(damage(weak, strengthClub, 'ACTION')).toBe('1d4 - 1')
    expect(damage(weak, strengthClub, 'BONUS_ACTION')).toBe('1d4 - 1')
  })

  it('does the same for a finesse weapon, whichever ability it attacks with', () => {
    const dexterous = fighter({ abilities: { STRENGTH: 8, DEXTERITY: 16 }, weapon: finesseBlade })
    expect(damage(dexterous, finesseBlade, 'ACTION')).toBe('1d6 + 3')
    expect(damage(dexterous, finesseBlade, 'BONUS_ACTION')).toBe('1d6')

    const clumsy = fighter({ abilities: { STRENGTH: 8, DEXTERITY: 8 }, weapon: finesseBlade })
    expect(damage(clumsy, finesseBlade, 'BONUS_ACTION')).toBe('1d6 - 1')
  })

  it('does the same for a thrown weapon’s melee attack', () => {
    const dexterous = fighter({ abilities: { STRENGTH: 8, DEXTERITY: 16 }, weapon: throwingDagger })
    expect(damage(dexterous, throwingDagger, 'ACTION')).toBe('1d4 + 3')
    expect(damage(dexterous, throwingDagger, 'BONUS_ACTION')).toBe('1d4')
  })

  it('is restored in full by the Two-Weapon Fighting style, for the ability the attack uses', () => {
    const strong = fighter({ abilities: { STRENGTH: 16 }, weapon: strengthClub, style: true })
    expect(damage(strong, strengthClub, 'BONUS_ACTION')).toBe('1d4 + 3')
    // The Action attack is unchanged: the style does not add the modifier a second time.
    expect(damage(strong, strengthClub, 'ACTION')).toBe('1d4 + 3')

    const dexterous = fighter({
      abilities: { STRENGTH: 8, DEXTERITY: 16 },
      weapon: finesseBlade,
      style: true
    })
    expect(damage(dexterous, finesseBlade, 'BONUS_ACTION')).toBe('1d6 + 3')
    expect(damage(dexterous, finesseBlade, 'ACTION')).toBe('1d6 + 3')

    // A Strength weapon is restored by Strength, not by the Fighter's higher Dexterity.
    const dexterousClubber = fighter({
      abilities: { STRENGTH: 12, DEXTERITY: 18 },
      weapon: strengthClub,
      style: true
    })
    expect(damage(dexterousClubber, strengthClub, 'BONUS_ACTION')).toBe('1d4 + 1')
  })

  it('leaves a negative modifier as it is under the style', () => {
    const weak = fighter({ abilities: { STRENGTH: 8 }, weapon: strengthClub, style: true })
    expect(damage(weak, strengthClub, 'BONUS_ACTION')).toBe('1d4 - 1')
  })

  it('restores the modifier only to a Light weapon’s bonus attack', () => {
    const heavy = fighter({ abilities: { STRENGTH: 16 }, weapon: heavyClub, style: true })
    expect(damage(heavy, heavyClub, 'BONUS_ACTION')).toBe('1d4')
    expect(damage(heavy, heavyClub, 'ACTION')).toBe('1d4 + 3')
  })
})
