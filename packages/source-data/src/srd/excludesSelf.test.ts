import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from './index.js'

type LabelledEffects = {
  label: string
  effects: { invocation: { targeting?: { selectionKind: string; excludesSelf?: boolean } } }[]
}

/** Every SRD record (feature, option, spell) with the label and effects, wherever it is nested. */
function recordsLabelled(node: unknown, matches: (label: string) => boolean): LabelledEffects[] {
  if (Array.isArray(node)) return node.flatMap((child) => recordsLabelled(child, matches))
  if (typeof node !== 'object' || node === null) return []
  const record = node as Record<string, unknown>
  const own =
    typeof record.label === 'string' && Array.isArray(record.effects) && matches(record.label)
      ? [record as unknown as LabelledEffects]
      : []
  return [...own, ...Object.values(record).flatMap((child) => recordsLabelled(child, matches))]
}

/** D99: "another creature" / "a creature other than you" SINGLE_TARGET effects exclude their user. */
describe('SRD effects that cannot target their user (D99)', () => {
  it.each([
    ['Bardic Inspiration', (label: string) => label === 'Bardic Inspiration', 1],
    ['Healing Touch', (label: string) => label.startsWith('Healing Touch'), 4],
    ['Modify Memory', (label: string) => label === 'Modify Memory', 1],
    ['Protection', (label: string) => label === 'Protection', 3]
  ])('%s excludes self on every single-target effect', (_name, matches, expectedRecords) => {
    const records = recordsLabelled(srdBaselineContent.subjects, matches)
    expect(records).toHaveLength(expectedRecords)
    for (const record of records) {
      const singleTargets = record.effects
        .map((effect) => effect.invocation.targeting)
        .filter((targeting) => targeting?.selectionKind === 'SINGLE_TARGET')
      expect(singleTargets.length).toBeGreaterThan(0)
      for (const targeting of singleTargets) expect(targeting?.excludesSelf).toBe(true)
    }
  })
})
