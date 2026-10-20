import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { describe, expect, it } from 'vitest'

import { prepareCharacterBuilderFromContext } from '../character/builderPreparation.js'
import { resolveCharacterRecordStats } from '../character/characterRecordStats.js'
import { evaluateCharacterRules } from '../character/characterRuleEvaluation.js'
import { prepareFixtureContext, readyFighterFixture } from '../testing/characterContextFixtures.js'

/** What commit reads back and writes: readiness, the activated Character and its stored stats. */
async function commitFacts(
  input: { character: CharacterAuthored },
  context: Omit<Awaited<ReturnType<typeof prepareFixtureContext>>, 'presentation'>
) {
  const prepared = await prepareCharacterBuilderFromContext({
    character: input.character,
    current: null,
    mode: 'create',
    finalize: true,
    context
  })
  const evaluation = await evaluateCharacterRules(
    {
      character: prepared.character,
      context: prepared.context,
      spellsById: prepared.context.spellsById
    },
    prepared.sourcePreparation
  )
  return {
    readiness: prepared.resolution.readiness,
    character: prepared.character,
    stats: resolveCharacterRecordStats(evaluation)
  }
}

// D163: commit reads compiled rules only, so the prose lookup cannot change what it persists.
describe('Character commit without the presentation lookup', () => {
  const fixtures = {
    'a ready Character': () => {
      const ready = readyFighterFixture()
      const secondWind = (fighter.features ?? []).find((row) => row.label === 'Second Wind')
      if (!secondWind) throw new Error('Expected the SRD Second Wind feature.')
      const [baseClass] = ready.documents.CLASS
      return {
        ...ready,
        documents: { ...ready.documents, CLASS: [{ ...baseClass, features: [secondWind] }] },
        proseFeatureId: secondWind.id
      }
    },
    'a Character with an open Fighting Style choice': () => {
      const ready = readyFighterFixture()
      const [baseClass] = ready.documents.CLASS
      const fightingStyle = (fighter.features ?? []).find((row) => row.label === 'Fighting Style')
      if (!fightingStyle) throw new Error('Expected the SRD Fighting Style feature.')
      return {
        ...ready,
        documents: { ...ready.documents, CLASS: [{ ...baseClass, features: [fightingStyle] }] },
        proseFeatureId: fightingStyle.id
      }
    }
  }

  for (const [name, build] of Object.entries(fixtures)) {
    it(`gives ${name} the same readiness and writes`, async () => {
      const input = build()
      const context = await prepareFixtureContext(input.character, input.documents)
      expect(context.presentation.features[input.proseFeatureId]?.description).toBeTruthy()
      const { presentation: _presentation, ...withoutPresentation } = context

      const withLookup = await commitFacts(input, context)
      const withoutLookup = await commitFacts(input, withoutPresentation)

      expect(withoutLookup).toEqual(withLookup)
    })
  }

  it('activates the ready Character and blocks the open choice', async () => {
    const results = await Promise.all(
      Object.values(fixtures).map(async (build) => {
        const input = build()
        const { presentation: _presentation, ...context } = await prepareFixtureContext(
          input.character,
          input.documents
        )
        return (await commitFacts(input, context)).readiness.ready
      })
    )
    expect(results).toEqual([true, false])
  })
})
