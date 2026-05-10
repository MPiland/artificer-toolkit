import { z } from 'zod'
import {
  createTRPCUntypedClient,
  httpBatchLink,
  isTRPCClientError
} from '@trpc/client'
import type { AnyRouter } from '@trpc/server'
import { createIsomorphicFn } from '@tanstack/react-start'
import {
  backgroundListResponseDtoSchema,
  backgroundResponseDtoSchema,
  authoredDraftDtoSchema,
  classListResponseDtoSchema,
  classResponseDtoSchema,
  creatureListResponseDtoSchema,
  creatureResponseDtoSchema,
  equipmentListResponseDtoSchema,
  equipmentResponseDtoSchema,
  featListResponseDtoSchema,
  featResponseDtoSchema,
  featureListResponseDtoSchema,
  featureResponseDtoSchema,
  raceListResponseDtoSchema,
  raceResponseDtoSchema,
  spellListResponseDtoSchema,
  spellResponseDtoSchema,
  vehicleListResponseDtoSchema,
  vehicleResponseDtoSchema,
  type AuthoredDraftDto,
  type AuthoredDraftSaveRequestDto,
  type AuthoredSubjectKindDto,
  type BackgroundListItemDto,
  type BackgroundListResponseDto,
  type BackgroundResponseDto,
  type ClassListItemDto,
  type ClassListResponseDto,
  type ClassResponseDto,
  type CreatureListItemDto,
  type CreatureListResponseDto,
  type CreatureResponseDto,
  type EquipmentListItemDto,
  type EquipmentListResponseDto,
  type EquipmentResponseDto,
  type FeatListItemDto,
  type FeatListResponseDto,
  type FeatResponseDto,
  type FeatureListItemDto,
  type FeatureListResponseDto,
  type FeatureResponseDto,
  type RaceListItemDto,
  type RaceListResponseDto,
  type RaceResponseDto,
  type SpellListItemDto,
  type SpellListResponseDto,
  type SpellResponseDto,
  type VehicleListItemDto,
  type VehicleListResponseDto,
  type VehicleResponseDto
} from '@artificer-toolkit/schema/api/content'
import {
  characterBuilderDraftDtoSchema,
  characterBuilderPreviewPayloadDtoSchema,
  characterBuilderPayloadDtoSchema,
  characterHistoryResponseDtoSchema,
  characterListResponseDtoSchema,
  characterSheetCommandResponseDtoSchema,
  characterSheetResponseDtoSchema,
  type CharacterBuilderPayloadDto,
  type CharacterBuilderFormDto,
  type CharacterBuilderDraftDto,
  type CharacterBuilderDraftSaveRequestDto,
  type CharacterBuilderCommitRequestDto,
  type CharacterBuilderPreviewPayloadDto,
  type CharacterBuilderResolveRequestDto,
  type CharacterBuilderSaveRequestDto,
  type CharacterDraftRequestDto,
  type CharacterHistoryResponseDto,
  type CharacterListItemDto,
  type CharacterListResponseDto,
  type CharacterSheetCommandInputDto,
  type CharacterSheetCommandResponseDto,
  type CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
import {
  nodeRuntimeNormalizeValuesResponseDtoSchema,
  nodeRuntimeResolveResponseDtoSchema,
  type NodeRuntimeNormalizeValuesRequestDto,
  type NodeRuntimeNormalizeValuesResponseDto,
  type NodeRuntimeResolveRequestDto,
  type NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  systemListResponseDtoSchema,
  systemResponseDtoSchema,
  type SystemListItemDto,
  type SystemListResponseDto,
  type SystemResponseDto
} from '@artificer-toolkit/schema/api/systems'
import { applySameOriginRequestHeader } from './trpcRequestSecurity'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import type { BackgroundAuthoringInputDto } from '@artificer-toolkit/schema/subjects/background'
import type { ClassAuthoringInputDto } from '@artificer-toolkit/schema/subjects/class'
import type { CreatureAuthoringInputDto } from '@artificer-toolkit/schema/subjects/creature'
import type { EquipmentAuthoringInputDto } from '@artificer-toolkit/schema/subjects/equipment'
import type { FeatAuthoringInputDto } from '@artificer-toolkit/schema/subjects/feat'
import type { RaceAuthoringInputDto } from '@artificer-toolkit/schema/subjects/race'
import type { SpellAuthoringInputDto } from '@artificer-toolkit/schema/subjects/spell'
import type { VehicleAuthoringInputDto } from '@artificer-toolkit/schema/subjects/vehicle'

export type {
  AuthoredDraftDto,
  AuthoredDraftSaveRequestDto,
  AuthoredSubjectKindDto,
  BackgroundListItemDto,
  BackgroundListResponseDto,
  BackgroundResponseDto,
  CharacterBuilderPayloadDto,
  CharacterBuilderFormDto,
  CharacterBuilderDraftDto,
  CharacterBuilderDraftSaveRequestDto,
  CharacterBuilderCommitRequestDto,
  CharacterBuilderPreviewPayloadDto,
  CharacterBuilderResolveRequestDto,
  CharacterBuilderSaveRequestDto,
  CharacterDraftRequestDto,
  CharacterHistoryResponseDto,
  CharacterListItemDto,
  CharacterListResponseDto,
  CharacterSheetCommandInputDto,
  CharacterSheetCommandResponseDto,
  CharacterSheetResponseDto,
  ClassListItemDto,
  ClassListResponseDto,
  ClassResponseDto,
  BackgroundAuthoringInputDto,
  ClassAuthoringInputDto,
  CreatureAuthoringInputDto,
  CreatureListItemDto,
  CreatureListResponseDto,
  CreatureResponseDto,
  EquipmentListItemDto,
  EquipmentListResponseDto,
  EquipmentResponseDto,
  FeatListItemDto,
  FeatListResponseDto,
  FeatAuthoringInputDto,
  FeatResponseDto,
  FeatureListItemDto,
  FeatureListResponseDto,
  FeatureResponseDto,
  RaceAuthoringInputDto,
  NodeRuntimeNormalizeValuesRequestDto,
  NodeRuntimeNormalizeValuesResponseDto,
  NodeRuntimeResolveRequestDto,
  NodeRuntimeResolveResponseDto,
  RaceListItemDto,
  RaceListResponseDto,
  RaceResponseDto,
  SpellListItemDto,
  SpellListResponseDto,
  SpellAuthoringInputDto,
  SpellResponseDto,
  SystemListItemDto,
  VehicleAuthoringInputDto,
  VehicleListItemDto,
  VehicleListResponseDto,
  VehicleResponseDto
}

type FetchInput = Parameters<typeof fetch>[0]
type FetchInit = Parameters<typeof fetch>[1]

interface IdProcedureInput {
  id: string
}

interface QueryProcedure<TInput, TOutput> {
  query: (input: TInput) => Promise<TOutput>
}

interface EmptyQueryProcedure<TOutput> {
  query: () => Promise<TOutput>
}

interface MutationProcedure<TInput, TOutput> {
  mutate: (input: TInput) => Promise<TOutput>
}

interface FeatureUpsertInput {
  feature: FeatureDto
  systemId: string
}

const okResponseSchema = z.object({
  ok: z.literal(true)
})

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class ApiParseError extends Error {
  constructor(
    public readonly path: string,
    public readonly issues: z.ZodIssue[]
  ) {
    super(`API response for ${path} did not match the expected schema.`)
    this.name = 'ApiParseError'
  }
}

function parseResponse<TSchema extends z.ZodTypeAny>(
  path: string,
  schema: TSchema,
  value: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new ApiParseError(path, result.error.issues)
  }

  return result.data
}

