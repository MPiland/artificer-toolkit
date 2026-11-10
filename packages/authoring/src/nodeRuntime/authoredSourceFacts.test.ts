import { describe, expect, it } from 'vitest'

import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import {
  AUTHORED_SOURCE_FACTS_VERSION,
  authoredNodeRuntimeSourceFactsSchema,
  nodeRuntimeSourceManifest,
  type AuthoredNodeRuntimeSourceFacts,
  type AuthoredSourceRoots,
  type NodeRuntimeSourceTable
} from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import type { AuthoredDocumentVersion } from '@artificer-toolkit/schema/projections/authoredContent'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  authoredRootKeyColumns,
  authoredSourceFacts,
  authoredSourceKindsByTable,
  authoredSourceRootsForRead,
  authoredSourceRootsWhere,
  readsRootCatalogueOnly
} from './authoredSourceFacts.js'

const checksum = 'a'.repeat(64)
/**
 * The derivation shape each facts version produced. A derivation change fails the drift guard
 * until AUTHORED_SOURCE_FACTS_VERSION is bumped and its new shape added here; never re-pin an
 * existing version, or stored facts from the old derivation are mistaken for current ones.
 */
const factsShapeByVersion: Readonly<Record<number, string>> = {
  1: 'bd9f89f9203754081a83156523106116d6940867a2d308ddc1aa85d4f4c602c3',
  2: '109cf498720edeb3af1c05d7a6239694838221ca7919d9b95b6ec558c72309c2',
  3: '95fd3f6f8a65971fff2387c542bfde2e2ab68eb0d6854770a5c0c1adc70f0b34',
  4: '1e25cef1e57e7208056e4012cfca4d22f82fc978b338dd9f94954c2ed3824903',
  5: '3efb5e525265277e5c41938fdd4b19a0047d526e9081a50483fa635a6831bf5b'
}
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

  it('pins the facts version to the shape its derivation produces from the SRD corpus', () => {
    const derived = Object.entries(srdBaselineContent.subjects).flatMap(([kind, subjects]) =>
      subjects.flatMap((document: unknown) => {
        const subjectKind = subjectKinds[kind as keyof typeof subjectKinds]
        const facts = authoredSourceFacts(version(subjectKind, document))
        expect(facts.factsVersion).toBe(AUTHORED_SOURCE_FACTS_VERSION)
        return Object.entries(facts.rows).map(([table, rows]) => ({
          subjectKind,
          table,
          columns: [...new Set((rows ?? []).flatMap((row) => Object.keys(row)))].sort()
        }))
      })
    )
    const shape = {
      kindsByTable: authoredSourceKindsByTable,
      derived: [...new Map(derived.map((entry) => [JSON.stringify(entry), entry])).values()].sort(
        (left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))
      )
    }

    expect(new Set(Object.values(factsShapeByVersion)).size).toBe(
      Object.keys(factsShapeByVersion).length
    )
    expect(Math.max(...Object.keys(factsShapeByVersion).map(Number))).toBe(
      AUTHORED_SOURCE_FACTS_VERSION
    )
    expect(checksumRuleDocument(shape)).toBe(factsShapeByVersion[AUTHORED_SOURCE_FACTS_VERSION])
  })

  it('keys every root-owned row by its own root, so a read by root key returns all of its rows', () => {
    const keyed = Object.entries(srdBaselineContent.subjects).flatMap(([kind, subjects]) =>
      subjects.flatMap((document: { id: string; category?: unknown }) => {
        const facts = authoredSourceFacts(
          version(subjectKinds[kind as keyof typeof subjectKinds], document)
        )
        return (Object.keys(authoredRootKeyColumns) as NodeRuntimeSourceTable[]).flatMap(
          (table) => {
            const keys = authoredRootKeyColumns[table]
            return (facts.rows[table] ?? []).map((row) => ({
              table,
              owner: [document.id, keys?.category ? document.category : undefined],
              key: [row[keys?.id ?? ''], keys?.category ? row[keys.category] : undefined]
            }))
          }
        )
      })
    )

    expect(keyed.length).toBeGreaterThan(1000)
    expect(keyed.filter(({ owner, key }) => JSON.stringify(owner) !== JSON.stringify(key))).toEqual(
      []
    )
  })

  it('derives the roots a read pins and replays them as an equivalent predicate', () => {
    const pinned = {
      kind: 'AND',
      expressions: [
        { kind: 'PREDICATE', column: 'magic_school_id', op: '=', value: 'evocation' },
        { kind: 'PREDICATE', column: 'id', op: 'IN', values: ['b', 'a', 'b', 7] }
      ]
    } as const

    expect(authoredSourceRootsForRead('spells', pinned)).toEqual({ by: 'ID', ids: ['a', 'b'] })
    expect(
      authoredSourceRootsForRead('equipment', {
        kind: 'PREDICATE',
        column: 'category',
        op: '=',
        value: 'WEAPON'
      })
    ).toEqual({ by: 'CATEGORY', categories: ['WEAPON'] })
    expect(
      authoredSourceRootsForRead('spells', {
        kind: 'OR',
        expressions: [{ kind: 'PREDICATE', column: 'id', op: '=', value: 'a' }]
      })
    ).toEqual({ by: 'KIND' })
    expect(
      authoredSourceRootsForRead('spells', {
        kind: 'PREDICATE',
        column: 'id',
        op: '!=',
        value: 'a'
      })
    ).toEqual({ by: 'KIND' })
    expect(authoredSourceRootsForRead('conditions', pinned)).toEqual({ by: 'KIND' })

    for (const [table, roots] of [
      ['spells', { by: 'ID', ids: ['a', 'b'] }],
      ['equipment', { by: 'CATEGORY', categories: ['ARMOR', 'WEAPON'] }],
      ['conditions', { by: 'KIND' }]
    ] satisfies [NodeRuntimeSourceTable, AuthoredSourceRoots][])
      expect(authoredSourceRootsForRead(table, authoredSourceRootsWhere(table, roots))).toEqual(
        roots
      )
    expect(() => authoredSourceRootsWhere('spells', { by: 'CATEGORY', categories: ['A'] })).toThrow(
      'Authoring source roots do not key spells.'
    )
  })

  it("serves only a root table's id and label from the root itself", () => {
    expect(readsRootCatalogueOnly('spells', ['id', 'label'])).toBe(true)
    expect(readsRootCatalogueOnly('classes', ['id'])).toBe(true)
    expect(readsRootCatalogueOnly('spells', ['id', 'label', 'magic_school_id'])).toBe(false)
    expect(readsRootCatalogueOnly('class_resources', ['id', 'label'])).toBe(false)
    expect(readsRootCatalogueOnly('conditions', ['id', 'label'])).toBe(false)
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
