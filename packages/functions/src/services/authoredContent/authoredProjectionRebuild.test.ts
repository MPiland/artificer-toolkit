import { describe, expect, it } from 'vitest'

import {
  checksumCanonicalJson,
  checksumCompiledAuthoredProjection,
  normalizeCanonicalJson,
  srdBaselineContent,
  type AuthoredVersionRecord
} from '@artificer-toolkit/db'
import {
  authoredDocumentVersionSchema,
  compiledAuthoredProjectionSchema,
  type JsonValue
} from '@artificer-toolkit/schema/projections'
import {
  compileBackground,
  compileEquipment,
  compileRace,
  resolveEquipmentAuthored,
  resolveRaceAuthored
} from '@artificer-toolkit/shared/subjects/compilers'
import type { EquipmentAuthored, RaceAuthored } from '@artificer-toolkit/shared/subjects/authored'

import {
  assertAuthoredProjectionRebuild,
  AuthoredProjectionRebuildError,
  rebuildAuthoredProjectionDocument
} from './authoredProjectionRebuild.js'
import {
  AUTHORED_PROJECTION_COMPILER_VERSION,
  AUTHORED_PROJECTION_SCHEMA_VERSION
} from './versionedAuthoring.js'

function requireProjectionDocument(value: unknown): Record<string, JsonValue> {
  const normalized = normalizeCanonicalJson(value)
  if (typeof normalized !== 'object' || normalized === null || Array.isArray(normalized)) {
    throw new Error('Expected an object projection.')
  }
  return normalized
}

function createBackgroundVersionRecord(): AuthoredVersionRecord {
  const document = srdBaselineContent.subjects.backgrounds[0]
  if (!document) throw new Error('SRD background fixture is missing.')
  const authored = authoredDocumentVersionSchema.parse({
    subjectKind: 'BACKGROUND',
    subjectId: document.id,
    versionId: 'background-version-1',
    version: 1,
    documentSchemaVersion: 1,
    checksum: checksumCanonicalJson(document),
    document
  })
  const projection = requireProjectionDocument(compileBackground(document))
  const compiledInput = {
    subjectKind: 'BACKGROUND' as const,
    subjectId: document.id,
    authoredVersionId: authored.versionId,
    authoredVersion: authored.version,
    authoredChecksum: authored.checksum,
    projectionSchemaVersion: AUTHORED_PROJECTION_SCHEMA_VERSION,
    compilerVersion: AUTHORED_PROJECTION_COMPILER_VERSION,
    vocabularySnapshotId: 'snapshot-1',
    vocabularySnapshotVersion: 1,
    vocabularySnapshotChecksum: 'a'.repeat(64),
    authoredDependencies: [],
    projection
  }
  const compiled = compiledAuthoredProjectionSchema.parse({
    ...compiledInput,
    projectionChecksum: checksumCompiledAuthoredProjection(compiledInput)
  })
  return { authored, compiled }
}

function createRaceVersionRecord(input: {
  document: RaceAuthored
  parent?: AuthoredVersionRecord
  versionId: string
}): AuthoredVersionRecord {
  const authored = authoredDocumentVersionSchema.parse({
    subjectKind: 'RACE',
    subjectId: input.document.id,
    versionId: input.versionId,
    version: 1,
    documentSchemaVersion: 1,
    checksum: checksumCanonicalJson(input.document),
    document: input.document
  })
  const dependencies = input.parent
    ? [
        {
          subjectKind: 'RACE' as const,
          subjectId: input.parent.authored.subjectId,
          versionId: input.parent.authored.versionId,
          version: input.parent.authored.version,
          checksum: input.parent.authored.checksum
        }
      ]
    : []
  const projection = requireProjectionDocument(
    compileRace(
      resolveRaceAuthored(input.document, (parentId) =>
        parentId === input.parent?.authored.subjectId && input.parent?.authored.subjectKind === 'RACE'
          ? input.parent.authored.document as RaceAuthored
          : null
      )
    )
  )
  const compiledInput = {
    subjectKind: 'RACE' as const,
    subjectId: input.document.id,
    authoredVersionId: authored.versionId,
    authoredVersion: authored.version,
    authoredChecksum: authored.checksum,
    projectionSchemaVersion: AUTHORED_PROJECTION_SCHEMA_VERSION,
    compilerVersion: AUTHORED_PROJECTION_COMPILER_VERSION,
    vocabularySnapshotId: 'snapshot-1',
    vocabularySnapshotVersion: 1,
    vocabularySnapshotChecksum: 'a'.repeat(64),
    authoredDependencies: dependencies,
    projection
  }
  const compiled = compiledAuthoredProjectionSchema.parse({
    ...compiledInput,
    projectionChecksum: checksumCompiledAuthoredProjection(compiledInput)
  })
  return { authored, compiled }
}

