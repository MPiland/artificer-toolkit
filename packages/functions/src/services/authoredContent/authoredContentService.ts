import {
  createAuthoredRouteIdRepository,
  createAuthoredDefinitionRepository,
  type AuthoredDefinitionDraft,
  type AuthoredSubjectKind,
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

function toDraftSummary(draft: AuthoredDefinitionDraft & { publicId?: string }): AuthoredDraftSummaryDto {
  return {
    subjectKind: draft.subjectKind,
    subjectId: draft.subjectId,
    publicId: draft.publicId ?? draft.subjectId,
    userId: draft.userId,
    systemId: draft.systemId,
    label: draft.label,
    status: draft.status,
    draftState: draft.draftState,
    revisionId: draft.revisionId,
    revisionNumber: draft.revisionNumber,
    activeRevisionId: draft.activeRevisionId,
    baseActiveRevisionId: draft.baseActiveRevisionId,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt
  }
}

function getDraftPayloadRecord(draft: AuthoredDefinitionDraft): Record<string, unknown> {
  return typeof draft.payload === 'object' && draft.payload !== null && !Array.isArray(draft.payload)
    ? draft.payload as Record<string, unknown>
    : {}
}

function getDraftListMetadata(draft: AuthoredDefinitionDraft) {
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
  subjectKind: AuthoredSubjectKind
) {
  const normalized = normalizeAuthoredListResponse(response, userId)
  const definitionRepository = createAuthoredDefinitionRepository(db)
  const drafts = await definitionRepository.listDraftsByUser({
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
  const definitions = await definitionRepository.findBySubjects({
    subjectKind,
    subjectIds: normalized.items.map((item) => item.id)
  })
  const definitionBySubjectId = new Map(definitions.map((definition) => [definition.subjectId, definition]))

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
      const definition = definitionBySubjectId.get(item.id)
      if (!definition?.activeRevisionId) {
        throw new Error(`${subjectKind} "${item.id}" is missing its canonical active revision.`)
      }

      return {
        ...item,
        publicId,
        activeRevisionId: definition.activeRevisionId,
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
  subjectKind: AuthoredSubjectKind,
  id: string
): Promise<AuthoredOwnership | null> {
  const definition = await createAuthoredDefinitionRepository(db).findBySubject({
    subjectKind,
    subjectId: id
  })
  if (!definition) return null

  return {
    isMaster: definition.isMaster,
    ownerUserId: definition.ownerUserId
  }
}

export async function normalizeAuthoredDetailResponse<TRecord extends AuthoredRecord>(
  db: DBLike,
  table: AuthoredContentTable,
  item: TRecord | null,
  userId: string
) {
  if (!item) return null

  const subjectKind = getSubjectKindForTable(table)
  const definition = await createAuthoredDefinitionRepository(db).findBySubject({
    subjectKind,
    subjectId: item.id
  })
  if (!definition?.activeRevisionId) {
    throw new Error(`${subjectKind} "${item.id}" is missing its canonical active revision.`)
  }
  const ownership = {
    isMaster: definition.isMaster,
    ownerUserId: definition.ownerUserId
  }

  const routeIdentity = await createAuthoredRouteIdRepository(db).ensure({
    subjectKind,
    subjectId: item.id
  })

  return {
    item,
    publicId: routeIdentity.publicId,
    activeRevisionId: definition.activeRevisionId,
    provenance: getProvenance(ownership),
    permissions: getPermissions(ownership, userId)
  }
}

function getSubjectKindForTable(table: AuthoredContentTable): AuthoredSubjectKind {
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
  subjectKind: AuthoredSubjectKind,
  subjectId: string,
  userId: string
) {
  const draft = await createAuthoredDefinitionRepository(db).findDraftBySubject({
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
  constructor(subjectKind: AuthoredSubjectKind, subjectId: string) {
    super(`${subjectKind} draft "${subjectId}" was not found.`)
    this.name = 'AuthoredDraftNotFoundError'
  }
}

export class AuthoredContentOwnershipError extends Error {
  constructor(subjectKind: AuthoredSubjectKind, subjectId: string) {
    super(`${subjectKind} "${subjectId}" cannot be edited by the current user.`)
    this.name = 'AuthoredContentOwnershipError'
  }
}

export class AuthoredContentDependencyError extends Error {
  constructor(subjectKind: AuthoredSubjectKind, subjectId: string) {
    super(`${subjectKind} "${subjectId}" has dependent content and cannot be deleted.`)
    this.name = 'AuthoredContentDependencyError'
  }
}

export class AuthoredContentNotFoundError extends Error {
  constructor(subjectKind: AuthoredSubjectKind, subjectId: string) {
    super(`${subjectKind} "${subjectId}" was not found.`)
    this.name = 'NotFoundError'
  }
}

export async function assertWritableAuthoredSubject(
  db: DBLike,
  subjectKind: AuthoredSubjectKind,
  subjectId: string,
  userId: string
): Promise<AuthoredOwnership | null> {
  const ownership = await getAuthoredOwnership(db, subjectKind, subjectId)
  if (!ownership) return null

  if (ownership.isMaster) {
    throw new AuthoredContentOwnershipError(subjectKind, subjectId)
  }

  if (ownership.ownerUserId !== userId) {
    throw new AuthoredContentOwnershipError(subjectKind, subjectId)
  }

  return ownership
}

export async function activeAuthoredSubjectExists(
  db: DBLike,
  subjectKind: AuthoredSubjectKind,
  subjectId: string
): Promise<boolean> {
  const definition = await createAuthoredDefinitionRepository(db).findBySubject({
    subjectKind,
    subjectId
  })
  return Boolean(definition?.activeRevisionId)
}

export async function assertNoActiveDeleteDependents(
  db: DBLike,
  table: AuthoredContentTable,
  subjectKind: AuthoredSubjectKind,
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
  subjectKind: AuthoredSubjectKind,
  subjectId: string,
  userId: string
): Promise<void> {
  if (!await activeAuthoredSubjectExists(db, subjectKind, subjectId)) {
    throw new AuthoredContentNotFoundError(subjectKind, subjectId)
  }

  await assertWritableAuthoredSubject(db, subjectKind, subjectId, userId)
  await assertNoActiveDeleteDependents(db, table, subjectKind, subjectId)
}

export async function deleteActiveAuthoredSubject(
  db: DBLike,
  table: AuthoredContentTable,
  subjectKind: AuthoredSubjectKind,
  subjectId: string,
  userId: string
): Promise<void> {
  await assertDeletableActiveAuthoredSubject(db, table, subjectKind, subjectId, userId)
  await db
    .deleteFrom(table as TableName)
    .where('id', '=', subjectId)
    .execute()
  await createAuthoredDefinitionRepository(db).deleteActive({
    subjectKind,
    subjectId,
    userId
  })
}

async function findActiveDeleteDependency(
  db: DBLike,
  table: AuthoredContentTable,
  subjectId: string
): Promise<{ id: string } | null> {
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

export async function requireAuthoredDraft(
  db: DBLike,
  subjectKind: AuthoredSubjectKind,
  subjectId: string,
  userId: string
): Promise<AuthoredDefinitionDraft> {
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
  const draft = await createAuthoredDefinitionRepository(db).saveDraft({
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
    })
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
  draft: AuthoredDefinitionDraft,
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
  subjectKind: AuthoredSubjectKind,
  subjectId: string,
  userId: string
) {
  await createAuthoredDefinitionRepository(db).discardDraft({
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
