import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const mechanicsFreeModules = [
  'characterBuilderSelections.ts',
  'characterRuleSnapshot.ts',
  'characterRulePolicyFacts.ts',
  'characterRuleEvaluation.ts'
]

describe('Character rules boundary', () => {
  it('keeps raw assembly and evaluation free of the legacy TypeScript mechanics path', () => {
    for (const moduleName of mechanicsFreeModules) {
      const source = readFileSync(
        fileURLToPath(new URL(`./${moduleName}`, import.meta.url)),
        'utf8'
      )
      expect(source).not.toMatch(/builderEligibility|characterEngine/)
      expect(source).not.toMatch(/\b(runEngine|applyGrants|resolveSpellGrantState)\b/)
    }
  })

  it('keeps Sheet mechanics fail-closed on policy output', () => {
    const projectionSource = readFileSync(
      fileURLToPath(new URL('./sheetProjection.ts', import.meta.url)),
      'utf8'
    )
    const reducerSource = readFileSync(
      fileURLToPath(new URL('./sheetCommandReducer.ts', import.meta.url)),
      'utf8'
    )

    expect(projectionSource).not.toMatch(/getSpellCastAvailability|projectSpellMechanicsForCast/)
    expect(projectionSource).toContain('omitted companion mechanics')
    expect(projectionSource).toContain('omitted item mechanics')
    expect(reducerSource).toContain('resolveAvailableSpellCast')
    expect(reducerSource).not.toMatch(/\bcastMode\b/)
  })
})
