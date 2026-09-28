import {
  contentSnapshotDocumentsObjectSchema,
  contentSnapshotHeadSchema,
  contentSnapshotIndexObjectSchema,
  type ContentSnapshotDocument,
  type ContentSnapshotHeader,
  type ContentSnapshotIndexEntry,
  type ContentSnapshotKind
} from '@artificer-toolkit/schema/api/contentSnapshots'
import type { EquipmentAuthoredDto } from '@artificer-toolkit/schema/subjects/equipment'
import type { RaceAuthoredDto } from '@artificer-toolkit/schema/subjects/race'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { resolveEquipmentAuthored } from '@artificer-toolkit/shared/subjects/compilers'
import { prepareSrdImport } from '@artificer-toolkit/source-data/srd/import.js'
import { describe, expect, it } from 'vitest'

import { toCharacterBuilderEquipmentCatalogRecord } from '../character/builderCatalog.js'
import {
  buildContentSnapshotPart,
  contentSnapshotObjectKey,
  parseContentSnapshotObjectKey,
  toContentSnapshotIndexEntry,
  type ContentSnapshotIndexSource
} from '../contentSnapshots.js'

const SCOPE_ID = '00000000-0000-4000-8000-000000000302'
const KINDS = [
  'RACE',
  'CLASS',
  'BACKGROUND',
  'EQUIPMENT',
  'FEAT',
  'SPELL',
  'CREATURE',
  'VEHICLE'
] as const satisfies readonly ContentSnapshotKind[]

const srd = prepareSrdImport()
// The import manifest already validated each document against its publication schema.
function srdDocuments<Kind extends ContentSnapshotKind>(kind: Kind) {
  return srd.subjects
    .filter((subject) => subject.subjectKind === kind)
    .map((subject) => subject.document as unknown as ContentSnapshotDocument<Kind>)
}

const equipmentById = new Map(srdDocuments('EQUIPMENT').map((document) => [document.id, document]))
function indexSource<Kind extends ContentSnapshotKind>(
  kind: Kind,
  document: ContentSnapshotDocument<Kind>
): Extract<ContentSnapshotIndexSource, { subjectKind: Kind }> {
  type Source = Extract<ContentSnapshotIndexSource, { subjectKind: Kind }>
  if (kind !== 'EQUIPMENT') return { subjectKind: kind, document } as unknown as Source
  const equipment = document as unknown as EquipmentAuthoredDto
  const effective = toCharacterBuilderEquipmentCatalogRecord(
    // Authored charge refinements narrow beyond the validated DTO's inferred type.
    resolveEquipmentAuthored(
      equipment as EquipmentAuthored,
      (id) => equipmentById.get(id) as EquipmentAuthored | undefined
    )
  )
  const source: Extract<ContentSnapshotIndexSource, { subjectKind: 'EQUIPMENT' }> = {
    subjectKind: 'EQUIPMENT',
    document: equipment,
    builder: {
      version: 1,
      parentEquipmentId: equipment.category === 'VARIANT' ? equipment.parentEquipmentId : null,
      category: effective.category!,
      isContainer: effective.isContainer,
      maxStack: effective.maxStack,
      properties: effective.properties,
      requiresAttunement: effective.requiresAttunement
    }
  }
  return source as unknown as Source
}

function header<Kind extends ContentSnapshotKind, Part extends 'index' | 'documents'>(
  kind: Kind,
  part: Part,
  scope: ContentSnapshotHeader['scope'] = 'SOURCE',
  scopeId = SCOPE_ID
) {
  return { format: 1 as const, scope, scopeId, kind, part }
}

const races = srdDocuments('RACE')

