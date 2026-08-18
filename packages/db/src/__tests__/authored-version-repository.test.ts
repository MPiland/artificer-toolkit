import { describe, expect, it } from 'vitest'

import type { AuthoredVersionRecord } from '../domains/subjects/repositories/authoredVersion.js'
import {
  assertAuthoredVersionRecordIntegrity,
  AuthoredVersionProjectionMismatchError
} from '../domains/subjects/repositories/authoredVersion.js'
import { checksumCanonicalJson } from '../utils/canonicalJson.js'
import { checksumCompiledAuthoredProjection } from '../utils/versionedProjectionChecksum.js'

function createEquipmentVariantRecord(
  includeParentDependency = true
): AuthoredVersionRecord {
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
  it('accepts an equipment variant that pins its exact parent version', () => {
    expect(() => assertAuthoredVersionRecordIntegrity(createEquipmentVariantRecord())).not.toThrow()
  })

  it('rejects an equipment variant without its parent version pin', () => {
    expect(() => assertAuthoredVersionRecordIntegrity(createEquipmentVariantRecord(false))).toThrow(
      AuthoredVersionProjectionMismatchError
    )
  })
})
