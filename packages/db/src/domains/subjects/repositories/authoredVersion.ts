import { sql } from 'kysely'

import {
  authoredDocumentVersionSchema,
  compiledAuthoredProjectionSchema,
  type AuthoredDocumentVersion,
  type CompiledAuthoredProjection
} from '@artificer-toolkit/schema/projections/authoredContent'
import {
  authoredSubjectKindSchema,
  authoredVersionVectorSchema,
  type AuthoredSubjectKind,
  type AuthoredVersionVector
} from '@artificer-toolkit/schema/projections/identity'

import type { DBLike, Json } from '#types'
import {
  checksumCanonicalJson,
  checksumCompiledAuthoredProjection,
  withTransaction
} from '../../../utils/index.js'

interface AuthoredVersionTable {
  rootIdColumn: string
  rootTable: string
  versionTable: string
}

const tableBySubjectKind = {
  BACKGROUND: {
    rootIdColumn: 'background_id',
    rootTable: 'backgrounds',
    versionTable: 'background_versions'
  },
  CLASS: { rootIdColumn: 'class_id', rootTable: 'classes', versionTable: 'class_versions' },
  CREATURE: {
    rootIdColumn: 'creature_id',
    rootTable: 'creatures',
    versionTable: 'creature_versions'
  },
  EQUIPMENT: {
    rootIdColumn: 'equipment_id',
    rootTable: 'equipment',
    versionTable: 'equipment_versions'
  },
  FEAT: { rootIdColumn: 'feat_id', rootTable: 'feats', versionTable: 'feat_versions' },
  RACE: { rootIdColumn: 'race_id', rootTable: 'races', versionTable: 'race_versions' },
  SPELL: { rootIdColumn: 'spell_id', rootTable: 'spells', versionTable: 'spell_versions' },
  VEHICLE: {
    rootIdColumn: 'vehicle_id',
    rootTable: 'vehicles',
    versionTable: 'vehicle_versions'
  }
} as const satisfies Record<AuthoredSubjectKind, AuthoredVersionTable>

interface RootRow {
  active_version_id: string | null
  id: string
  status: string
  system_id: string
}

interface VersionRow {
  authored_dependency_vector: Json
  authored_checksum: string
  authored_document: Json
  compiled_checksum: string
  compiled_document: Json
  compiler_version: string
  document_schema_version: number
  id: string
  projection_schema_version: number
  snapshot_checksum: string
  snapshot_version: number
  version: number
  vocabulary_snapshot_id: string
}

interface ActiveVersionRow extends VersionRow {
  subject_id: string
}

interface VocabularySnapshotRow {
  checksum: string
  id: string
  system_id: string
  vocabulary_version: number
}

export interface AuthoredVersionRecord {
  authored: AuthoredDocumentVersion
  compiled: CompiledAuthoredProjection
}

export interface PublishAuthoredVersionInput {
  authoredDependencies: CompiledAuthoredProjection['authoredDependencies']
  authoredChecksum: string
  compiledDocument: CompiledAuthoredProjection['projection']
  compilerVersion: string
  document: AuthoredDocumentVersion['document']
  documentSchemaVersion: number
  projectionSchemaVersion: number
  subjectId: string
  subjectKind: AuthoredSubjectKind
  versionId: string
  vocabularySnapshotChecksum: string
  vocabularySnapshotId: string
  vocabularySnapshotVersion: number
}

export class AuthoredVersionProjectionMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthoredVersionProjectionMismatchError'
  }
}

function documentRecord(document: AuthoredDocumentVersion['document']): Record<string, unknown> {
  return document as Record<string, unknown>
}

function requiredDocumentString(document: Record<string, unknown>, key: string): string {
  const value = document[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new AuthoredVersionProjectionMismatchError(
      `Authored root envelope requires a non-empty "${key}" value.`
    )
  }
  return value
}

function optionalDocumentString(document: Record<string, unknown>, key: string): string | null {
  const value = document[key]
  return typeof value === 'string' ? value : null
}

