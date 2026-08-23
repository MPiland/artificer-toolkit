import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { AuthoredVersionRecord } from '../domains/subjects/repositories/authoredVersion.js'
import {
  assertAuthoredVersionRecordIntegrity,
  AuthoredVersionProjectionMismatchError
} from '../domains/subjects/repositories/authoredVersion.js'
import { checksumCanonicalJson } from '../utils/canonicalJson.js'
import { checksumCompiledAuthoredProjection } from '../utils/versionedProjectionChecksum.js'

const source = readFileSync(
  join(process.cwd(), 'packages/db/src/domains/subjects/repositories/authoredVersion.ts'),
  'utf8'
)

function sourceBetween(start: string, end: string): string {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex)
  expect(startIndex).toBeGreaterThanOrEqual(0)
  expect(endIndex).toBeGreaterThan(startIndex)
  return source.slice(startIndex, endIndex)
}

function createEquipmentVariantRecord(includeParentDependency = true): AuthoredVersionRecord {
  const document = {
    kind: 'EQUIPMENT' as const,
    id: 'equipment-variant-1',
    label: 'Longsword +1',
    description: null,
    rarityId: 'common',
    category: 'VARIANT' as const,
    parentEquipmentId: 'equipment-parent-1',
    userId: 'user-1',
    systemId: 'system-1'
  }
  const authored = {
    subjectKind: 'EQUIPMENT' as const,
    subjectId: document.id,
    versionId: 'equipment-variant-version-1',
    version: 1,
    documentSchemaVersion: 1,
    checksum: checksumCanonicalJson(document),
    document
  }
  const authoredDependencies = includeParentDependency
    ? [
        {
          subjectKind: 'EQUIPMENT' as const,
          subjectId: document.parentEquipmentId,
          versionId: 'equipment-parent-version-1',
          version: 1,
          checksum: 'a'.repeat(64)
        }
      ]
    : []
  const compiledInput = {
    subjectKind: 'EQUIPMENT' as const,
    subjectId: document.id,
    authoredVersionId: authored.versionId,
    authoredVersion: authored.version,
    authoredChecksum: authored.checksum,
    projectionSchemaVersion: 1,
    compilerVersion: 'subject-compiler-v1',
    vocabularySnapshotId: 'snapshot-1',
    vocabularySnapshotVersion: 1,
    vocabularySnapshotChecksum: 'b'.repeat(64),
    authoredDependencies,
    projection: {}
  }
  return {
    authored,
    compiled: {
      ...compiledInput,
      projectionChecksum: checksumCompiledAuthoredProjection(compiledInput)
    }
  }
}

describe('authored version repository integrity', () => {
  it('locks the exact immutable vocabulary snapshot for shared validation', () => {
    const vocabularySnapshotLock = sourceBetween(
      'async function lockVocabularySnapshot(',
      'export interface AuthoredVersionRepository'
    )

    expect(vocabularySnapshotLock).toContain('where id = ${snapshotId}')
    expect(vocabularySnapshotLock).toContain('for share')
    expect(vocabularySnapshotLock).not.toContain('for update')
  })

  it('loads exact current authored versions in deterministic shared-lock order', () => {
    const currentVersionRead = sourceBetween(
      'async findCurrentVersions(input)',
      'async listVersions(input)'
    )

    expect(currentVersionRead).toContain("root.status = 'ACTIVE'")
    expect(currentVersionRead).toContain('version.id = root.active_version_id')
    expect(currentVersionRead).toContain('order by root.id, version.id')
    expect(currentVersionRead).toContain('for share')
    expect(currentVersionRead).not.toContain('for update')
    expect(currentVersionRead).toContain('sortedGroups')
    expect(currentVersionRead).toContain('subjectEntries = [...unsortedEntries].sort')
  })

  it('accepts an equipment variant that pins its exact parent version', () => {
    expect(() => assertAuthoredVersionRecordIntegrity(createEquipmentVariantRecord())).not.toThrow()
  })

  it('rejects an equipment variant without its parent version pin', () => {
    expect(() => assertAuthoredVersionRecordIntegrity(createEquipmentVariantRecord(false))).toThrow(
      AuthoredVersionProjectionMismatchError
    )
  })
})