interface AuthoredContentInput {
  id: string
  label: string
  status?: unknown
  userId?: string
  systemId: string
}

interface AuthoredDomainTransport<TList, TResponse, TInput extends AuthoredContentInput> {
  activate: (input: TInput) => Promise<TResponse>
  activateDraft: (id: string) => Promise<TResponse>
  discardDraft: (id: string) => Promise<unknown>
  duplicate: (id: string) => Promise<AuthoredDraftDto | null>
  get: (id: string) => Promise<TResponse>
  getDraft: (id: string) => Promise<AuthoredDraftDto | null>
  list: () => Promise<TList>
  saveDraft: (input: TInput) => Promise<AuthoredDraftDto>
  upsert: (input: TInput) => Promise<TResponse>
}

interface AuthoredDomainProcedures<TList, TResponse, TInput extends AuthoredContentInput> {
  activate: MutationProcedure<TInput, TResponse>
  activateDraft: MutationProcedure<IdProcedureInput, TResponse>
  discardDraft: MutationProcedure<IdProcedureInput, { ok: true }>
  duplicate: MutationProcedure<IdProcedureInput, AuthoredDraftDto | null>
  get: QueryProcedure<IdProcedureInput, TResponse>
  getDraft: QueryProcedure<IdProcedureInput, AuthoredDraftDto | null>
  list: EmptyQueryProcedure<TList>
  saveDraft: MutationProcedure<TInput, AuthoredDraftDto>
  upsert: MutationProcedure<TInput, TResponse>
}

