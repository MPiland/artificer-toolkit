import { sql } from 'kysely'
import type { DBLike, Json } from '#types'
import { withTransaction } from '../../../utils/index.js'

export type AuthoredSubjectKind
  = | 'BACKGROUND'
    | 'CLASS'
    | 'CREATURE'
    | 'EQUIPMENT'
    | 'FEAT'
    | 'RACE'
    | 'SPELL'
    | 'VEHICLE'

export type AuthoredDraftState = 'DRAFT_ONLY' | 'ACTIVE_WITH_DRAFT'

export interface AuthoredDefinition {
  subjectId: string
  subjectKind: AuthoredSubjectKind
  ownerUserId: string | null
  systemId: string
  label: string
  isMaster: boolean
  activeRevisionId: string | null
  draftRevisionId: string | null
  createdAt: string
  updatedAt: string
}

export interface AuthoredDefinitionDraft {
  subjectKind: AuthoredSubjectKind
  subjectId: string
  userId: string
  systemId: string
  label: string
  status: 'DRAFT'
  payload: Json
  draftState: AuthoredDraftState
  revisionId: string
  revisionNumber: number
  activeRevisionId: string | null
  baseActiveRevisionId: string | null
  createdAt: string
  updatedAt: string
}

export interface SaveAuthoredDefinitionDraftInput {
  subjectKind: AuthoredSubjectKind
  subjectId: string
  userId: string
  systemId: string
  label: string
  payload: Json
}

export interface SyncMasterAuthoredDefinitionInput {
  subjectKind: AuthoredSubjectKind
  subjectId: string
  systemId: string
  label: string
  payload: Json
}

interface AuthoredDefinitionRow {
  subject_id: string
  subject_kind: AuthoredSubjectKind
  owner_user_id: string | null
  system_id: string
  label: string
  is_master: boolean
  active_revision_id: string | null
  draft_revision_id: string | null
  next_revision_number: number
  created_at: Date | string
  updated_at: Date | string
}

interface AuthoredDefinitionDraftRow extends AuthoredDefinitionRow {
  revision_id: string
  revision_number: number
  payload: Json
  base_active_revision_id: string | null
  revision_created_at: Date | string
}

export class AuthoredDefinitionRevisionConflictError extends Error {
  constructor(subjectId: string) {
    super(`Authored definition "${subjectId}" changed after its draft was created.`)
    this.name = 'AuthoredDefinitionRevisionConflictError'
  }
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}

function mapDefinition(row: AuthoredDefinitionRow): AuthoredDefinition {
  return {
    subjectId: row.subject_id,
    subjectKind: row.subject_kind,
    ownerUserId: row.owner_user_id,
    systemId: row.system_id,
    label: row.label,
    isMaster: row.is_master,
    activeRevisionId: row.active_revision_id,
    draftRevisionId: row.draft_revision_id,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  }
}

function mapDraft(row: AuthoredDefinitionDraftRow): AuthoredDefinitionDraft {
  if (!row.owner_user_id) {
    throw new Error(`Authored definition "${row.subject_id}" has a draft without an owner.`)
  }

  return {
    subjectKind: row.subject_kind,
    subjectId: row.subject_id,
    userId: row.owner_user_id,
    systemId: row.system_id,
    label: row.label,
    status: 'DRAFT',
    payload: row.payload,
    draftState: row.active_revision_id ? 'ACTIVE_WITH_DRAFT' : 'DRAFT_ONLY',
    revisionId: row.revision_id,
    revisionNumber: row.revision_number,
    activeRevisionId: row.active_revision_id,
    baseActiveRevisionId: row.base_active_revision_id,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.revision_created_at)
  }
}

