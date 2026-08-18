import { sql } from 'kysely'

import {
  characterMechanicsProjectionMetadataSchema,
  characterMechanicsProjectionSchema,
  type CharacterMechanicsProjectionMetadata,
  type CharacterMechanicsProjection
} from '@artificer-toolkit/schema/projections/characterMechanics'
import type {
  AuthoredSubjectKind,
  AuthoredVersionVector
} from '@artificer-toolkit/schema/projections/identity'

import type { DBLike, Json } from '#types'
import {
  checksumCharacterMechanicsCommandState,
  checksumCharacterMechanicsCommandLane,
  checksumCharacterMechanicsProjection,
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

interface CharacterRow {
  id: string
  stream_version: number
  system_id: string
}

interface VocabularySnapshotRow {
  checksum: string
  id: string
  system_id: string
  vocabulary_version: number
}

interface RuleRevisionRow {
  checksum: string
  evaluator_version: string
  id: string
  model_contract_version: number
}

interface ExistingProjectionRow {
  projection_checksum: string
  stream_version: number
}

interface AuthoredVersionValidationRow {
  authored_checksum: string
  id: string
  root_active_version_id: string | null
  root_system_id: string
  root_status: string
  subject_id: string
  subject_kind: AuthoredSubjectKind
  version: number
}

interface CharacterMechanicsProjectionRow {
  authored_version_vector: Json
  bounded_registry: Json
  character_id: string
  character_system_id: string
  command_state: Json
  command_state_checksum: string
  command_lane_checksum: string
  character_stream_version: number
  evaluator_version: string
  model_contract_version: number
  normalized_facts: Json
  projection_checksum: string
  projection_schema_version: number
  rule_pack_checksum: string
  rule_pack_revision_id: string
  rule_result: Json
  rule_snapshot: Json
  stream_version: number
  vocabulary_snapshot_checksum: string
  vocabulary_snapshot_id: string
  vocabulary_snapshot_version: number
}

type CharacterMechanicsProjectionMetadataRow = Pick<
  CharacterMechanicsProjectionRow,
  | 'authored_version_vector'
  | 'character_id'
  | 'command_state'
  | 'command_state_checksum'
  | 'command_lane_checksum'
  | 'evaluator_version'
  | 'model_contract_version'
  | 'projection_checksum'
  | 'projection_schema_version'
  | 'rule_pack_checksum'
  | 'rule_pack_revision_id'
  | 'stream_version'
  | 'vocabulary_snapshot_checksum'
  | 'vocabulary_snapshot_id'
  | 'vocabulary_snapshot_version'
> & {
  character_stream_version: number
  character_system_id: string
}

export class CharacterMechanicsProjectionMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CharacterMechanicsProjectionMismatchError'
  }
}

export interface CharacterMechanicsProjectionPublicationTiming {
  characterLockMs: number
  vocabularyLockMs: number
  ruleRevisionValidationMs: number
  authoredVersionValidationMs: number
  existingProjectionLockMs: number
  writeMs: number
  totalMs: number
}

export interface CharacterMechanicsProjectionPublishOptions {
  requireActiveAuthoredVersions?: boolean
  onTiming?: (timing: CharacterMechanicsProjectionPublicationTiming) => void
}