interface TrpcClient {
  characters: {
    command: MutationProcedure<{ id: string, input: CharacterSheetCommandInputDto }, CharacterSheetCommandResponseDto>
    discardDraft: MutationProcedure<IdProcedureInput, { ok: true }>
    draft: MutationProcedure<CharacterDraftRequestDto, CharacterBuilderPayloadDto>
    get: QueryProcedure<IdProcedureInput, CharacterBuilderPayloadDto | null>
    getDraft: QueryProcedure<IdProcedureInput, CharacterBuilderDraftDto | null>
    history: QueryProcedure<IdProcedureInput, CharacterHistoryResponseDto>
    list: EmptyQueryProcedure<CharacterListResponseDto>
    previewSave: MutationProcedure<CharacterBuilderSaveRequestDto, CharacterBuilderPreviewPayloadDto>
    resolve: MutationProcedure<CharacterBuilderResolveRequestDto, CharacterBuilderPayloadDto>
    saveDraft: MutationProcedure<{ id: string, input: CharacterBuilderDraftSaveRequestDto }, CharacterBuilderDraftDto>
    sheet: QueryProcedure<IdProcedureInput, CharacterSheetResponseDto | null>
    upsert: MutationProcedure<CharacterBuilderCommitRequestDto, CharacterBuilderPayloadDto>
  }
  content: {
    backgrounds: AuthoredDomainProcedures<BackgroundListResponseDto, BackgroundResponseDto, BackgroundAuthoringInputDto>
    classes: AuthoredDomainProcedures<ClassListResponseDto, ClassResponseDto, ClassAuthoringInputDto>
    creatures: AuthoredDomainProcedures<CreatureListResponseDto, CreatureResponseDto, CreatureAuthoringInputDto>
    equipment: AuthoredDomainProcedures<EquipmentListResponseDto, EquipmentResponseDto, EquipmentAuthoringInputDto>
    feats: AuthoredDomainProcedures<FeatListResponseDto, FeatResponseDto, FeatAuthoringInputDto>
    features: {
      get: QueryProcedure<IdProcedureInput, FeatureResponseDto>
      list: EmptyQueryProcedure<FeatureListResponseDto>
      upsert: MutationProcedure<FeatureUpsertInput, FeatureResponseDto>
    }
    races: AuthoredDomainProcedures<RaceListResponseDto, RaceResponseDto, RaceAuthoringInputDto>
    spells: AuthoredDomainProcedures<SpellListResponseDto, SpellResponseDto, SpellAuthoringInputDto>
    vehicles: AuthoredDomainProcedures<VehicleListResponseDto, VehicleResponseDto, VehicleAuthoringInputDto>
  }
  nodeRuntime: {
    normalizeValues: MutationProcedure<NodeRuntimeNormalizeValuesRequestDto, NodeRuntimeNormalizeValuesResponseDto>
    resolve: QueryProcedure<NodeRuntimeResolveRequestDto, NodeRuntimeResolveResponseDto>
  }
  systems: {
    get: QueryProcedure<IdProcedureInput, SystemResponseDto>
    list: EmptyQueryProcedure<SystemListResponseDto>
  }
}

function createTrpcClient(): TrpcClient {
  const rawClient = createTRPCUntypedClient<AnyRouter>({
    links: [
      httpBatchLink<AnyRouter>({
        fetch: trpcFetch,
        url: '/api/trpc'
      })
    ]
  })

  return createProcedureProxy(rawClient) as TrpcClient
}

function createProcedureProxy(rawClient: ReturnType<typeof createTRPCUntypedClient<AnyRouter>>, path: string[] = []): unknown {
  return new Proxy<Record<PropertyKey, unknown>>({}, {
    get(_target, property) {
      if (property === 'query') {
        return (input?: unknown) => rawClient.query(path.join('.'), input)
      }
      if (property === 'mutate') {
        return (input?: unknown) => rawClient.mutation(path.join('.'), input)
      }

      return createProcedureProxy(rawClient, [...path, String(property)])
    }
  })
}

