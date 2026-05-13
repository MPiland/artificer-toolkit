import type { z } from 'zod'
import type { DBLike } from '@artificer-toolkit/db'
import {
  createBackgroundRepository,
  createAuthoredRouteIdRepository,
  createClassRepository,
  createCreatureRepository,
  createEquipmentRepository,
  createFeatRepository,
  createRaceRepository,
  createSpellRepository,
  createVehicleRepository,
  getBackgroundListQuery,
  getClassListQuery,
  getCreatureListQuery,
  getEquipmentListQuery,
  getFeatListQuery,
  getRaceListQuery,
  getSpellListQuery,
  getVehicleListQuery
} from '@artificer-toolkit/db'
import {
  createBackgroundSubjectAuthoringService,
  createClassSubjectAuthoringService,
  createCreatureSubjectAuthoringService,
  createEquipmentSubjectAuthoringService,
  createFeatSubjectAuthoringService,
  createRaceSubjectAuthoringService,
  createSpellSubjectAuthoringService,
  createVehicleSubjectAuthoringService,
  normalizeNodeRuntimeValues
} from '@artificer-toolkit/functions'
import type {
  AuthoredDetailRequestDto,
  AuthoredDraftSaveRequestDto,
  AuthoredSubjectKindDto
} from '@artificer-toolkit/schema/api/content'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import { classAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { featAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/feat'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import {
  assertWritableAuthoredSubject,
  discardAuthoredDraft,
  getAuthoredDraft,
  normalizeActivatedAuthoringInput,
  normalizeAuthoredDetailResponse,
  normalizeAuthoredDraftPayload,
  normalizeAuthoredListResponseWithDrafts,
  normalizeAuthoringResult,
  normalizeStoredDraftPayloadForActivation,
  requireAuthoredDraft,
  saveAuthoredDraft,
  type AuthoredListRow,
  type AuthoredRecord
} from '../routes/authoredContent.js'

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
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type AuthoringService = {
  execute(input: AuthoredRecord): Promise<AuthoringResult>
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
  findById: (db: DBLike, id: string) => Promise<AuthoredRecord | null>
  listQuery: (db: DBLike) => Promise<{
    items: Array<AuthoredListRow & {
      id: string
      label: string
      status: string
      systemId: string
      description?: string | null
    }>
    meta: unknown
  }>
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

export function cloneAuthoredItem<TInput extends AuthoredContentInput>(input: TInput): TInput {
  return {
    ...input,
    id: crypto.randomUUID(),
    label: `${input.label} Copy`,
    ...('status' in input ? { status: 'DRAFT' } : {})
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
  userId: string
) {
  return normalizeAuthoredListResponseWithDrafts(db, await config.listQuery(db), userId, config.subjectKind)
}

export async function getAuthoredDomain(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  input: AuthoredDetailRequestDto,
  userId: string
) {
  const subjectId = await resolveAuthoredRouteSubjectId(db, config.subjectKind, input.id)
  if (!subjectId) return null

  if (input.view === 'draft') {
    const draftDetail = await getAuthoredDomainDraftDetail(db, config, subjectId, userId, input.meta)
    if (draftDetail) return draftDetail
  }

  const response = await normalizeAuthoredDetailResponse(db, config.table, await config.findById(db, subjectId), userId)
  if (!response) return null

  const [draft, meta] = await Promise.all([
    input.includeDraft ? getAuthoredDraft(db, config.subjectKind, subjectId, userId) : Promise.resolve(undefined),
    resolveDetailMeta(db, config, response.item, input.meta)
  ])

  return {
    ...response,
    ...(draft !== undefined ? { draft } : {}),
    ...(meta ? { meta } : {})
  }
}

export async function getAuthoredDomainDraft(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  id: string,
  userId: string
) {
  const subjectId = await resolveAuthoredRouteSubjectId(db, config.subjectKind, id)
  return subjectId ? getAuthoredDraft(db, config.subjectKind, subjectId, userId) : null
}

async function getAuthoredDomainDraftDetail(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  subjectId: string,
  userId: string,
  metaKeys: string[] | undefined
) {
  const draft = await getAuthoredDraft(db, config.subjectKind, subjectId, userId)
  if (!draft) return null

  const parsedItem = config.schema.safeParse(normalizeAuthoredDraftPayload(draft.payload, {
    subjectId: draft.subjectId,
    label: draft.label,
    systemId: draft.systemId,
    userId: draft.userId
  }))
  if (!parsedItem.success) return null

  const item = parsedItem.data
  const meta = await resolveDetailMeta(db, config, item, metaKeys)

  return {
    draft,
    item,
    publicId: draft.publicId,
    provenance: {
      kind: 'OWNED' as const,
      ownerUserId: draft.userId
    },
    permissions: {
      canView: true,
      canEdit: true,
      canCopy: false,
      canDelete: true
    },
    ...(meta ? { meta } : {})
  }
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

    return await repository.canAccessSubjectForUser({
      subjectKind,
      subjectId
    })
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
  await assertWritableAuthoredSubject(db, config.table, config.subjectKind, body.subjectId, userId)
  return saveAuthoredDraft(db, {
    ...body,
    subjectKind: config.subjectKind
  }, userId)
}

export async function discardAuthoredDomainDraft(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  id: string,
  userId: string
) {
  await discardAuthoredDraft(db, config.subjectKind, id, userId)
  return { ok: true as const }
}

export async function activateAuthoredDomainDraft(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  subjectId: string,
  userId: string
) {
  const draft = await requireAuthoredDraft(db, config.subjectKind, subjectId, userId)
  await assertWritableAuthoredSubject(db, config.table, config.subjectKind, subjectId, userId)
  const input = config.schema.parse(normalizeStoredDraftPayloadForActivation(draft, userId))
  const normalized = await normalizeNodeRuntimeValues(db, {
    mapId: config.mapId,
    values: { ...input }
  })
  const normalizedBody = config.schema.parse(normalized.values)
  const result = await config.createService(db).execute(normalizeActivatedAuthoringInput(normalizedBody, userId))
  await discardAuthoredDraft(db, config.subjectKind, subjectId, userId)
  return normalizeAuthoringResult(db, config.table, result, userId)
}

export async function activateAuthoredDomainInput<TInput extends AuthoredContentInput>(
  db: DBLike,
  config: DirectAuthoredDomainConfig,
  body: TInput,
  userId: string
) {
  await assertWritableAuthoredSubject(db, config.table, config.subjectKind, body.id, userId)
  const input = config.schema.parse({
    ...body,
    userId
  })
  const normalized = await normalizeNodeRuntimeValues(db, {
    mapId: config.mapId,
    values: { ...input }
  })
  const normalizedBody = config.schema.parse(normalized.values)
  const result = await config.createService(db).execute(normalizeActivatedAuthoringInput(normalizedBody, userId))
  await discardAuthoredDraft(db, config.subjectKind, normalizedBody.id, userId)
  return normalizeAuthoringResult(db, config.table, result, userId)
}

function hasMetaKey(keys: Set<string>, key: string) {
  return keys.has(key)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

async function selectClassOptions(db: DBLike, ids: string[]) {
  if (!ids.length) return []
  return db.selectFrom('classes')
    .select(['id as value', 'label'])
    .where('id', 'in', ids)
    .orderBy('label')
    .execute()
}

async function selectEquipmentOptions(db: DBLike, ids: string[]) {
  if (!ids.length) return []
  return db.selectFrom('equipment')
    .select(['id as value', 'label'])
    .where('id', 'in', ids)
    .orderBy('label')
    .execute()
}

async function selectRaceOptions(db: DBLike, ids: string[]) {
  if (!ids.length) return []
  return db.selectFrom('races')
    .select(['id as value', 'label'])
    .where('id', 'in', ids)
    .orderBy('label')
    .execute()
}

async function selectVocabularyOptions(
  db: DBLike,
  table: 'challenge_ratings' | 'condition_types' | 'creature_types' | 'damage_types' | 'heritages' | 'magic_schools' | 'rarities' | 'speeds',
  systemId: string,
  ids?: string[]
) {
  let query = db.selectFrom(table)
    .select(['id as value', 'label'])
    .where('system_id', '=', systemId)

  if (ids) {
    if (!ids.length) return []
    query = query.where('id', 'in', ids)
  }

  return query.orderBy('label').execute()
}

async function spellDetailMeta(db: DBLike, item: AuthoredRecord, keys: Set<string>) {
  const record = item as AuthoredRecord & Record<string, unknown>
  const meta: DetailMeta = {}
  const queries: Array<Promise<void>> = []

  if (hasMetaKey(keys, 'classes')) {
    queries.push(selectClassOptions(db, readStringArray(record.classIds)).then((options) => {
      meta.classes = options
    }))
  }

  if (hasMetaKey(keys, 'magicSchools')) {
    queries.push(selectVocabularyOptions(db, 'magic_schools', item.systemId).then((options) => {
      meta.magicSchools = options
    }))
  }

  if (hasMetaKey(keys, 'damageTypes')) {
    queries.push(selectVocabularyOptions(db, 'damage_types', item.systemId).then((options) => {
      meta.damageTypes = options
    }))
  }

  if (hasMetaKey(keys, 'conditionTypes')) {
    queries.push(selectVocabularyOptions(db, 'condition_types', item.systemId).then((options) => {
      meta.conditionTypes = options
    }))
  }

  await Promise.all(queries)
  return meta
}

async function classDetailMeta(db: DBLike, item: AuthoredRecord, keys: Set<string>): Promise<DetailMeta> {
  const meta: DetailMeta = {}
  if (!hasMetaKey(keys, 'classes')) return meta
  const parentClassId = readString((item as AuthoredRecord & Record<string, unknown>).parentClassId)
  meta.classes = await selectClassOptions(db, parentClassId ? [parentClassId] : [])
  return meta
}

async function raceDetailMeta(db: DBLike, item: AuthoredRecord, keys: Set<string>) {
  const record = item as AuthoredRecord & Record<string, unknown>
  const meta: DetailMeta = {}
  const queries: Array<Promise<void>> = []

  if (hasMetaKey(keys, 'races')) {
    const parentRaceId = readString(record.parentRaceId)
    queries.push(selectRaceOptions(db, parentRaceId ? [parentRaceId] : []).then((options) => {
      meta.races = options
    }))
  }

  if (hasMetaKey(keys, 'heritages')) {
    queries.push(selectVocabularyOptions(db, 'heritages', item.systemId, readStringArray(record.heritageIds)).then((options) => {
      meta.heritages = options
    }))
  }

  if (hasMetaKey(keys, 'speeds')) {
    const speedIds = uniqueStrings(readRecordArray(record.speeds).map((speed) => readString(speed.speedId)))
    queries.push(selectVocabularyOptions(db, 'speeds', item.systemId, speedIds).then((options) => {
      meta.speeds = options
    }))
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
    queries.push(selectVocabularyOptions(db, 'challenge_ratings', item.systemId, challengeRatingId ? [challengeRatingId] : []).then((options) => {
      meta.challengeRatings = options
    }))
  }

  if (hasMetaKey(keys, 'creatureTypes')) {
    const creatureTypeId = readString(record.creatureTypeId)
    queries.push(selectVocabularyOptions(db, 'creature_types', item.systemId, creatureTypeId ? [creatureTypeId] : []).then((options) => {
      meta.creatureTypes = options
    }))
  }

  if (hasMetaKey(keys, 'speeds')) {
    const speedIds = uniqueStrings(readRecordArray(record.speeds).map((speed) => readString(speed.speedId)))
    queries.push(selectVocabularyOptions(db, 'speeds', item.systemId, speedIds).then((options) => {
      meta.speeds = options
    }))
  }

  if (hasMetaKey(keys, 'damageTypes')) {
    const damageTypeIds = uniqueStrings([
      ...readStringArray(record.damageVulnerabilities),
      ...readStringArray(record.damageResistances),
      ...readStringArray(record.damageImmunities)
    ])
    queries.push(selectVocabularyOptions(db, 'damage_types', item.systemId, damageTypeIds).then((options) => {
      meta.damageTypes = options
    }))
  }

  if (hasMetaKey(keys, 'conditionTypes')) {
    queries.push(selectVocabularyOptions(db, 'condition_types', item.systemId, readStringArray(record.conditionImmunities)).then((options) => {
      meta.conditionTypes = options
    }))
  }

  await Promise.all(queries)
  return meta
}

async function equipmentDetailMeta(db: DBLike, item: AuthoredRecord, keys: Set<string>) {
  const record = item as AuthoredRecord & Record<string, unknown>
  const meta: DetailMeta = {}
  const queries: Array<Promise<void>> = []

  if (hasMetaKey(keys, 'equipment')) {
    const containedEquipmentIds = readRecordArray(record.contains).map((entry) => readString(entry.equipmentId))
    const equipmentIds = uniqueStrings([readString(record.parentEquipmentId), ...containedEquipmentIds])
    queries.push(selectEquipmentOptions(db, equipmentIds).then((options) => {
      meta.equipment = options
    }))
  }

  if (hasMetaKey(keys, 'rarities')) {
    const rarityId = readString(record.rarityId)
    queries.push(selectVocabularyOptions(db, 'rarities', item.systemId, rarityId ? [rarityId] : []).then((options) => {
      meta.rarities = options
    }))
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
    findById: (db, id) => createBackgroundRepository(db).findById(id),
    listQuery: getBackgroundListQuery,
    mapId: 'background',
    schema: backgroundAuthoredDtoSchema,
    subjectKind: 'BACKGROUND',
    table: 'backgrounds'
  } satisfies DirectAuthoredDomainConfig,
  classes: {
    createService: createClassSubjectAuthoringService,
    findById: (db, id) => createClassRepository(db).findById(id),
    listQuery: getClassListQuery,
    mapId: 'class',
    meta: classDetailMeta,
    schema: classAuthoredDtoSchema,
    subjectKind: 'CLASS',
    table: 'classes'
  } satisfies DirectAuthoredDomainConfig,
  creatures: {
    createService: createCreatureSubjectAuthoringService,
    findById: (db, id) => createCreatureRepository(db).findById(id),
    listQuery: getCreatureListQuery,
    mapId: 'creature',
    meta: creatureDetailMeta,
    schema: creatureAuthoredDtoSchema,
    subjectKind: 'CREATURE',
    table: 'creatures'
  } satisfies DirectAuthoredDomainConfig,
  equipment: {
    createService: createEquipmentSubjectAuthoringService,
    findById: (db, id) => createEquipmentRepository(db).findById(id),
    listQuery: getEquipmentListQuery,
    mapId: 'equipment',
    meta: equipmentDetailMeta,
    schema: equipmentAuthoredDtoSchema,
    subjectKind: 'EQUIPMENT',
    table: 'equipment'
  } satisfies DirectAuthoredDomainConfig,
  feats: {
    createService: createFeatSubjectAuthoringService,
    findById: (db, id) => createFeatRepository(db).findById(id),
    listQuery: getFeatListQuery,
    mapId: 'feat',
    schema: featAuthoredDtoSchema,
    subjectKind: 'FEAT',
    table: 'feats'
  } satisfies DirectAuthoredDomainConfig,
  races: {
    createService: createRaceSubjectAuthoringService,
    findById: (db, id) => createRaceRepository(db).findById(id),
    listQuery: getRaceListQuery,
    mapId: 'race',
    meta: raceDetailMeta,
    schema: raceAuthoredDtoSchema,
    subjectKind: 'RACE',
    table: 'races'
  } satisfies DirectAuthoredDomainConfig,
  spells: {
    createService: createSpellSubjectAuthoringService,
    findById: (db, id) => createSpellRepository(db).findById(id),
    listQuery: getSpellListQuery,
    mapId: 'spell',
    meta: spellDetailMeta,
    schema: spellAuthoredDtoSchema,
    subjectKind: 'SPELL',
    table: 'spells'
  } satisfies DirectAuthoredDomainConfig,
  vehicles: {
    createService: createVehicleSubjectAuthoringService,
    findById: (db, id) => createVehicleRepository(db).findById(id),
    listQuery: getVehicleListQuery,
    mapId: 'vehicle',
    schema: vehicleAuthoredDtoSchema,
    subjectKind: 'VEHICLE',
    table: 'vehicles'
  } satisfies DirectAuthoredDomainConfig
} as const
