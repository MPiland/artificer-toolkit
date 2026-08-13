import { sql } from 'kysely'

import type { DBLike, Json } from '#types'
import { withTransaction } from '../utils/index.js'

type RuntimeTimestamp = Date | string

export type RulePackRevisionState = 'DRAFT' | 'ACTIVE' | 'RETIRED'
export type RulePackDocument = Record<string, Json | undefined>

export interface RulePackRecord {
  id: string
  rulesetCode: string
  version: string
  activeRevisionId: string | null
  createdAt: string
  updatedAt: string
}

export interface RulePackRevisionRecord {
  id: string
  rulePackId: string
  revision: number
  document: RulePackDocument
  checksum: string
  createdBy: string
  activatedBy: string | null
  activatedAt: string | null
  state: RulePackRevisionState
  createdAt: string
  updatedAt: string
}

function iso(value: RuntimeTimestamp): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid database timestamp "${value}".`)
  return date.toISOString()
}

function rulePackFromRow(row: Record<string, unknown>): RulePackRecord {
  return {
    id: String(row.id),
    rulesetCode: String(row.ruleset_code),
    version: String(row.version),
    activeRevisionId: row.active_revision_id == null ? null : String(row.active_revision_id),
    createdAt: iso(row.created_at as RuntimeTimestamp),
    updatedAt: iso(row.updated_at as RuntimeTimestamp)
  }
}

function revisionFromRow(
  row: Record<string, unknown>,
  state: RulePackRevisionState
): RulePackRevisionRecord {
  return {
    id: String(row.id),
    rulePackId: String(row.rule_pack_id),
    revision: Number(row.revision),
    document: row.document as RulePackDocument,
    checksum: String(row.checksum),
    createdBy: String(row.created_by),
    activatedBy: row.activated_by == null ? null : String(row.activated_by),
    activatedAt: row.activated_at == null ? null : iso(row.activated_at as RuntimeTimestamp),
    state,
    createdAt: iso(row.created_at as RuntimeTimestamp),
    updatedAt: iso(row.updated_at as RuntimeTimestamp)
  }
}

function revisionState(row: Record<string, unknown>): RulePackRevisionState {
  if (row.activated_at == null) return 'DRAFT'
  return row.is_active === true ? 'ACTIVE' : 'RETIRED'
}

const revisionProjection = sql<Record<string, unknown>>`
  SELECT revision.*, revision.id = pack.active_revision_id AS is_active
  FROM public.rule_pack_revisions revision
  JOIN public.rule_packs pack ON pack.id = revision.rule_pack_id