const getServerRequestInfo = createIsomorphicFn()
  .server(async () => {
    const { getRequest } = await import('@tanstack/react-start/server')
    const request = getRequest()

    return {
      cookie: request.headers.get('cookie'),
      url: request.url
    }
  })
  .client(async () => null)

async function trpcFetch(input: FetchInput, init?: FetchInit): Promise<Response> {
  const headers = applySameOriginRequestHeader(new Headers(init?.headers))
  const serverRequestInfo = await getServerRequestInfo()

  if (serverRequestInfo) {
    if (serverRequestInfo.cookie && !headers.has('cookie')) {
      headers.set('cookie', serverRequestInfo.cookie)
    }

    const resolvedInput = input instanceof Request
      ? input
      : new URL(input.toString(), serverRequestInfo.url).toString()
    return fetch(resolvedInput, {
      ...init,
      headers
    })
  }

  return fetch(input, {
    ...init,
    credentials: 'same-origin',
    headers
  })
}

function mapTrpcError(error: unknown): never {
  if (isTRPCClientError<AnyRouter>(error)) {
    const status = typeof error.data?.httpStatus === 'number'
      ? error.data.httpStatus
      : 500
    throw new ApiError(status, error.message)
  }

  throw error
}

async function request<TSchema extends z.ZodTypeAny>(
  path: string,
  schema: TSchema,
  procedure: () => Promise<unknown>
): Promise<z.infer<TSchema>> {
  try {
    return parseResponse(path, schema, await procedure())
  } catch (error) {
    mapTrpcError(error)
  }
}

