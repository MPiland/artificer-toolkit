import { describe, expect, it } from 'vitest'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import { skillId } from '@artificer-toolkit/source-data/srd/equipment/shared.js'

import { evaluateSrdCharacter, srdFeature } from '../testing/dnd5eSrdCharacter.js'

/**
 * SPELLS-31.T5q-B: an ability check BONUS is a generic modifier domain with a proficiency gate and
 * a rounding. Jack of All Trades (half, down, unproficient) and Remarkable Athlete (half, up,
 * Strength, Dexterity and Constitution) are authored with it, on skills, plain checks and initiative.
 */

const jackOfAllTrades = srdFeature({
  owner: 'CLASS',
  classLabel: 'Bard',
  featureLabel: 'Jack of All Trades',
  level: 2
})

const remarkableAthlete = srdFeature({
  owner: 'SUBCLASS',
  classLabel: 'Fighter',
  subclassLabel: 'Champion',
  featureLabel: 'Remarkable Athlete',
  level: 7
})

/** A level 5 Bard (proficiency bonus +3) with a +2 Charisma and a half-orc's Intimidation. */
const bard = () =>
  evaluateSrdCharacter({
    race: 'Half-Orc',
    abilities: { CHARISMA: 14, DEXTERITY: 12 },
    classes: [{ label: 'Bard', level: 5 }],
    features: [jackOfAllTrades]
  }).output.derivedStats

/** A level 7 Champion (proficiency bonus +3) with Strength 14, Dexterity 12 and Wisdom 10. */
const champion = () =>
  evaluateSrdCharacter({
    abilities: { STRENGTH: 14, DEXTERITY: 12, WISDOM: 10 },
    classes: [{ label: 'Fighter', level: 7, subclass: 'Champion' }],
    features: [remarkableAthlete]
  }).output.derivedStats

const skillTotal = (stats: ReturnType<typeof bard>, code: string) =>
  stats.skills.find((skill) => skill.skillId === skillId(code))?.total.effective

const checkOf = (stats: ReturnType<typeof bard>, code: string) =>
  stats.abilities.find((ability) => ability.abilityId === code)?.check.effective

describe('ability check bonus (Jack of All Trades)', () => {
  it('adds half the proficiency bonus, rounded down, to an unproficient skill', () => {
    // +2 Charisma, +1 (floor of 3 / 2).
    expect(skillTotal(bard(), 'PERSUASION')).toBe(3)
  })

  it('adds nothing to a skill the Character is proficient in', () => {
    // +2 Charisma, +3 proficiency, and no half bonus on top.
    expect(skillTotal(bard(), 'INTIMIDATION')).toBe(5)
  })

  it('adds to a plain ability check and to initiative, and leaves the ability modifier pure', () => {
    const stats = bard()
    expect(checkOf(stats, 'CHARISMA')).toBe(3)
    expect(
      stats.abilities.find((ability) => ability.abilityId === 'CHARISMA')?.modifier.effective
    ).toBe(2)
    expect(stats.initiative.effective).toBe(2)
  })
})

describe('ability check bonus (Remarkable Athlete)', () => {
  it('rounds half the proficiency bonus up, on Strength, Dexterity and Constitution only', () => {
    const stats = champion()
    expect(checkOf(stats, 'STRENGTH')).toBe(4)
    expect(checkOf(stats, 'DEXTERITY')).toBe(3)
    expect(checkOf(stats, 'WISDOM')).toBe(0)
  })

  it('adds to initiative, a Dexterity check', () => {
    expect(champion().initiative.effective).toBe(3)
  })

  it('adds to an unproficient skill of a covered ability only', () => {
    const stats = champion()
    expect(skillTotal(stats, 'STEALTH')).toBe(3)
    expect(skillTotal(stats, 'INSIGHT')).toBe(0)
  })

  it('stacks with Jack of All Trades on a covered check', () => {
    const stats = evaluateSrdCharacter({
      abilities: { STRENGTH: 14 },
      classes: [
        { label: 'Fighter', level: 7, subclass: 'Champion' },
        { label: 'Bard', level: 2 }
      ],
      features: [remarkableAthlete, jackOfAllTrades]
    }).output.derivedStats
    // Total level 9 gives a +4 proficiency bonus: +2 Strength, +2 rounded up, +2 rounded down.
    expect(checkOf(stats, 'STRENGTH')).toBe(6)
  })
})

describe('the retired closed rule kinds', () => {
  it('no longer exist', () => {
    expect(Object.keys(CLOSED_RULE_KIND)).not.toContain('CLASS_BARD_JACK_OF_ALL_TRADES')
    expect(Object.keys(CLOSED_RULE_KIND)).not.toContain('CLASS_CHAMPION_REMARKABLE_ATHLETE')
  })
})
