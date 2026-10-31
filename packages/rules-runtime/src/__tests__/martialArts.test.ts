import { describe, expect, it } from 'vitest'

import {
  damageExpression,
  evaluateSrdCharacter,
  itemAction,
  srdFeature,
  type SrdCharacterInput
} from '../testing/dnd5eSrdCharacter.js'

const UNARMED = 'Unarmed Strike'

function monk(
  level: number,
  input: Pick<SrdCharacterInput, 'abilities' | 'items'> = {}
): ReturnType<typeof evaluateSrdCharacter> {
  return evaluateSrdCharacter({
    ...input,
    classes: [{ label: 'Monk', level }],
    features: [
      srdFeature({ owner: 'CLASS', classLabel: 'Monk', featureLabel: 'Martial Arts', level: 1 })
    ]
  })
}

const unarmed = (character: ReturnType<typeof evaluateSrdCharacter>) =>
  itemAction(character, UNARMED, { attackKind: 'UNARMED' }).decision

const melee = (character: ReturnType<typeof evaluateSrdCharacter>, label: string) =>
  itemAction(character, label, { attackKind: 'MELEE', grip: 'ONE_HANDED' }).decision

const DEX_16 = { DEXTERITY: 16, STRENGTH: 10 }

describe('Martial Arts (SPELLS-31.T4l2, D156)', () => {
  it.each([
    [1, '1d4 + 3'],
    [4, '1d4 + 3'],
    [5, '1d6 + 3'],
    [11, '1d8 + 3'],
    [17, '1d10 + 3']
  ])('a level %i Monk strikes unarmed with Dexterity for %s', (level, expected) => {
    const decision = unarmed(monk(level, { abilities: DEX_16 }))
    expect(damageExpression(decision)).toBe(expected)
  })

  it('rolls the Monk die and Dexterity on the unarmed attack roll (proficiency 2 + Dex 3)', () => {
    expect(unarmed(monk(1, { abilities: DEX_16 })).mechanic.attackBonus).toBe(5)
  })

  it('never lowers a monk weapon die: a d6 quarterstaff stays d6 under the level 1 d4', () => {
    const character = monk(1, { abilities: DEX_16, items: [{ label: 'Quarterstaff' }] })
    expect(damageExpression(melee(character, 'Quarterstaff'))).toBe('1d6 + 3')
  })

  it('raises a monk weapon die to the Monk die once it is larger', () => {
    const character = monk(11, { abilities: DEX_16, items: [{ label: 'Quarterstaff' }] })
    expect(damageExpression(melee(character, 'Quarterstaff'))).toBe('1d8 + 3')
  })

  it('treats a shortsword as a monk weapon', () => {
    const character = monk(11, { abilities: DEX_16, items: [{ label: 'Shortsword' }] })
    expect(damageExpression(melee(character, 'Shortsword'))).toBe('1d8 + 3')
  })

  it('keeps Strength when it beats Dexterity', () => {
    const character = monk(1, {
      abilities: { DEXTERITY: 10, STRENGTH: 16 },
      items: [{ label: 'Quarterstaff' }]
    })
    expect(damageExpression(melee(character, 'Quarterstaff'))).toBe('1d6 + 3')
  })

  it('leaves a martial weapon that is not a monk weapon on Strength and its own die', () => {
    const character = monk(17, {
      abilities: { DEXTERITY: 16, STRENGTH: 14 },
      items: [{ label: 'Longsword' }]
    })
    expect(damageExpression(melee(character, 'Longsword'))).toBe('1d8 + 2')
  })

  it.each(['Chain Mail', 'Shield'])('ends while wearing %s', (label) => {
    const character = monk(1, {
      abilities: { DEXTERITY: 16, STRENGTH: 14 },
      items: [{ label, equipped: true }]
    })
    expect(damageExpression(unarmed(character))).toBe('3')
  })

  it('offers one free weapon attack as a bonus action, without a ki cost', () => {
    const character = monk(1, { abilities: DEX_16 })
    const bonusStrike = character.entryPoints.find(
      ({ compiledEffect }) =>
        compiledEffect.invocation.kind === 'ACTION' &&
        compiledEffect.invocation.activation?.code === 'BONUS_ACTION' &&
        compiledEffect.invocation.resourceUse === undefined
    )
    expect(bonusStrike).toBeDefined()
    const offers = bonusStrike!.compiledEffect.entries.flatMap((compiled) =>
      'outcome' in compiled && compiled.duration ? (compiled.lifecycle?.grantedActions ?? []) : []
    )
    expect(offers).toEqual([
      { activation: 'FREE', usesPerTurn: 1, actionDefinitionIds: [], weaponAttack: true }
    ])
  })
})
