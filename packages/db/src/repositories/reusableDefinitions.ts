import { sql } from 'kysely'
import {
  reusableDefinitionCurrentDtoSchema,
  reusableDefinitionDocumentFamilyKey,
  reusableDefinitionDocumentDtoSchema,
  reusableDefinitionDraftDtoSchema,
  type ContentSourceKindDto,
  type ReusableDefinitionCurrentDto,
  type ReusableDefinitionDraftDto
} from '@artificer-toolkit/schema/shared/reusableDefinitions'

import type { DBLike } from '#types'
import { withTransaction } from '../utils/index.js'
import { requireDefaultUserContentSource } from './contentSources.js'

type Timestamp = Date | string

export interface ReusableDefinitionRootRecord {
  id: string
  gameSystemId: string
  contentSourceId: string
  definitionFamilyKey: string
  label: string
  description: string | null
  version: number
  draftVersion: number | null
  sourceKind: ContentSourceKindDto
  sourceOwnerUserId: string | null
  current: ReusableDefinitionCurrentDto | null
}

function iso(value: Timestamp): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('Reusable definition timestamp is invalid.')
  return date.toISOString()
}

function rootFromRow(row: Record<string, unknown>): ReusableDefinitionRootRecord {
  const current =
    row.current_document == null
      ? null
      : reusableDefinitionCurrentDtoSchema.parse({
          id: String(row.id),
          gameSystemId: String(row.game_system_id),
          contentSourceId: String(row.content_source_id),
          definitionFamilyKey: String(row.definition_family_key),
          label: String(row.label),
          description: row.description == null ? null : String(row.description),
          document: row.current_document,
          checksum: String(row.current_checksum),
          contractVersion: Number(row.current_contract_version),
          version: Number(row.version),
          publishedAt: iso(row.published_at as Timestamp),
          publishedBy: String(row.published_by)
        })
  return {
    id: String(row.id).toLowerCase(),
    gameSystemId: String(row.game_system_id).toLowerCase(),
    contentSourceId: String(row.content_source_id).toLowerCase(),
    definitionFamilyKey: String(row.definition_family_key),
    label: String(row.label),
    description: row.description == null ? null : String(row.description),
    version: Number(row.version),
    draftVersion: row.draft_version == null ? null : Number(row.draft_version),
    sourceKind: row.source_kind as ContentSourceKindDto,
    sourceOwnerUserId:
      row.source_owner_user_id == null ? null : String(row.source_owner_user_id).toLowerCase(),
    current
  }
}

function assertDocumentMatchesRoot(
  root: Pick<ReusableDefinitionRootRecord, 'id' | 'gameSystemId' | 'definitionFamilyKey'>,
  document: ReusableDefinitionDraftDto['document']
): void {
  const documentFamilyKey = reusableDefinitionDocumentFamilyKey(document)
  if (
    root.id !== document.id ||
    root.gameSystemId !== document.gameSystemId ||
    root.definitionFamilyKey !== documentFamilyKey
  ) {
    throw new Error('Reusable definition document does not match its root identity or family.')
  }
}

function draftFromRow(
  row: Record<string, unknown>,
  root: Pick<ReusableDefinitionRootRecord, 'id' | 'gameSystemId' | 'definitionFamilyKey'>
): ReusableDefinitionDraftDto {
  const draft = reusableDefinitionDraftDtoSchema.parse({
    definitionId: String(row.definition_id),
    gameSystemId: String(row.game_system_id),
    authorUserId: String(row.author_user_id),
    document: row.document,
    checksum: String(row.checksum),
    baseDefinitionVersion: Number(row.base_definition_version),
    version: Number(row.version),
    createdAt: iso(row.created_at as Timestamp),
    updatedAt: iso(row.updated_at as Timestamp)
  })
  assertDocumentMatchesRoot(root, draft.document)
  return draft
}