function mapProjection(row: CharacterMechanicsProjectionRow): CharacterMechanicsProjection {
  const projection = characterMechanicsProjectionSchema.parse({
    characterId: row.character_id,
    commandState: row.command_state,
    commandStateChecksum: row.command_state_checksum,
    commandLaneChecksum: row.command_lane_checksum,
    projectionSchemaVersion: row.projection_schema_version,
    projectionChecksum: row.projection_checksum,
    characterStreamVersion: row.stream_version,
    authoredVersionVector: row.authored_version_vector,
    systemVocabularySnapshotId: row.vocabulary_snapshot_id,
    systemVocabularySnapshotVersion: row.vocabulary_snapshot_version,
    systemVocabularySnapshotChecksum: row.vocabulary_snapshot_checksum,
    ruleRevisionId: row.rule_pack_revision_id,
    ruleRevisionChecksum: row.rule_pack_checksum,
    evaluatorVersion: row.evaluator_version,
    modelContractVersion: row.model_contract_version,
    ruleSnapshot: row.rule_snapshot,
    rulePolicyInput: row.normalized_facts,
    rulePolicyOutput: row.rule_result,
    ruleRegistry: row.bounded_registry
  })
  if (checksumCharacterMechanicsCommandState(projection.commandState) !== projection.commandStateChecksum) {
    throw new CharacterMechanicsProjectionMismatchError(
      `Character "${projection.characterId}" has command state with an invalid checksum.`
    )
  }
  if (checksumCharacterMechanicsCommandLane(projection) !== projection.commandLaneChecksum) {
    throw new CharacterMechanicsProjectionMismatchError(
      `Character "${projection.characterId}" has command lane metadata with an invalid checksum.`
    )
  }
  if (
    projection.commandState.id !== row.character_id ||
    projection.commandState.systemId !== row.character_system_id
  ) {
    throw new CharacterMechanicsProjectionMismatchError(
      `Character "${projection.characterId}" mechanics projection identity does not match its Character row.`
    )
  }
  if (checksumCharacterMechanicsProjection(projection) !== projection.projectionChecksum) {
    throw new CharacterMechanicsProjectionMismatchError(
      `Character "${projection.characterId}" has a mechanics projection with an invalid checksum.`
    )
  }
  return projection
}

function mapProjectionMetadata(
  row: CharacterMechanicsProjectionMetadataRow
): CharacterMechanicsProjectionMetadata {
  const projection = characterMechanicsProjectionMetadataSchema.parse({
    characterId: row.character_id,
    commandState: row.command_state,
    commandStateChecksum: row.command_state_checksum,
    commandLaneChecksum: row.command_lane_checksum,
    projectionSchemaVersion: row.projection_schema_version,
    projectionChecksum: row.projection_checksum,
    characterStreamVersion: row.stream_version,
    authoredVersionVector: row.authored_version_vector,
    systemVocabularySnapshotId: row.vocabulary_snapshot_id,
    systemVocabularySnapshotVersion: row.vocabulary_snapshot_version,
    systemVocabularySnapshotChecksum: row.vocabulary_snapshot_checksum,
    ruleRevisionId: row.rule_pack_revision_id,
    ruleRevisionChecksum: row.rule_pack_checksum,
    evaluatorVersion: row.evaluator_version,
    modelContractVersion: row.model_contract_version
  })
  if (checksumCharacterMechanicsCommandState(projection.commandState) !== projection.commandStateChecksum) {
    throw new CharacterMechanicsProjectionMismatchError(
      `Character "${projection.characterId}" has command state with an invalid checksum.`
    )
  }
  if (checksumCharacterMechanicsCommandLane(projection) !== projection.commandLaneChecksum) {
    throw new CharacterMechanicsProjectionMismatchError(
      `Character "${projection.characterId}" has command lane metadata with an invalid checksum.`
    )
  }
  if (
    projection.commandState.id !== row.character_id ||
    projection.commandState.systemId !== row.character_system_id
  ) {
    throw new CharacterMechanicsProjectionMismatchError(
      `Character "${projection.characterId}" mechanics projection identity does not match its Character row.`
    )
  }
  return projection
}

async function lockCharacter(db: DBLike, characterId: string): Promise<CharacterRow | null> {
  const result = await sql<CharacterRow>`
    select id, system_id, stream_version
    from public.characters
    where id = ${characterId}
    for update
  `.execute(db)
  return result.rows[0] ?? null
}

async function lockVocabularySnapshot(
  db: DBLike,
  snapshotId: string
): Promise<VocabularySnapshotRow | null> {
  const result = await sql<VocabularySnapshotRow>`
    select id, system_id, vocabulary_version, checksum
    from public.system_vocabulary_snapshots
    where id = ${snapshotId}
    for update
  `.execute(db)
  return result.rows[0] ?? null
}

async function validateRuleRevision(
  db: DBLike,
  systemId: string,
  projection: CharacterMechanicsProjection
): Promise<void> {
  const result = await sql<RuleRevisionRow>`
    select
      revision.id,
      revision.checksum,
      revision.evaluator_version,
      revision.model_contract_version
    from public.rule_pack_revisions revision
    join public.rule_packs pack
      on pack.id = revision.rule_pack_id
    join public.systems system
      on system.id = ${systemId}
    where revision.id = ${projection.ruleRevisionId}
      and revision.activated_at is not null
      and pack.ruleset_code = system.ruleset_code
      and pack.version = system.ruleset_version
    limit 1
  `.execute(db)
  const revision = result.rows[0]
  if (
    !revision ||
    revision.checksum !== projection.ruleRevisionChecksum ||
    revision.evaluator_version !== projection.evaluatorVersion ||
    revision.model_contract_version !== projection.modelContractVersion
  ) {
    throw new CharacterMechanicsProjectionMismatchError(
      `Character "${projection.characterId}" has an unavailable or incompatible rule revision.`
    )
  }
}

