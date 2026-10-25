import { blackDragonWyrmling } from '@artificer-toolkit/source-data/srd/creatures/black-dragon-wyrmling.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { describe, expect, it } from 'vitest'

import { compileDnd5eCreatureRuleFacts } from '../systems/dnd5e/creatureRuleFacts.js'
import { SRD_VOCABULARY } from '../testing/dnd5eSrdEncounter.js'
import { creatureActor, srdAbilityId } from './encounterCreatureAction.js'

describe('Creature save proficiency facts', () => {
  it('pins the CR proficiency bonus for each authored proficient save and no other', () => {
    const { ruleFacts } = creatureActor({
      id: crypto.randomUUID(),
      label: 'Wyrmling',
      features: [],
      statBlock: blackDragonWyrmling
    }).snapshot as { ruleFacts: { saveProficiencyBonuses?: Record<string, number> } }
    // Challenge rating 2 gives +2; the stat block is proficient in DEX, CON, WIS and CHA saves.
    expect(ruleFacts.saveProficiencyBonuses).toEqual({
      [srdAbilityId('DEXTERITY')]: 2,
      [srdAbilityId('CONSTITUTION')]: 2,
      [srdAbilityId('WISDOM')]: 2,
      [srdAbilityId('CHARISMA')]: 2
    })
  })

  it('pins none for a stat block with no save proficiency', () => {
    const { ruleFacts } = creatureActor({
      id: crypto.randomUUID(),
      label: 'Wolf',
      features: [],
      statBlock: wolf
    }).snapshot as { ruleFacts: { saveProficiencyBonuses?: Record<string, number> } }
    expect(ruleFacts.saveProficiencyBonuses).toEqual({})
  })
})

const withProficiencyBonus = (proficiencyBonus: number) => ({
  ...SRD_VOCABULARY,
  document: {
    ...SRD_VOCABULARY.document,
    challengeRatings: SRD_VOCABULARY.document.challengeRatings.map((entry) => ({
      ...entry,
      proficiencyBonus
    }))
  }
})

describe('Creature rule facts read the System challenge rating', () => {
  it('takes the proficiency bonus from the challenge rating entry on the System record', () => {
    const facts = (bonus: number) =>
      compileDnd5eCreatureRuleFacts({ creature: wolf, vocabulary: withProficiencyBonus(bonus) })
    const base = facts(2).checkTotals ?? {}
    const raised = facts(5).checkTotals ?? {}

    const proficientCheckIds = Object.keys(base).filter((id) => raised[id] !== base[id])
    expect(proficientCheckIds.length).toBeGreaterThan(0)
    for (const id of proficientCheckIds) {
      expect(raised[id]! - base[id]!).toBe(3)
    }
  })

  it('refuses a challenge rating the System record does not define', () => {
    expect(() =>
      compileDnd5eCreatureRuleFacts({
        creature: wolf,
        vocabulary: {
          ...SRD_VOCABULARY,
          document: { ...SRD_VOCABULARY.document, challengeRatings: [] }
        }
      })
    ).toThrow('Creature challenge rating is unavailable for D&D proficiency.')
  })
})

describe('Creature ability facts follow the System ability order', () => {
  it('keys scores in System order whatever order the stored record holds', () => {
    const alphabetical = Object.fromEntries(
      Object.entries(wolf.abilityScores).sort(([left], [right]) => left.localeCompare(right))
    )
    const facts = compileDnd5eCreatureRuleFacts({
      creature: { ...wolf, abilityScores: alphabetical },
      vocabulary: SRD_VOCABULARY
    })
    expect(Object.keys(facts.abilityScores)).toEqual(
      SRD_VOCABULARY.document.abilities.map(({ id }) => id)
    )
  })

  it('refuses a score for an ability the System does not list', () => {
    expect(() =>
      compileDnd5eCreatureRuleFacts({
        creature: { ...wolf, abilityScores: { ...wolf.abilityScores, SANITY: 10 } },
        vocabulary: SRD_VOCABULARY
      })
    ).toThrow('Creature ability facts are not normalized by the pinned System vocabulary.')
  })
})
