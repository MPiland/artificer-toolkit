import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from './index.js'

const plainText = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')

/** D156 T2a1: Awaken's 30-day charm is the GM's ruling on its description (class C). */
describe('SRD Awaken (D156 T2a1)', () => {
  it('resolves to GM rulings quoting its description, with no closed rule', () => {
    const awaken = srdBaselineContent.subjects.spells.find(({ label }) => label === 'Awaken')
    if (!awaken) throw new Error('SRD spell "Awaken" is missing.')
    const outcomes = (awaken.effects ?? [])
      .flatMap((effect) => effect.paths)
      .flatMap((path) => (path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []))
    const description = plainText(awaken.description ?? '')
    expect(outcomes.map(({ effectKind }) => effectKind)).toEqual([
      'MANUAL_ADJUDICATION',
      'MANUAL_ADJUDICATION'
    ])
    for (const outcome of outcomes)
      if (outcome.effectKind === 'MANUAL_ADJUDICATION')
        expect(description).toContain(plainText(outcome.instructions))
  })
})
