import {
  createAuthoredSubjectDraftRepository,
  type AuthoredSubjectDraft,
  type AuthoredSubjectDraftKind,
  type DBLike,
  type Json,
  type TableName
} from '@artificer-toolkit/db'
import type {
  AuthoredDraftSaveRequestDto,
  AuthoredDraftSummaryDto
} from '@artificer-toolkit/schema/api/content'

type AuthoredContentTable =
  | 'backgrounds'
  | 'classes'
  | 'creatures'
  | 'equipment'
  | 'feats'
  | 'races'
  | 'spells'
  | 'vehicles'

interface AuthoredOwnership {
  isMaster: boolean
  ownerUserId: string | null
}

export interface AuthoredListRow {
  userId: string
  isMaster?: boolean | null
  ownerUserId?: string | null
}

export interface AuthoredRecord {
  id: string
  userId: string
  systemId: string
  label: string
  status?: 'ACTIVE' | 'DRAFT'
}

export interface AuthoringPipelineResult<TRecord extends AuthoredRecord> {
  authored: TRecord
}

function getPermissions(ownership: AuthoredOwnership, userId: string) {
  const ownsRecord = !ownership.isMaster && ownership.ownerUserId === userId

  return {
    canView: true,
    canEdit: ownsRecord,
    canCopy: true,
    canDelete: ownsRecord
  }
}

function getOwnedPermissions() {
  return {
    canView: true,
    canEdit: true,
    canCopy: true,
    canDelete: true
  }
}

function getProvenance(ownership: AuthoredOwnership) {
  return {
    kind: ownership.isMaster ? 'MASTER' as const : 'OWNED' as const,
    ownerUserId: ownership.isMaster ? null : ownership.ownerUserId
  }
}

function getListOwnership(row: AuthoredListRow): AuthoredOwnership {
  const isMaster = row.isMaster ?? row.userId === 'master'

  return {
    isMaster,
    ownerUserId: isMaster ? null : row.ownerUserId ?? row.userId
  }
}

export function normalizeAuthoredListResponse<
  TItem extends AuthoredListRow,
  TResponse extends { items: TItem[], meta: unknown }
>(
  response: TResponse,
  userId: string
) {
  return {
    ...response,
    items: response.items.map((item) => {
      const ownership = getListOwnership(item)

      return {
        ...item,
        provenance: getProvenance(ownership),
        permissions: getPermissions(ownership, userId)
      }
    })
  }
}

function toDraftSummary(draft: AuthoredSubjectDraft): AuthoredDraftSummaryDto {
  return {
    subjectKind: draft.subjectKind,
    subjectId: draft.subjectId,
    userId: draft.userId,
    systemId: draft.systemId,
    label: draft.label,
    status: draft.status,
    draftState: draft.draftState,
    baseActiveUpdatedAt: draft.baseActiveUpdatedAt,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt
  }
}

function getDraftPayloadRecord(draft: AuthoredSubjectDraft): Record<string, unknown> {
  return typeof draft.payload === 'object' && draft.payload !== null && !Array.isArray(draft.payload)
    ? draft.payload as Record<string, unknown>
    : {}
}

function getDraftListMetadata(draft: AuthoredSubjectDraft) {
  const payload = getDraftPayloadRecord(draft)
  const description = typeof payload.description === 'string' ? payload.description : null
  const category = typeof payload.category === 'string' ? payload.category : undefined

  return {
    description,
    ...(category ? { category } : {})
  }
}

export async function normalizeAuthoredListResponseWithDrafts<
  TItem extends AuthoredListRow & {
    id: string
    label: string
    status: string
    systemId: string
    description?: string | null
  },
  TResponse extends { items: TItem[], meta: unknown }
>(
  db: DBLike,
  response: TResponse,
  userId: string,
  subjectKind: AuthoredSubjectDraftKind
) {
  const normalized = normalizeAuthoredListResponse(response, userId)
  const drafts = await createAuthoredSubjectDraftRepository(db).listByUser({
    userId,
    subjectKind
  })
  const draftBySubjectId = new Map(drafts.map((draft) => [draft.subjectId, draft]))
  const activeIds = new Set(normalized.items.map((item) => item.id))
  const activeItems = normalized.items.map((item) => {
    const draft = draftBySubjectId.get(item.id)
    if (!draft) return item

    return {
      ...item,
      label: draft.label,
      status: 'DRAFT',
      draft: toDraftSummary(draft)
    }
  })
  const draftOnlyItems = drafts
    .filter((draft) => !activeIds.has(draft.subjectId))
    .map((draft) => {
      const metadata = getDraftListMetadata(draft)

      return {
        id: draft.subjectId,
        label: draft.label,
        status: 'DRAFT',
        ...metadata,
        userId: draft.userId,
        systemId: draft.systemId,
        provenance: {
          kind: 'OWNED' as const,
          ownerUserId: draft.userId
        },
        permissions: getOwnedPermissions(),
        draft: toDraftSummary(draft)
      }
    })

  return {
    ...normalized,
    items: [
      ...activeItems,
      ...draftOnlyItems
    ]
  }
}

export async function getAuthoredOwnership(
  db: DBLike,
  table: AuthoredContentTable,
  id: string
): Promise<AuthoredOwnership | null> {
  const row = await db
    .selectFrom(table as TableName)
    .select([
      'is_master as isMaster',
      'user_id as ownerUserId'
    ])
    .where('id', '=', id)
    .executeTakeFirst() as { isMaster: boolean, ownerUserId: string | null } | undefined

  if (!row) return null

  return {
    isMaster: row.isMaster,
    ownerUserId: row.isMaster ? null : row.ownerUserId
  }
}

