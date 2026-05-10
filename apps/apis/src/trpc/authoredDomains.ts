import type { z } from 'zod'
import type { DBLike } from '@artificer-toolkit/db'
import {
  createBackgroundRepository,
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
import type { AuthoredDraftSaveRequestDto, AuthoredSubjectKindDto } from '@artificer-toolkit/schema/api/content'
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

type AuthoringService = {
  execute(input: AuthoredRecord): Promise<AuthoringResult>
}

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
  id: string,
  userId: string
) {
  return normalizeAuthoredDetailResponse(db, config.table, await config.findById(db, id), userId)
}

export async function getAuthoredDomainDraft(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  id: string,
  userId: string
) {
  return getAuthoredDraft(db, config.subjectKind, id, userId)
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
    schema: classAuthoredDtoSchema,
    subjectKind: 'CLASS',
    table: 'classes'
  } satisfies DirectAuthoredDomainConfig,
  creatures: {
    createService: createCreatureSubjectAuthoringService,
    findById: (db, id) => createCreatureRepository(db).findById(id),
    listQuery: getCreatureListQuery,
    mapId: 'creature',
    schema: creatureAuthoredDtoSchema,
    subjectKind: 'CREATURE',
    table: 'creatures'
  } satisfies DirectAuthoredDomainConfig,
  equipment: {
    createService: createEquipmentSubjectAuthoringService,
    findById: (db, id) => createEquipmentRepository(db).findById(id),
    listQuery: getEquipmentListQuery,
    mapId: 'equipment',
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
    schema: raceAuthoredDtoSchema,
    subjectKind: 'RACE',
    table: 'races'
  } satisfies DirectAuthoredDomainConfig,
  spells: {
    createService: createSpellSubjectAuthoringService,
    findById: (db, id) => createSpellRepository(db).findById(id),
    listQuery: getSpellListQuery,
    mapId: 'spell',
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
