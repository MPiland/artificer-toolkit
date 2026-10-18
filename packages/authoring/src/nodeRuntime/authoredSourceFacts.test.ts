import { describe, expect, it } from 'vitest'

import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import {
  authoredNodeRuntimeSourceFactsSchema,
  nodeRuntimeSourceManifest,
  type AuthoredNodeRuntimeSourceFacts,
  type NodeRuntimeSourceTable
} from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import type { AuthoredDocumentVersion } from '@artificer-toolkit/schema/projections/authoredContent'

import { authoredSourceFacts } from './authoredSourceFacts.js'

const checksum = 'a'.repeat(64)
const subjectKinds = {
  backgrounds: 'BACKGROUND',
  classes: 'CLASS',
  creatures: 'CREATURE',
  equipment: 'EQUIPMENT',
  feats: 'FEAT',
  races: 'RACE',
  spells: 'SPELL',
  vehicles: 'VEHICLE'
} as const

function version(subjectKind: AuthoredDocumentVersion['subjectKind'], document: unknown) {
  return { subjectKind, document, checksum } as Parameters<typeof authoredSourceFacts>[0]
}

describe('authoredSourceFacts', () => {
  it('projects nested feature, grant, and effect source rows with manifest-exact columns', () => {
    // A union of subject arrays has no single map signature, so the facts are typed here.
    const documents: AuthoredNodeRuntimeSourceFacts[] = Object.entries(
      srdBaselineContent.subjects
    ).flatMap(([kind, subjects]) =>
      subjects.map((document: unknown) =>
        authoredSourceFacts(version(subjectKinds[kind as keyof typeof subjectKinds], document))
      )
    )
    const rows = documents.flatMap((facts) =>
      (Object.keys(facts.rows) as NodeRuntimeSourceTable[]).flatMap((table) => {
        const tableRows = facts.rows[table]
        return tableRows ? [[table, tableRows] as const] : []
      })
    )

    expect(rows.some(([table]) => table === 'features')).toBe(true)
    expect(rows.some(([table]) => table === 'effect_paths')).toBe(true)
    expect(rows.some(([table]) => table === 'effect_result_block_outcomes')).toBe(true)
    for (const [table, tableRows] of rows) {
      expect(
        tableRows.every(
          (row) =>
            Object.keys(row).sort().join(',') ===
            [...nodeRuntimeSourceManifest[table as keyof typeof nodeRuntimeSourceManifest]]
              .sort()
              .join(',')
        )
      ).toBe(true)
      expect(JSON.stringify(tableRows)).not.toContain('"description"')
      expect(JSON.stringify(tableRows)).not.toContain('"userId"')
    }
  })

  it('projects every SRD authored subject into compact schema-valid facts', () => {
    const facts = Object.entries(srdBaselineContent.subjects).flatMap(([kind, subjects]) =>
      subjects.map((document: unknown) =>
        authoredSourceFacts(version(subjectKinds[kind as keyof typeof subjectKinds], document))
      )
    )

    expect(facts).not.toHaveLength(0)
    expect(
      facts.every((fact) => authoredNodeRuntimeSourceFactsSchema.safeParse(fact).success)
    ).toBe(true)
    const sourceBytes = facts.reduce((size, fact) => size + JSON.stringify(fact.rows).length, 0)
    const documentBytes = JSON.stringify(srdBaselineContent.subjects).length
    expect(sourceBytes).toBeLessThan(documentBytes)
  })

  it('projects a triggering-weapon damage outcome with no fixed damage type', () => {
    const rogue = srdBaselineContent.subjects.classes.find(({ label }) => label === 'Rogue')
    const damages = authoredSourceFacts(version('CLASS', rogue)).rows.damages ?? []

    expect(damages.some(({ damage_type_id }) => damage_type_id === null)).toBe(true)
  })

  it('rejects rows with unsupported columns', () => {
    expect(() =>
      authoredNodeRuntimeSourceFactsSchema.parse({
        checksum,
        rows: { backgrounds: [{ id: 'background', label: 'Background', prose: 'not source data' }] }
      })
    ).toThrow('closed manifest')
  })
})