`

export function createRulePackRepository(db: DBLike) {
  return {
    async listPacks(): Promise<RulePackRecord[]> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.rule_packs
        ORDER BY ruleset_code, version, id
      `.execute(db)
      return result.rows.map(rulePackFromRow)
    },

    async getPack(rulePackId: string): Promise<RulePackRecord | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.rule_packs WHERE id = ${rulePackId}
      `.execute(db)
      return result.rows[0] ? rulePackFromRow(result.rows[0]) : null
    },

    async findOrCreatePack(rulesetCode: string, version: string): Promise<RulePackRecord> {
      await sql`
        INSERT INTO public.rule_packs (ruleset_code, version)
        VALUES (${rulesetCode}, ${version})
        ON CONFLICT (ruleset_code, version) DO NOTHING
      `.execute(db)
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.rule_packs
        WHERE ruleset_code = ${rulesetCode} AND version = ${version}
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Rule pack was not created.')
      return rulePackFromRow(row)
    },

    async listRevisions(rulePackId: string): Promise<RulePackRevisionRecord[]> {
      const result = await sql<Record<string, unknown>>`
        ${revisionProjection}
        WHERE revision.rule_pack_id = ${rulePackId}
        ORDER BY revision.revision DESC
      `.execute(db)
      return result.rows.map((row) => revisionFromRow(row, revisionState(row)))
    },

    async getRevision(revisionId: string): Promise<RulePackRevisionRecord | null> {
      const result = await sql<Record<string, unknown>>`
        ${revisionProjection}
        WHERE revision.id = ${revisionId}
      `.execute(db)
      const row = result.rows[0]
      return row ? revisionFromRow(row, revisionState(row)) : null
    },

    async findActiveByRuleset(
      rulesetCode: string,
      version: string
    ): Promise<RulePackRevisionRecord | null> {
      const result = await sql<Record<string, unknown>>`
        ${revisionProjection}
        WHERE pack.ruleset_code = ${rulesetCode}
          AND pack.version = ${version}
          AND revision.id = pack.active_revision_id
        FOR SHARE OF pack, revision
      `.execute(db)
      const row = result.rows[0]
      return row ? revisionFromRow(row, 'ACTIVE') : null
    },

    async saveDraft(input: {
      rulePackId: string
      expectedUpdatedAt: string | null
      document: RulePackDocument
      checksum: string
      createdBy: string
    }): Promise<RulePackRevisionRecord | null> {
      return withTransaction(db, async (trx) => {
        const pack = await sql<{ id: string }>`
          SELECT id FROM public.rule_packs WHERE id = ${input.rulePackId} FOR UPDATE
        `.execute(trx)
        if (!pack.rows[0]) return null

        const draft = await sql<Record<string, unknown>>`
          SELECT * FROM public.rule_pack_revisions
          WHERE rule_pack_id = ${input.rulePackId} AND activated_at IS NULL
          FOR UPDATE
        `.execute(trx)
        const existing = draft.rows[0]

        if (existing) {
          if (input.expectedUpdatedAt !== iso(existing.updated_at as RuntimeTimestamp)) return null
          const updated = await sql<Record<string, unknown>>`
            UPDATE public.rule_pack_revisions
            SET document = ${JSON.stringify(input.document)}::jsonb, checksum = ${input.checksum}
            WHERE id = ${String(existing.id)} AND updated_at = ${input.expectedUpdatedAt}::timestamptz
            RETURNING *
          `.execute(trx)
          const row = updated.rows[0]
          return row ? revisionFromRow(row, 'DRAFT') : null
        }

        if (input.expectedUpdatedAt !== null) return null
        const inserted = await sql<Record<string, unknown>>`
          INSERT INTO public.rule_pack_revisions (
            rule_pack_id, revision, document, checksum, created_by
          ) VALUES (
            ${input.rulePackId},
            (SELECT COALESCE(MAX(revision), 0) + 1 FROM public.rule_pack_revisions WHERE rule_pack_id = ${input.rulePackId}),
            ${JSON.stringify(input.document)}::jsonb, ${input.checksum}, ${input.createdBy}
          )
          RETURNING *
        `.execute(trx)
        const row = inserted.rows[0]
        return row ? revisionFromRow(row, 'DRAFT') : null
      })
    },

    async activateDraft(input: {
      rulePackId: string
      revisionId: string
      checksum: string
      actorId: string
    }): Promise<RulePackRevisionRecord | null> {
      return withTransaction(db, async (trx) => {
        const activated = await sql<Record<string, unknown>>`
          UPDATE public.rule_pack_revisions
          SET activated_by = ${input.actorId}, activated_at = now()
          WHERE id = ${input.revisionId}
            AND rule_pack_id = ${input.rulePackId}
            AND checksum = ${input.checksum}
            AND activated_at IS NULL
          RETURNING *
        `.execute(trx)
        const row = activated.rows[0]
        if (!row) return null

        const pack = await sql<{ id: string }>`
          UPDATE public.rule_packs
          SET active_revision_id = ${input.revisionId}
          WHERE id = ${input.rulePackId}
          RETURNING id
        `.execute(trx)
        if (!pack.rows[0]) return null
        return revisionFromRow(row, 'ACTIVE')
      })
    },

    async retireActiveRevision(input: {
      rulePackId: string
      expectedRevisionId: string
    }): Promise<boolean> {
      return withTransaction(db, async (trx) => {
        const result = await sql<{ id: string }>`
          UPDATE public.rule_packs
          SET active_revision_id = NULL
          WHERE id = ${input.rulePackId} AND active_revision_id = ${input.expectedRevisionId}
          RETURNING id
        `.execute(trx)
        return Boolean(result.rows[0])
      })
    }
  }
}
