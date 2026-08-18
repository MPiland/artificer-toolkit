import type { z } from 'zod'
import type {
  AuthoredActiveMetadata,
  AuthoredCatalogPageInput,
  AuthoredDraft,
  DBLike
} from '@artificer-toolkit/db'
import {
  createAuthoredContentRepository,
  createAuthoredVersionRepository,
  createMediaRepository,
  createAuthoredRouteIdRepository,
  getAuthoredCatalogPage,
  withTransaction
} from '@artificer-toolkit/db'
import {
  createBackgroundSubjectAuthoringService,
  createClassSubjectAuthoringService,
  createCreatureSubjectAuthoringService,
  createEquipmentSubjectAuthoringService,
  createFeatSubjectAuthoringService,
  createRaceSubjectAuthoringService,
  createSpellSubjectAuthoringService,
  createVehicleSubjectAuthoringService
} from '../subjects/index.js'
import { normalizeNodeRuntimeValues } from '../nodeRuntime/index.js'
import {
  toAuthoredValidationIssues,
  type AuthoredDetailRequestDto,
  type AuthoredDraftDto,
  type AuthoredDraftSaveRequestDto,
  type AuthoredSubjectKindDto
} from '@artificer-toolkit/schema/api/content'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import { classAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { featAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/feat'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import { cloneAuthoredItem } from '@artificer-toolkit/shared/utils'
import {
  activeAuthoredSubjectExists,
  assertWritableAuthoredSubject,
  deleteActiveAuthoredSubject,
  discardAuthoredDraft,
  getAuthoredDraft,
  getAuthoredPermissions,
  getAuthoredProvenance,
  getDraftListMetadata,
  normalizeActivatedAuthoringInput,
  normalizeAuthoringResult,
  normalizeStoredDraftPayloadForActivation,
  saveAuthoredDraft,
  toDraftSummary,
  AuthoredContentNotFoundError,
  type AuthoredRecord
} from './authoredContentService.js'
import { publishVersionedAuthoredAggregate } from './versionedAuthoring.js'

type AuthoredContentTable =
  | 'backgrounds'
  | 'classes'
  | 'creatures'
  | 'equipment'
  | 'feats'
  | 'races'
  | 'spells'
  | 'vehicles'

type NodeRuntimeMapId =
  | 'background'
  | 'class'
  | 'creature'
  | 'equipment'
  | 'feat'
  | 'race'
  | 'spell'
  | 'vehicle'

type AuthoringResult = {
  authored: AuthoredRecord
  compiled: unknown
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type AuthoringService = {
  prepare(input: AuthoredRecord): Promise<AuthoringResult>
}

type DetailReferenceOption = {
  value: string
  label: string
}

type DetailMeta = Record<string, DetailReferenceOption[]>

type DetailMetaResolver = (
  db: DBLike,
  item: AuthoredRecord,
  keys: Set<string>
) => Promise<DetailMeta>

export interface AuthoredDomainRuntimeConfig {
  createService: (db: DBLike) => AuthoringService
  mapId: NodeRuntimeMapId
  meta?: DetailMetaResolver
  schema: z.ZodType<AuthoredRecord>
  subjectKind: AuthoredSubjectKindDto
  table: AuthoredContentTable
}

export interface AuthoredContentInput {
  id: string
  label: string
  status?: unknown
  systemId: string
  userId?: string
}

export type DirectAuthoredDomainConfig = AuthoredDomainRuntimeConfig

export function buildDraftRequest<TInput extends AuthoredContentInput>(
  subjectKind: AuthoredSubjectKindDto,
  input: TInput
): AuthoredDraftSaveRequestDto {
  return {
    label: input.label,
    payload: input as unknown as Record<string, unknown>,
    subjectId: input.id,
    subjectKind,
    systemId: input.systemId
  }
}

export function getDetailItem<TInput extends AuthoredContentInput>(detail: unknown): TInput | null {
  if (typeof detail !== 'object' || detail === null || !('item' in detail)) {
    return null
  }

  return (detail as { item: TInput }).item
}

export async function listAuthoredDomain(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  request: AuthoredCatalogPageInput,
  userId: string
) {
  const page = await getAuthoredCatalogPage(db, {
    request,
    subjectKind: config.subjectKind,
    userId
  })
  const contentRepository = createAuthoredContentRepository(db)
  const drafts = await contentRepository.listDraftsByUser({
    userId,
    subjectKind: config.subjectKind
  })
  const routeIds = await createAuthoredRouteIdRepository(db).ensureMany(config.subjectKind, [
    ...drafts.map((draft) => draft.subjectId)
  ])
  const draftBySubjectId = new Map(drafts.map((draft) => [draft.subjectId, draft]))

  return {
    ...page,
    drafts: drafts.map((draft) => {
      const route = routeIds.get(draft.subjectId)
      if (!route) {
        throw new Error(`Missing route identity for ${config.subjectKind} draft "${draft.subjectId}".`)
      }
      return {
        ...toDraftSummary({ ...draft, publicId: route.publicId }),
        ...getDraftListMetadata(draft)
      }
    }),
    items: page.items.map((item) => {
      const ownership = { isMaster: item.isMaster, ownerUserId: item.ownerUserId }
      const draft = draftBySubjectId.get(item.id)
      return {
        ...item,
        provenance: getAuthoredProvenance(ownership),
        permissions: getAuthoredPermissions(ownership, userId),
        draft: draft
          ? {
              ...toDraftSummary({ ...draft, publicId: item.publicId }),
              ...getDraftListMetadata(draft)
            }
          : undefined
      }
    })
  }
}

export async function getAuthoredDomain(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  input: AuthoredDetailRequestDto,
  userId: string
) {
  const repository = createAuthoredContentRepository(db)
  let draftDetail: Awaited<ReturnType<typeof buildDraftDetail>> | null = null
  if (input.view === 'draft') {
    const selectedDraft = await repository.findDraftByRoute({
      routeId: input.id,
      subjectKind: config.subjectKind,
      userId
    })
    draftDetail = selectedDraft
      ? await buildDraftDetail(db, config, selectedDraft, input.meta)
      : null
    if (draftDetail?.item) return draftDetail
  }

  const selectedActive = await repository.findActiveByRoute({
    routeId: input.id,
    subjectKind: config.subjectKind,
    userId
  })
  if (!selectedActive) return draftDetail
  const version = await createAuthoredVersionRepository(db).findActive({
    subjectKind: config.subjectKind,
    subjectId: selectedActive.subjectId
  })
  if (!version) {
    throw new Error(`${config.subjectKind} "${selectedActive.subjectId}" has no active version.`)
  }
  const response = await buildActiveDetail(
    db,
    config,
    selectedActive,
    version.authored.document,
    userId,
    input.meta
  )

  return {
    ...response,
    ...(draftDetail?.draft ? { draft: draftDetail.draft } : {}),
    ...(draftDetail && 'validationIssues' in draftDetail
      ? { validationIssues: draftDetail.validationIssues }
      : {})
  }
}

export async function getAuthoredDomainDraft(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  id: string,
  userId: string
) {
  const subjectId = await resolveAuthoredRouteSubjectId(db, config.subjectKind, id)
  if (!subjectId) return null
  const draft = await getAuthoredDraft(db, config.subjectKind, subjectId, userId)
  return draft ? toAuthoredDraftDto(draft) : null
}

async function buildDraftDetail(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  selected: AuthoredDraft & { publicId: string },
  metaKeys: string[] | undefined
) {
  const parsedItem = config.schema.safeParse({
    ...(selected.payload as Record<string, unknown>),
    id: selected.subjectId,
    label: selected.label,
    status: 'DRAFT',
    systemId: selected.systemId,
    userId: selected.userId
  })
  const ownership = {
    isMaster: false,
    ownerUserId: selected.userId
  }
  const permissions = { canView: true, canEdit: true, canCopy: false, canDelete: true }
  const draft = { ...selected }
  const active =
    selected.draftState === 'ACTIVE_WITH_DRAFT'
      ? await createAuthoredContentRepository(db).findActiveBySubject({
          subjectKind: selected.subjectKind,
          subjectId: selected.subjectId
        })
      : null
  if (!parsedItem.success) {
    return {
      draft,
      activeUpdatedAt: active?.updatedAt ?? null,
      hasDraft: true,
      item: null,
      validationIssues: toAuthoredValidationIssues(parsedItem.error.issues),
      publicId: selected.publicId,
      provenance: getAuthoredProvenance(ownership),
      permissions
    }
  }

  const item = parsedItem.data
  const meta = await resolveDetailMeta(db, config, item, metaKeys)

  return {
    draft,
    activeUpdatedAt: active?.updatedAt ?? null,
    hasDraft: true,
    item,
    publicId: selected.publicId,
    provenance: getAuthoredProvenance(ownership),
    permissions,
    ...(meta ? { meta } : {})
  }
}

async function buildActiveDetail(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  selected: AuthoredActiveMetadata & { publicId: string },
  item: AuthoredRecord,
  userId: string,
  metaKeys: string[] | undefined
) {
  const parsedItem = config.schema.safeParse(item)
  const ownership = { isMaster: selected.isMaster, ownerUserId: selected.ownerUserId }
  const base = {
    activeUpdatedAt: selected.updatedAt,
    hasDraft: selected.hasDraft,
    publicId: selected.publicId,
    provenance: getAuthoredProvenance(ownership),
    permissions: getAuthoredPermissions(ownership, userId)
  }
  if (!parsedItem.success) {
    return {
      ...base,
      item: null,
      validationIssues: toAuthoredValidationIssues(parsedItem.error.issues)
    }
  }

  const meta = await resolveDetailMeta(db, config, parsedItem.data, metaKeys)
  return { ...base, item: parsedItem.data, ...(meta ? { meta } : {}) }
}

async function resolveDetailMeta(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  item: AuthoredRecord,
  metaKeys: string[] | undefined
) {
  if (!config.meta || !metaKeys?.length) return undefined
  return config.meta(db, item, new Set(metaKeys))
}

async function resolveAuthoredRouteSubjectId(
  db: DBLike,
  subjectKind: AuthoredSubjectKindDto,
  routeId: string
): Promise<string | null> {
  const repository = createAuthoredRouteIdRepository(db)
  if (uuidPattern.test(routeId)) {
    const subjectId = routeId.toLowerCase()
    const routeIdentity = await repository.resolveBySubjectForUser({
      subjectKind,
      subjectId
    })

    if (routeIdentity) return routeIdentity.subjectId

    return (await repository.canAccessSubjectForUser({
      subjectKind,
      subjectId
    }))
      ? subjectId
      : null
  }

  const routeIdentity = await repository.resolveByPublicIdForUser({
    subjectKind,
    publicId: routeId
  })

  return routeIdentity?.subjectId ?? null
}

export async function saveAuthoredDomainDraft(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  body: AuthoredDraftSaveRequestDto,
  userId: string
) {
  return withTransaction(db, async (trx) => {
    await assertWritableAuthoredSubject(trx, config.subjectKind, body.subjectId, userId)
    const saved = await saveAuthoredDraft(
      trx,
      {
        ...body,
        subjectKind: config.subjectKind
      },
      userId
    )
    const media = createMediaRepository(trx)
    const draftImage = await media.getAuthoredSlot(config.subjectKind, body.subjectId, 'DRAFT')
    if (!draftImage) {
      const activeImage = await media.getAuthoredSlot(config.subjectKind, body.subjectId, 'ACTIVE')
      if (activeImage) await media.upsertAuthoredSlot({ ...activeImage, scope: 'DRAFT' })
    }
    return toAuthoredDraftDto(saved)
  })
}

export async function saveAuthoredDomainInputDraft<TInput extends AuthoredContentInput>(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  input: TInput,
  userId: string
) {
  return saveAuthoredDomainDraft(db, config, buildDraftRequest(config.subjectKind, input), userId)
}

export async function duplicateAuthoredDomain(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  id: string,
  userId: string
) {
  return withTransaction(db, async (trx) => {
    const detail = await getAuthoredDomain(trx, config, { id }, userId)
    const item = getDetailItem<AuthoredRecord>(detail)
    if (!item) return null

    const parsedItem = config.schema.parse(item)
    return saveAuthoredDomainInputDraft(trx, config, cloneAuthoredItem(parsedItem), userId)
  })
}

export async function discardAuthoredDomainDraft(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  id: string,
  userId: string
) {
  return withTransaction(db, async (trx) => {
    const subjectId = await resolveAuthoredRouteSubjectId(trx, config.subjectKind, id)
    if (!subjectId) {
      throw new AuthoredContentNotFoundError(config.subjectKind, id)
    }

    const draft = await getAuthoredDraft(trx, config.subjectKind, subjectId, userId)
    const hasActive = await activeAuthoredSubjectExists(trx, config.subjectKind, subjectId)

    await discardAuthoredDraft(trx, config.subjectKind, subjectId, userId)
    await createMediaRepository(trx).deleteAuthoredSlot(config.subjectKind, subjectId, 'DRAFT')

    if (draft && !hasActive) {
      await createAuthoredRouteIdRepository(trx).delete({
        subjectKind: config.subjectKind,
        subjectId
      })
    }

    return { ok: true as const }
  })
}

export async function deleteAuthoredDomainActive(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  id: string,
  userId: string
) {
  return withTransaction(db, async (trx) => {
    const subjectId = await resolveAuthoredRouteSubjectId(trx, config.subjectKind, id)
    if (!subjectId) {
      throw new AuthoredContentNotFoundError(config.subjectKind, id)
    }

    const draft = await getAuthoredDraft(trx, config.subjectKind, subjectId, userId)
    await deleteActiveAuthoredSubject(trx, config.table, config.subjectKind, subjectId, userId)
    await createMediaRepository(trx).deleteAuthoredSlot(config.subjectKind, subjectId, 'ACTIVE')

    if (!draft) {
      await createAuthoredRouteIdRepository(trx).delete({
        subjectKind: config.subjectKind,
        subjectId
      })
    }

    return { ok: true as const }
  })
}

export async function activateAuthoredDomainDraft(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  subjectId: string,
  userId: string
) {
  return withTransaction(db, async (trx) => {
    const repository = createAuthoredContentRepository(trx)
    const draft = await repository.lockDraftForActivation({
      subjectKind: config.subjectKind,
      subjectId,
      userId
    })
    await assertWritableAuthoredSubject(trx, config.subjectKind, subjectId, userId)
    const input = config.schema.parse(normalizeStoredDraftPayloadForActivation(draft, userId))
    const normalized = await normalizeNodeRuntimeValues(trx, {
      mapId: config.mapId,
      values: { ...input },
      systemId: input.systemId
    })
    const normalizedBody = config.schema.parse(normalized.values)
    const result = await config
      .createService(trx)
      .prepare(normalizeActivatedAuthoringInput(normalizedBody, userId))
    await publishVersionedAuthoredAggregate({
      authored: result.authored,
      compiled: result.compiled,
      db: trx,
      subjectKind: config.subjectKind
    })
    const media = createMediaRepository(trx)
    const image = await media.getAuthoredSlot(config.subjectKind, subjectId, 'DRAFT')
    if (image) {
      await media.upsertAuthoredSlot({ ...image, scope: 'ACTIVE' })
      await media.deleteAuthoredSlot(config.subjectKind, subjectId, 'DRAFT')
    }
    await repository.deleteDraft({
      subjectKind: config.subjectKind,
      subjectId,
      userId
    })
    return normalizeAuthoringResult(trx, config.table, result, userId)
  })
}

export async function activateAuthoredDomainInput<TInput extends AuthoredContentInput>(
  db: DBLike,
  config: DirectAuthoredDomainConfig,
  body: TInput,
  userId: string
) {
  return withTransaction(db, async (trx) => {
    await assertWritableAuthoredSubject(trx, config.subjectKind, body.id, userId)
    const input = config.schema.parse({
      ...body,
      userId
    })
    const normalized = await normalizeNodeRuntimeValues(trx, {
      mapId: config.mapId,
      values: { ...input },
      systemId: input.systemId
    })
    const normalizedBody = config.schema.parse(normalized.values)
    await saveAuthoredDraft(trx, buildDraftRequest(config.subjectKind, normalizedBody), userId)
    const repository = createAuthoredContentRepository(trx)
    await repository.lockDraftForActivation({
      subjectKind: config.subjectKind,
      subjectId: normalizedBody.id,
      userId
    })
    const result = await config
      .createService(trx)
      .prepare(normalizeActivatedAuthoringInput(normalizedBody, userId))
    await publishVersionedAuthoredAggregate({
      authored: result.authored,
      compiled: result.compiled,
      db: trx,
      subjectKind: config.subjectKind
    })
    const media = createMediaRepository(trx)
    const image = await media.getAuthoredSlot(config.subjectKind, normalizedBody.id, 'DRAFT')
    if (image) {
      await media.upsertAuthoredSlot({ ...image, scope: 'ACTIVE' })
      await media.deleteAuthoredSlot(config.subjectKind, normalizedBody.id, 'DRAFT')
    }
    await repository.deleteDraft({
      subjectKind: config.subjectKind,
      subjectId: normalizedBody.id,
      userId
    })
    return normalizeAuthoringResult(trx, config.table, result, userId)
  })
}

function hasMetaKey(keys: Set<string>, key: string) {
  return keys.has(key)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toAuthoredDraftDto(draft: AuthoredDraft & { publicId: string }): AuthoredDraftDto {
  if (!isRecord(draft.payload)) {
    throw new TypeError('Authored draft payload must be an object.')
  }

  return {
    ...draft,
    payload: draft.payload
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function uniqueStrings(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function collectReferenceIds(value: unknown, singularKey: string, pluralKey: string): string[] {
  const ids = new Set<string>()

  function visit(current: unknown): void {
    if (Array.isArray(current)) {
      current.forEach(visit)
      return
    }
    if (!isRecord(current)) return

    for (const [key, nested] of Object.entries(current)) {
      if (key === singularKey) {
        const id = readString(nested)
        if (id) ids.add(id)
      } else if (key === pluralKey) {
        readStringArray(nested).forEach((id) => ids.add(id))
      }
      visit(nested)
    }
  }

  visit(value)
  return [...ids]
}

async function selectClassOptions(db: DBLike, ids: string[]) {
  if (!ids.length) return []
  return db
    .selectFrom('classes')
    .select(['id as value', 'label'])
    .where('id', 'in', ids)
    .orderBy('label')
    .execute()
}

async function selectEquipmentOptions(db: DBLike, ids: string[]) {
  if (!ids.length) return []
  return db
    .selectFrom('equipment')
    .select(['id as value', 'label'])
    .where('id', 'in', ids)
    .orderBy('label')
    .execute()
}

async function selectRaceOptions(db: DBLike, ids: string[]) {
  if (!ids.length) return []
  return db
    .selectFrom('races')
    .select(['id as value', 'label'])
    .where('id', 'in', ids)
    .orderBy('label')
    .execute()
}

async function selectVocabularyOptions(
  db: DBLike,
  table:
    | 'challenge_ratings'
    | 'condition_types'
    | 'creature_types'
    | 'currencies'
    | 'damage_types'
    | 'heritages'
    | 'languages'
    | 'magic_schools'
    | 'rarities'
    | 'skills'
    | 'speeds',
  systemId: string,
  ids?: string[]
) {
  let query = db
    .selectFrom(table)
    .select(['id as value', 'label'])
    .where('system_id', '=', systemId)

  if (ids) {
    if (!ids.length) return []
    query = query.where('id', 'in', ids)
  }

  return query.orderBy('label').execute()
}

async function vehicleDetailMeta(db: DBLike, item: AuthoredRecord, keys: Set<string>) {
  const record = item as AuthoredRecord & Record<string, unknown>
  const meta: DetailMeta = {}

  if (!hasMetaKey(keys, 'currencies')) return meta

  const cost =
    typeof record.cost === 'object' && record.cost !== null && !Array.isArray(record.cost)
      ? (record.cost as Record<string, unknown>)
      : {}
  const currencyId = readString(cost.currencyId)
  meta.currencies = await selectVocabularyOptions(
    db,
    'currencies',
    item.systemId,
    currencyId ? [currencyId] : []
  )
  return meta
}

async function spellDetailMeta(db: DBLike, item: AuthoredRecord, keys: Set<string>) {
  const record = item as AuthoredRecord & Record<string, unknown>
  const meta: DetailMeta = {}
  const queries: Array<Promise<void>> = []

  if (hasMetaKey(keys, 'classes')) {
    queries.push(
      selectClassOptions(db, readStringArray(record.classIds)).then((options) => {
        meta.classes = options
      })
    )
  }

  if (hasMetaKey(keys, 'magicSchools')) {
    queries.push(
      selectVocabularyOptions(
        db,
        'magic_schools',
        item.systemId,
        collectReferenceIds(record, 'magicSchoolId', 'magicSchoolIds')
      ).then((options) => {
        meta.magicSchools = options
      })
    )
  }

  if (hasMetaKey(keys, 'damageTypes')) {
    queries.push(
      selectVocabularyOptions(
        db,
        'damage_types',
        item.systemId,
        collectReferenceIds(record, 'damageTypeId', 'damageTypeIds')
      ).then((options) => {
        meta.damageTypes = options
      })
    )
  }

  if (hasMetaKey(keys, 'conditionTypes')) {
    const conditionIds = uniqueStrings([
      ...collectReferenceIds(record, 'conditionTypeId', 'conditionTypeIds'),
      ...collectReferenceIds(record, 'conditionId', 'conditionIds')
    ])
    queries.push(
      selectVocabularyOptions(db, 'condition_types', item.systemId, conditionIds).then(
        (options) => {
          meta.conditionTypes = options
        }
      )
    )
  }

  await Promise.all(queries)
  return meta
}

async function backgroundDetailMeta(
  db: DBLike,
  item: AuthoredRecord,
  keys: Set<string>
): Promise<DetailMeta> {
  return authoredReaderReferenceMeta(db, item, keys)
}

async function classDetailMeta(
  db: DBLike,
  item: AuthoredRecord,
  keys: Set<string>
): Promise<DetailMeta> {
  const record = item as AuthoredRecord & Record<string, unknown>
  const meta: DetailMeta = {}
  const queries: Array<Promise<void>> = []

  if (hasMetaKey(keys, 'classes')) {
    const parentClassId = readString(record.parentClassId)
    queries.push(
      selectClassOptions(db, parentClassId ? [parentClassId] : []).then((options) => {
        meta.classes = options
      })
    )
  }

  queries.push(
    authoredReaderReferenceMeta(db, item, keys).then((references) => {
      Object.assign(meta, references)
    })
  )
  await Promise.all(queries)
  return meta
}

async function authoredReaderReferenceMeta(
  db: DBLike,
  item: AuthoredRecord,
  keys: Set<string>
): Promise<DetailMeta> {
  const record = item as AuthoredRecord & Record<string, unknown>
  const meta: DetailMeta = {}
  const queries: Array<Promise<void>> = []
  const referenceQueries = [
    ['currencies', 'currencies', 'currencyId', 'currencyIds'],
    ['languages', 'languages', 'languageId', 'languageIds'],
    ['skills', 'skills', 'skillId', 'skillIds']
  ] as const

  for (const [metaKey, table, singularKey, pluralKey] of referenceQueries) {
    if (!hasMetaKey(keys, metaKey)) continue
    queries.push(
      selectVocabularyOptions(
        db,
        table,
        item.systemId,
        collectReferenceIds(record, singularKey, pluralKey)
      ).then((options) => {
        meta[metaKey] = options
      })
    )
  }

  if (hasMetaKey(keys, 'equipment')) {
    queries.push(
      selectEquipmentOptions(db, collectReferenceIds(record, 'equipmentId', 'equipmentIds')).then(
        (options) => {
          meta.equipment = options
        }
      )
    )
  }

  await Promise.all(queries)
  return meta
}

async function raceDetailMeta(db: DBLike, item: AuthoredRecord, keys: Set<string>) {
  const record = item as AuthoredRecord & Record<string, unknown>
  const meta: DetailMeta = {}
  const queries: Array<Promise<void>> = []

  if (hasMetaKey(keys, 'races')) {
    const parentRaceId = readString(record.parentRaceId)
    queries.push(
      selectRaceOptions(db, parentRaceId ? [parentRaceId] : []).then((options) => {
        meta.races = options
      })
    )
  }

  if (hasMetaKey(keys, 'heritages')) {
    queries.push(
      selectVocabularyOptions(
        db,
        'heritages',
        item.systemId,
        readStringArray(record.heritageIds)
      ).then((options) => {
        meta.heritages = options
      })
    )
  }

  if (hasMetaKey(keys, 'speeds')) {
    const speedIds = uniqueStrings(
      readRecordArray(record.speeds).map((speed) => readString(speed.speedId))
    )
    queries.push(
      selectVocabularyOptions(db, 'speeds', item.systemId, speedIds).then((options) => {
        meta.speeds = options
      })
    )
  }

  await Promise.all(queries)
  return meta
}

async function creatureDetailMeta(db: DBLike, item: AuthoredRecord, keys: Set<string>) {
  const record = item as AuthoredRecord & Record<string, unknown>
  const meta: DetailMeta = {}
  const queries: Array<Promise<void>> = []

  if (hasMetaKey(keys, 'challengeRatings')) {
    const challengeRatingId = readString(record.challengeRatingId)
    queries.push(
      selectVocabularyOptions(
        db,
        'challenge_ratings',
        item.systemId,
        challengeRatingId ? [challengeRatingId] : []
      ).then((options) => {
        meta.challengeRatings = options
      })
    )
  }

  if (hasMetaKey(keys, 'creatureTypes')) {
    const creatureTypeId = readString(record.creatureTypeId)
    queries.push(
      selectVocabularyOptions(
        db,
        'creature_types',
        item.systemId,
        creatureTypeId ? [creatureTypeId] : []
      ).then((options) => {
        meta.creatureTypes = options
      })
    )
  }

  if (hasMetaKey(keys, 'speeds')) {
    const speedIds = uniqueStrings(
      readRecordArray(record.speeds).map((speed) => readString(speed.speedId))
    )
    queries.push(
      selectVocabularyOptions(db, 'speeds', item.systemId, speedIds).then((options) => {
        meta.speeds = options
      })
    )
  }

  if (hasMetaKey(keys, 'damageTypes')) {
    const damageTypeIds = uniqueStrings([
      ...readStringArray(record.damageVulnerabilities),
      ...readStringArray(record.damageResistances),
      ...readStringArray(record.damageImmunities)
    ])
    queries.push(
      selectVocabularyOptions(db, 'damage_types', item.systemId, damageTypeIds).then((options) => {
        meta.damageTypes = options
      })
    )
  }

  if (hasMetaKey(keys, 'conditionTypes')) {
    queries.push(
      selectVocabularyOptions(
        db,
        'condition_types',
        item.systemId,
        readStringArray(record.conditionImmunities)
      ).then((options) => {
        meta.conditionTypes = options
      })
    )
  }

  await Promise.all(queries)
  return meta
}

async function equipmentDetailMeta(db: DBLike, item: AuthoredRecord, keys: Set<string>) {
  const record = item as AuthoredRecord & Record<string, unknown>
  const meta: DetailMeta = {}
  const queries: Array<Promise<void>> = []

  if (hasMetaKey(keys, 'equipment')) {
    const containedEquipmentIds = readRecordArray(record.contains).map((entry) =>
      readString(entry.equipmentId)
    )
    const equipmentIds = uniqueStrings([
      readString(record.parentEquipmentId),
      ...containedEquipmentIds
    ])
    queries.push(
      selectEquipmentOptions(db, equipmentIds).then((options) => {
        meta.equipment = options
      })
    )
  }

  if (hasMetaKey(keys, 'rarities')) {
    const rarityId = readString(record.rarityId)
    queries.push(
      selectVocabularyOptions(db, 'rarities', item.systemId, rarityId ? [rarityId] : []).then(
        (options) => {
          meta.rarities = options
        }
      )
    )
  }

  await Promise.all(queries)
  return meta
}

type AuthoredDomainConfigKey =
  | 'backgrounds'
  | 'classes'
  | 'creatures'
  | 'equipment'
  | 'feats'
  | 'races'
  | 'spells'
  | 'vehicles'

export const authoredDomainConfigs: Record<AuthoredDomainConfigKey, DirectAuthoredDomainConfig> = {
  backgrounds: {
    createService: createBackgroundSubjectAuthoringService,
    mapId: 'background',
    meta: backgroundDetailMeta,
    schema: backgroundAuthoredDtoSchema,
    subjectKind: 'BACKGROUND',
    table: 'backgrounds'
  } satisfies DirectAuthoredDomainConfig,
  classes: {
    createService: createClassSubjectAuthoringService,
    mapId: 'class',
    meta: classDetailMeta,
    schema: classAuthoredDtoSchema,
    subjectKind: 'CLASS',
    table: 'classes'
  } satisfies DirectAuthoredDomainConfig,
  creatures: {
    createService: createCreatureSubjectAuthoringService,
    mapId: 'creature',
    meta: creatureDetailMeta,
    schema: creatureAuthoredDtoSchema,
    subjectKind: 'CREATURE',
    table: 'creatures'
  } satisfies DirectAuthoredDomainConfig,
  equipment: {
    createService: createEquipmentSubjectAuthoringService,
    mapId: 'equipment',
    meta: equipmentDetailMeta,
    schema: equipmentAuthoredDtoSchema,
    subjectKind: 'EQUIPMENT',
    table: 'equipment'
  } satisfies DirectAuthoredDomainConfig,
  feats: {
    createService: createFeatSubjectAuthoringService,
    mapId: 'feat',
    schema: featAuthoredDtoSchema,
    subjectKind: 'FEAT',
    table: 'feats'
  } satisfies DirectAuthoredDomainConfig,
  races: {
    createService: createRaceSubjectAuthoringService,
    mapId: 'race',
    meta: raceDetailMeta,
    schema: raceAuthoredDtoSchema,
    subjectKind: 'RACE',
    table: 'races'
  } satisfies DirectAuthoredDomainConfig,
  spells: {
    createService: createSpellSubjectAuthoringService,
    mapId: 'spell',
    meta: spellDetailMeta,
    schema: spellAuthoredDtoSchema,
    subjectKind: 'SPELL',
    table: 'spells'
  } satisfies DirectAuthoredDomainConfig,
  vehicles: {
    createService: createVehicleSubjectAuthoringService,
    mapId: 'vehicle',
    meta: vehicleDetailMeta,
    schema: vehicleAuthoredDtoSchema,
    subjectKind: 'VEHICLE',
    table: 'vehicles'
  } satisfies DirectAuthoredDomainConfig
} as const
