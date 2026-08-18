import type { AuthoredSubjectKind } from '../domains/subjects/repositories/authoredContent.js'
import { createAuthoredContentRepository } from '../domains/subjects/repositories/authoredContent.js'
import { sql } from 'kysely'
import type { DbTables, DBLike } from '#types'

export type CampaignContentState = 'PENDING' | 'APPROVED' | 'REJECTED'

type RuntimeTimestamp = Date | string
type GeneratedContentVersionRow = DbTables['campaign_content_versions']['Row']
type GeneratedCharacterBindingRow = DbTables['campaign_character_content_bindings']['Row']

type ContentVersionRow = Omit<
  GeneratedContentVersionRow,
  'approved_at' | 'created_at' | 'rejected_at' | 'updated_at'
> & {
  approved_at: RuntimeTimestamp | null
  created_at: RuntimeTimestamp
  rejected_at: RuntimeTimestamp | null
  updated_at: RuntimeTimestamp
}

type ContentVersionWithAuthorRow = ContentVersionRow & { author_username: string | null }

type CharacterBindingRow = Omit<GeneratedCharacterBindingRow, 'created_at' | 'updated_at'> & {
  created_at: RuntimeTimestamp
  updated_at: RuntimeTimestamp
}

type CharacterBindingProjectionRow = CharacterBindingRow & {
  revision: number
  authored_version_id: string
  authored_version: number
  authored_checksum: string
  compiled_projection_checksum: string
  state: string
}

export interface CampaignContentVersion {
  id: string
  campaignId: string
  subjectKind: AuthoredSubjectKind
  subjectId: string
  authoredBy: string
  revision: number
  state: CampaignContentState
  authoredVersionId: string
  authoredVersion: number
  authoredChecksum: string
  compiledProjectionChecksum: string
  approvedBy: string | null
  approvedAt: string | null
  rejectedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CampaignContentVersionWithAuthor extends CampaignContentVersion {
  authorUsername: string | null
}

interface InsertContentVersionBase {
  campaignId: string
  subjectKind: AuthoredSubjectKind
  subjectId: string
  authoredBy: string
  revision: number
  authoredVersionId: string
  authoredVersion: number
  authoredChecksum: string
  compiledProjectionChecksum: string
}

export type InsertCampaignContentVersionInput = InsertContentVersionBase &
  ({ state: 'PENDING' } | { state: 'APPROVED'; approvedBy: string; approvedAt: string })

export interface CampaignCharacterContentBinding {
  campaignId: string
  characterId: string
  subjectKind: AuthoredSubjectKind
  subjectId: string
  contentVersionId: string
  createdAt: string
  updatedAt: string
}

export interface CampaignCharacterContentBindingProjection extends CampaignCharacterContentBinding {
  revision: number
  state: CampaignContentState
  authoredVersionId: string
  authoredVersion: number
  authoredChecksum: string
  compiledProjectionChecksum: string
}

export interface RemovedCampaignCharacterContentBinding {
  subjectKind: AuthoredSubjectKind
  subjectId: string
  contentVersionId: string
  revision: number
  authoredVersionId: string
  authoredVersion: number
  authoredChecksum: string
  compiledProjectionChecksum: string
}

export interface CampaignCharacterContentBindingInput {
  subjectKind: AuthoredSubjectKind
  subjectId: string
  contentVersionId: string
}

export class CampaignContentBindingMismatchError extends Error {
  readonly code = 'CAMPAIGN_CONTENT_BINDING_MISMATCH'

