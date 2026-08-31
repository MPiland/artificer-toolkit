import {
  checksumCompiledAuthoredProjection,
  normalizeCanonicalJson,
  type AuthoredVersionRecord
} from '@artificer-toolkit/db'
import type { JsonValue } from '@artificer-toolkit/schema/projections/identity'
import {
  assertCompiledSubjectMechanicsIndex,
  compileSubjectWithMechanicsIndex,
  resolveEquipmentAuthored,
  resolveRaceAuthored
} from '@artificer-toolkit/shared/subjects/compilers'
import type { EquipmentAuthored, RaceAuthored } from '@artificer-toolkit/shared/subjects/authored'

import {
  AUTHORED_PROJECTION_COMPILER_VERSION,
  AUTHORED_PROJECTION_SCHEMA_VERSION
} from './versionedAuthoring.js'

export class AuthoredProjectionRebuildError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthoredProjectionRebuildError'
  }
}

function requireProjectionDocument(value: unknown): Record<string, JsonValue> {
  const normalized = normalizeCanonicalJson(value)
  if (typeof normalized !== 'object' || normalized === null || Array.isArray(normalized)) {
    throw new AuthoredProjectionRebuildError(
      'Authored compilation must produce an object projection.'
    )
  }
  return normalized
}

function assertSupportedCompiler(record: AuthoredVersionRecord): void {
  if (record.compiled.compilerVersion !== AUTHORED_PROJECTION_COMPILER_VERSION) {
    throw new AuthoredProjectionRebuildError(
      `Authored ${record.authored.subjectKind} "${record.authored.subjectId}" uses unsupported compiler version "${record.compiled.compilerVersion}".`
    )
  }
  if (record.compiled.projectionSchemaVersion !== AUTHORED_PROJECTION_SCHEMA_VERSION) {
    throw new AuthoredProjectionRebuildError(
      `Authored ${record.authored.subjectKind} "${record.authored.subjectId}" uses unsupported projection schema version ${record.compiled.projectionSchemaVersion}.`
    )
  }
}

function rebuildRaceProjection(
  record: AuthoredVersionRecord,
  dependencies: readonly AuthoredVersionRecord[]
): Record<string, JsonValue> {
  const authored = record.authored
  if (authored.subjectKind !== 'RACE') {
    throw new AuthoredProjectionRebuildError(
      'Race projection rebuild received another subject kind.'
    )
  }
  const race = authored.document as RaceAuthored
  if (race.category === 'BASE') {
    if (dependencies.length !== 0) {
      throw new AuthoredProjectionRebuildError(
        `Base race "${authored.subjectId}" cannot have authored dependencies.`
      )
    }
    const compilation = compileSubjectWithMechanicsIndex({ subjectKind: 'RACE', authored: race })
    assertCompiledSubjectMechanicsIndex(compilation.mechanicsIndex)
    return requireProjectionDocument(compilation.compiled)
  }

  const parent = dependencies.find(
    (dependency) =>
      dependency.authored.subjectKind === 'RACE' &&
      dependency.authored.subjectId === race.parentRaceId
  )
  if (!parent || parent.authored.subjectKind !== 'RACE') {
    throw new AuthoredProjectionRebuildError(
      `Subrace "${authored.subjectId}" does not have its pinned parent race document.`
    )
  }
  if (dependencies.length !== 1) {
    throw new AuthoredProjectionRebuildError(
      `Subrace "${authored.subjectId}" must have exactly one authored dependency.`
    )
  }
  const compilation = compileSubjectWithMechanicsIndex({
    subjectKind: 'RACE',
    authored: race,
    effectiveAuthored: resolveRaceAuthored(race, (parentId) =>
      parentId === parent.authored.subjectId ? (parent.authored.document as RaceAuthored) : null
    )
  })
  assertCompiledSubjectMechanicsIndex(compilation.mechanicsIndex)
  return requireProjectionDocument(compilation.compiled)
}

function rebuildEquipmentProjection(
  record: AuthoredVersionRecord,
  dependencies: readonly AuthoredVersionRecord[]
): Record<string, JsonValue> {
  const authored = record.authored
  if (authored.subjectKind !== 'EQUIPMENT') {
    throw new AuthoredProjectionRebuildError(
      'Equipment projection rebuild received another subject kind.'
    )
  }
  const equipment = authored.document as EquipmentAuthored
  if (equipment.category !== 'VARIANT') {
    if (dependencies.length !== 0) {
      throw new AuthoredProjectionRebuildError(
        `Base equipment "${authored.subjectId}" cannot have authored dependencies.`
      )
    }
    const compilation = compileSubjectWithMechanicsIndex({
      subjectKind: 'EQUIPMENT',
      authored: equipment
    })
    assertCompiledSubjectMechanicsIndex(compilation.mechanicsIndex)
    return requireProjectionDocument(compilation.compiled)
  }

  const parent = dependencies.find(
    (dependency) =>
      dependency.authored.subjectKind === 'EQUIPMENT' &&
      dependency.authored.subjectId === equipment.parentEquipmentId
  )
  if (!parent || parent.authored.subjectKind !== 'EQUIPMENT') {
    throw new AuthoredProjectionRebuildError(
      `Equipment variant "${authored.subjectId}" does not have its pinned parent equipment document.`
    )
  }
  if (dependencies.length !== 1) {
    throw new AuthoredProjectionRebuildError(
      `Equipment variant "${authored.subjectId}" must have exactly one authored dependency.`
    )
  }
  const compilation = compileSubjectWithMechanicsIndex({
    subjectKind: 'EQUIPMENT',
    authored: equipment,
    effectiveAuthored: resolveEquipmentAuthored(equipment, (parentId) =>
      parentId === parent.authored.subjectId
        ? (parent.authored.document as EquipmentAuthored)
        : null
    )
  })
  assertCompiledSubjectMechanicsIndex(compilation.mechanicsIndex)
  return requireProjectionDocument(compilation.compiled)
}

export function rebuildAuthoredProjectionDocument(
  record: AuthoredVersionRecord,
  dependencies: readonly AuthoredVersionRecord[] = []
): Record<string, JsonValue> {
  assertSupportedCompiler(record)
  const authored = record.authored
  switch (authored.subjectKind) {
    case 'EQUIPMENT':
      return rebuildEquipmentProjection(record, dependencies)
    case 'RACE':
      return rebuildRaceProjection(record, dependencies)
    default: {
      const compilation = compileSubjectWithMechanicsIndex({
        subjectKind: authored.subjectKind,
        authored: authored.document
      })
      assertCompiledSubjectMechanicsIndex(compilation.mechanicsIndex)
      return requireProjectionDocument(compilation.compiled)
    }
  }
}

export function assertAuthoredProjectionRebuild(
  record: AuthoredVersionRecord,
  dependencies: readonly AuthoredVersionRecord[] = []
): void {
  const rebuilt = rebuildAuthoredProjectionDocument(record, dependencies)
  const checksum = checksumCompiledAuthoredProjection({
    ...record.compiled,
    projection: rebuilt
  })
  if (checksum !== record.compiled.projectionChecksum) {
    throw new AuthoredProjectionRebuildError(
      `Authored ${record.authored.subjectKind} "${record.authored.subjectId}" version ${record.authored.version} does not rebuild to its stored projection checksum.`
    )
  }
}