function optionalDocumentInteger(document: Record<string, unknown>, key: string): number | null {
  const value = document[key]
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function optionalDocumentBoolean(document: Record<string, unknown>, key: string): boolean {
  return document[key] === true
}

function optionalDocumentObject(
  document: Record<string, unknown>,
  key: string
): Record<string, unknown> | null {
  const value = document[key]
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * Keeps the root rows as ownership, route, and catalog envelopes. The immutable
 * document version remains the complete authored aggregate; no child aggregate
 * rows are written here.
 */
export async function upsertAuthoredRootEnvelope(
  db: DBLike,
  input: {
    document: AuthoredDocumentVersion['document']
    subjectKind: AuthoredSubjectKind
  }
): Promise<void> {
  const document = documentRecord(input.document)
  const id = requiredDocumentString(document, 'id')
  const systemId = requiredDocumentString(document, 'systemId')
  const userId = requiredDocumentString(document, 'userId')
  const label = requiredDocumentString(document, 'label')
  const description = optionalDocumentString(document, 'description')

  switch (input.subjectKind) {
    case 'BACKGROUND':
      await sql`
        insert into public.backgrounds (id, system_id, user_id, label, description)
        values (${id}::uuid, ${systemId}::uuid, ${userId}::uuid, ${label}, ${description})
        on conflict (id) do update set
          system_id = excluded.system_id,
          user_id = excluded.user_id,
          label = excluded.label,
          description = excluded.description,
          updated_at = now()
      `.execute(db)
      return
    case 'CLASS': {
      const category = requiredDocumentString(document, 'category')
      const parentClassId = optionalDocumentString(document, 'parentClassId')
      const subclassSelectionLevel = optionalDocumentInteger(document, 'subclassSelectionLevel')
      await sql`
        insert into public.classes (
          id,
          system_id,
          user_id,
          category,
          parent_class_id,
          subclass_selection_level,
          label,
          description
        )
        values (
          ${id}::uuid,
          ${systemId}::uuid,
          ${userId}::uuid,
          ${category},
          ${parentClassId}::uuid,
          ${subclassSelectionLevel},
          ${label},
          ${description}
        )
        on conflict (id) do update set
          system_id = excluded.system_id,
          user_id = excluded.user_id,
          category = excluded.category,
          parent_class_id = excluded.parent_class_id,
          subclass_selection_level = excluded.subclass_selection_level,
          label = excluded.label,
          description = excluded.description,
          updated_at = now()
      `.execute(db)
      return
    }
    case 'CREATURE': {
      const category = requiredDocumentString(document, 'category')
      const creatureTypeId = optionalDocumentString(document, 'creatureTypeId')
      const challengeRatingId = optionalDocumentString(document, 'challengeRatingId')
      await sql`
        insert into public.creatures (
          id,
          system_id,
          user_id,
          label,
          description,
          category,
          creature_type_id,
          challenge_rating_id
        )
        values (
          ${id}::uuid,
          ${systemId}::uuid,
          ${userId}::uuid,
          ${label},
          ${description},
          ${category},
          ${creatureTypeId}::uuid,
          ${challengeRatingId}::uuid
        )
        on conflict (id) do update set
          system_id = excluded.system_id,
          user_id = excluded.user_id,
          label = excluded.label,
          description = excluded.description,
          category = excluded.category,
          creature_type_id = excluded.creature_type_id,
          challenge_rating_id = excluded.challenge_rating_id,
          updated_at = now()
      `.execute(db)
      return
    }
    case 'EQUIPMENT': {
      const category = requiredDocumentString(document, 'category')
      const rarityId = requiredDocumentString(document, 'rarityId')
      const parentEquipmentId = optionalDocumentString(document, 'parentEquipmentId')
      await sql`
        insert into public.equipment (
          id,
          system_id,
          user_id,
          label,
          description,
          category,
          rarity_id,
          parent_equipment_id,
          requires_attunement
        )
        values (
          ${id}::uuid,
          ${systemId}::uuid,
          ${userId}::uuid,
          ${label},
          ${description},
          ${category},
          ${rarityId}::uuid,
          ${parentEquipmentId}::uuid,
          ${optionalDocumentBoolean(document, 'requiresAttunement')}
        )
        on conflict (id) do update set
          system_id = excluded.system_id,
          user_id = excluded.user_id,
          label = excluded.label,
          description = excluded.description,
          category = excluded.category,
          rarity_id = excluded.rarity_id,
          parent_equipment_id = excluded.parent_equipment_id,
          requires_attunement = excluded.requires_attunement,
          updated_at = now()
      `.execute(db)
      return
    }
    case 'FEAT':
      await sql`
        insert into public.feats (id, system_id, user_id, label, description)
        values (
          ${id}::uuid,
          ${systemId}::uuid,
          ${userId}::uuid,
          ${label},
          ${requiredDocumentString(document, 'description')}
        )
        on conflict (id) do update set
          system_id = excluded.system_id,
          user_id = excluded.user_id,
          label = excluded.label,
          description = excluded.description,
          updated_at = now()
      `.execute(db)
      return
    case 'RACE': {
      const category = requiredDocumentString(document, 'category')
      const parentRaceId = optionalDocumentString(document, 'parentRaceId')
      const selectionMode = optionalDocumentString(document, 'selectionMode')
      const size = optionalDocumentString(document, 'size')
      await sql`
        insert into public.races (
          id,
          system_id,
          user_id,
          label,
          description,
          category,
          parent_race_id,
          selection_mode,
          size_code
        )
        values (
          ${id}::uuid,
          ${systemId}::uuid,
          ${userId}::uuid,
          ${label},
          ${description},
          ${category},
          ${parentRaceId}::uuid,
          ${selectionMode},
          ${size}
        )
        on conflict (id) do update set
          system_id = excluded.system_id,
          user_id = excluded.user_id,
          label = excluded.label,
          description = excluded.description,
          category = excluded.category,
          parent_race_id = excluded.parent_race_id,
          selection_mode = excluded.selection_mode,
          size_code = excluded.size_code,
          updated_at = now()
      `.execute(db)
      return
    }
    case 'SPELL': {
      const castingTime = optionalDocumentObject(document, 'castingTime')
      const castingTimeAmount = castingTime ? optionalDocumentInteger(castingTime, 'amount') : null
      const castingTimeUnit = castingTime ? optionalDocumentString(castingTime, 'unit') : null
      await sql`
        insert into public.spells (
          id,
          system_id,
          user_id,
          label,
          description,
          level,
          magic_school_id,
          casting_time_amount,
          casting_time_unit,
          material_description
        )
        values (
          ${id}::uuid,
          ${systemId}::uuid,
          ${userId}::uuid,
          ${label},
          ${description},
          ${optionalDocumentInteger(document, 'level')},
          ${optionalDocumentString(document, 'magicSchoolId')}::uuid,
          ${castingTimeAmount},
          ${castingTimeUnit},
          ${optionalDocumentString(document, 'materialDescription')}
        )
        on conflict (id) do update set
          system_id = excluded.system_id,
          user_id = excluded.user_id,
          label = excluded.label,
          description = excluded.description,
          level = excluded.level,
          magic_school_id = excluded.magic_school_id,
          casting_time_amount = excluded.casting_time_amount,
          casting_time_unit = excluded.casting_time_unit,
          material_description = excluded.material_description,
          updated_at = now()
      `.execute(db)
      return
    }
    case 'VEHICLE':
      await sql`
        insert into public.vehicles (id, system_id, user_id, label, description, category)
        values (
          ${id}::uuid,
          ${systemId}::uuid,
          ${userId}::uuid,
          ${label},
          ${description},
          ${requiredDocumentString(document, 'category')}
        )
        on conflict (id) do update set
          system_id = excluded.system_id,
          user_id = excluded.user_id,
          label = excluded.label,
          description = excluded.description,
          category = excluded.category,
          updated_at = now()
      `.execute(db)
  }
}

function mapVersion(
  subjectKind: AuthoredSubjectKind,
  subjectId: string,
  row: VersionRow
): AuthoredVersionRecord {
  const authored = authoredDocumentVersionSchema.parse({
    subjectKind,
    subjectId,
    versionId: row.id,
    version: row.version,
    documentSchemaVersion: row.document_schema_version,
    checksum: row.authored_checksum,
    document: row.authored_document
  })
  const compiled = compiledAuthoredProjectionSchema.parse({
    subjectKind,
    subjectId,
    authoredVersionId: row.id,
    authoredVersion: row.version,
    authoredChecksum: row.authored_checksum,
    projectionSchemaVersion: row.projection_schema_version,
    compilerVersion: row.compiler_version,
    vocabularySnapshotId: row.vocabulary_snapshot_id,
    vocabularySnapshotVersion: row.snapshot_version,
    vocabularySnapshotChecksum: row.snapshot_checksum,
    authoredDependencies: row.authored_dependency_vector,
    projectionChecksum: row.compiled_checksum,
    projection: row.compiled_document
  })

  const record = { authored, compiled }
  assertAuthoredVersionRecordIntegrity(record)
  return record
}

export function assertAuthoredVersionRecordIntegrity(input: AuthoredVersionRecord): void {
  if (input.authored.subjectKind !== input.compiled.subjectKind) {
    throw new AuthoredVersionProjectionMismatchError('Authored and compiled subject kinds differ.')
  }
  if (input.authored.subjectId !== input.compiled.subjectId) {
    throw new AuthoredVersionProjectionMismatchError(
      'Authored and compiled subject identities differ.'
    )
  }
  if (input.authored.versionId !== input.compiled.authoredVersionId) {
    throw new AuthoredVersionProjectionMismatchError(
      'Compiled projection references another authored version.'
    )
  }
  if (input.authored.version !== input.compiled.authoredVersion) {
    throw new AuthoredVersionProjectionMismatchError(
      'Compiled projection references another authored version number.'
    )
  }
  if (input.authored.checksum !== input.compiled.authoredChecksum) {
    throw new AuthoredVersionProjectionMismatchError(
      'Compiled projection references another authored checksum.'
    )
  }
  if (checksumCanonicalJson(input.authored.document) !== input.authored.checksum) {
    throw new AuthoredVersionProjectionMismatchError(
      'Authored document checksum does not match its contents.'
    )
  }
  if (checksumCompiledAuthoredProjection(input.compiled) !== input.compiled.projectionChecksum) {
    throw new AuthoredVersionProjectionMismatchError(
      'Compiled projection checksum does not match its document or dependencies.'
    )
  }
  if (
    input.compiled.authoredDependencies.some(
      (dependency) =>
        dependency.subjectKind === input.authored.subjectKind &&
        dependency.subjectId === input.authored.subjectId
    )
  ) {
    throw new AuthoredVersionProjectionMismatchError(
      'Compiled projection cannot depend on its own authored version.'
    )
  }
  const dependencies = input.compiled.authoredDependencies
  if (input.authored.subjectKind === 'RACE') {
    const race = input.authored.document
    if (race.category === 'BASE' && dependencies.length !== 0) {
      throw new AuthoredVersionProjectionMismatchError(
        'Base race projections cannot declare authored dependencies.'
      )
    }
    if (
      race.category === 'SUBRACE' &&
      (dependencies.length !== 1 ||
        dependencies[0]?.subjectKind !== 'RACE' ||
        dependencies[0]?.subjectId !== race.parentRaceId)
    ) {
      throw new AuthoredVersionProjectionMismatchError(
        'Subrace projections must pin exactly their parent race version.'
      )
    }
    return
  }

  if (input.authored.subjectKind === 'EQUIPMENT') {
    const equipment = input.authored.document
    if (equipment.category !== 'VARIANT' && dependencies.length !== 0) {
      throw new AuthoredVersionProjectionMismatchError(
        'Base equipment projections cannot declare authored dependencies.'
      )
    }
    if (
      equipment.category === 'VARIANT' &&
      (dependencies.length !== 1 ||
        dependencies[0]?.subjectKind !== 'EQUIPMENT' ||
        dependencies[0]?.subjectId !== equipment.parentEquipmentId)
    ) {
      throw new AuthoredVersionProjectionMismatchError(
        'Equipment variant projections must pin exactly their parent equipment version.'
      )
    }
    return
  }

  if (dependencies.length !== 0) {
    throw new AuthoredVersionProjectionMismatchError(
      'Only subrace and equipment variant projections currently declare authored dependencies.'
    )
  }
}

async function lockRoot(
  db: DBLike,
  subjectKind: AuthoredSubjectKind,
  subjectId: string
): Promise<RootRow | null> {
  const table = tableBySubjectKind[subjectKind]
  const result = await sql<RootRow>`
    select id, system_id, status, active_version_id
    from ${sql.table(table.rootTable)}
    where id = ${subjectId}
    for update
  `.execute(db)
  return result.rows[0] ?? null
}

async function readVersion(
  db: DBLike,
  subjectKind: AuthoredSubjectKind,
  subjectId: string,
  versionId: string
): Promise<AuthoredVersionRecord | null> {
  const table = tableBySubjectKind[subjectKind]
  const result = await sql<VersionRow>`
    select
      version.id,
      version.version,
      version.document_schema_version,
      version.projection_schema_version,
      version.compiler_version,
      version.authored_checksum,
      version.authored_dependency_vector,
      version.compiled_checksum,
      version.authored_document,
      version.compiled_document,
      version.vocabulary_snapshot_id,
      snapshot.vocabulary_version as snapshot_version,
      snapshot.checksum as snapshot_checksum
    from ${sql.table(table.versionTable)} version
    join public.system_vocabulary_snapshots snapshot
      on snapshot.id = version.vocabulary_snapshot_id
    where version.id = ${versionId}
      and ${sql.ref(table.rootIdColumn)} = ${subjectId}
    limit 1
  `.execute(db)
  const row = result.rows[0]
  if (!row) return null
  const record = mapVersion(subjectKind, subjectId, row)
  await assertAuthoredDependencies(db, record.compiled.authoredDependencies)
  return record
}

async function assertAuthoredDependencies(
  db: DBLike,
  dependencies: CompiledAuthoredProjection['authoredDependencies'],
  expectedSystemId?: string,
  lock = false
): Promise<void> {
  for (const dependency of dependencies) {
    const table = tableBySubjectKind[dependency.subjectKind]
    const result = await sql<{
      authored_checksum: string
      id: string
      root_system_id: string
      version: number
    }>`
      select
        version.id,
        version.version,
        version.authored_checksum,
        root.system_id as root_system_id
      from ${sql.table(table.versionTable)} version
      join ${sql.table(table.rootTable)} root
        on root.id = ${sql.ref(table.rootIdColumn)}
      where version.id = ${dependency.versionId}
        and ${sql.ref(table.rootIdColumn)} = ${dependency.subjectId}
      limit 1
      ${lock ? sql`for key share` : sql``}
    `.execute(db)
    const row = result.rows[0]
    if (
      !row ||
      row.version !== dependency.version ||
      row.authored_checksum !== dependency.checksum ||
      (expectedSystemId !== undefined && row.root_system_id !== expectedSystemId)
    ) {
      throw new AuthoredVersionProjectionMismatchError(
        `Authored dependency ${dependency.subjectKind} "${dependency.subjectId}" is unavailable or mismatched.`
      )
    }
  }
}

async function lockVocabularySnapshot(
  db: DBLike,
  snapshotId: string
): Promise<VocabularySnapshotRow | null> {
  const result = await sql<VocabularySnapshotRow>`
    select id, system_id, vocabulary_version, checksum
    from public.system_vocabulary_snapshots
    where id = ${snapshotId}
    for share
  `.execute(db)
  return result.rows[0] ?? null
}

export interface AuthoredVersionRepository {
  findActive(input: {
    subjectId: string
    subjectKind: AuthoredSubjectKind
  }): Promise<AuthoredVersionRecord | null>
  findActiveForPublication(input: {
    subjectId: string
    subjectKind: AuthoredSubjectKind
  }): Promise<AuthoredVersionRecord | null>
  findActiveByIds(input: {
    includeMaster?: boolean
    subjectIds: readonly string[]
    subjectKind: AuthoredSubjectKind
    systemId?: string
    userId?: string
  }): Promise<Map<string, AuthoredVersionRecord>>
  findVersionsByIds(input: {
    subjectKind: AuthoredSubjectKind
    verifyCompiledDependencies?: boolean
    versionIds: readonly string[]
  }): Promise<Map<string, AuthoredVersionRecord>>
  findExactVersions(input: {
    entries: AuthoredVersionVector
    verifyCompiledDependencies?: boolean
  }): Promise<Map<string, AuthoredVersionRecord>>
  findCurrentVersions(input: {
    entries: AuthoredVersionVector
    verifyCompiledDependencies?: boolean
  }): Promise<Map<string, AuthoredVersionRecord>>
  listVersions(input: { subjectKind: AuthoredSubjectKind }): Promise<AuthoredVersionRecord[]>
  findVersion(input: {
    subjectId: string
    subjectKind: AuthoredSubjectKind
    versionId: string
  }): Promise<AuthoredVersionRecord | null>
  publish(input: PublishAuthoredVersionInput): Promise<AuthoredVersionRecord>
}

export function createAuthoredVersionRepository(db: DBLike): AuthoredVersionRepository {
  return {
    async findActive(input) {
      const table = tableBySubjectKind[input.subjectKind]
      const rootResult = await sql<RootRow>`
        select id, system_id, status, active_version_id
        from ${sql.table(table.rootTable)}
        where id = ${input.subjectId}
      `.execute(db)
      const root = rootResult.rows[0]
      if (!root || root.status !== 'ACTIVE') return null
      if (!root.active_version_id) {
        throw new AuthoredVersionProjectionMismatchError(
          `Active ${input.subjectKind} "${input.subjectId}" has no active version.`
        )
      }

      const version = await readVersion(
        db,
        input.subjectKind,
        input.subjectId,
        root.active_version_id
      )
      if (!version) {
        throw new AuthoredVersionProjectionMismatchError(
          `Active ${input.subjectKind} "${input.subjectId}" points to an unavailable version.`
        )
      }
      return version
    },

    async findActiveForPublication(input) {
      const table = tableBySubjectKind[input.subjectKind]
      const rootResult = await sql<RootRow>`
        select id, system_id, status, active_version_id
        from ${sql.table(table.rootTable)}
        where id = ${input.subjectId}
      `.execute(db)
      const root = rootResult.rows[0]
      if (!root || root.status !== 'ACTIVE' || !root.active_version_id) return null

      const version = await readVersion(
        db,
        input.subjectKind,
        input.subjectId,
        root.active_version_id
      )
      if (!version) {
        throw new AuthoredVersionProjectionMismatchError(
          `Active ${input.subjectKind} "${input.subjectId}" points to an unavailable version.`
        )
      }
      return version
    },

    async findActiveByIds(input) {
      const subjectIds = [...new Set(input.subjectIds)]
      if (subjectIds.length === 0) return new Map()
      const table = tableBySubjectKind[input.subjectKind]
      const systemFilter = input.systemId
        ? sql`and root.system_id = ${input.systemId}::uuid`
        : sql``
      const accessFilter = input.userId
        ? input.includeMaster
          ? sql`and (root.user_id = ${input.userId}::uuid or root.is_master = true)`
          : sql`and root.user_id = ${input.userId}::uuid`
        : input.includeMaster
          ? sql`and root.is_master = true`
          : sql``
      const result = await sql<ActiveVersionRow>`
        select
          root.id as subject_id,
          version.id,
          version.version,
          version.document_schema_version,
          version.projection_schema_version,
          version.compiler_version,
          version.authored_checksum,
          version.authored_dependency_vector,
          version.compiled_checksum,
          version.authored_document,
          version.compiled_document,
          version.vocabulary_snapshot_id,
          snapshot.vocabulary_version as snapshot_version,
          snapshot.checksum as snapshot_checksum
        from ${sql.table(table.rootTable)} root
        join ${sql.table(table.versionTable)} version
          on version.id = root.active_version_id
        join public.system_vocabulary_snapshots snapshot
          on snapshot.id = version.vocabulary_snapshot_id
        where root.status = 'ACTIVE'
          and root.id in (${sql.join(subjectIds.map((subjectId) => sql`${subjectId}::uuid`))})
          ${systemFilter}
          ${accessFilter}
      `.execute(db)

      const records = await Promise.all(
        result.rows.map(async (row) => {
          const record = mapVersion(input.subjectKind, row.subject_id, row)
          await assertAuthoredDependencies(db, record.compiled.authoredDependencies)
          return [row.subject_id, record] as const
        })
      )
      return new Map(records)
    },

    async findVersionsByIds(input) {
      const versionIds = [...new Set(input.versionIds)]
      if (versionIds.length === 0) return new Map()
      const table = tableBySubjectKind[input.subjectKind]
      const result = await sql<ActiveVersionRow>`
        select
          root.id as subject_id,
          version.id,
          version.version,
          version.document_schema_version,
          version.projection_schema_version,
          version.compiler_version,
          version.authored_checksum,
          version.authored_dependency_vector,
          version.compiled_checksum,
          version.authored_document,
          version.compiled_document,
          version.vocabulary_snapshot_id,
          snapshot.vocabulary_version as snapshot_version,
          snapshot.checksum as snapshot_checksum
        from ${sql.table(table.versionTable)} version
        join ${sql.table(table.rootTable)} root
          on root.id = ${sql.ref(table.rootIdColumn)}
        join public.system_vocabulary_snapshots snapshot
          on snapshot.id = version.vocabulary_snapshot_id
        where version.id in (${sql.join(versionIds.map((versionId) => sql`${versionId}::uuid`))})
      `.execute(db)

      const records = await Promise.all(
        result.rows.map(async (row) => {
          const record = mapVersion(input.subjectKind, row.subject_id, row)
          if (input.verifyCompiledDependencies ?? true) {
            await assertAuthoredDependencies(db, record.compiled.authoredDependencies)
          }
          return [record.authored.versionId, record] as const
        })
      )
      return new Map(records)
    },

    async findExactVersions(input) {
      const entries = authoredVersionVectorSchema.parse(input.entries)
      const versionIdsByKind = new Map<AuthoredSubjectKind, string[]>()
      for (const entry of entries) {
        const versionIds = versionIdsByKind.get(entry.subjectKind) ?? []
        versionIds.push(entry.versionId)
        versionIdsByKind.set(entry.subjectKind, versionIds)
      }
      const recordsByVersion = new Map<string, AuthoredVersionRecord>()
      await Promise.all(
        [...versionIdsByKind.entries()].map(async ([subjectKind, versionIds]) => {
          const records = await createAuthoredVersionRepository(db).findVersionsByIds({
            subjectKind,
            verifyCompiledDependencies: input.verifyCompiledDependencies,
            versionIds
          })
          for (const [versionId, record] of records) {
            recordsByVersion.set(`${subjectKind}:${versionId}`, record)
          }
        })
      )

      const exact = new Map<string, AuthoredVersionRecord>()
      for (const entry of entries) {
        const record = recordsByVersion.get(`${entry.subjectKind}:${entry.versionId}`)
        if (
          !record ||
          record.authored.subjectKind !== entry.subjectKind ||
          record.authored.subjectId !== entry.subjectId ||
          record.authored.versionId !== entry.versionId ||
          record.authored.version !== entry.version ||
          record.authored.checksum !== entry.checksum
        ) {
          throw new AuthoredVersionProjectionMismatchError(
            `Authored ${entry.subjectKind} "${entry.subjectId}" version dependency is unavailable or mismatched.`
          )
        }
        exact.set(`${entry.subjectKind}:${entry.subjectId}`, record)
      }
      return exact
    },

    async findCurrentVersions(input) {
      const entries = authoredVersionVectorSchema.parse(input.entries)
      if (entries.length === 0) return new Map()
      return withTransaction(db, async (trx) => {
        const entriesBySubjectKind = new Map<AuthoredSubjectKind, AuthoredVersionVector>()
        for (const entry of entries) {
          const subjectEntries = entriesBySubjectKind.get(entry.subjectKind) ?? []
          subjectEntries.push(entry)
          entriesBySubjectKind.set(entry.subjectKind, subjectEntries)
        }
        const recordsByRoot = new Map<string, AuthoredVersionRecord>()
        const sortedGroups = [...entriesBySubjectKind].sort(([left], [right]) =>
          left.localeCompare(right)
        )
        for (const [subjectKind, unsortedEntries] of sortedGroups) {
          const subjectEntries = [...unsortedEntries].sort((left, right) =>
            `${left.subjectId}:${left.versionId}`.localeCompare(
              `${right.subjectId}:${right.versionId}`
            )
          )
          const table = tableBySubjectKind[subjectKind]
          const result = await sql<ActiveVersionRow>`
            select
              root.id as subject_id,
              version.id,
              version.version,
              version.document_schema_version,
              version.projection_schema_version,
              version.compiler_version,
              version.authored_checksum,
              version.authored_dependency_vector,
              version.compiled_checksum,
              version.authored_document,
              version.compiled_document,
              version.vocabulary_snapshot_id,
              snapshot.vocabulary_version as snapshot_version,
              snapshot.checksum as snapshot_checksum
            from ${sql.table(table.rootTable)} root
            join ${sql.table(table.versionTable)} version
              on version.id = root.active_version_id
            join public.system_vocabulary_snapshots snapshot
              on snapshot.id = version.vocabulary_snapshot_id
            where root.status = 'ACTIVE'
              and (root.id, version.id) in (
                ${sql.join(
                  subjectEntries.map(
                    (entry) => sql`(${entry.subjectId}::uuid, ${entry.versionId}::uuid)`
                  )
                )}
              )
            order by root.id, version.id
            for share
          `.execute(trx)
          for (const row of result.rows) {
            const record = mapVersion(subjectKind, row.subject_id, row)
            if (input.verifyCompiledDependencies ?? true) {
              await assertAuthoredDependencies(
                trx,
                record.compiled.authoredDependencies,
                record.authored.document.systemId,
                true
              )
            }
            recordsByRoot.set(`${subjectKind}:${row.subject_id}`, record)
          }
        }

        for (const entry of entries) {
          const record = recordsByRoot.get(`${entry.subjectKind}:${entry.subjectId}`)
          if (
            !record ||
            record.authored.versionId !== entry.versionId ||
            record.authored.version !== entry.version ||
            record.authored.checksum !== entry.checksum
          ) {
            throw new AuthoredVersionProjectionMismatchError(
              `Authored ${entry.subjectKind} "${entry.subjectId}" is not the current active source.`
            )
          }
        }
        return recordsByRoot
      })
    },

    async listVersions(input) {
      const table = tableBySubjectKind[input.subjectKind]
      const result = await sql<ActiveVersionRow>`
        select
          root.id as subject_id,
          version.id,
          version.version,
          version.document_schema_version,
          version.projection_schema_version,
          version.compiler_version,
          version.authored_checksum,
          version.authored_dependency_vector,
          version.compiled_checksum,
          version.authored_document,
          version.compiled_document,
          version.vocabulary_snapshot_id,
          snapshot.vocabulary_version as snapshot_version,
          snapshot.checksum as snapshot_checksum
        from ${sql.table(table.versionTable)} version
        join ${sql.table(table.rootTable)} root
          on root.id = ${sql.ref(table.rootIdColumn)}
        join public.system_vocabulary_snapshots snapshot
          on snapshot.id = version.vocabulary_snapshot_id
        order by root.id, version.version
      `.execute(db)

      return Promise.all(
        result.rows.map(async (row) => {
          const record = mapVersion(input.subjectKind, row.subject_id, row)
          await assertAuthoredDependencies(db, record.compiled.authoredDependencies)
          return record
        })
      )
    },

    findVersion(input) {
      return readVersion(db, input.subjectKind, input.subjectId, input.versionId)
    },

    async publish(input) {
      const subjectKind = authoredSubjectKindSchema.parse(input.subjectKind)
      const preparedAuthored = authoredDocumentVersionSchema.parse({
        subjectKind,
        subjectId: input.subjectId,
        versionId: input.versionId,
        version: 1,
        documentSchemaVersion: input.documentSchemaVersion,
        checksum: input.authoredChecksum,
        document: input.document
      })
      const preparedCompiled = {
        subjectKind,
        subjectId: input.subjectId,
        authoredVersionId: input.versionId,
        authoredChecksum: input.authoredChecksum,
        projectionSchemaVersion: input.projectionSchemaVersion,
        compilerVersion: input.compilerVersion,
        vocabularySnapshotId: input.vocabularySnapshotId,
        vocabularySnapshotVersion: input.vocabularySnapshotVersion,
        vocabularySnapshotChecksum: input.vocabularySnapshotChecksum,
        authoredDependencies: input.authoredDependencies,
        projection: input.compiledDocument
      }

      return withTransaction(db, async (trx) => {
        const root = await lockRoot(trx, subjectKind, input.subjectId)
        if (!root) {
          throw new AuthoredVersionProjectionMismatchError(
            `Cannot publish unavailable ${subjectKind} "${input.subjectId}".`
          )
        }
        const vocabularySnapshot = await lockVocabularySnapshot(
          trx,
          preparedCompiled.vocabularySnapshotId
        )
        if (
          !vocabularySnapshot ||
          vocabularySnapshot.system_id !== root.system_id ||
          vocabularySnapshot.vocabulary_version !== preparedCompiled.vocabularySnapshotVersion ||
          vocabularySnapshot.checksum !== preparedCompiled.vocabularySnapshotChecksum
        ) {
          throw new AuthoredVersionProjectionMismatchError(
            `Compiled ${subjectKind} "${input.subjectId}" has an incompatible vocabulary snapshot.`
          )
        }
        await assertAuthoredDependencies(
          trx,
          preparedCompiled.authoredDependencies,
          root.system_id,
          true
        )

        const table = tableBySubjectKind[subjectKind]
        const nextVersionResult = await sql<{ next_version: number }>`
          select coalesce(max(version), 0) + 1 as next_version
          from ${sql.table(table.versionTable)}
          where ${sql.ref(table.rootIdColumn)} = ${input.subjectId}
        `.execute(trx)
        const nextVersion = nextVersionResult.rows[0]?.next_version
        if (nextVersion === undefined) {
          throw new AuthoredVersionProjectionMismatchError(
            `Could not allocate a version for ${subjectKind} "${input.subjectId}".`
          )
        }
        const authored = authoredDocumentVersionSchema.parse({
          ...preparedAuthored,
          version: nextVersion
        })
        const compiledInput = {
          ...preparedCompiled,
          authoredVersion: nextVersion
        }
        const compiled = compiledAuthoredProjectionSchema.parse({
          ...compiledInput,
          projectionChecksum: checksumCompiledAuthoredProjection(compiledInput)
        })
        const record = { authored, compiled }
        assertAuthoredVersionRecordIntegrity(record)

        await sql`
          insert into ${sql.table(table.versionTable)} (
            id,
            ${sql.ref(table.rootIdColumn)},
            version,
            vocabulary_snapshot_id,
            document_schema_version,
            projection_schema_version,
            compiler_version,
            authored_checksum,
            authored_dependency_vector,
            compiled_checksum,
            authored_document,
            compiled_document
          ) values (
            ${authored.versionId},
            ${input.subjectId},
            ${authored.version},
            ${compiled.vocabularySnapshotId},
            ${authored.documentSchemaVersion},
            ${compiled.projectionSchemaVersion},
            ${compiled.compilerVersion},
            ${authored.checksum},
            ${JSON.stringify(compiled.authoredDependencies)}::jsonb,
            ${compiled.projectionChecksum},
            ${JSON.stringify(authored.document)}::jsonb,
            ${JSON.stringify(compiled.projection)}::jsonb
          )
        `.execute(trx)

        const updated = await sql<{ id: string }>`
          update ${sql.table(table.rootTable)}
          set
            status = 'ACTIVE',
            active_version_id = ${authored.versionId}
          where id = ${input.subjectId}
          returning id
        `.execute(trx)
        if (!updated.rows[0]) {
          throw new AuthoredVersionProjectionMismatchError(
            `${subjectKind} "${input.subjectId}" changed while its version was publishing.`
          )
        }

        return record
      })
    }
  }
}
