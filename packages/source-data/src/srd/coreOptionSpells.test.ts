import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared'
import { describe, expect, it } from 'vitest'
import { srdSpells } from './spells/index.js'

const plainText = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')

/**
 * D156 T2a3: spells whose closed rule converted to existing core options. What the product
 * resolves is authored; the clauses it does not are the GM's ruling, quoted from the description.
 */
describe.each([
  { label: 'Light', ruleKind: 'LIGHT', effectKinds: ['MANIFEST', 'MANUAL_ADJUDICATION'] },
  { label: 'Mage Armor', ruleKind: 'MAGE_ARMOR', effectKinds: ['APPLY_GRANT'] },
  {
    label: 'Mind Blank',
    ruleKind: 'MIND_BLANK',
    effectKinds: ['APPLY_GRANT', 'MANUAL_ADJUDICATION']
  },
  {
    label: 'Pass without Trace',
    ruleKind: 'PASS_WITHOUT_TRACE',
    effectKinds: ['APPLY_GRANT', 'MANUAL_ADJUDICATION']
  }
])('SRD $label (D156 T2a3)', ({ label, ruleKind, effectKinds }) => {
  const spell = srdSpells.find((entry) => entry.label === label)
  if (!spell) throw new Error(`SRD spell "${label}" is missing.`)
  const outcomes = (spell.effects ?? [])
    .flatMap((effect) => effect.paths)
    .flatMap((path) => (path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []))

  it('authors its outcomes from core options, with no closed rule left', () => {
    expect(outcomes.map(({ effectKind }) => effectKind)).toEqual(effectKinds)
    expect(Object.keys(CLOSED_RULE_KIND)).not.toContain(ruleKind)
  })

  it('quotes its description in every GM ruling', () => {
    const description = plainText(spell.description ?? '')
    for (const outcome of outcomes)
      if (outcome.effectKind === 'MANUAL_ADJUDICATION')
        expect(description).toContain(plainText(outcome.instructions))
  })
})