const rootProjection = sql<Record<string, unknown>>`
  SELECT definition.*, source.kind AS source_kind, source.owner_user_id AS source_owner_user_id,
    (SELECT draft.version FROM public.reusable_definition_drafts draft
      WHERE draft.definition_id = definition.id) AS draft_version
  FROM public.reusable_definitions definition
  JOIN public.content_sources source
    ON source.id = definition.content_source_id AND source.game_system_id = definition.game_system_id
`

/** Server-only repository. Service code validates documents and source authority before mutation. */
export function createReusableDefinitionRepository(db: DBLike) {
  async function lockRoot(
    transaction: DBLike,
    definitionId: string
  ): Promise<ReusableDefinitionRootRecord> {
    const locator = await sql<{ content_source_id: string; game_system_id: string }>`
      SELECT content_source_id, game_system_id
      FROM public.reusable_definitions
      WHERE id = ${definitionId}
    `.execute(transaction)
    const located = locator.rows[0]
    if (!located) throw new Error('Reusable definition does not exist.')
    const source = await sql<{ id: string }>`
      SELECT id FROM public.content_sources
      WHERE id = ${located.content_source_id} AND game_system_id = ${located.game_system_id}
      FOR UPDATE
    `.execute(transaction)
    if (!source.rows[0]) throw new Error('Reusable definition content source does not exist.')
    const rootResult = await sql<Record<string, unknown>>`
      ${rootProjection}
      WHERE definition.id = ${definitionId}
        AND definition.content_source_id = ${located.content_source_id}
        AND definition.game_system_id = ${located.game_system_id}
      FOR UPDATE OF definition
    `.execute(transaction)
    const row = rootResult.rows[0]
    if (!row) throw new Error('Reusable definition changed before lock acquisition.')
    return rootFromRow(row)
  }

  return {
    async createRoot(input: {
      gameSystemId: string
      actorUserId: string
      definitionFamilyKey: string
      label: string
      description: string | null
    }): Promise<ReusableDefinitionRootRecord> {
      return withTransaction(db, async (trx) => {
        const contentSourceId = await requireDefaultUserContentSource(
          trx,
          input.gameSystemId,
          input.actorUserId
        )
        const inserted = await sql<{ id: string }>`
          INSERT INTO public.reusable_definitions (
            game_system_id, content_source_id, definition_family_key, label, description
          ) VALUES (
            ${input.gameSystemId}::uuid, ${contentSourceId}::uuid,
            ${input.definitionFamilyKey}, ${input.label}, ${input.description}
          )
          RETURNING id
        `.execute(trx)
        const definitionId = inserted.rows[0]?.id
        if (!definitionId) throw new Error('Reusable definition root was not created.')
        const result = await sql<Record<string, unknown>>`
          ${rootProjection} WHERE definition.id = ${definitionId}::uuid
        `.execute(trx)
        if (!result.rows[0]) throw new Error('Reusable definition root is unavailable.')
        return rootFromRow(result.rows[0])
      })
    },

    async listRootsForUser(input: {
      gameSystemId: string
      actorUserId: string
    }): Promise<ReusableDefinitionRootRecord[]> {
      const result = await sql<Record<string, unknown>>`
        ${rootProjection}
        WHERE definition.game_system_id = ${input.gameSystemId}::uuid
          AND (source.kind = 'PLATFORM' OR source.owner_user_id = ${input.actorUserId}::uuid)
        ORDER BY definition.definition_family_key, definition.label, definition.id
      `.execute(db)
      return result.rows.map(rootFromRow)
    },

    async getRoot(definitionId: string): Promise<ReusableDefinitionRootRecord | null> {
      const result = await sql<Record<string, unknown>>`
        ${rootProjection} WHERE definition.id = ${definitionId}
      `.execute(db)
      return result.rows[0] ? rootFromRow(result.rows[0]) : null
    },

    async getDraft(root: ReusableDefinitionRootRecord): Promise<ReusableDefinitionDraftDto | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.reusable_definition_drafts
        WHERE definition_id = ${root.id}::uuid
      `.execute(db)
      return result.rows[0] ? draftFromRow(result.rows[0], root) : null
    },

    async requireCurrent(definitionId: string): Promise<ReusableDefinitionCurrentDto> {
      const root = await this.getRoot(definitionId)
      if (!root?.current) throw new Error('Reusable definition is not currently published.')
      return root.current
    },

    async listCurrentAvailableToCampaign(input: {
      campaignId: string
      gameSystemId: string
    }): Promise<ReusableDefinitionCurrentDto[]> {
      const result = await sql<Record<string, unknown>>`
        ${rootProjection}
        WHERE definition.game_system_id = ${input.gameSystemId}::uuid
          AND definition.current_document IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.rules_catalogue_content_sources inclusion
            JOIN public.campaigns campaign
              ON campaign.id = ${input.campaignId}::uuid
             AND campaign.game_system_id = inclusion.game_system_id
            WHERE inclusion.content_source_id = definition.content_source_id
              AND inclusion.game_system_id = definition.game_system_id
              AND (
                inclusion.catalogue_id = campaign.primary_rules_catalogue_id
                OR inclusion.catalogue_id IN (
                  SELECT additional.rules_catalogue_id
                  FROM public.campaign_additional_rules_catalogues additional
                  WHERE additional.campaign_id = campaign.id
                )
              )
          )
        ORDER BY definition.definition_family_key, definition.label, definition.id
      `.execute(db)
      return result.rows.map((row) => {
        const current = rootFromRow(row).current
        if (!current) throw new Error('Reusable definition current document is unavailable.')
        return current
      })
    },

    async saveDraft(input: {
      definitionId: string
      actorUserId: string
      expectedDefinitionVersion: number
      expectedDraftVersion: number | null
      document: unknown
      checksum: string
      authorize: (root: ReusableDefinitionRootRecord) => void | Promise<void>
    }): Promise<ReusableDefinitionDraftDto> {
      const document = reusableDefinitionDocumentDtoSchema.parse(input.document)
      return withTransaction(db, async (trx) => {
        const root = await lockRoot(trx, input.definitionId)
        assertDocumentMatchesRoot(root, document)
        await input.authorize(root)
        if (root.version !== input.expectedDefinitionVersion) {
          throw new Error('Reusable definition version is stale.')
        }
        const existingResult = await sql<Record<string, unknown>>`
          SELECT * FROM public.reusable_definition_drafts
          WHERE definition_id = ${root.id} FOR UPDATE
        `.execute(trx)
        const existing = existingResult.rows[0]
        if (existing) {
          if (input.expectedDraftVersion !== Number(existing.version)) {
            throw new Error('Reusable definition draft version is stale.')
          }
          const updated = await sql<Record<string, unknown>>`
            UPDATE public.reusable_definition_drafts
            SET author_user_id = ${input.actorUserId}, document = ${JSON.stringify(document)}::jsonb,
                checksum = ${input.checksum}, base_definition_version = ${root.version},
                version = version + 1
            WHERE definition_id = ${root.id} AND version = ${Number(existing.version)}
            RETURNING *
          `.execute(trx)
          if (!updated.rows[0]) throw new Error('Reusable definition draft changed before update.')
          return draftFromRow(updated.rows[0], root)
        }
        if (input.expectedDraftVersion !== null)
          throw new Error('Reusable definition draft does not exist.')
        const inserted = await sql<Record<string, unknown>>`
          INSERT INTO public.reusable_definition_drafts (
            definition_id, game_system_id, author_user_id, document, checksum, base_definition_version
          ) VALUES (
            ${root.id}, ${root.gameSystemId}, ${input.actorUserId},
            ${JSON.stringify(document)}::jsonb, ${input.checksum}, ${root.version}
          ) RETURNING *
        `.execute(trx)
        if (!inserted.rows[0]) throw new Error('Reusable definition draft was not created.')
        return draftFromRow(inserted.rows[0], root)
      })
    },

    async publishDraft(input: {
      definitionId: string
      actorUserId: string
      expectedDefinitionVersion: number
      expectedDraftVersion: number
      authorize: (root: ReusableDefinitionRootRecord) => void
      dependencyDefinitionIds: (draft: ReusableDefinitionDraftDto) => readonly string[]
      validate: (
        root: ReusableDefinitionRootRecord,
        draft: ReusableDefinitionDraftDto,
        lockedDependencies: readonly ReusableDefinitionCurrentDto[]
      ) => void | Promise<void>
    }): Promise<ReusableDefinitionCurrentDto> {
      return withTransaction(db, async (trx) => {
        const root = await lockRoot(trx, input.definitionId)
        input.authorize(root)
        if (root.version !== input.expectedDefinitionVersion) {
          throw new Error('Reusable definition version is stale.')
        }
        const draftResult = await sql<Record<string, unknown>>`
          SELECT * FROM public.reusable_definition_drafts
          WHERE definition_id = ${root.id} FOR UPDATE
        `.execute(trx)
        const draftRow = draftResult.rows[0]
        if (!draftRow) throw new Error('Reusable definition draft does not exist.')
        const draft = draftFromRow(draftRow, root)
        if (
          draft.version !== input.expectedDraftVersion ||
          draft.baseDefinitionVersion !== root.version
        ) {
          throw new Error('Reusable definition draft is stale.')
        }
        const dependencyIds = [...new Set(input.dependencyDefinitionIds(draft))]
          .filter((definitionId) => definitionId !== root.id)
          .sort((left, right) => left.localeCompare(right))
        let lockedDependencies: ReusableDefinitionCurrentDto[] = []
        if (dependencyIds.length > 0) {
          const dependencyResult = await sql<Record<string, unknown>>`
            ${rootProjection}
            WHERE definition.id IN (${sql.join(
              dependencyIds.map((definitionId) => sql`${definitionId}::uuid`)
            )})
            ORDER BY definition.id ASC
            FOR UPDATE OF definition
          `.execute(trx)
          if (dependencyResult.rows.length !== dependencyIds.length) {
            throw new Error('Reusable definition dependency is unavailable.')
          }
          lockedDependencies = dependencyResult.rows.map((row) => {
            const dependency = rootFromRow(row).current
            if (!dependency) throw new Error('Reusable definition dependency is not published.')
            return dependency
          })
        }
        await input.validate(root, draft, lockedDependencies)
        const updated = await sql<Record<string, unknown>>`
          UPDATE public.reusable_definitions
          SET current_document = ${JSON.stringify(draft.document)}::jsonb,
              current_checksum = ${draft.checksum}, current_contract_version = 1,
              published_at = now(), published_by = ${input.actorUserId}, version = version + 1
          WHERE id = ${root.id} AND version = ${root.version}
          RETURNING *
        `.execute(trx)
        if (!updated.rows[0]) throw new Error('Reusable definition changed before publish.')
        await sql`DELETE FROM public.reusable_definition_drafts WHERE definition_id = ${root.id}`.execute(
          trx
        )
        return reusableDefinitionCurrentDtoSchema.parse({
          id: String(updated.rows[0].id),
          gameSystemId: String(updated.rows[0].game_system_id),
          contentSourceId: String(updated.rows[0].content_source_id),
          definitionFamilyKey: String(updated.rows[0].definition_family_key),
          label: String(updated.rows[0].label),
          description:
            updated.rows[0].description == null ? null : String(updated.rows[0].description),
          document: updated.rows[0].current_document,
          checksum: String(updated.rows[0].current_checksum),
          contractVersion: Number(updated.rows[0].current_contract_version),
          version: Number(updated.rows[0].version),
          publishedAt: iso(updated.rows[0].published_at as Timestamp),
          publishedBy: String(updated.rows[0].published_by)
        })
      })
    }
  }
}
