import { describe, expect, it } from 'vitest'

import {
  checksumCompiledAuthoredProjection,
  checksumSystemVocabularySnapshot,
  srdBaselineContent
} from '@artificer-toolkit/db'

import {
  canonicalizeProjectionJson,
  checksumProjectionDocument,
  equalProjectionDocuments
} from './projectionChecksum.js'

describe('projection checksums', () => {
  it('is stable across object key ordering', () => {
    const left = { nested: { z: 2, a: [true, null] }, label: 'projection' }
    const right = { label: 'projection', nested: { a: [true, null], z: 2 } }

    expect(canonicalizeProjectionJson(left)).toBe(canonicalizeProjectionJson(right))
    expect(checksumProjectionDocument(left)).toBe(checksumProjectionDocument(right))
    expect(equalProjectionDocuments(left, right)).toBe(true)
  })

  it('fails closed for non-JSON projection values', () => {
    expect(() => checksumProjectionDocument({ value: Number.NaN })).toThrow('finite numbers')
    expect(() => checksumProjectionDocument({ value: new Date() })).toThrow('plain JSON objects')
  })

  it('includes versioned authored dependencies in an operational projection checksum', () => {
    const base = {
      subjectKind: 'RACE' as const,
      subjectId: 'subrace-1',
      authoredVersionId: 'subrace-version-1',
      authoredVersion: 1,
      authoredChecksum: 'a'.repeat(64),
      projectionSchemaVersion: 1,
      compilerVersion: 'compiler-1',
      vocabularySnapshotId: 'snapshot-1',
      vocabularySnapshotVersion: 1,
      vocabularySnapshotChecksum: 'b'.repeat(64),
      authoredDependencies: [
        {
          subjectKind: 'RACE' as const,
          subjectId: 'parent-1',
          versionId: 'parent-version-1',
          version: 1,
          checksum: 'c'.repeat(64)
        }
      ],
      projection: { id: 'subrace-1' }
    }

    expect(checksumCompiledAuthoredProjection(base)).not.toBe(
      checksumCompiledAuthoredProjection({
        ...base,
        authoredDependencies: [
          {
            ...base.authoredDependencies[0],
            versionId: 'parent-version-2',
            version: 2
          }
        ]
      })
    )
    expect(checksumCompiledAuthoredProjection(base)).not.toBe(
      checksumCompiledAuthoredProjection({ ...base, authoredVersion: 2 })
    )
    expect(checksumCompiledAuthoredProjection(base)).toBe(
      checksumCompiledAuthoredProjection({
        ...base,
        projectionChecksum: 'f'.repeat(64)
      })
    )
  })

  it('includes the vocabulary snapshot identity and version in its checksum', () => {
    const system = srdBaselineContent.vocabulary.systems[0]
    if (!system) throw new Error('SRD System fixture is missing.')
    const snapshot = {
      snapshotId: 'snapshot-1',
      systemId: system.id,
      snapshotVersion: 1,
      schemaVersion: 1,
      document: system
    }

    expect(checksumSystemVocabularySnapshot(snapshot)).not.toBe(
      checksumSystemVocabularySnapshot({ ...snapshot, snapshotVersion: 2 })
    )
  })
})
