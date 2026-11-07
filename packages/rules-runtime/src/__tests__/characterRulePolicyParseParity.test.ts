import {
  characterActionModelInputSchema,
  characterActionModelOutputSchema
} from '@artificer-toolkit/schema/api/characterActionRules'
import { characterRulePolicyInputSchema } from '@artificer-toolkit/schema/api/characterRules'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { srdClasses } from '@artificer-toolkit/source-data/srd/classes/index.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { describe, expect, it, vi } from 'vitest'

import { evaluateCharacterRules } from '../character/characterRuleEvaluation.js'
import { evaluateDnd5e2014CharacterActions } from '../systems/dnd5e/characterActions.js'
import { prepareFixtureContext, readyFighterFixture } from '../testing/characterContextFixtures.js'

// The policy facts and the action model are no longer parsed at run time (RELIABILITY-21.T33), but
// their schemas carry defaults, sorting transforms and refinements. Real-code facts and action models
// must already be what parsing would make of them, so a builder that drifts from its contract fails here.
vi.mock('../systems/dnd5e/characterActions.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../systems/dnd5e/characterActions.js')>()
  return { evaluateDnd5e2014CharacterActions: vi.fn(actual.evaluateDnd5e2014CharacterActions) }
})

const LEVELS = [1, 3, 5, 11, 20]
const baseClasses = srdClasses.filter((document) => document.category === 'BASE')
const subclassOf = (base: ClassAuthored) =>
  srdClasses.find((document) => 'parentClassId' in document && document.parentClassId === base.id)

async function expectParsedParity(base: ClassAuthored, level: number) {
  const { character, documents } = readyFighterFixture()
  const subclass = level >= 3 ? subclassOf(base) : undefined
  character.intent.classes = [
    { classId: base.id, classLevel: level, ...(subclass ? { subclassId: subclass.id } : {}) }
  ]
  character.intent.hitpoints = {
    method: 'FIXED',
    levels: Array.from({ length: level }, (_, index) => ({
      level: index + 1,
      classId: base.id,
      classLevel: index + 1,
      value: 8
    }))
  }
  const context = await prepareFixtureContext(character, {
    ...documents,
    CLASS: [base, ...(subclass ? [subclass] : [])],
    EQUIPMENT: srdEquipment,
    SPELL: srdSpells
  })
  const actions = vi.mocked(evaluateDnd5e2014CharacterActions)
  actions.mockClear()

  const { facts } = evaluateCharacterRules({ character, context, spellsById: context.spellsById })

  expect(facts).toEqual(characterRulePolicyInputSchema.parse(facts))
  expect(actions).toHaveBeenCalled()
  actions.mock.calls.forEach(([input], index) => {
    const output = actions.mock.results[index]?.value
    expect(input).toEqual(characterActionModelInputSchema.parse(input))
    expect(output).toEqual(characterActionModelOutputSchema.parse(output))
  })
}

/**
 * With the whole SRD spell catalogue a Bard holds 844 spell access candidates, and College of Lore
 * adds enough at level 3 that the policy output's spell access decisions pass their 999 sequence cap,
 * so evaluation throws in `characterRulePolicyOutputSchema.parse`. Found by this test and reported
 * under RELIABILITY-21.T33; these flip to passing once that is fixed, and then join `cases`.
 */
const exceedsSpellAccessSequence = (base: ClassAuthored, level: number) =>
  base.label === 'Bard' && level >= 3
const cases = baseClasses.flatMap((base) =>
  LEVELS.map((level) => [base.label, level, base] as const)
)

describe('Character rule policy parse parity', () => {
  it.each(cases.filter(([, level, base]) => !exceedsSpellAccessSequence(base, level)))(
    '%s level %i facts and action model equal their parsed form',
    (_label, level, base) => expectParsedParity(base, level),
    30_000
  )
  it.fails.each(cases.filter(([, level, base]) => exceedsSpellAccessSequence(base, level)))(
    '%s level %i exceeds the spell access decision sequence cap',
    (_label, level, base) => expectParsedParity(base, level),
    30_000
  )
})
