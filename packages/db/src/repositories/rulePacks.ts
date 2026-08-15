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
  evaluatorKind: 'ZEN'
  evaluatorVersion: string
  modelContractVersion: number
  document: RulePackDocument
  checksum: string
  createdBy: string
  activatedBy: string | null
  activatedAt: string | null
  state: RulePackRevisionState
  createdAt: string
  updatedAt: string
}

export interface RulePackRevisionWithPackRecord {
  pack: RulePackRecord
  revision: RulePackRevisionRecord
}

export interface RulePackRulesetRecord {
  systemId: string
  code: string
  version: string
}

export interface SeededRulesetRecord extends RulePackRulesetRecord {
  ownerId: string | null
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
    evaluatorKind: 'ZEN',
    evaluatorVersion: String(row.evaluator_version),
    modelContractVersion: Number(row.model_contract_version),
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

function packFromRevisionRow(row: Record<string, unknown>): RulePackRecord {
  return {
    id: String(row.pack_id),
    rulesetCode: String(row.pack_ruleset_code),
    version: String(row.pack_version),
    activeRevisionId:
      row.pack_active_revision_id == null ? null : String(row.pack_active_revision_id),
    createdAt: iso(row.pack_created_at as RuntimeTimestamp),
    updatedAt: iso(row.pack_updated_at as RuntimeTimestamp)
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

    async getRevisionWithPack(revisionId: string): Promise<RulePackRevisionWithPackRecord | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT revision.*, revision.id = pack.active_revision_id AS is_active,
          pack.id AS pack_id, pack.ruleset_code AS pack_ruleset_code,
          pack.version AS pack_version, pack.active_revision_id AS pack_active_revision_id,
          pack.created_at AS pack_created_at, pack.updated_at AS pack_updated_at
        FROM public.rule_pack_revisions revision
        JOIN public.rule_packs pack ON pack.id = revision.rule_pack_id
        WHERE revision.id = ${revisionId}
        FOR SHARE OF pack, revision
      `.execute(db)
      const row = result.rows[0]
      return row
        ? { pack: packFromRevisionRow(row), revision: revisionFromRow(row, revisionState(row)) }
        : null
    },

    async findRulesetForSystem(systemId: string): Promise<RulePackRulesetRecord | null> {
      const result = await sql<{
        system_id: string
        ruleset_code: string
        ruleset_version: string
      }>`
        SELECT id AS system_id, ruleset_code, ruleset_version
        FROM public.systems
        WHERE id = ${systemId}
        FOR SHARE
      `.execute(db)
      const row = result.rows[0]
      return row
        ? { systemId: row.system_id, code: row.ruleset_code, version: row.ruleset_version }
        : null
    },

    async findSeededRuleset(
      rulesetCode: string,
      version: string
    ): Promise<SeededRulesetRecord | null> {
      const result = await sql<{
        system_id: string
        ruleset_code: string
        ruleset_version: string
        owner_id: string | null
      }>`
        SELECT id AS system_id, ruleset_code, ruleset_version, user_id AS owner_id
        FROM public.systems
        WHERE ruleset_code = ${rulesetCode}
          AND ruleset_version = ${version}
          AND user_id IS NOT NULL
        ORDER BY id
        LIMIT 1
        FOR SHARE
      `.execute(db)
      const row = result.rows[0]
      return row
        ? {
            systemId: row.system_id,
            code: row.ruleset_code,
            version: row.ruleset_version,
            ownerId: row.owner_id
          }
        : null
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

    async backfillActiveCharacterRevision(input: {
      rulesetCode: string
      version: string
      revisionId: string
    }): Promise<number> {
      const result = await sql<{ id: string }>`
        UPDATE public.characters character
        SET rule_pack_revision_id = ${input.revisionId}
        FROM public.systems system
        WHERE character.system_id = system.id
          AND character.status = 'ACTIVE'
          AND character.rule_pack_revision_id IS NULL
          AND system.ruleset_code = ${input.rulesetCode}
          AND system.ruleset_version = ${input.version}
        RETURNING character.id
      `.execute(db)
      return result.rows.length
    },

    async saveDraft(input: {
      rulePackId: string
      expectedUpdatedAt: string | null
      evaluatorKind: 'ZEN'
      evaluatorVersion: string
      modelContractVersion: number
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
            SET
              evaluator_kind = ${input.evaluatorKind},
              evaluator_version = ${input.evaluatorVersion},
              model_contract_version = ${input.modelContractVersion},
              document = ${JSON.stringify(input.document)}::jsonb,
              checksum = ${input.checksum}
            WHERE id = ${String(existing.id)}
            RETURNING *
          `.execute(trx)
          const row = updated.rows[0]
          return row ? revisionFromRow(row, 'DRAFT') : null
        }

        if (input.expectedUpdatedAt !== null) return null
        const inserted = await sql<Record<string, unknown>>`
          INSERT INTO public.rule_pack_revisions (
            rule_pack_id, revision, evaluator_kind, evaluator_version, model_contract_version,
            document, checksum, created_by
          ) VALUES (
            ${input.rulePackId},
            (SELECT COALESCE(MAX(revision), 0) + 1 FROM public.rule_pack_revisions WHERE rule_pack_id = ${input.rulePackId}),
            ${input.evaluatorKind}, ${input.evaluatorVersion}, ${input.modelContractVersion},
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
      expectedActiveRevisionId?: string | null
    }): Promise<RulePackRevisionRecord | null> {
      return withTransaction(db, async (trx) => {
        const pack = await sql<{ id: string; active_revision_id: string | null }>`
          SELECT id, active_revision_id
          FROM public.rule_packs
          WHERE id = ${input.rulePackId}
          FOR UPDATE
        `.execute(trx)
        const lockedPack = pack.rows[0]
        if (!lockedPack) return null
        if (
          input.expectedActiveRevisionId !== undefined &&
          lockedPack.active_revision_id !== input.expectedActiveRevisionId
        ) {
          return null
        }

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

        const updatedPack = await sql<{ id: string }>`
          UPDATE public.rule_packs
          SET active_revision_id = ${input.revisionId}
          WHERE id = ${input.rulePackId}
          RETURNING id
        `.execute(trx)
        if (!updatedPack.rows[0]) return null
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
