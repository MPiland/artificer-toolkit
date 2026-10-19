import { describe, expect, it } from 'vitest'

import { dnd5eCharacterActionTarget } from '../systems/dnd5e/modifierApplicability.js'
import { dnd5eAttackCriticalRules } from '../systems/dnd5e/characterCriticalRules.js'
import { evaluateSrdCharacter, itemAction } from '../testing/dnd5eSrdCharacter.js'

type AttackKind = 'MELEE' | 'RANGED'

/** The critical rules a Character's accepted grants give its Longsword or Shortbow attack. */
function criticalRules(
  input: Parameters<typeof evaluateSrdCharacter>[0],
  item: string,
  attackKind: AttackKind
) {
  const character = evaluateSrdCharacter({ ...input, items: [{ label: item, equipped: true }] })
  const { candidate } = itemAction(character, item, {
    attackKind,
    ...(item === 'Longsword' ? { grip: 'ONE_HANDED' as const } : {})
  })
  return dnd5eAttackCriticalRules(
    character.output,
    attackKind,
    dnd5eCharacterActionTarget(candidate)
  )
}

const champion = (level: number) => ({
  abilities: { STRENGTH: 16, DEXTERITY: 16 },
  classes: [{ label: 'Fighter', level, subclass: 'Champion' }]
})

describe('Character critical rules from authored grants (D158)', () => {
  it('has the default threshold and no extra dice without a source', () => {
    expect(
      criticalRules({ classes: [{ label: 'Fighter', level: 3 }] }, 'Longsword', 'MELEE')
    ).toEqual({ threshold: 20, extraDice: 0 })
  })

  it('gives a Champion a threshold of 19 from level 3, for melee and ranged weapons', () => {
    expect(criticalRules(champion(3), 'Longsword', 'MELEE').threshold).toBe(19)
    expect(criticalRules(champion(3), 'Shortbow', 'RANGED').threshold).toBe(19)
  })

  it('lowers a Champion to 18 at level 15, the lowest source winning over Improved Critical', () => {
    expect(criticalRules(champion(15), 'Longsword', 'MELEE').threshold).toBe(18)
  })

  it.each([
    { level: 8, extraDice: 0 },
    { level: 9, extraDice: 1 },
    { level: 13, extraDice: 2 },
    { level: 17, extraDice: 3 }
  ])('gives a level $level Barbarian $extraDice extra melee dice', ({ level, extraDice }) => {
    const barbarian = { abilities: { STRENGTH: 16 }, classes: [{ label: 'Barbarian', level }] }
    expect(criticalRules(barbarian, 'Greataxe', 'MELEE').extraDice).toBe(extraDice)
  })

  it('gives a Barbarian no extra dice on a ranged attack', () => {
    const barbarian = { abilities: { DEXTERITY: 16 }, classes: [{ label: 'Barbarian', level: 17 }] }
    expect(criticalRules(barbarian, 'Shortbow', 'RANGED').extraDice).toBe(0)
  })
})

describe('diagnostic', () => {
  it('lists folded domains', () => {
    const character = evaluateSrdCharacter({
      abilities: { STRENGTH: 16 },
      classes: [{ label: 'Barbarian', level: 17 }]
    })
    const codes = [...new Set(character.output.grantFold.modifiers.map((m) => m.valueDomainCode))]
    expect(codes.join(',')).toContain('CRITICAL')
  })
})