describe('content snapshot parts', () => {
  it('builds the same object and hash regardless of root order', () => {
    const forward = buildContentSnapshotPart(header('RACE', 'documents'), races)
    const reversed = buildContentSnapshotPart(header('RACE', 'documents'), [...races].reverse())

    expect(reversed).toEqual(forward)
    expect(forward.rootCount).toBe(races.length)
    expect(forward.byteLength).toBe(new TextEncoder().encode(forward.json).byteLength)
    const ids = contentSnapshotDocumentsObjectSchema
      .parse(JSON.parse(forward.json))
      .roots.map((root) => root.id)
    expect(ids).toEqual([...ids].sort())
  })

  it('hashes the header, so the same roots in another scope, kind or part get another key', () => {
    const source = buildContentSnapshotPart(header('RACE', 'documents'), races)
    const system = buildContentSnapshotPart(header('RACE', 'documents', 'SYSTEM'), races)
    const otherSource = buildContentSnapshotPart(
      header('RACE', 'documents', 'SOURCE', '00000000-0000-4000-8000-000000000303'),
      races
    )
    const empty = (kind: 'FEAT' | 'VEHICLE') => buildContentSnapshotPart(header(kind, 'index'), [])

    expect(new Set([source.sha256, system.sha256, otherSource.sha256]).size).toBe(3)
    expect(empty('FEAT').sha256).not.toBe(empty('VEHICLE').sha256)
    expect(contentSnapshotObjectKey(header('RACE', 'documents'), source.sha256)).toBe(
      `v1/source/${SCOPE_ID}/race/documents/${source.sha256}.json`
    )
    expect(contentSnapshotObjectKey(header('RACE', 'documents', 'SYSTEM'), system.sha256)).toBe(
      `v1/system/${SCOPE_ID}/race/documents/${system.sha256}.json`
    )
    expect(() => contentSnapshotObjectKey(header('RACE', 'index'), 'not-a-hash')).toThrow()
  })

  it('parses only canonical object keys', () => {
    const { sha256 } = buildContentSnapshotPart(header('RACE', 'index'), [])
    const key = contentSnapshotObjectKey(header('RACE', 'index'), sha256)
    expect(parseContentSnapshotObjectKey(key)).toEqual({ header: header('RACE', 'index'), sha256 })
    for (const other of [
      key.toUpperCase(),
      key.replace('/race/', '/RACE/'),
      key.replace(SCOPE_ID, 'not-a-uuid'),
      key.replace('v1/', 'v2/'),
      key.replace('/index/', '/other/'),
      key.replace('.json', ''),
      `${key}/extra`,
      `../${key}`,
      key.replace(sha256, sha256.slice(1))
    ])
      expect(parseContentSnapshotObjectKey(other)).toBeNull()
  })

  it('splits picker facts into the index and full documents into the documents part', () => {
    const entries = races.map((race) => toContentSnapshotIndexEntry(indexSource('RACE', race)))
    const index = contentSnapshotIndexObjectSchema.parse(
      JSON.parse(buildContentSnapshotPart(header('RACE', 'index'), entries).json)
    )
    const documents = contentSnapshotDocumentsObjectSchema.parse(
      JSON.parse(buildContentSnapshotPart(header('RACE', 'documents'), races).json)
    )

    expect(index.roots.map((root) => root.id)).toEqual(documents.roots.map((root) => root.id))
    for (const root of index.roots) {
      expect(root).not.toHaveProperty('features')
      expect(root).not.toHaveProperty('details')
    }
    const dwarf = (documents.roots as RaceAuthoredDto[]).find((race) => race.label === 'Dwarf')!
    const dwarfEntry = index.roots.find((root) => root.id === dwarf.id)
    expect(dwarfEntry).toMatchObject({
      category: 'BASE',
      size: dwarf.category === 'BASE' ? dwarf.size : undefined,
      abilityScoreIncreaseFacts: [{ label: 'Constitution', value: '+2' }]
    })
  })

  it('rejects roots that do not match the header kind, duplicate roots and unknown fields', () => {
    const entries = races.map((race) => toContentSnapshotIndexEntry(indexSource('RACE', race)))

    const raceEntriesAsClasses = entries as unknown as ContentSnapshotIndexEntry<'CLASS'>[]
    expect(() => buildContentSnapshotPart(header('CLASS', 'index'), raceEntriesAsClasses)).toThrow()
    expect(() =>
      buildContentSnapshotPart(header('RACE', 'index'), [entries[0]!, entries[0]!])
    ).toThrow(/Duplicate content snapshot root/)
    const withFeatures = { ...entries[0]!, features: [] }
    expect(() => buildContentSnapshotPart(header('RACE', 'index'), [withFeatures])).toThrow()
    expect(() =>
      buildContentSnapshotPart({ ...header('RACE', 'index'), format: 2 as 1 }, entries)
    ).toThrow()
  })

  it('round-trips every SRD kind and part through its schema byte for byte', () => {
    for (const kind of KINDS) {
      const documents = srdDocuments(kind)
      const parts = [
        buildContentSnapshotPart(
          header(kind, 'index'),
          documents.map((document) => toContentSnapshotIndexEntry(indexSource(kind, document)))
        ),
        buildContentSnapshotPart(header(kind, 'documents'), documents)
      ]
      for (const part of parts) {
        const parsed = JSON.parse(part.json) as { part: string }
        const schema =
          parsed.part === 'index'
            ? contentSnapshotIndexObjectSchema
            : contentSnapshotDocumentsObjectSchema
        expect(canonicalizeJson(schema.parse(parsed)), `${kind} ${parsed.part}`).toBe(part.json)
      }
    }
    const head = {
      scope: 'SYSTEM',
      scopeId: SCOPE_ID,
      revision: 3,
      builtRevision: 2,
      kinds: { RACE: { index: { sha256: 'a'.repeat(64), byteLength: 10, rootCount: 1 } } }
    }
    expect(() => contentSnapshotHeadSchema.parse(head)).toThrow()
    const complete = {
      ...head,
      kinds: { RACE: { ...head.kinds.RACE, documents: head.kinds.RACE.index } }
    }
    expect(contentSnapshotHeadSchema.parse(complete)).toEqual(complete)
  })

  it('reports SRD index and documents sizes per kind within the picker budget', async ({
    annotate
  }) => {
    const gzipBytes = async (text: string) =>
      (
        await new Response(
          new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
        ).arrayBuffer()
      ).byteLength
    const rows = await Promise.all(
      KINDS.map(async (kind) => {
        const documents = srdDocuments(kind)
        const index = buildContentSnapshotPart(
          header(kind, 'index', 'SYSTEM'),
          documents.map((document) => toContentSnapshotIndexEntry(indexSource(kind, document)))
        )
        const full = buildContentSnapshotPart(header(kind, 'documents', 'SYSTEM'), documents)
        return {
          kind,
          roots: documents.length,
          indexBytes: index.byteLength,
          indexGzip: await gzipBytes(index.json),
          documentsBytes: full.byteLength,
          documentsGzip: await gzipBytes(full.json)
        }
      })
    )
    await annotate(JSON.stringify(rows))

    for (const row of rows) {
      expect(row.roots, row.kind).toBeGreaterThan(0)
      expect(row.indexBytes, row.kind).toBeLessThan(row.documentsBytes)
      // Plan budget: a picker opens with at most one 300 KB gzipped index per kind.
      expect(row.indexGzip, row.kind).toBeLessThanOrEqual(300 * 1024)
    }
  })
})
