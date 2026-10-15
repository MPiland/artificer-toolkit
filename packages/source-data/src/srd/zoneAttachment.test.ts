import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from './index.js'

type ZoneManifest = { manifestKind: 'ZONE'; label?: string; attachmentKind?: string }

/** Every ZONE manifest outcome in the corpus, wherever it is nested. */
function zoneManifests(node: unknown): ZoneManifest[] {
  if (Array.isArray(node)) return node.flatMap(zoneManifests)
  if (typeof node !== 'object' || node === null) return []
  const record = node as Record<string, unknown>
  const own =
    record.effectKind === 'MANIFEST' && record.manifestKind === 'ZONE'
      ? [record as unknown as ZoneManifest]
      : []
  return [...own, ...Object.values(record).flatMap(zoneManifests)]
}

describe('SRD zones state where they are placed (ADR 0038)', () => {
  const zones = zoneManifests(srdBaselineContent.subjects)

  it('finds every SRD zone', () => {
    expect(zones).toHaveLength(40)
  })

  it('gives every ZONE manifest an attachmentKind', () => {
    const missing = zones.filter((zone) => zone.attachmentKind === undefined)
    expect(missing.map((zone) => zone.label ?? '(unlabelled zone)')).toEqual([])
  })
})