async function findDefinitionBySubject(
  db: DBLike,
  subjectKind: AuthoredSubjectKind,
  subjectId: string
): Promise<AuthoredDefinition | null> {
  const result = await sql<AuthoredDefinitionRow>`
    select
      subject_id,
      subject_kind,
      owner_user_id,
      system_id,
      label,
      is_master,
      active_revision_id,
      draft_revision_id,
      next_revision_number,
      created_at::text as created_at,
      updated_at::text as updated_at
    from authored_definitions
    where subject_kind = ${subjectKind}
      and subject_id = ${subjectId}
    limit 1
  `.execute(db)

  const row = result.rows[0]
  return row ? mapDefinition(row) : null
}

async function findDraftBySubject(
  db: DBLike,
  subjectKind: AuthoredSubjectKind,
  subjectId: string,
  userId: string
): Promise<AuthoredDefinitionDraft | null> {
  const result = await sql<AuthoredDefinitionDraftRow>`
    select
      definition.subject_id,
      definition.subject_kind,
      definition.owner_user_id,
      definition.system_id,
      definition.label,
      definition.is_master,
      definition.active_revision_id,
      definition.draft_revision_id,
      definition.next_revision_number,
      definition.created_at::text as created_at,
      definition.updated_at::text as updated_at,
      revision.id as revision_id,
      revision.revision_number,
      revision.payload,
      revision.base_active_revision_id,
      revision.created_at::text as revision_created_at
    from authored_definitions definition
    join authored_definition_revisions revision
      on revision.definition_id = definition.subject_id
      and revision.id = definition.draft_revision_id
    where definition.subject_kind = ${subjectKind}
      and definition.subject_id = ${subjectId}
      and definition.owner_user_id = ${userId}
    limit 1
  `.execute(db)

  const row = result.rows[0]
  return row ? mapDraft(row) : null
}

async function saveDraft(
  db: DBLike,
  input: SaveAuthoredDefinitionDraftInput
): Promise<AuthoredDefinitionDraft> {
  return withTransaction(db, async (trx) => {
    const definitionResult = await sql<AuthoredDefinitionRow>`
      select
        subject_id,
        subject_kind,
        owner_user_id,
        system_id,
        label,
        is_master,
        active_revision_id,
        draft_revision_id,
        next_revision_number,
        created_at,
        updated_at
      from authored_definitions
      where subject_id = ${input.subjectId}
      for update
    `.execute(trx)
    const existing = definitionResult.rows[0]

    if (existing && (existing.subject_kind !== input.subjectKind || existing.owner_user_id !== input.userId || existing.is_master)) {
      throw new Error(`Authored definition "${input.subjectId}" is not writable by this owner and subject kind.`)
    }
    if (existing && existing.system_id !== input.systemId) {
      throw new Error(`Authored definition "${input.subjectId}" cannot change rules system.`)
    }

    if (!existing) {
      await sql`
        insert into authored_definitions (
          subject_id,
          subject_kind,
          owner_user_id,
          system_id,
          label,
          is_master,
          next_revision_number
        ) values (
          ${input.subjectId},
          ${input.subjectKind},
          ${input.userId},
          ${input.systemId},
          ${input.label},
          false,
          2
        )
      `.execute(trx)
    }

    const revisionNumber = existing?.next_revision_number ?? 1
    const baseActiveRevisionId = existing?.draft_revision_id
      ? (await sql<{ base_active_revision_id: string | null }>`
          select base_active_revision_id
          from authored_definition_revisions
          where definition_id = ${input.subjectId}
            and id = ${existing.draft_revision_id}
        `.execute(trx)).rows[0]?.base_active_revision_id ?? existing.active_revision_id
      : existing?.active_revision_id ?? null
    const revisionResult = await sql<{ id: string }>`
      insert into authored_definition_revisions (
        definition_id,
        revision_number,
        payload,
        base_active_revision_id,
        created_by_user_id
      ) values (
        ${input.subjectId},
        ${revisionNumber},
        ${JSON.stringify(input.payload)}::jsonb,
        ${baseActiveRevisionId},
        ${input.userId}
      )
      returning id
    `.execute(trx)
    const revisionId = revisionResult.rows[0]?.id
    if (!revisionId) {
      throw new Error(`Failed to create a revision for authored definition "${input.subjectId}".`)
    }

    await sql`
      update authored_definitions
      set
        label = ${input.label},
        draft_revision_id = ${revisionId},
        next_revision_number = ${revisionNumber + 1},
        updated_at = now()
      where subject_id = ${input.subjectId}
    `.execute(trx)

    if (existing?.draft_revision_id && existing.draft_revision_id !== existing.active_revision_id) {
      await sql`
        delete from authored_definition_revisions
        where definition_id = ${input.subjectId}
          and id = ${existing.draft_revision_id}
      `.execute(trx)
    }

    const draft = await findDraftBySubject(trx, input.subjectKind, input.subjectId, input.userId)
    if (!draft) {
      throw new Error(`Failed to load authored definition draft "${input.subjectId}" after saving it.`)
    }

    return draft
  })
}

