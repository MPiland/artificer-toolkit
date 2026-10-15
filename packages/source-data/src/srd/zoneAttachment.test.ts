import { manifestDtoSchema } from '@artificer-toolkit/schema/effects/manifest'
import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from './index.js'

type CorpusZone = { label?: string; attachmentKind?: string }

/** Every ZONE manifest outcome in the corpus, wherever it is nested. */
function zoneManifests(node: unknown): CorpusZone[] {
  if (Array.isArray(node)) return node.flatMap(zoneManifests)
  if (typeof node !== 'object' || node === null) return []
  const record = node as Record<string, unknown>
  const own =
    record.effectKind === 'MANIFEST' && record.manifestKind === 'ZONE' ? [record as CorpusZone] : []
  return [...own, ...Object.values(record).flatMap(zoneManifests)]
}

describe('SRD zones state where they are placed (ADR 0038)', () => {
  const zones = zoneManifests(srdBaselineContent.subjects)
  const labelsOf = (attachmentKind: string) =>
    zones.filter((zone) => zone.attachmentKind === attachmentKind).map((zone) => zone.label)

  it('finds SRD zones', () => {
    expect(zones.length).toBeGreaterThan(0)
  })

  it('parses every ZONE manifest through the manifest schema', () => {
    const invalid = zones.filter((zone) => !manifestDtoSchema.safeParse(zone).success)
    expect(invalid.map((zone) => zone.label ?? '(unlabelled zone)')).toEqual([])
  })

  it('keeps SOURCE and PRIMARY_TARGET for the zones that move with a creature', () => {
    expect(labelsOf('SOURCE').sort()).toEqual(['Antilife Shell', 'Antimagic Field'])
    expect(labelsOf('PRIMARY_TARGET')).toEqual(['Resilient Sphere'])
  })
})