type AuthoredVersionVectorEntry = AuthoredVersionVector[number]

function authoredVersionDependencyKey(entry: {
  subjectId: string
  subjectKind: AuthoredSubjectKind
}): string {
  return `${entry.subjectKind}:${entry.subjectId}`
}

function createAuthoredVersionValidationQuery(
  subjectKind: AuthoredSubjectKind,
  entries: AuthoredVersionVector,
  requireActiveVersions: boolean
) {
  const table = tableBySubjectKind[subjectKind]
  return sql<AuthoredVersionValidationRow>`
    select
      ${subjectKind}::text as subject_kind,
      version.id,
      ${sql.ref(table.rootIdColumn)} as subject_id,
      version.version,
      version.authored_checksum,
      root.system_id as root_system_id,
      root.status as root_status,
      root.active_version_id as root_active_version_id
    from ${sql.table(table.versionTable)} version
    join ${sql.table(table.rootTable)} root
      on root.id = ${sql.ref(table.rootIdColumn)}
    where (version.id, ${sql.ref(table.rootIdColumn)}) in (
      ${sql.join(entries.map((entry) => sql`(${entry.versionId}, ${entry.subjectId})`))}
    )
    ${requireActiveVersions ? sql`for share` : sql``}
  `
}

async function validateAuthoredVersionVector(
  db: DBLike,
  systemId: string,
  projection: CharacterMechanicsProjection,
  requireActiveVersions: boolean
): Promise<void> {
  const entriesBySubjectKind = new Map<AuthoredSubjectKind, AuthoredVersionVectorEntry[]>()
  for (const entry of projection.authoredVersionVector) {
    const entries = entriesBySubjectKind.get(entry.subjectKind) ?? []
    entries.push(entry)
    entriesBySubjectKind.set(entry.subjectKind, entries)
  }
  if (entriesBySubjectKind.size === 0) return

  const queries = [...entriesBySubjectKind.entries()].map(([subjectKind, entries]) =>
    createAuthoredVersionValidationQuery(subjectKind, entries, requireActiveVersions)
  )
  const rows: AuthoredVersionValidationRow[] = []
  if (requireActiveVersions) {
    for (const entry of projection.authoredVersionVector) {
      const result = await createAuthoredVersionValidationQuery(entry.subjectKind, [entry], true).execute(
        db
      )
      rows.push(...result.rows)
    }
  } else {
    rows.push(
      ...(
        await sql<AuthoredVersionValidationRow>`
          ${sql.join(queries, sql` union all `)}
        `.execute(db)
      ).rows
    )
  }
  const rowsByDependency = new Map(
    rows.map((row) => [
      authoredVersionDependencyKey({ subjectId: row.subject_id, subjectKind: row.subject_kind }),
      row
    ])
  )

  for (const entry of projection.authoredVersionVector) {
    const version = rowsByDependency.get(authoredVersionDependencyKey(entry))
    if (
      !version ||
      version.subject_kind !== entry.subjectKind ||
      version.id !== entry.versionId ||
      version.root_system_id !== systemId ||
      version.version !== entry.version ||
      version.authored_checksum !== entry.checksum ||
      (requireActiveVersions &&
        (version.root_status !== 'ACTIVE' || version.root_active_version_id !== entry.versionId))
    ) {
      throw new CharacterMechanicsProjectionMismatchError(
        `Character "${projection.characterId}" has an unavailable ${entry.subjectKind} version dependency.`
      )
    }
  }
}

async function lockExistingProjection(
  db: DBLike,
  characterId: string
): Promise<ExistingProjectionRow | null> {
  const result = await sql<ExistingProjectionRow>`
    select stream_version, projection_checksum
    from public.character_mechanics_projections
    where character_id = ${characterId}
    for update
  `.execute(db)
  return result.rows[0] ?? null
}