function buildApi(client: TrpcClient) {
  function contentDomain<TList, TResponse, TInput extends AuthoredContentInput>(
    path: string,
    listSchema: z.ZodType<TList>,
    responseSchema: z.ZodType<TResponse>,
    transport: AuthoredDomainTransport<TList, TResponse, TInput>
  ) {
    const draftSchema = authoredDraftDtoSchema
    const nullableDraftSchema = authoredDraftDtoSchema.nullable()

    return {
      activate: (input: TInput) => request(`${path}.activate`, responseSchema, () => transport.activate(input)),
      activateDraft: (id: string) => request(`${path}.activateDraft`, responseSchema, () => transport.activateDraft(id)),
      discardDraft: async (id: string) => {
        await request(`${path}.discardDraft`, okResponseSchema, () => transport.discardDraft(id))
      },
      duplicate: (id: string) => request(`${path}.duplicate`, nullableDraftSchema, () => transport.duplicate(id)),
      get: (id: string) => request(`${path}.get`, responseSchema, () => transport.get(id)),
      getDraft: (id: string) => request(`${path}.getDraft`, nullableDraftSchema, () => transport.getDraft(id)),
      list: () => request(`${path}.list`, listSchema, () => transport.list()),
      saveDraft: (input: TInput) => request(`${path}.saveDraft`, draftSchema, () => transport.saveDraft(input)),
      upsert: (input: TInput) => request(`${path}.upsert`, responseSchema, () => transport.upsert(input))
    }
  }

  return {
    characters: {
      command: (id: string, input: CharacterSheetCommandInputDto) => request('characters.command', characterSheetCommandResponseDtoSchema, () => client.characters.command.mutate({ id, input })),
      discardDraft: async (id: string) => {
        await request('characters.discardDraft', okResponseSchema, () => client.characters.discardDraft.mutate({ id }))
      },
      draft: (input: CharacterDraftRequestDto) => request('characters.draft', characterBuilderPayloadDtoSchema, () => client.characters.draft.mutate(input)),
      get: (id: string) => request('characters.get', characterBuilderPayloadDtoSchema.nullable(), () => client.characters.get.query({ id })),
      getDraft: (id: string) => request('characters.getDraft', characterBuilderDraftDtoSchema.nullable(), () => client.characters.getDraft.query({ id })),
      history: (id: string) => request('characters.history', characterHistoryResponseDtoSchema, () => client.characters.history.query({ id })),
      list: () => request('characters.list', characterListResponseDtoSchema, () => client.characters.list.query()),
      previewSave: (input: CharacterBuilderSaveRequestDto) => request('characters.previewSave', characterBuilderPreviewPayloadDtoSchema, () => client.characters.previewSave.mutate(input)),
      resolve: (input: CharacterBuilderResolveRequestDto) => request('characters.resolve', characterBuilderPayloadDtoSchema, () => client.characters.resolve.mutate(input)),
      saveDraft: (id: string, input: CharacterBuilderDraftSaveRequestDto) => request('characters.saveDraft', characterBuilderDraftDtoSchema, () => client.characters.saveDraft.mutate({ id, input })),
      sheet: (id: string) => request('characters.sheet', characterSheetResponseDtoSchema.nullable(), () => client.characters.sheet.query({ id })),
      upsert: (input: CharacterBuilderCommitRequestDto) => request('characters.upsert', characterBuilderPayloadDtoSchema, () => client.characters.upsert.mutate(input))
    },

    content: {
      backgrounds: contentDomain<BackgroundListResponseDto, BackgroundResponseDto, BackgroundAuthoringInputDto>('content.backgrounds', backgroundListResponseDtoSchema, backgroundResponseDtoSchema, {
        activate: (input) => client.content.backgrounds.activate.mutate(input),
        activateDraft: (id) => client.content.backgrounds.activateDraft.mutate({ id }),
        discardDraft: (id) => client.content.backgrounds.discardDraft.mutate({ id }),
        duplicate: (id) => client.content.backgrounds.duplicate.mutate({ id }),
        get: (id) => client.content.backgrounds.get.query({ id }),
        getDraft: (id) => client.content.backgrounds.getDraft.query({ id }),
        list: () => client.content.backgrounds.list.query(),
        saveDraft: (input) => client.content.backgrounds.saveDraft.mutate(input),
        upsert: (input) => client.content.backgrounds.upsert.mutate(input)
      }),
      classes: contentDomain<ClassListResponseDto, ClassResponseDto, ClassAuthoringInputDto>('content.classes', classListResponseDtoSchema, classResponseDtoSchema, {
        activate: (input) => client.content.classes.activate.mutate(input),
        activateDraft: (id) => client.content.classes.activateDraft.mutate({ id }),
        discardDraft: (id) => client.content.classes.discardDraft.mutate({ id }),
        duplicate: (id) => client.content.classes.duplicate.mutate({ id }),
        get: (id) => client.content.classes.get.query({ id }),
        getDraft: (id) => client.content.classes.getDraft.query({ id }),
        list: () => client.content.classes.list.query(),
        saveDraft: (input) => client.content.classes.saveDraft.mutate(input),
        upsert: (input) => client.content.classes.upsert.mutate(input)
      }),
      equipment: contentDomain<EquipmentListResponseDto, EquipmentResponseDto, EquipmentAuthoringInputDto>('content.equipment', equipmentListResponseDtoSchema, equipmentResponseDtoSchema, {
        activate: (input) => client.content.equipment.activate.mutate(input),
        activateDraft: (id) => client.content.equipment.activateDraft.mutate({ id }),
        discardDraft: (id) => client.content.equipment.discardDraft.mutate({ id }),
        duplicate: (id) => client.content.equipment.duplicate.mutate({ id }),
        get: (id) => client.content.equipment.get.query({ id }),
        getDraft: (id) => client.content.equipment.getDraft.query({ id }),
        list: () => client.content.equipment.list.query(),
        saveDraft: (input) => client.content.equipment.saveDraft.mutate(input),
        upsert: (input) => client.content.equipment.upsert.mutate(input)
      }),
      feats: contentDomain<FeatListResponseDto, FeatResponseDto, FeatAuthoringInputDto>('content.feats', featListResponseDtoSchema, featResponseDtoSchema, {
        activate: (input) => client.content.feats.activate.mutate(input),
        activateDraft: (id) => client.content.feats.activateDraft.mutate({ id }),
        discardDraft: (id) => client.content.feats.discardDraft.mutate({ id }),
        duplicate: (id) => client.content.feats.duplicate.mutate({ id }),
        get: (id) => client.content.feats.get.query({ id }),
        getDraft: (id) => client.content.feats.getDraft.query({ id }),
        list: () => client.content.feats.list.query(),
        saveDraft: (input) => client.content.feats.saveDraft.mutate(input),
        upsert: (input) => client.content.feats.upsert.mutate(input)
      }),
      races: contentDomain<RaceListResponseDto, RaceResponseDto, RaceAuthoringInputDto>('content.races', raceListResponseDtoSchema, raceResponseDtoSchema, {
        activate: (input) => client.content.races.activate.mutate(input),
        activateDraft: (id) => client.content.races.activateDraft.mutate({ id }),
        discardDraft: (id) => client.content.races.discardDraft.mutate({ id }),
        duplicate: (id) => client.content.races.duplicate.mutate({ id }),
        get: (id) => client.content.races.get.query({ id }),
        getDraft: (id) => client.content.races.getDraft.query({ id }),
        list: () => client.content.races.list.query(),
        saveDraft: (input) => client.content.races.saveDraft.mutate(input),
        upsert: (input) => client.content.races.upsert.mutate(input)
      }),
      spells: contentDomain<SpellListResponseDto, SpellResponseDto, SpellAuthoringInputDto>('content.spells', spellListResponseDtoSchema, spellResponseDtoSchema, {
        activate: (input) => client.content.spells.activate.mutate(input),
        activateDraft: (id) => client.content.spells.activateDraft.mutate({ id }),
        discardDraft: (id) => client.content.spells.discardDraft.mutate({ id }),
        duplicate: (id) => client.content.spells.duplicate.mutate({ id }),
        get: (id) => client.content.spells.get.query({ id }),
        getDraft: (id) => client.content.spells.getDraft.query({ id }),
        list: () => client.content.spells.list.query(),
        saveDraft: (input) => client.content.spells.saveDraft.mutate(input),
        upsert: (input) => client.content.spells.upsert.mutate(input)
      }),
      creatures: contentDomain<CreatureListResponseDto, CreatureResponseDto, CreatureAuthoringInputDto>('content.creatures', creatureListResponseDtoSchema, creatureResponseDtoSchema, {
        activate: (input) => client.content.creatures.activate.mutate(input),
        activateDraft: (id) => client.content.creatures.activateDraft.mutate({ id }),
        discardDraft: (id) => client.content.creatures.discardDraft.mutate({ id }),
        duplicate: (id) => client.content.creatures.duplicate.mutate({ id }),
        get: (id) => client.content.creatures.get.query({ id }),
        getDraft: (id) => client.content.creatures.getDraft.query({ id }),
        list: () => client.content.creatures.list.query(),
        saveDraft: (input) => client.content.creatures.saveDraft.mutate(input),
        upsert: (input) => client.content.creatures.upsert.mutate(input)
      }),
      vehicles: contentDomain<VehicleListResponseDto, VehicleResponseDto, VehicleAuthoringInputDto>('content.vehicles', vehicleListResponseDtoSchema, vehicleResponseDtoSchema, {
        activate: (input) => client.content.vehicles.activate.mutate(input),
        activateDraft: (id) => client.content.vehicles.activateDraft.mutate({ id }),
        discardDraft: (id) => client.content.vehicles.discardDraft.mutate({ id }),
        duplicate: (id) => client.content.vehicles.duplicate.mutate({ id }),
        get: (id) => client.content.vehicles.get.query({ id }),
        getDraft: (id) => client.content.vehicles.getDraft.query({ id }),
        list: () => client.content.vehicles.list.query(),
        saveDraft: (input) => client.content.vehicles.saveDraft.mutate(input),
        upsert: (input) => client.content.vehicles.upsert.mutate(input)
      }),
      features: {
        get: (id: string) => request('content.features.get', featureResponseDtoSchema, () => client.content.features.get.query({ id })),
        list: () => request('content.features.list', featureListResponseDtoSchema, () => client.content.features.list.query()),
        upsert: (input: FeatureUpsertInput) => request('content.features.upsert', featureResponseDtoSchema, () => client.content.features.upsert.mutate(input))
      }
    },

    systems: {
      get: (id: string) => request('systems.get', systemResponseDtoSchema, () => client.systems.get.query({ id })),
      list: () => request('systems.list', systemListResponseDtoSchema, () => client.systems.list.query())
    },

    nodeRuntime: {
      normalizeValues: (input: NodeRuntimeNormalizeValuesRequestDto) => request('nodeRuntime.normalizeValues', nodeRuntimeNormalizeValuesResponseDtoSchema, () => client.nodeRuntime.normalizeValues.mutate(input)),
      resolve: (input: NodeRuntimeResolveRequestDto) => request('nodeRuntime.resolve', nodeRuntimeResolveResponseDtoSchema, () => client.nodeRuntime.resolve.query(input))
    }
  }
}

const trpcClient = createTrpcClient()

export const api = buildApi(trpcClient)

export function createServerApi() {
  return api
}

export type Api = ReturnType<typeof buildApi>
