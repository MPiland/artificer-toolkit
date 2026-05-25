import {
  createAuthoredRouteIdRepository,
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

export interface AuthoredOwnership {
  isMaster: boolean
  ownerUserId: string | null
}

export interface AuthoredContentAuthz {
  canManageMasterContent?: boolean
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

function getPermissions(ownership: AuthoredOwnership, userId: string, authz: AuthoredContentAuthz = {}) {
  const ownsRecord = !ownership.isMaster && ownership.ownerUserId === userId
  const canManageMaster = ownership.isMaster && authz.canManageMasterContent === true

  return {
    canView: true,
    canEdit: ownsRecord || canManageMaster,
    canCopy: true,
    canDelete: ownsRecord
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
    ownerUserId: row.ownerUserId ?? (row.userId === 'master' ? null : row.userId)
  }
}

export function normalizeAuthoredListResponse<
  TItem extends AuthoredListRow,
  TResponse extends { items: TItem[], meta: unknown }
>(
  response: TResponse,
  userId: string,
  authz: AuthoredContentAuthz = {}
) {
  return {
    ...response,
    items: response.items.map((item) => {
      const ownership = getListOwnership(item)

      return {
        ...item,
        provenance: getProvenance(ownership),
        permissions: getPermissions(ownership, userId, authz)
      }
    })
  }
}

function toDraftSummary(draft: AuthoredSubjectDraft & { publicId?: string }): AuthoredDraftSummaryDto {
  return {
    subjectKind: draft.subjectKind,
    subjectId: draft.subjectId,
    publicId: draft.publicId ?? draft.subjectId,
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
  const level = typeof payload.level === 'number' ? payload.level : undefined
  const magicSchoolId = typeof payload.magicSchoolId === 'string' ? payload.magicSchoolId : null
  const castingTime = typeof payload.castingTime === 'object' && payload.castingTime !== null && !Array.isArray(payload.castingTime)
    ? payload.castingTime as Record<string, unknown>
    : {}
  const castingTimeUnit = typeof castingTime.unit === 'string' ? castingTime.unit : undefined
  const castingTimeAmount = typeof castingTime.amount === 'number' ? castingTime.amount : undefined

  return {
    description,
    ...(category ? { category } : {}),
    ...(level !== undefined ? { level } : {}),
    ...(magicSchoolId !== null ? { magicSchoolId } : {}),
    ...(castingTimeUnit ? { castingTimeUnit } : {}),
    ...(castingTimeAmount !== undefined ? { castingTimeAmount } : {})
  }
}

function getPublicId(publicIdBySubjectId: Map<string, { publicId?: string }>, subjectId: string) {
  return publicIdBySubjectId.get(subjectId)?.publicId ?? subjectId
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
  subjectKind: AuthoredSubjectDraftKind,
  authz: AuthoredContentAuthz = {}
) {
  const normalized = normalizeAuthoredListResponse(response, userId, authz)
  const drafts = await createAuthoredSubjectDraftRepository(db).listByUser({
    userId,
    subjectKind
  })
  const draftBySubjectId = new Map(drafts.map((draft) => [draft.subjectId, draft]))
  const routeSubjectIds = new Set([
    ...normalized.items.map((item) => item.id),
    ...drafts.map((draft) => draft.subjectId)
  ])
  const publicIdBySubjectId = await createAuthoredRouteIdRepository(db).ensureMany(
    subjectKind,
    [...routeSubjectIds]
  )

  return {
    ...normalized,
    drafts: drafts.map((draft) => {
      const publicId = getPublicId(publicIdBySubjectId, draft.subjectId)

      return {
        ...toDraftSummary({
          ...draft,
          publicId
        }),
        ...getDraftListMetadata(draft)
      }
    }),
    items: normalized.items.map((item) => {
      const publicId = getPublicId(publicIdBySubjectId, item.id)
      const draft = draftBySubjectId.get(item.id)

      return {
        ...item,
        publicId,
        draft: draft
          ? {
              ...toDraftSummary({
                ...draft,
                publicId
              }),
              ...getDraftListMetadata(draft)
            }
          : undefined
      }
    })
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
    ownerUserId: row.ownerUserId
  }
}

export async function normalizeAuthoredDetailResponse<TRecord extends AuthoredRecord>(
  db: DBLike,
  table: AuthoredContentTable,
  item: TRecord | null,
  userId: string,
  authz: AuthoredContentAuthz = {}
) {
  if (!item) return null

  const ownership = await getAuthoredOwnership(db, table, item.id)
    ?? { isMaster: item.userId === 'master', ownerUserId: item.userId === 'master' ? null : item.userId }

  const routeIdentity = await createAuthoredRouteIdRepository(db).ensure({
    subjectKind: getSubjectKindForTable(table),
    subjectId: item.id
  })

  return {
    item,
    publicId: routeIdentity.publicId,
    provenance: getProvenance(ownership),
    permissions: getPermissions(ownership, userId, authz)
  }
}

function getSubjectKindForTable(table: AuthoredContentTable): AuthoredSubjectDraftKind {
  switch (table) {
    case 'backgrounds':
      return 'BACKGROUND'
    case 'classes':
      return 'CLASS'
    case 'creatures':
      return 'CREATURE'
    case 'equipment':
      return 'EQUIPMENT'
    case 'feats':
      return 'FEAT'
    case 'races':
      return 'RACE'
    case 'spells':
      return 'SPELL'
    case 'vehicles':
      return 'VEHICLE'
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
  const draft = await createAuthoredSubjectDraftRepository(db).findBySubject({
    subjectKind,
    subjectId,
    userId
  })
  if (!draft) return null

  const routeIdentity = await createAuthoredRouteIdRepository(db).ensure({
    subjectKind,
    subjectId
  })

  return {
    ...draft,
    publicId: routeIdentity.publicId
  }
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

export class AuthoredContentDependencyError extends Error {
  constructor(subjectKind: AuthoredSubjectDraftKind, subjectId: string) {
    super(`${subjectKind} "${subjectId}" has dependent content and cannot be deleted.`)
    this.name = 'AuthoredContentDependencyError'
  }
}

export class AuthoredContentNotFoundError extends Error {
  constructor(subjectKind: AuthoredSubjectDraftKind, subjectId: string) {
    super(`${subjectKind} "${subjectId}" was not found.`)
    this.name = 'NotFoundError'
  }
}

export async function assertWritableAuthoredSubject(
  db: DBLike,
  table: AuthoredContentTable,
  subjectKind: AuthoredSubjectDraftKind,
  subjectId: string,
  userId: string,
  authz: AuthoredContentAuthz = {}
): Promise<AuthoredOwnership | null> {
  const ownership = await getAuthoredOwnership(db, table, subjectId)
  if (!ownership) return null

  if (ownership.isMaster) {
    if (authz.canManageMasterContent === true) return ownership
    throw new AuthoredContentOwnershipError(subjectKind, subjectId)
  }

  if (ownership.ownerUserId !== userId) {
    throw new AuthoredContentOwnershipError(subjectKind, subjectId)
  }

  return ownership
}

export async function activeAuthoredSubjectExists(
  db: DBLike,
  table: AuthoredContentTable,
  subjectId: string
): Promise<boolean> {
  const row = await db
    .selectFrom(table as TableName)
    .select('id')
    .where('id', '=', subjectId)
    .executeTakeFirst()

  return Boolean(row)
}

export async function assertNoActiveDeleteDependents(
  db: DBLike,
  table: AuthoredContentTable,
  subjectKind: AuthoredSubjectDraftKind,
  subjectId: string
): Promise<void> {
  const dependency = await findActiveDeleteDependency(db, table, subjectId)

  if (dependency) {
    throw new AuthoredContentDependencyError(subjectKind, subjectId)
  }
}

export async function assertDeletableActiveAuthoredSubject(
  db: DBLike,
  table: AuthoredContentTable,
  subjectKind: AuthoredSubjectDraftKind,
  subjectId: string,
  userId: string
): Promise<void> {
  if (!await activeAuthoredSubjectExists(db, table, subjectId)) {
    throw new AuthoredContentNotFoundError(subjectKind, subjectId)
  }

  await assertWritableAuthoredSubject(db, table, subjectKind, subjectId, userId)
  await assertNoActiveDeleteDependents(db, table, subjectKind, subjectId)
}

export async function deleteActiveAuthoredSubject(
  db: DBLike,
  table: AuthoredContentTable,
  subjectKind: AuthoredSubjectDraftKind,
  subjectId: string,
  userId: string
): Promise<void> {
  await assertDeletableActiveAuthoredSubject(db, table, subjectKind, subjectId, userId)
  await db
    .deleteFrom(table as TableName)
    .where('id', '=', subjectId)
    .execute()
}

async function findActiveDeleteDependency(
  db: DBLike,
  table: AuthoredContentTable,
  subjectId: string
): Promise<unknown | null> {
  switch (table) {
    case 'classes':
      return await db
        .selectFrom('classes')
        .select('id')
        .where('parent_class_id', '=', subjectId)
        .executeTakeFirst() ?? null
    case 'equipment':
      return await db
        .selectFrom('equipment')
        .select('id')
        .where('parent_equipment_id', '=', subjectId)
        .executeTakeFirst() ?? null
    case 'races':
      return await db
        .selectFrom('races')
        .select('id')
        .where('parent_race_id', '=', subjectId)
        .executeTakeFirst() ?? null
    default:
      return null
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
  const draft = await createAuthoredSubjectDraftRepository(db).save({
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
  const routeIdentity = await createAuthoredRouteIdRepository(db).ensure({
    subjectKind: draft.subjectKind,
    subjectId: draft.subjectId
  })

  return {
    ...draft,
    publicId: routeIdentity.publicId
  }
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
    status: 'DRAFT',
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
  userId: string,
  authz: AuthoredContentAuthz = {}
) {
  return normalizeAuthoredDetailResponse(db, table, result.authored, userId, authz)
}