async function activateDraft(
  db: DBLike,
  params: {
    subjectKind: AuthoredSubjectKind
    subjectId: string
    userId: string
    revisionId: string
  }
): Promise<{ revisionId: string, revisionNumber: number }> {
  return withTransaction(db, async (trx) => {
    const result = await sql<{
      active_revision_id: string | null
      base_active_revision_id: string | null
      draft_revision_id: string | null
      revision_number: number | null
    }>`
      select
        definition.active_revision_id,
        definition.draft_revision_id,
        revision.base_active_revision_id,
        revision.revision_number
      from authored_definitions definition
      left join authored_definition_revisions revision
        on revision.definition_id = definition.subject_id
        and revision.id = definition.draft_revision_id
      where definition.subject_kind = ${params.subjectKind}
        and definition.subject_id = ${params.subjectId}
        and definition.owner_user_id = ${params.userId}
      for update of definition
    `.execute(trx)
    const row = result.rows[0]

    if (!row || row.draft_revision_id !== params.revisionId || row.revision_number == null) {
      throw new AuthoredDefinitionRevisionConflictError(params.subjectId)
    }
    if (row.active_revision_id !== row.base_active_revision_id) {
      throw new AuthoredDefinitionRevisionConflictError(params.subjectId)
    }

    await sql`
      update authored_definitions
      set
        active_revision_id = ${params.revisionId},
        draft_revision_id = null,
        updated_at = now()
      where subject_id = ${params.subjectId}
    `.execute(trx)

    return {
      revisionId: params.revisionId,
      revisionNumber: row.revision_number
    }
  })
}

async function discardDraft(
  db: DBLike,
  params: {
    subjectKind: AuthoredSubjectKind
    subjectId: string
    userId: string
  }
): Promise<void> {
  return withTransaction(db, async (trx) => {
    const result = await sql<{
      active_revision_id: string | null
      draft_revision_id: string | null
    }>`
      select active_revision_id, draft_revision_id
      from authored_definitions
      where subject_kind = ${params.subjectKind}
        and subject_id = ${params.subjectId}
        and owner_user_id = ${params.userId}
      for update
    `.execute(trx)
    const definition = result.rows[0]

    if (definition?.draft_revision_id) {
      await sql`
        update authored_definitions
        set draft_revision_id = null, updated_at = now()
        where subject_id = ${params.subjectId}
      `.execute(trx)

      if (definition.draft_revision_id !== definition.active_revision_id) {
        await sql`
          delete from authored_definition_revisions
          where definition_id = ${params.subjectId}
            and id = ${definition.draft_revision_id}
        `.execute(trx)
      }
    }

    if (definition && !definition.active_revision_id) {
      await sql`
        delete from authored_definitions
        where subject_id = ${params.subjectId}
      `.execute(trx)
    }

  })
}

