import { describe, expect, it } from 'vitest'

import { evaluateCharacterRules } from '../character/characterRuleEvaluation.js'
import { prepareFixtureContext, readyFighterFixture } from '../testing/characterContextFixtures.js'

// RELIABILITY-21.16: a write evaluates its Character several times over one loaded context.
describe('Character rule evaluation reuse', () => {
  it('reuses the output over unchanged facts and context, and evaluates anything else', async () => {
    const { character, documents } = readyFighterFixture()
    const context = await prepareFixtureContext(character, documents)
    const evaluate = (target: typeof character, over = context) =>
      evaluateCharacterRules({ character: target, context: over, spellsById: over.spellsById })

    const first = evaluate(character)
    const again = evaluate(structuredClone(character))
    expect(again.facts).toBe(first.facts)
    expect(again.output).toBe(first.output)

    const exhausted = structuredClone(character)
    exhausted.state.exhaustion = { level: 1 }
    const changed = evaluate(exhausted)
    expect(changed.facts.rest.currentExhaustion).toBe(1)
    expect(changed.output).not.toBe(first.output)

    const otherContext = await prepareFixtureContext(exhausted, documents)
    const fresh = evaluate(exhausted, otherContext)
    expect(fresh.output).not.toBe(changed.output)
    expect(fresh.output).toEqual(changed.output)
  })
})
