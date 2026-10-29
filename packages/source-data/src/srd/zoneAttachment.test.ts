import { manifestDtoSchema } from '@artificer-toolkit/schema/effects/manifest'
import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from './index.js'

type CorpusZone = { owner: string; manifest: { attachmentKind?: string } }

/** Every ZONE manifest outcome in the corpus, wherever it is nested, with the labelled subject that owns it. */
function zoneManifests(node: unknown, owner: string): CorpusZone[] {
  if (Array.isArray(node)) return node.flatMap((child) => zoneManifests(child, owner))
  if (typeof node !== 'object' || node === null) return []
  const record = node as Record<string, unknown>
  const subject =
    typeof record.kind === 'string' && typeof record.label === 'string' ? record.label : owner
  const own =
    record.effectKind === 'MANIFEST' && record.manifestKind === 'ZONE'
      ? [{ owner: subject, manifest: record }]
      : []
  return [...own, ...Object.values(record).flatMap((child) => zoneManifests(child, subject))]
}

describe('SRD zones state where they are placed (ADR 0038)', () => {
  // Creatures author no `kind`, so each subject starts as its own owner.
  const zones = Object.values(srdBaselineContent.subjects)
    .flat()
    .flatMap((subject) => zoneManifests(subject, subject.label))
  const ownersOf = (attachmentKind: string) => [
    ...new Set(
      zones
        .filter((zone) => zone.manifest.attachmentKind === attachmentKind)
        .map((zone) => zone.owner)
    )
  ]

  it('finds SRD zones', () => {
    expect(zones.length).toBeGreaterThan(0)
  })

  it('parses every ZONE manifest through the manifest schema', () => {
    const invalid = zones.filter((zone) => !manifestDtoSchema.safeParse(zone.manifest).success)
    expect(invalid.map((zone) => zone.owner)).toEqual([])
  })

  it('keeps SOURCE and PRIMARY_TARGET for the zones that move with or enclose a creature', () => {
    expect(ownersOf('SOURCE').sort()).toEqual([
      'Antilife Shell',
      'Antimagic Field',
      'Balor',
      'Black Pudding',
      'Chain Devil',
      'Darkmantle',
      'Fire Shield',
      'Hezrou',
      'Oath of Devotion',
      'Paladin',
      'Pit Fiend',
      'Sea Hag',
      'Spirit Guardians'
    ])
    expect(ownersOf('PRIMARY_TARGET')).toEqual(['Resilient Sphere'])
  })
})