async function deleteActive(
  db: DBLike,
  params: {
    subjectKind: AuthoredSubjectKind
    subjectId: string
    userId: string
  }
): Promise<boolean> {
  return withTransaction(db, async (trx) => {
    const result = await sql<{ draft_revision_id: string | null }>`
      select draft_revision_id
      from authored_definitions
      where subject_kind = ${params.subjectKind}
        and subject_id = ${params.subjectId}
        and owner_user_id = ${params.userId}
      for update
    `.execute(trx)
    const definition = result.rows[0]
    if (!definition) {
      return false
    }

    if (definition.draft_revision_id) {
      await sql`
        update authored_definitions
        set active_revision_id = null, updated_at = now()
        where subject_id = ${params.subjectId}
      `.execute(trx)
    } else {
      await sql`
        delete from authored_definitions
        where subject_id = ${params.subjectId}
      `.execute(trx)
    }

    return Boolean(definition.draft_revision_id)
  })
}

async function syncMaster(
  db: DBLike,
  input: SyncMasterAuthoredDefinitionInput
): Promise<{ revisionId: string, revisionNumber: number }> {
  return withTransaction(db, async (trx) => {
    const definitionResult = await sql<AuthoredDefinitionRow>`
      select
        subject_id,
        subject_kind,
        owner_user_id,
        system_id,
        label,
        is_master,
        active_revision_id,
        draft_revision_id,
        next_revision_number,
        created_at,
        updated_at
      from authored_definitions
      where subject_id = ${input.subjectId}
      for update
    `.execute(trx)
    const existing = definitionResult.rows[0]
    if (existing && (!existing.is_master || existing.subject_kind !== input.subjectKind)) {
      throw new Error(`Master authored definition "${input.subjectId}" conflicts with owned content.`)
    }

    if (!existing) {
      await sql`
        insert into authored_definitions (
          subject_id,
          subject_kind,
          owner_user_id,
          system_id,
          label,
          is_master,
          next_revision_number
        ) values (
          ${input.subjectId},
          ${input.subjectKind},
          null,
          ${input.systemId},
          ${input.label},
          true,
          2
        )
      `.execute(trx)
    } else if (existing.active_revision_id) {
      const matchResult = await sql<{
        payload_matches: boolean
        revision_number: number
      }>`
        select
          payload = ${JSON.stringify(input.payload)}::jsonb as payload_matches,
          revision_number
        from authored_definition_revisions
        where definition_id = ${input.subjectId}
          and id = ${existing.active_revision_id}
      `.execute(trx)
      if (matchResult.rows[0]?.payload_matches) {
        await sql`
          update authored_definitions
          set system_id = ${input.systemId}, label = ${input.label}, updated_at = now()
          where subject_id = ${input.subjectId}
        `.execute(trx)
        return {
          revisionId: existing.active_revision_id,
          revisionNumber: matchResult.rows[0].revision_number
        }
      }
    }

    const revisionNumber = existing?.next_revision_number ?? 1
    const revisionResult = await sql<{ id: string }>`
      insert into authored_definition_revisions (
        definition_id,
        revision_number,
        payload,
        base_active_revision_id,
        created_by_user_id
      ) values (
        ${input.subjectId},
        ${revisionNumber},
        ${JSON.stringify(input.payload)}::jsonb,
        ${existing?.active_revision_id ?? null},
        null
      )
      returning id
    `.execute(trx)
    const revisionId = revisionResult.rows[0]?.id
    if (!revisionId) {
      throw new Error(`Failed to create master revision for "${input.subjectId}".`)
    }

    await sql`
      update authored_definitions
      set
        system_id = ${input.systemId},
        label = ${input.label},
        active_revision_id = ${revisionId},
        next_revision_number = ${revisionNumber + 1},
        updated_at = now()
      where subject_id = ${input.subjectId}
    `.execute(trx)

    return { revisionId, revisionNumber }
  })
}