  constructor(contentVersionId: string) {
    super(
      `Campaign content version "${contentVersionId}" does not belong to the requested Campaign root.`
    )
    this.name = 'CampaignContentBindingMismatchError'
  }
}

export class CampaignContentVersionNotApprovedError extends Error {
  constructor(contentVersionId: string) {
    super(`Campaign content version "${contentVersionId}" is not approved.`)
    this.name = 'CampaignContentVersionNotApprovedError'
  }
}

function toIsoString(value: RuntimeTimestamp): string {
  const parsed = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Invalid database timestamp "${value}".`)
  return parsed.toISOString()
}

function toOptionalIsoString(value: RuntimeTimestamp | null): string | null {
  return value === null ? null : toIsoString(value)
}

function toContentVersion(row: ContentVersionRow): CampaignContentVersion {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    subjectKind: row.subject_kind as AuthoredSubjectKind,
    subjectId: row.subject_id,
    authoredBy: row.authored_by,
    revision: row.revision,
    state: row.state as CampaignContentState,
    authoredVersionId: row.authored_version_id,
    authoredVersion: row.authored_version,
    authoredChecksum: row.authored_checksum,
    compiledProjectionChecksum: row.compiled_projection_checksum,
    approvedBy: row.approved_by,
    approvedAt: toOptionalIsoString(row.approved_at),
    rejectedAt: toOptionalIsoString(row.rejected_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  }
}

function toCharacterBinding(row: CharacterBindingRow): CampaignCharacterContentBinding {
  return {
    campaignId: row.campaign_id,
    characterId: row.character_id,
    subjectKind: row.subject_kind as AuthoredSubjectKind,
    subjectId: row.subject_id,
    contentVersionId: row.content_version_id,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  }
}

function toCharacterBindingProjection(
  row: CharacterBindingProjectionRow
): CampaignCharacterContentBindingProjection {
  return {
    ...toCharacterBinding(row),
    revision: row.revision,
    state: row.state as CampaignContentState,
    authoredVersionId: row.authored_version_id,
    authoredVersion: row.authored_version,
    authoredChecksum: row.authored_checksum,
    compiledProjectionChecksum: row.compiled_projection_checksum
  }
}

async function assertApprovedMatchingVersion(
  db: DBLike,
  input: {
    campaignId: string
    subjectKind: AuthoredSubjectKind
    subjectId: string
    contentVersionId: string
  }
): Promise<void> {
  const version = await db
    .selectFrom('campaign_content_versions')
    .select(['campaign_id', 'subject_kind', 'subject_id', 'state'])
    .where('id', '=', input.contentVersionId)
    .executeTakeFirst()

  if (
    !version ||
    version.campaign_id !== input.campaignId ||
    version.subject_kind !== input.subjectKind ||
    version.subject_id !== input.subjectId
  ) {
    throw new CampaignContentBindingMismatchError(input.contentVersionId)
  }
  if (version.state !== 'APPROVED') {
    throw new CampaignContentVersionNotApprovedError(input.contentVersionId)
  }
}

const characterBindingProjectionColumns = [
  'binding.campaign_id',
  'binding.character_id',
  'binding.subject_kind',
  'binding.subject_id',
  'binding.content_version_id',
  'binding.created_at',
  'binding.updated_at',
  'version.revision',
  'version.state',
  'version.authored_version_id',
  'version.authored_version',
  'version.authored_checksum',
  'version.compiled_projection_checksum'
] as const

export function createCampaignContentRepository(db: DBLike) {
  const authoredContent = createAuthoredContentRepository(db)

  return {
    async copyApprovedContentVersions(
      sourceCampaignId: string,
      targetCampaignId: string,
      ownerUserId: string
    ): Promise<void> {
      await sql`
        insert into campaign_content_versions (
          campaign_id, subject_kind, subject_id, authored_by, revision, state,
          authored_version_id, authored_version, authored_checksum,
          compiled_projection_checksum, approved_by, approved_at
        )
        select ${targetCampaignId}::uuid, subject_kind, subject_id, authored_by, revision,
          'APPROVED', authored_version_id, authored_version, authored_checksum,
          compiled_projection_checksum, ${ownerUserId}::uuid, now()
        from campaign_content_versions
        where campaign_id = ${sourceCampaignId}::uuid and state = 'APPROVED'
      `.execute(db)
    },

    async listContentVersions(campaignId: string): Promise<CampaignContentVersionWithAuthor[]> {
      const rows = (await db
        .selectFrom('campaign_content_versions as version')
        .leftJoin('profiles as author', 'author.id', 'version.authored_by')
        .select([
          'version.id',
          'version.campaign_id',
          'version.subject_kind',
          'version.subject_id',
          'version.authored_by',
          'version.revision',
          'version.state',
          'version.authored_version_id',
          'version.authored_version',
          'version.authored_checksum',
          'version.compiled_projection_checksum',
          'version.approved_by',
          'version.approved_at',
          'version.rejected_at',
          'version.created_at',
          'version.updated_at',
          'author.username as author_username'
        ])
        .where('version.campaign_id', '=', campaignId)
        .orderBy('version.subject_kind', 'asc')
        .orderBy('version.subject_id', 'asc')
        .orderBy('version.revision', 'asc')
        .execute()) as ContentVersionWithAuthorRow[]

      return rows.map((row) => ({ ...toContentVersion(row), authorUsername: row.author_username }))
    },

    async findContentVersion(input: {
      campaignId: string
      id: string
    }): Promise<CampaignContentVersionWithAuthor | null> {
      const row = (await db
        .selectFrom('campaign_content_versions as version')
        .leftJoin('profiles as author', 'author.id', 'version.authored_by')
        .select([
          'version.id',
          'version.campaign_id',
          'version.subject_kind',
          'version.subject_id',
          'version.authored_by',
          'version.revision',
          'version.state',
          'version.authored_version_id',
          'version.authored_version',
          'version.authored_checksum',
          'version.compiled_projection_checksum',
          'version.approved_by',
          'version.approved_at',
          'version.rejected_at',
          'version.created_at',
          'version.updated_at',
          'author.username as author_username'
        ])
        .where('version.campaign_id', '=', input.campaignId)
        .where('version.id', '=', input.id)
        .executeTakeFirst()) as ContentVersionWithAuthorRow | undefined

      return row ? { ...toContentVersion(row), authorUsername: row.author_username } : null
    },

    async lockNextRevision(input: {
      campaignId: string
      subjectKind: AuthoredSubjectKind
      subjectId: string
    }): Promise<number | null> {
      // ponytail: Campaign-wide lock is simplest; use per-root advisory locks if submissions contend.
      const campaign = await db
        .selectFrom('campaigns')
        .select('id')
        .where('id', '=', input.campaignId)
        .forUpdate()
        .executeTakeFirst()
      if (!campaign) return null

      const versions = await db
        .selectFrom('campaign_content_versions')
        .select('revision')
        .where('campaign_id', '=', input.campaignId)
        .where('subject_kind', '=', input.subjectKind)
        .where('subject_id', '=', input.subjectId)
        .orderBy('revision', 'asc')
        .forUpdate()
        .execute()

      return (versions.at(-1)?.revision ?? 0) + 1
    },

    async insertContentVersion(
      input: InsertCampaignContentVersionInput
    ): Promise<CampaignContentVersion> {
      const row = (await db
        .insertInto('campaign_content_versions')
        .values({
          campaign_id: input.campaignId,
          subject_kind: input.subjectKind,
          subject_id: input.subjectId,
          authored_by: input.authoredBy,
          revision: input.revision,
          state: input.state,
          authored_version_id: input.authoredVersionId,
          authored_version: input.authoredVersion,
          authored_checksum: input.authoredChecksum,
          compiled_projection_checksum: input.compiledProjectionChecksum,
          approved_by: input.state === 'APPROVED' ? input.approvedBy : null,
          approved_at: input.state === 'APPROVED' ? input.approvedAt : null,
          rejected_at: null
        })
        .returningAll()
        .executeTakeFirstOrThrow()) as ContentVersionRow
      return toContentVersion(row)
    },

    async approvePendingContentVersion(input: {
      campaignId: string
      id: string
      reviewerUserId: string
      reviewedAt: string
    }): Promise<CampaignContentVersion | null> {
      const row = (await db
        .updateTable('campaign_content_versions')
        .set({
          state: 'APPROVED',
          approved_by: input.reviewerUserId,
          approved_at: input.reviewedAt,
          updated_at: input.reviewedAt
        })
        .where('campaign_id', '=', input.campaignId)
        .where('id', '=', input.id)
        .where('state', '=', 'PENDING')
        .returningAll()
        .executeTakeFirst()) as ContentVersionRow | undefined
      return row ? toContentVersion(row) : null
    },

    async rejectPendingContentVersion(input: {
      campaignId: string
      id: string
      reviewedAt: string
    }): Promise<CampaignContentVersion | null> {
      const row = (await db
        .updateTable('campaign_content_versions')
        .set({ state: 'REJECTED', rejected_at: input.reviewedAt, updated_at: input.reviewedAt })
        .where('campaign_id', '=', input.campaignId)
        .where('id', '=', input.id)
        .where('state', '=', 'PENDING')
        .returningAll()
        .executeTakeFirst()) as ContentVersionRow | undefined
      return row ? toContentVersion(row) : null
    },

    async listCharacterBindings(
      campaignId: string,
      characterId: string
    ): Promise<CampaignCharacterContentBindingProjection[]> {
      const rows = (await db
        .selectFrom('campaign_character_content_bindings as binding')
        .innerJoin(
          'campaign_content_versions as version',
          'version.id',
          'binding.content_version_id'
        )
        .select(characterBindingProjectionColumns)
        .where('binding.campaign_id', '=', campaignId)
        .where('binding.character_id', '=', characterId)
        .orderBy('binding.subject_kind', 'asc')
        .orderBy('binding.subject_id', 'asc')
        .execute()) as CharacterBindingProjectionRow[]
      return rows.map(toCharacterBindingProjection)
    },

    async findAssignedCampaign(
      characterId: string
    ): Promise<{ campaignId: string; userId: string } | null> {
      const row = await db
        .selectFrom('campaign_character_assignments')
        .select(['campaign_id', 'user_id'])
        .where('character_id', '=', characterId)
        .executeTakeFirst()

      return row ? { campaignId: row.campaign_id, userId: row.user_id } : null
    },

    async findCharacterBinding(input: {
      campaignId: string
      characterId: string
      subjectKind: AuthoredSubjectKind
      subjectId: string
    }): Promise<CampaignCharacterContentBindingProjection | null> {
      const row = (await db
        .selectFrom('campaign_character_content_bindings as binding')
        .innerJoin(
          'campaign_content_versions as version',
          'version.id',
          'binding.content_version_id'
        )
        .select(characterBindingProjectionColumns)
        .where('binding.campaign_id', '=', input.campaignId)
        .where('binding.character_id', '=', input.characterId)
        .where('binding.subject_kind', '=', input.subjectKind)
        .where('binding.subject_id', '=', input.subjectId)
        .executeTakeFirst()) as CharacterBindingProjectionRow | undefined
      return row ? toCharacterBindingProjection(row) : null
    },

    async lockCharacterBindings(
      campaignId: string,
      characterId: string
    ): Promise<CampaignCharacterContentBinding[]> {
      const rows = (await db
        .selectFrom('campaign_character_content_bindings')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .where('character_id', '=', characterId)
        .orderBy('subject_kind', 'asc')
        .orderBy('subject_id', 'asc')
        .forUpdate()
        .execute()) as CharacterBindingRow[]
      return rows.map(toCharacterBinding)
    },

    async lockRootBindings(input: {
      campaignId: string
      subjectKind: AuthoredSubjectKind
      subjectId: string
    }): Promise<CampaignCharacterContentBinding[]> {
      const rows = (await db
        .selectFrom('campaign_character_content_bindings')
        .selectAll()
        .where('campaign_id', '=', input.campaignId)
        .where('subject_kind', '=', input.subjectKind)
        .where('subject_id', '=', input.subjectId)
        .orderBy('character_id', 'asc')
        .forUpdate()
        .execute()) as CharacterBindingRow[]

      return rows
        .map(toCharacterBinding)
        .sort((left, right) => left.characterId.localeCompare(right.characterId))
    },

    async replaceLockedRootBindings(input: {
      campaignId: string
      subjectKind: AuthoredSubjectKind
      subjectId: string
      contentVersionId: string
      updatedAt: string
    }): Promise<string[]> {
      await assertApprovedMatchingVersion(db, input)
      const rows = await db
        .updateTable('campaign_character_content_bindings')
        .set({ content_version_id: input.contentVersionId, updated_at: input.updatedAt })
        .where('campaign_id', '=', input.campaignId)
        .where('subject_kind', '=', input.subjectKind)
        .where('subject_id', '=', input.subjectId)
        .returning('character_id')
        .execute()
      return rows.map((row) => row.character_id).sort()
    },

    async bindCharacterRoot(input: {
      campaignId: string
      characterId: string
      subjectKind: AuthoredSubjectKind
      subjectId: string
      contentVersionId: string
    }): Promise<CampaignCharacterContentBinding> {
      await assertApprovedMatchingVersion(db, input)
      const row = (await db
        .insertInto('campaign_character_content_bindings')
        .values({
          campaign_id: input.campaignId,
          character_id: input.characterId,
          subject_kind: input.subjectKind,
          subject_id: input.subjectId,
          content_version_id: input.contentVersionId
        })
        .returningAll()
        .executeTakeFirstOrThrow()) as CharacterBindingRow
      return toCharacterBinding(row)
    },

    async replaceCharacterBindings(input: {
      campaignId: string
      characterId: string
      bindings: readonly CampaignCharacterContentBindingInput[]
    }): Promise<void> {
      const bindings = [...input.bindings].sort((left, right) =>
        `${left.subjectKind}:${left.subjectId}`.localeCompare(
          `${right.subjectKind}:${right.subjectId}`
        )
      )
      const roots = new Set<string>()
      for (const binding of bindings) {
        const root = `${binding.subjectKind}:${binding.subjectId}`
        if (roots.has(root)) throw new Error(`Duplicate Campaign content binding "${root}".`)
        roots.add(root)
        await assertApprovedMatchingVersion(db, { ...input, ...binding })
      }

      await db
        .deleteFrom('campaign_character_content_bindings')
        .where('campaign_id', '=', input.campaignId)
        .where('character_id', '=', input.characterId)
        .execute()

      if (bindings.length === 0) return
      await db
        .insertInto('campaign_character_content_bindings')
        .values(
          bindings.map((binding) => ({
            campaign_id: input.campaignId,
            character_id: input.characterId,
            subject_kind: binding.subjectKind,
            subject_id: binding.subjectId,
            content_version_id: binding.contentVersionId
          }))
        )
        .execute()
    },

    async deleteAssignmentBindings(
      campaignId: string,
      characterId: string
    ): Promise<RemovedCampaignCharacterContentBinding[]> {
      const result = await sql<{
        content_version_id: string
        revision: number
        authored_version_id: string
        authored_version: number
        authored_checksum: string
        compiled_projection_checksum: string
        subject_id: string
        subject_kind: AuthoredSubjectKind
      }>`
        delete from campaign_character_content_bindings binding
        using campaign_content_versions version
        where binding.content_version_id = version.id
          and binding.campaign_id = ${campaignId}::uuid
          and binding.character_id = ${characterId}::uuid
        returning
          binding.subject_kind,
          binding.subject_id,
          binding.content_version_id,
          version.revision,
          version.authored_version_id,
          version.authored_version,
          version.authored_checksum,
          version.compiled_projection_checksum
      `.execute(db)

      return result.rows
        .map((row) => ({
          subjectKind: row.subject_kind,
          subjectId: row.subject_id,
          contentVersionId: row.content_version_id,
          revision: row.revision,
          authoredVersionId: row.authored_version_id,
          authoredVersion: row.authored_version,
          authoredChecksum: row.authored_checksum,
          compiledProjectionChecksum: row.compiled_projection_checksum
        }))
        .sort((left, right) =>
          `${left.subjectKind}:${left.subjectId}`.localeCompare(
            `${right.subjectKind}:${right.subjectId}`
          )
        )
    },

    findActiveRootOwner: authoredContent.findActiveBySubject,
    findOwnedDraftPayload: authoredContent.findDraftBySubject
  }
}
