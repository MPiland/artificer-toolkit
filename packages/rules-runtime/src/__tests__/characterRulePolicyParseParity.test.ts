import {
  characterActionModelInputSchema,
  characterActionModelOutputSchema
} from '@artificer-toolkit/schema/api/characterActionRules'
import {
  characterGrantFoldInputSchema,
  characterGrantFoldOutputSchema
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '@artificer-toolkit/schema/api/characterRules'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { srdClasses } from '@artificer-toolkit/source-data/srd/classes/index.js'
import { srdCreatures } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { describe, expect, it, vi } from 'vitest'

import {
  evaluateCharacterRules,
  withCharacterActiveGrants
} from '../character/characterRuleEvaluation.js'
import { evaluateDnd5e2014CharacterActions } from '../systems/dnd5e/characterActions.js'
import { evaluateDnd5e2014CharacterGrantFold } from '../systems/dnd5e/characterGrantFold.js'
import { evaluateDnd5e2014CharacterPolicy } from '../systems/dnd5e/characterPolicy.js'
import { foldDnd5eCreatureFeatureGrants } from '../systems/dnd5e/creatureFeatureGrantFold.js'
import { prepareFixtureContext, readyFighterFixture } from '../testing/characterContextFixtures.js'
import { evaluateSrdCharacter } from '../testing/dnd5eSrdCharacter.js'
import { rageEffect } from './antitoxinEffectFixture.js'

// The policy facts and the action model (RELIABILITY-21.T33), the grant fold's input and output and the
// policy output (PERF-6.T7) are not parsed at run time, but their schemas carry defaults, sorting
// transforms and refinements. Real-code values must already be what parsing would make of them, so a
// builder that drifts from its contract fails here.
vi.mock('../systems/dnd5e/characterActions.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../systems/dnd5e/characterActions.js')>()
  return { evaluateDnd5e2014CharacterActions: vi.fn(actual.evaluateDnd5e2014CharacterActions) }
})
vi.mock('../systems/dnd5e/characterGrantFold.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../systems/dnd5e/characterGrantFold.js')>()
  return { evaluateDnd5e2014CharacterGrantFold: vi.fn(actual.evaluateDnd5e2014CharacterGrantFold) }
})

// A derivation parses none of the values it builds itself: these parses were about a third of an SRD
// Cleric's derivation CPU (PERF-6.T1 profile, fix 6).
const runtimeParses = [
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema,
  characterGrantFoldInputSchema,
  characterGrantFoldOutputSchema
].map((schema) => vi.spyOn(schema, 'parse'))

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
  const grantFolds = vi.mocked(evaluateDnd5e2014CharacterGrantFold)
  grantFolds.mockClear()
  runtimeParses.forEach((parse) => parse.mockClear())

  const { facts } = evaluateCharacterRules({ character, context, spellsById: context.spellsById })

  runtimeParses.forEach((parse) => expect(parse).not.toHaveBeenCalled())
  expect(facts).toEqual(characterRulePolicyInputSchema.parse(facts))
  const output = evaluateDnd5e2014CharacterPolicy(facts)
  expect(output).toEqual(characterRulePolicyOutputSchema.parse(output))
  expect(grantFolds).toHaveBeenCalled()
  grantFolds.mock.calls.forEach(([input], index) => {
    const folded = grantFolds.mock.results[index]?.value
    expect(input).toEqual(characterGrantFoldInputSchema.parse(input))
    expect(folded).toEqual(characterGrantFoldOutputSchema.parse(folded))
  })
  expect(actions).toHaveBeenCalled()
  actions.mock.calls.forEach(([input], index) => {
    const output = actions.mock.results[index]?.value
    expect(input).toEqual(characterActionModelInputSchema.parse(input))
    expect(output).toEqual(characterActionModelOutputSchema.parse(output))
  })
}

const cases = baseClasses.flatMap((base) =>
  LEVELS.map((level) => [base.label, level, base] as const)
)

describe('Character rule policy parse parity', () => {
  it.each(cases)(
    '%s level %i facts, grant fold, policy output and action model equal their parsed form',
    (_label, level, base) => expectParsedParity(base, level),
    30_000
  )

  it.each([false, true])(
    'builds a raging Barbarian’s resistances in their parsed order (grants reversed: %s)',
    (reversed) => {
      const rage = rageEffect({
        id: '00000000-0000-4000-8000-00000000b902',
        holderActorId: '00000000-0000-4000-8000-00000000b901'
      })
      const effect = {
        ...rage,
        definition: {
          ...rage.definition,
          stateContributions: rage.definition.stateContributions.map((contribution) =>
            reversed && contribution.kind === 'MODIFIER_GRANT'
              ? { ...contribution, modifiers: [...contribution.modifiers].reverse() }
              : contribution
          )
        }
      }
      const grantFolds = vi.mocked(evaluateDnd5e2014CharacterGrantFold)
      grantFolds.mockClear()
      const { facts } = evaluateSrdCharacter({ classes: [{ label: 'Barbarian', level: 9 }] })

      const output = evaluateDnd5e2014CharacterPolicy(withCharacterActiveGrants(facts, [effect]))

      expect(output.defenses.filter(({ kind }) => kind === 'RESISTANCE')).toHaveLength(3)
      expect(output).toEqual(characterRulePolicyOutputSchema.parse(output))
      const [input] = grantFolds.mock.lastCall ?? []
      expect(input?.activeEffects).toHaveLength(1)
      expect(input).toEqual(characterGrantFoldInputSchema.parse(input))
    }
  )

  it('folds every SRD Creature feature grant from and to its parsed form', () => {
    const grantFolds = vi.mocked(evaluateDnd5e2014CharacterGrantFold)
    grantFolds.mockClear()
    srdCreatures.forEach((creature) => foldDnd5eCreatureFeatureGrants(creature))
    expect(grantFolds).toHaveBeenCalledTimes(srdCreatures.length)
    grantFolds.mock.calls.forEach(([input], index) => {
      const folded = grantFolds.mock.results[index]?.value
      expect(input).toEqual(characterGrantFoldInputSchema.parse(input))
      expect(folded).toEqual(characterGrantFoldOutputSchema.parse(folded))
    })
  })
})