function createEquipmentVersionRecord(input: {
  document: EquipmentAuthored
  parent?: AuthoredVersionRecord
  versionId: string
}): AuthoredVersionRecord {
  const authored = authoredDocumentVersionSchema.parse({
    subjectKind: 'EQUIPMENT',
    subjectId: input.document.id,
    versionId: input.versionId,
    version: 1,
    documentSchemaVersion: 1,
    checksum: checksumCanonicalJson(input.document),
    document: input.document
  })
  const dependencies = input.parent
    ? [
        {
          subjectKind: 'EQUIPMENT' as const,
          subjectId: input.parent.authored.subjectId,
          versionId: input.parent.authored.versionId,
          version: input.parent.authored.version,
          checksum: input.parent.authored.checksum
        }
      ]
    : []
  const projection = requireProjectionDocument(
    compileEquipment(
      input.document.category === 'VARIANT'
        ? resolveEquipmentAuthored(input.document, (parentId) =>
            parentId === input.parent?.authored.subjectId &&
            input.parent?.authored.subjectKind === 'EQUIPMENT'
              ? input.parent.authored.document as EquipmentAuthored
              : null
          )
        : input.document
    )
  )
  const compiledInput = {
    subjectKind: 'EQUIPMENT' as const,
    subjectId: input.document.id,
    authoredVersionId: authored.versionId,
    authoredVersion: authored.version,
    authoredChecksum: authored.checksum,
    projectionSchemaVersion: AUTHORED_PROJECTION_SCHEMA_VERSION,
    compilerVersion: AUTHORED_PROJECTION_COMPILER_VERSION,
    vocabularySnapshotId: 'snapshot-1',
    vocabularySnapshotVersion: 1,
    vocabularySnapshotChecksum: 'a'.repeat(64),
    authoredDependencies: dependencies,
    projection
  }
  const compiled = compiledAuthoredProjectionSchema.parse({
    ...compiledInput,
    projectionChecksum: checksumCompiledAuthoredProjection(compiledInput)
  })
  return { authored, compiled }
}

describe('authored projection rebuild', () => {
  it('rebuilds a validated immutable authored version to its exact stored checksum', () => {
    const record = createBackgroundVersionRecord()

    expect(rebuildAuthoredProjectionDocument(record)).toEqual(record.compiled.projection)
    expect(() => assertAuthoredProjectionRebuild(record)).not.toThrow()
  })

  it('fails closed when the stored projection checksum cannot be rebuilt', () => {
    const record = createBackgroundVersionRecord()
    const mismatched: AuthoredVersionRecord = {
      ...record,
      compiled: {
        ...record.compiled,
        projectionChecksum: 'f'.repeat(64)
      }
    }

    expect(() => assertAuthoredProjectionRebuild(mismatched)).toThrow(
      AuthoredProjectionRebuildError
    )
  })

  it('rebuilds a subrace from its exact pinned parent document', () => {
    const subrace = srdBaselineContent.subjects.races.find((race) => race.category === 'SUBRACE')
    if (!subrace) throw new Error('SRD subrace fixture is missing.')
    const parent = srdBaselineContent.subjects.races.find(
      (race) => race.id === subrace.parentRaceId
    )
    if (!parent || parent.category !== 'BASE') throw new Error('SRD base race fixture is missing.')

    const parentRecord = createRaceVersionRecord({
      document: parent,
      versionId: 'parent-race-version-1'
    })
    const subraceRecord = createRaceVersionRecord({
      document: subrace,
      parent: parentRecord,
      versionId: 'subrace-version-1'
    })

    expect(() => assertAuthoredProjectionRebuild(subraceRecord, [parentRecord])).not.toThrow()
    expect(() => assertAuthoredProjectionRebuild(subraceRecord)).toThrow(
      AuthoredProjectionRebuildError
    )
  })

  it('rebuilds an equipment variant from its exact pinned parent document', () => {
    const parent = srdBaselineContent.subjects.equipment.find(
      (equipment) => equipment.category !== 'VARIANT'
    )
    if (!parent) throw new Error('SRD base equipment fixture is missing.')
    const variant: EquipmentAuthored = {
      kind: 'EQUIPMENT',
      id: 'equipment-variant-1',
      label: `${parent.label} +1`,
      description: null,
      rarityId: parent.rarityId,
      category: 'VARIANT',
      parentEquipmentId: parent.id,
      userId: parent.userId,
      systemId: parent.systemId
    }
    const parentRecord = createEquipmentVersionRecord({
      document: parent,
      versionId: 'parent-equipment-version-1'
    })
    const variantRecord = createEquipmentVersionRecord({
      document: variant,
      parent: parentRecord,
      versionId: 'equipment-variant-version-1'
    })

    expect(() => assertAuthoredProjectionRebuild(variantRecord, [parentRecord])).not.toThrow()
    expect(() => assertAuthoredProjectionRebuild(variantRecord)).toThrow(
      AuthoredProjectionRebuildError
    )
  })
})