export function createAuthoredDefinitionRepository(db: DBLike) {
  return {
    findBySubject(params: {
      subjectKind: AuthoredSubjectKind
      subjectId: string
    }): Promise<AuthoredDefinition | null> {
      return findDefinitionBySubject(db, params.subjectKind, params.subjectId)
    },

    async findBySubjects(params: {
      subjectKind: AuthoredSubjectKind
      subjectIds: string[]
    }): Promise<AuthoredDefinition[]> {
      if (params.subjectIds.length === 0) return []

      const result = await sql<AuthoredDefinitionRow>`
        select
          subject_id,
          subject_kind,
          owner_user_id,
          system_id,
          label,
          is_master,
          active_revision_id,
          draft_revision_id,
          next_revision_number,
          created_at::text as created_at,
          updated_at::text as updated_at
        from authored_definitions
        where subject_kind = ${params.subjectKind}
          and subject_id in (${sql.join(params.subjectIds)})
      `.execute(db)

      return result.rows.map(mapDefinition)
    },

    findDraftBySubject(params: {
      subjectKind: AuthoredSubjectKind
      subjectId: string
      userId: string
    }): Promise<AuthoredDefinitionDraft | null> {
      return findDraftBySubject(db, params.subjectKind, params.subjectId, params.userId)
    },

    async listDraftsByUser(params: {
      userId: string
      subjectKind?: AuthoredSubjectKind
    }): Promise<AuthoredDefinitionDraft[]> {
      const result = params.subjectKind == null
        ? await sql<AuthoredDefinitionDraftRow>`
          select
            definition.subject_id,
            definition.subject_kind,
            definition.owner_user_id,
            definition.system_id,
            definition.label,
            definition.is_master,
            definition.active_revision_id,
            definition.draft_revision_id,
            definition.next_revision_number,
            definition.created_at::text as created_at,
            definition.updated_at::text as updated_at,
            revision.id as revision_id,
            revision.revision_number,
            revision.payload,
            revision.base_active_revision_id,
            revision.created_at::text as revision_created_at
          from authored_definitions definition
          join authored_definition_revisions revision
            on revision.definition_id = definition.subject_id
            and revision.id = definition.draft_revision_id
          where definition.owner_user_id = ${params.userId}
          order by revision.created_at desc
        `.execute(db)
        : await sql<AuthoredDefinitionDraftRow>`
          select
            definition.subject_id,
            definition.subject_kind,
            definition.owner_user_id,
            definition.system_id,
            definition.label,
            definition.is_master,
            definition.active_revision_id,
            definition.draft_revision_id,
            definition.next_revision_number,
            definition.created_at::text as created_at,
            definition.updated_at::text as updated_at,
            revision.id as revision_id,
            revision.revision_number,
            revision.payload,
            revision.base_active_revision_id,
            revision.created_at::text as revision_created_at
          from authored_definitions definition
          join authored_definition_revisions revision
            on revision.definition_id = definition.subject_id
            and revision.id = definition.draft_revision_id
          where definition.owner_user_id = ${params.userId}
            and definition.subject_kind = ${params.subjectKind}
          order by revision.created_at desc
        `.execute(db)

      return result.rows.map(mapDraft)
    },

    saveDraft(input: SaveAuthoredDefinitionDraftInput): Promise<AuthoredDefinitionDraft> {
      return saveDraft(db, input)
    },

    activateDraft(params: {
      subjectKind: AuthoredSubjectKind
      subjectId: string
      userId: string
      revisionId: string
    }): Promise<{ revisionId: string, revisionNumber: number }> {
      return activateDraft(db, params)
    },

    discardDraft(params: {
      subjectKind: AuthoredSubjectKind
      subjectId: string
      userId: string
    }): Promise<void> {
      return discardDraft(db, params)
    },

    deleteActive(params: {
      subjectKind: AuthoredSubjectKind
      subjectId: string
      userId: string
    }): Promise<boolean> {
      return deleteActive(db, params)
    },

    syncMaster(input: SyncMasterAuthoredDefinitionInput): Promise<{ revisionId: string, revisionNumber: number }> {
      return syncMaster(db, input)
    }
  }
}