async function readProjection(
  db: DBLike,
  characterId: string
): Promise<{ characterStreamVersion: number; projection: CharacterMechanicsProjection } | null> {
  const result = await sql<CharacterMechanicsProjectionRow>`
    select
      projection.character_id,
      character.system_id as character_system_id,
      projection.command_state,
      projection.command_state_checksum,
      projection.command_lane_checksum,
      projection.stream_version,
      character.stream_version as character_stream_version,
      projection.authored_version_vector,
      projection.vocabulary_snapshot_id,
      snapshot.vocabulary_version as vocabulary_snapshot_version,
      snapshot.checksum as vocabulary_snapshot_checksum,
      projection.rule_pack_revision_id,
      projection.rule_pack_checksum,
      projection.evaluator_version,
      projection.model_contract_version,
      projection.projection_schema_version,
      projection.projection_checksum,
      projection.rule_snapshot,
      projection.normalized_facts,
      projection.bounded_registry,
      projection.rule_result
    from public.character_mechanics_projections projection
    join public.characters character
      on character.id = projection.character_id
    join public.system_vocabulary_snapshots snapshot
      on snapshot.id = projection.vocabulary_snapshot_id
      and snapshot.system_id = character.system_id
    where projection.character_id = ${characterId}
    limit 1
  `.execute(db)
  const row = result.rows[0]
  return row
    ? { characterStreamVersion: row.character_stream_version, projection: mapProjection(row) }
    : null
}

async function readProjectionMetadata(
  db: DBLike,
  characterId: string
): Promise<{
  characterStreamVersion: number
  projection: CharacterMechanicsProjectionMetadata
} | null> {
  const result = await sql<CharacterMechanicsProjectionMetadataRow>`
    select
      projection.character_id,
      character.system_id as character_system_id,
      projection.command_state,
      projection.command_state_checksum,
      projection.command_lane_checksum,
      projection.stream_version,
      character.stream_version as character_stream_version,
      projection.authored_version_vector,
      projection.vocabulary_snapshot_id,
      snapshot.vocabulary_version as vocabulary_snapshot_version,
      snapshot.checksum as vocabulary_snapshot_checksum,
      projection.rule_pack_revision_id,
      projection.rule_pack_checksum,
      projection.evaluator_version,
      projection.model_contract_version,
      projection.projection_schema_version,
      projection.projection_checksum
    from public.character_mechanics_projections projection
    join public.characters character
      on character.id = projection.character_id
    join public.system_vocabulary_snapshots snapshot
      on snapshot.id = projection.vocabulary_snapshot_id
      and snapshot.system_id = character.system_id
    where projection.character_id = ${characterId}
    limit 1
  `.execute(db)
  const row = result.rows[0]
  return row
    ? { characterStreamVersion: row.character_stream_version, projection: mapProjectionMetadata(row) }
    : null
}

export interface CharacterMechanicsProjectionRepository {
  publish(
    projection: CharacterMechanicsProjection,
    options?: CharacterMechanicsProjectionPublishOptions
  ): Promise<CharacterMechanicsProjection>
  requireCurrent(input: {
    characterId: string
    expectedRuleRevisionId?: string
    expectedStreamVersion: number
  }): Promise<CharacterMechanicsProjection>
  requireCurrentMetadata(input: {
    characterId: string
    expectedProjectionChecksum?: string
    expectedCommandLaneChecksum?: string
    expectedRuleRevisionId?: string
    expectedStreamVersion: number
  }): Promise<CharacterMechanicsProjectionMetadata>
}