export async function normalizeAuthoredDetailResponse<TRecord extends AuthoredRecord>(
  db: DBLike,
  table: AuthoredContentTable,
  item: TRecord | null,
  userId: string
) {
  if (!item) return null

  const ownership = await getAuthoredOwnership(db, table, item.id)
    ?? { isMaster: item.userId === 'master', ownerUserId: item.userId === 'master' ? null : item.userId }

  return {
    item,
    provenance: getProvenance(ownership),
    permissions: getPermissions(ownership, userId)
  }
}

export function normalizeAuthoringInput<TRecord extends AuthoredRecord>(
  input: TRecord,
  userId: string
): TRecord {
  return {
    ...input,
    userId
  }
}

export function normalizeActivatedAuthoringInput<TRecord extends AuthoredRecord>(
  input: TRecord,
  userId: string
): TRecord {
  return {
    ...input,
    userId,
    status: 'ACTIVE'
  }
}

export async function getAuthoredDraft(
  db: DBLike,
  subjectKind: AuthoredSubjectDraftKind,
  subjectId: string,
  userId: string
) {
  return createAuthoredSubjectDraftRepository(db).findBySubject({
    subjectKind,
    subjectId,
    userId
  })
}

export class AuthoredDraftNotFoundError extends Error {
  constructor(subjectKind: AuthoredSubjectDraftKind, subjectId: string) {
    super(`${subjectKind} draft "${subjectId}" was not found.`)
    this.name = 'AuthoredDraftNotFoundError'
  }
}

export class AuthoredDraftSubjectMismatchError extends Error {
  constructor(subjectKind: AuthoredSubjectDraftKind, pathSubjectId: string, bodySubjectId: string) {
    super(`${subjectKind} draft route id "${pathSubjectId}" does not match request body subjectId "${bodySubjectId}".`)
    this.name = 'AuthoredDraftSubjectMismatchError'
  }
}

export class AuthoredContentOwnershipError extends Error {
  constructor(subjectKind: AuthoredSubjectDraftKind, subjectId: string) {
    super(`${subjectKind} "${subjectId}" cannot be edited by the current user.`)
    this.name = 'AuthoredContentOwnershipError'
  }
}

export async function assertWritableAuthoredSubject(
  db: DBLike,
  table: AuthoredContentTable,
  subjectKind: AuthoredSubjectDraftKind,
  subjectId: string,
  userId: string
): Promise<void> {
  const ownership = await getAuthoredOwnership(db, table, subjectId)
  if (!ownership) return

  if (ownership.isMaster || ownership.ownerUserId !== userId) {
    throw new AuthoredContentOwnershipError(subjectKind, subjectId)
  }
}

export function extractDraftSubjectIdFromRequest(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const last = segments[segments.length - 1]
  const previous = segments[segments.length - 2]

  if (last === 'activate' && previous === 'draft') {
    return segments[segments.length - 3] ?? ''
  }

  if (last === 'draft') {
    return previous ?? ''
  }

  return last ?? ''
}

export function resolveDraftActivationSubjectId(
  subjectKind: AuthoredSubjectDraftKind,
  bodySubjectId: string,
  req: Request
): string {
  const pathSubjectId = extractDraftSubjectIdFromRequest(req)
  if (pathSubjectId !== bodySubjectId) {
    throw new AuthoredDraftSubjectMismatchError(subjectKind, pathSubjectId, bodySubjectId)
  }

  return pathSubjectId
}

export async function requireAuthoredDraft(
  db: DBLike,
  subjectKind: AuthoredSubjectDraftKind,
  subjectId: string,
  userId: string
): Promise<AuthoredSubjectDraft> {
  const draft = await getAuthoredDraft(db, subjectKind, subjectId, userId)
  if (!draft) {
    throw new AuthoredDraftNotFoundError(subjectKind, subjectId)
  }

  return draft
}

export async function saveAuthoredDraft(
  db: DBLike,
  body: AuthoredDraftSaveRequestDto,
  userId: string
) {
  return createAuthoredSubjectDraftRepository(db).save({
    subjectKind: body.subjectKind,
    subjectId: body.subjectId,
    userId,
    systemId: body.systemId,
    label: body.label,
    payload: normalizeAuthoredDraftPayload(body.payload, {
      subjectId: body.subjectId,
      label: body.label,
      systemId: body.systemId,
      userId
    }),
    baseActiveUpdatedAt: body.baseActiveUpdatedAt ?? null
  })
}

export function normalizeAuthoredDraftPayload(
  payload: Record<string, unknown> | Json,
  identity: {
    subjectId: string
    label: string
    systemId: string
    userId: string
  }
): Json {
  return {
    ...(payload as Record<string, unknown>),
    id: identity.subjectId,
    label: identity.label,
    userId: identity.userId,
    systemId: identity.systemId
  } as Json
}

export function normalizeStoredDraftPayloadForActivation(
  draft: AuthoredSubjectDraft,
  userId: string
): Json {
  return normalizeAuthoredDraftPayload(draft.payload, {
    subjectId: draft.subjectId,
    label: draft.label,
    systemId: draft.systemId,
    userId
  })
}

export async function discardAuthoredDraft(
  db: DBLike,
  subjectKind: AuthoredSubjectDraftKind,
  subjectId: string,
  userId: string
) {
  await createAuthoredSubjectDraftRepository(db).delete({
    subjectKind,
    subjectId,
    userId
  })
}

export async function normalizeAuthoringResult<TRecord extends AuthoredRecord>(
  db: DBLike,
  table: AuthoredContentTable,
  result: AuthoringPipelineResult<TRecord>,
  userId: string
) {
  return normalizeAuthoredDetailResponse(db, table, result.authored, userId)
}