export function createCharacterMechanicsProjectionRepository(
  db: DBLike
): CharacterMechanicsProjectionRepository {
  return {
    async publish(input, options) {
      const onTiming = options?.onTiming
      const publicationStartedAt = performance.now()
      let characterLockMs = 0
      let vocabularyLockMs = 0
      let ruleRevisionValidationMs = 0
      let authoredVersionValidationMs = 0
      let existingProjectionLockMs = 0
      let writeMs = 0
      const projection = characterMechanicsProjectionSchema.parse(input)
      if (projection.commandState.id !== projection.characterId || projection.commandState.systemId === '') {
        throw new CharacterMechanicsProjectionMismatchError(
          `Character "${projection.characterId}" mechanics command state has an incompatible identity.`
        )
      }
      if (checksumCharacterMechanicsCommandState(projection.commandState) !== projection.commandStateChecksum) {
        throw new CharacterMechanicsProjectionMismatchError(
          `Character "${projection.characterId}" mechanics command state checksum does not match its contents.`
        )
      }
      if (checksumCharacterMechanicsCommandLane(projection) !== projection.commandLaneChecksum) {
        throw new CharacterMechanicsProjectionMismatchError(
          `Character "${projection.characterId}" mechanics command lane checksum does not match its contents.`
        )
      }
      if (checksumCharacterMechanicsProjection(projection) !== projection.projectionChecksum) {
        throw new CharacterMechanicsProjectionMismatchError(
          `Character "${projection.characterId}" mechanics projection checksum does not match its contents.`
        )
      }
      const published = await withTransaction(db, async (trx) => {
        let startedAt = performance.now()
        const character = await lockCharacter(trx, projection.characterId)
        characterLockMs = performance.now() - startedAt
        if (!character || character.stream_version !== projection.characterStreamVersion) {
          throw new CharacterMechanicsProjectionMismatchError(
            `Character "${projection.characterId}" changed before its mechanics projection was published.`
          )
        }
        if (projection.commandState.systemId !== character.system_id) {
          throw new CharacterMechanicsProjectionMismatchError(
            `Character "${projection.characterId}" mechanics command state system does not match the locked Character.`
          )
        }

        startedAt = performance.now()
        const vocabularySnapshot = await lockVocabularySnapshot(
          trx,
          projection.systemVocabularySnapshotId
        )
        vocabularyLockMs = performance.now() - startedAt
        if (
          !vocabularySnapshot ||
          vocabularySnapshot.system_id !== character.system_id ||
          vocabularySnapshot.vocabulary_version !== projection.systemVocabularySnapshotVersion ||
          vocabularySnapshot.checksum !== projection.systemVocabularySnapshotChecksum
        ) {
          throw new CharacterMechanicsProjectionMismatchError(
            `Character "${projection.characterId}" has an incompatible vocabulary snapshot.`
          )
        }

        startedAt = performance.now()
        await validateRuleRevision(trx, character.system_id, projection)
        ruleRevisionValidationMs = performance.now() - startedAt

        startedAt = performance.now()
        await validateAuthoredVersionVector(
          trx,
          character.system_id,
          projection,
          options?.requireActiveAuthoredVersions ?? true
        )
        authoredVersionValidationMs = performance.now() - startedAt

        startedAt = performance.now()
        const existing = await lockExistingProjection(trx, projection.characterId)
        existingProjectionLockMs = performance.now() - startedAt
        if (existing) {
          if (existing.stream_version > projection.characterStreamVersion) {
            throw new CharacterMechanicsProjectionMismatchError(
              `Character "${projection.characterId}" already has a newer mechanics projection.`
            )
          }
          if (
            existing.stream_version === projection.characterStreamVersion &&
            existing.projection_checksum !== projection.projectionChecksum
          ) {
            throw new CharacterMechanicsProjectionMismatchError(
              `Character "${projection.characterId}" has a conflicting mechanics projection for this stream version.`
            )
          }
          if (
            existing.stream_version === projection.characterStreamVersion &&
            existing.projection_checksum === projection.projectionChecksum
          ) {
            return projection
          }
        }

        startedAt = performance.now()
        await sql`
          insert into public.character_mechanics_projections (
            character_id,
            command_state,
            command_state_checksum,
            command_lane_checksum,
            stream_version,
            authored_version_vector,
            vocabulary_snapshot_id,
            rule_pack_revision_id,
            rule_pack_checksum,
            evaluator_version,
            model_contract_version,
            projection_schema_version,
            projection_checksum,
            rule_snapshot,
            normalized_facts,
            bounded_registry,
            rule_result,
            updated_at
          ) values (
            ${projection.characterId},
            ${JSON.stringify(projection.commandState)}::jsonb,
            ${projection.commandStateChecksum},
            ${projection.commandLaneChecksum},
            ${projection.characterStreamVersion},
            ${JSON.stringify(projection.authoredVersionVector)}::jsonb,
            ${projection.systemVocabularySnapshotId},
            ${projection.ruleRevisionId},
            ${projection.ruleRevisionChecksum},
            ${projection.evaluatorVersion},
            ${projection.modelContractVersion},
            ${projection.projectionSchemaVersion},
            ${projection.projectionChecksum},
            ${JSON.stringify(projection.ruleSnapshot)}::jsonb,
            ${JSON.stringify(projection.rulePolicyInput)}::jsonb,
            ${JSON.stringify(projection.ruleRegistry)}::jsonb,
            ${JSON.stringify(projection.rulePolicyOutput)}::jsonb,
            now()
          )
          on conflict (character_id) do update set
            stream_version = excluded.stream_version,
            command_state = excluded.command_state,
            command_state_checksum = excluded.command_state_checksum,
            command_lane_checksum = excluded.command_lane_checksum,
            authored_version_vector = excluded.authored_version_vector,
            vocabulary_snapshot_id = excluded.vocabulary_snapshot_id,
            rule_pack_revision_id = excluded.rule_pack_revision_id,
            rule_pack_checksum = excluded.rule_pack_checksum,
            evaluator_version = excluded.evaluator_version,
            model_contract_version = excluded.model_contract_version,
            projection_schema_version = excluded.projection_schema_version,
            projection_checksum = excluded.projection_checksum,
            rule_snapshot = excluded.rule_snapshot,
            normalized_facts = excluded.normalized_facts,
            bounded_registry = excluded.bounded_registry,
            rule_result = excluded.rule_result,
            updated_at = now()
        `.execute(trx)
        writeMs = performance.now() - startedAt

        return projection
      })
      if (onTiming) {
        onTiming({
          characterLockMs,
          vocabularyLockMs,
          ruleRevisionValidationMs,
          authoredVersionValidationMs,
          existingProjectionLockMs,
          writeMs,
          totalMs: performance.now() - publicationStartedAt
        })
      }
      return published
    },

    async requireCurrent(input) {
      const current = await readProjection(db, input.characterId)
      if (!current) {
        throw new CharacterMechanicsProjectionMismatchError(
          `Character "${input.characterId}" has no committed mechanics projection.`
        )
      }
      if (current.projection.characterStreamVersion !== current.characterStreamVersion) {
        throw new CharacterMechanicsProjectionMismatchError(
          `Character "${input.characterId}" has a stale mechanics projection.`
        )
      }
      if (current.projection.characterStreamVersion !== input.expectedStreamVersion) {
        throw new CharacterMechanicsProjectionMismatchError(
          `Character "${input.characterId}" stream version does not match the command expectation.`
        )
      }
      if (
        input.expectedRuleRevisionId &&
        current.projection.ruleRevisionId !== input.expectedRuleRevisionId
      ) {
        throw new CharacterMechanicsProjectionMismatchError(
          `Character "${input.characterId}" rule revision does not match the command expectation.`
        )
      }
      return current.projection
    },

    async requireCurrentMetadata(input) {
      const current = await readProjectionMetadata(db, input.characterId)
      if (!current) {
        throw new CharacterMechanicsProjectionMismatchError(
          `Character "${input.characterId}" has no committed mechanics projection.`
        )
      }
      if (current.projection.characterStreamVersion !== current.characterStreamVersion) {
        throw new CharacterMechanicsProjectionMismatchError(
          `Character "${input.characterId}" has a stale mechanics projection.`
        )
      }
      if (current.projection.characterStreamVersion !== input.expectedStreamVersion) {
        throw new CharacterMechanicsProjectionMismatchError(
          `Character "${input.characterId}" stream version does not match the command expectation.`
        )
      }
      if (
        input.expectedRuleRevisionId &&
        current.projection.ruleRevisionId !== input.expectedRuleRevisionId
      ) {
        throw new CharacterMechanicsProjectionMismatchError(
          `Character "${input.characterId}" rule revision does not match the command expectation.`
        )
      }
      if (
        input.expectedProjectionChecksum &&
        current.projection.projectionChecksum !== input.expectedProjectionChecksum
      ) {
        throw new CharacterMechanicsProjectionMismatchError(
          `Character "${input.characterId}" mechanics projection does not match the room snapshot.`
        )
      }
      if (
        input.expectedCommandLaneChecksum &&
        current.projection.commandLaneChecksum !== input.expectedCommandLaneChecksum
      ) {
        throw new CharacterMechanicsProjectionMismatchError(
          `Character "${input.characterId}" mechanics command lane does not match the room snapshot.`
        )
      }
      return current.projection
    }
  }
}
