import { z } from 'zod'
import { createTRPCUntypedClient, httpBatchLink, isTRPCClientError } from '@trpc/client'
import { createIsomorphicFn } from '@tanstack/react-start'
import type { AnyRouter } from '@trpc/server'
import {
  backgroundListResponseDtoSchema,
  backgroundResponseDtoSchema,
  authoredDraftDtoSchema,
  authoredValidationIssueDtoSchema,
  classListResponseDtoSchema,
  classResponseDtoSchema,
  creatureListResponseDtoSchema,
  creatureResponseDtoSchema,
  equipmentListResponseDtoSchema,
  equipmentResponseDtoSchema,
  featListResponseDtoSchema,
  featResponseDtoSchema,
  raceListResponseDtoSchema,
  raceResponseDtoSchema,
  spellListResponseDtoSchema,
  spellResponseDtoSchema,
  vehicleListResponseDtoSchema,
  vehicleResponseDtoSchema,
  type AuthoredDetailRequestDto,
  type AuthoredDraftDto,
  type AuthoredDraftSaveRequestDto,
  type AuthoredSubjectKindDto,
  type AuthoredValidationIssueDto,
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
  characterRestPreviewResponseDtoSchema,
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
  type CharacterRestPreviewRequestDto,
  type CharacterRestPreviewResponseDto,
  type CharacterSheetCommandInputDto,
  type CharacterSheetCommandResponseDto,
  type CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
import {
  characterSheetPanelDtoSchema,
  type CharacterSheetPanelDto,
  type CharacterSheetPanelNumericCalculationDto,
  type CharacterSheetPanelTargetDto
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import {
  nodeRuntimeNormalizeValuesResponseDtoSchema,
  nodeRuntimeResolveResponseDtoSchema,
  type NodeRuntimeNormalizeValuesRequestDto,
  type NodeRuntimeNormalizeValuesResponseDto,
  type NodeRuntimeResolveRequestDto,
  type NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  routeIdentityDtoSchema,
  type RouteIdentityBySubjectRequestDto,
  type RouteIdentityDto,
  type RouteIdentityResolveRequestDto
} from '@artificer-toolkit/schema/api/routeIds'
import {
  accountProfileDtoSchema,
  accountUsernameStatusDtoSchema,
  type AccountProfileDto,
  type AccountProfileUpdateInput,
  type AccountUsernameStatusDto,
  type AccountUsernameStatusInput
} from '@artificer-toolkit/schema/api/account'
import {
  systemListResponseDtoSchema,
  systemResponseDtoSchema,
  type SystemListItemDto,
  type SystemListResponseDto,
  type SystemResponseDto
} from '@artificer-toolkit/schema/api/systems'
import {
  executeDiceConfigurationInputDtoSchema,
  rollHistoryResponseDtoSchema,
  rollRecordDtoSchema,
  rollResultDtoSchema,
  type ExecuteDiceConfigurationInputDto,
  type ExecuteRollInputDto,
  type RollHistoryResponseDto,
  type RollRecordDto,
  type RollResultDto
} from '@artificer-toolkit/schema/api/rolls'
import { applySameOriginRequestHeader } from './trpcRequestSecurity'
import type { BackgroundAuthoringInputDto } from '@artificer-toolkit/schema/subjects/background'
import type { ClassAuthoringInputDto } from '@artificer-toolkit/schema/subjects/class'
import type { CreatureAuthoringInputDto } from '@artificer-toolkit/schema/subjects/creature'
import type { EquipmentAuthoringInputDto } from '@artificer-toolkit/schema/subjects/equipment'
import type { FeatAuthoringInputDto } from '@artificer-toolkit/schema/subjects/feat'
import type { RaceAuthoringInputDto } from '@artificer-toolkit/schema/subjects/race'
import type { SpellAuthoringInputDto } from '@artificer-toolkit/schema/subjects/spell'
import type { VehicleAuthoringInputDto } from '@artificer-toolkit/schema/subjects/vehicle'

export type {
  AuthoredDetailRequestDto,
  AuthoredDraftDto,
  AuthoredDraftSaveRequestDto,
  AuthoredSubjectKindDto,
  AccountProfileDto,
  AccountProfileUpdateInput,
  AccountUsernameStatusDto,
  AccountUsernameStatusInput,
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
  CharacterRestPreviewRequestDto,
  CharacterRestPreviewResponseDto,
  CharacterSheetCommandInputDto,
  CharacterSheetCommandResponseDto,
  CharacterSheetPanelDto,
  CharacterSheetPanelNumericCalculationDto,
  CharacterSheetPanelTargetDto,
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
  RaceAuthoringInputDto,
  NodeRuntimeNormalizeValuesRequestDto,
  NodeRuntimeNormalizeValuesResponseDto,
  NodeRuntimeResolveRequestDto,
  NodeRuntimeResolveResponseDto,
  RouteIdentityBySubjectRequestDto,
  RouteIdentityDto,
  RouteIdentityResolveRequestDto,
  ExecuteRollInputDto,
  ExecuteDiceConfigurationInputDto,
  RollHistoryResponseDto,
  RollResultDto,
  RollRecordDto,
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

interface EmptyMutationProcedure<TOutput> {
  mutate: () => Promise<TOutput>
}

interface ProcedureRequestOptions {
  signal?: AbortSignal
}

interface MutationProcedure<TInput, TOutput> {
  mutate: (input: TInput, options?: ProcedureRequestOptions) => Promise<TOutput>
}

const okResponseSchema = z.object({
  ok: z.literal(true)
})

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly validationIssues: readonly AuthoredValidationIssueDto[] = []
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

type AuthoredDetailInput = string | AuthoredDetailRequestDto

function normalizeAuthoredDetailInput(input: AuthoredDetailInput): AuthoredDetailRequestDto {
  return typeof input === 'string' ? { id: input } : input
}

interface AuthoredDomainTransport<TList, TResponse, TInput extends AuthoredContentInput> {
  activate: (input: TInput) => Promise<TResponse>
  activateDraft: (id: string) => Promise<TResponse>
  deleteActive: (id: string) => Promise<unknown>
  discardDraft: (id: string) => Promise<unknown>
  duplicate: (id: string) => Promise<AuthoredDraftDto | null>
  get: (input: AuthoredDetailRequestDto) => Promise<TResponse>
  getDraft: (id: string) => Promise<AuthoredDraftDto | null>
  list: () => Promise<TList>
  saveDraft: (input: TInput) => Promise<AuthoredDraftDto>
}

interface AuthoredDomainProcedures<TList, TResponse, TInput extends AuthoredContentInput> {
  activate: MutationProcedure<TInput, TResponse>
  activateDraft: MutationProcedure<IdProcedureInput, TResponse>
  deleteActive: MutationProcedure<IdProcedureInput, { ok: true }>
  discardDraft: MutationProcedure<IdProcedureInput, { ok: true }>
  duplicate: MutationProcedure<IdProcedureInput, AuthoredDraftDto | null>
  get: QueryProcedure<AuthoredDetailRequestDto, TResponse>
  getDraft: QueryProcedure<IdProcedureInput, AuthoredDraftDto | null>
  list: EmptyQueryProcedure<TList>
  saveDraft: MutationProcedure<TInput, AuthoredDraftDto>
}

interface TrpcClient {
  account: {
    profile: EmptyQueryProcedure<AccountProfileDto | null>
    updateProfile: MutationProcedure<AccountProfileUpdateInput, AccountProfileDto>
    usernameStatus: QueryProcedure<AccountUsernameStatusInput, AccountUsernameStatusDto>
  }
  characters: {
    command: MutationProcedure<
      { id: string; input: CharacterSheetCommandInputDto },
      CharacterSheetCommandResponseDto
    >
    discardDraft: MutationProcedure<IdProcedureInput, { ok: true }>
    draft: MutationProcedure<CharacterDraftRequestDto, CharacterBuilderPayloadDto>
    get: QueryProcedure<IdProcedureInput, CharacterBuilderPayloadDto | null>
    getDraft: QueryProcedure<IdProcedureInput, CharacterBuilderDraftDto | null>
    history: QueryProcedure<IdProcedureInput, CharacterHistoryResponseDto>
    list: EmptyQueryProcedure<CharacterListResponseDto>
    panel: QueryProcedure<
      { id: string; target: CharacterSheetPanelTargetDto },
      CharacterSheetPanelDto
    >
    previewSave: MutationProcedure<
      CharacterBuilderSaveRequestDto,
      CharacterBuilderPreviewPayloadDto
    >
    resolve: MutationProcedure<CharacterBuilderResolveRequestDto, CharacterBuilderPayloadDto>
    restPreview: MutationProcedure<
      { id: string; input: CharacterRestPreviewRequestDto },
      CharacterRestPreviewResponseDto
    >
    saveDraft: MutationProcedure<
      { id: string; input: CharacterBuilderDraftSaveRequestDto },
      CharacterBuilderDraftDto
    >
    sheet: QueryProcedure<IdProcedureInput, CharacterSheetResponseDto | null>
    upsert: MutationProcedure<CharacterBuilderCommitRequestDto, CharacterBuilderPayloadDto>
  }
  content: {
    backgrounds: AuthoredDomainProcedures<
      BackgroundListResponseDto,
      BackgroundResponseDto,
      BackgroundAuthoringInputDto
    >
    classes: AuthoredDomainProcedures<
      ClassListResponseDto,
      ClassResponseDto,
      ClassAuthoringInputDto
    >
    creatures: AuthoredDomainProcedures<
      CreatureListResponseDto,
      CreatureResponseDto,
      CreatureAuthoringInputDto
    >
    equipment: AuthoredDomainProcedures<
      EquipmentListResponseDto,
      EquipmentResponseDto,
      EquipmentAuthoringInputDto
    >
    feats: AuthoredDomainProcedures<FeatListResponseDto, FeatResponseDto, FeatAuthoringInputDto>
    races: AuthoredDomainProcedures<RaceListResponseDto, RaceResponseDto, RaceAuthoringInputDto>
    spells: AuthoredDomainProcedures<SpellListResponseDto, SpellResponseDto, SpellAuthoringInputDto>
    vehicles: AuthoredDomainProcedures<
      VehicleListResponseDto,
      VehicleResponseDto,
      VehicleAuthoringInputDto
    >
  }
  nodeRuntime: {
    normalizeValues: MutationProcedure<
      NodeRuntimeNormalizeValuesRequestDto,
      NodeRuntimeNormalizeValuesResponseDto
    >
    resolve: MutationProcedure<NodeRuntimeResolveRequestDto, NodeRuntimeResolveResponseDto>
  }
  rolls: {
    clearHistory: EmptyMutationProcedure<{ ok: true }>
    discard: MutationProcedure<IdProcedureInput, { ok: true }>
    executeConfiguration: MutationProcedure<ExecuteDiceConfigurationInputDto, RollResultDto>
    execute: MutationProcedure<ExecuteRollInputDto, RollRecordDto>
    history: EmptyQueryProcedure<RollHistoryResponseDto>
  }
  routeIds: {
    bySubject: QueryProcedure<RouteIdentityBySubjectRequestDto, RouteIdentityDto | null>
    resolve: QueryProcedure<RouteIdentityResolveRequestDto, RouteIdentityDto | null>
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

function createProcedureProxy(
  rawClient: ReturnType<typeof createTRPCUntypedClient<AnyRouter>>,
  path: string[] = []
): unknown {
  return new Proxy<Record<PropertyKey, unknown>>(
    {},
    {
      get(_target, property) {
        if (property === 'query') {
          return (input?: unknown) => rawClient.query(path.join('.'), input)
        }
        if (property === 'mutate') {
          return (input?: unknown, options?: ProcedureRequestOptions) =>
            rawClient.mutation(path.join('.'), input, options)
        }

        return createProcedureProxy(rawClient, [...path, String(property)])
      }
    }
  )
}

const getServerRequestInfo = createIsomorphicFn()
  .client(() => null)
  .server(async () => {
    const { getRequest } = await import('@tanstack/react-start/server')
    const request = getRequest()

    return {
      cookie: request.headers.get('cookie'),
      url: request.url
    }
  })

async function trpcFetch(input: FetchInput, init?: FetchInit): Promise<Response> {
  const headers = applySameOriginRequestHeader(new Headers(init?.headers))
  const serverRequestInfo = await getServerRequestInfo()

  if (serverRequestInfo) {
    if (serverRequestInfo.cookie && !headers.has('cookie')) {
      headers.set('cookie', serverRequestInfo.cookie)
    }

    const resolvedInput =
      input instanceof Request ? input : new URL(input.toString(), serverRequestInfo.url).toString()
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
    const status = typeof error.data?.httpStatus === 'number' ? error.data.httpStatus : 500
    const rawValidationIssues =
      error.data && typeof error.data === 'object' && 'validationIssues' in error.data
        ? error.data.validationIssues
        : undefined
    const validationIssues = authoredValidationIssueDtoSchema.array().safeParse(rawValidationIssues)
    throw new ApiError(status, error.message, validationIssues.success ? validationIssues.data : [])
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
      activate: (input: TInput) =>
        request(`${path}.activate`, responseSchema, () => transport.activate(input)),
      activateDraft: (id: string) =>
        request(`${path}.activateDraft`, responseSchema, () => transport.activateDraft(id)),
      deleteActive: async (id: string) => {
        await request(`${path}.deleteActive`, okResponseSchema, () => transport.deleteActive(id))
      },
      discardDraft: async (id: string) => {
        await request(`${path}.discardDraft`, okResponseSchema, () => transport.discardDraft(id))
      },
      duplicate: (id: string) =>
        request(`${path}.duplicate`, nullableDraftSchema, () => transport.duplicate(id)),
      get: (input: AuthoredDetailInput) =>
        request(`${path}.get`, responseSchema, () =>
          transport.get(normalizeAuthoredDetailInput(input))
        ),
      getDraft: (id: string) =>
        request(`${path}.getDraft`, nullableDraftSchema, () => transport.getDraft(id)),
      list: () => request(`${path}.list`, listSchema, () => transport.list()),
      saveDraft: (input: TInput) =>
        request(`${path}.saveDraft`, draftSchema, () => transport.saveDraft(input))
    }
  }

  return {
    account: {
      profile: () =>
        request('account.profile', accountProfileDtoSchema.nullable(), () =>
          client.account.profile.query()
        ),
      updateProfile: (input: AccountProfileUpdateInput) =>
        request('account.updateProfile', accountProfileDtoSchema, () =>
          client.account.updateProfile.mutate(input)
        ),
      usernameStatus: (input: AccountUsernameStatusInput) =>
        request('account.usernameStatus', accountUsernameStatusDtoSchema, () =>
          client.account.usernameStatus.query(input)
        )
    },

    characters: {
      command: (id: string, input: CharacterSheetCommandInputDto) =>
        request('characters.command', characterSheetCommandResponseDtoSchema, () =>
          client.characters.command.mutate({ id, input })
        ),
      discardDraft: async (id: string) => {
        await request('characters.discardDraft', okResponseSchema, () =>
          client.characters.discardDraft.mutate({ id })
        )
      },
      draft: (input: CharacterDraftRequestDto) =>
        request('characters.draft', characterBuilderPayloadDtoSchema, () =>
          client.characters.draft.mutate(input)
        ),
      get: (id: string) =>
        request('characters.get', characterBuilderPayloadDtoSchema.nullable(), () =>
          client.characters.get.query({ id })
        ),
      getDraft: (id: string) =>
        request('characters.getDraft', characterBuilderDraftDtoSchema.nullable(), () =>
          client.characters.getDraft.query({ id })
        ),
      history: (id: string) =>
        request('characters.history', characterHistoryResponseDtoSchema, () =>
          client.characters.history.query({ id })
        ),
      list: () =>
        request('characters.list', characterListResponseDtoSchema, () =>
          client.characters.list.query()
        ),
      panel: (id: string, target: CharacterSheetPanelTargetDto) =>
        request('characters.panel', characterSheetPanelDtoSchema, () =>
          client.characters.panel.query({ id, target })
        ),
      previewSave: (input: CharacterBuilderSaveRequestDto) =>
        request('characters.previewSave', characterBuilderPreviewPayloadDtoSchema, () =>
          client.characters.previewSave.mutate(input)
        ),
      resolve: (input: CharacterBuilderResolveRequestDto, options?: ProcedureRequestOptions) =>
        request('characters.resolve', characterBuilderPayloadDtoSchema, () =>
          client.characters.resolve.mutate(input, options)
        ),
      restPreview: (id: string, input: CharacterRestPreviewRequestDto) =>
        request('characters.restPreview', characterRestPreviewResponseDtoSchema, () =>
          client.characters.restPreview.mutate({ id, input })
        ),
      saveDraft: (id: string, input: CharacterBuilderDraftSaveRequestDto) =>
        request('characters.saveDraft', characterBuilderDraftDtoSchema, () =>
          client.characters.saveDraft.mutate({ id, input })
        ),
      sheet: (id: string) =>
        request('characters.sheet', characterSheetResponseDtoSchema.nullable(), () =>
          client.characters.sheet.query({ id })
        ),
      upsert: (input: CharacterBuilderCommitRequestDto) =>
        request('characters.upsert', characterBuilderPayloadDtoSchema, () =>
          client.characters.upsert.mutate(input)
        )
    },

    rolls: {
      clearHistory: () =>
        request('rolls.clearHistory', okResponseSchema, () => client.rolls.clearHistory.mutate()),
      discard: (id: string) =>
        request('rolls.discard', okResponseSchema, () => client.rolls.discard.mutate({ id })),
      executeConfiguration: (input: ExecuteDiceConfigurationInputDto) =>
        request('rolls.executeConfiguration', rollResultDtoSchema, () =>
          client.rolls.executeConfiguration.mutate(
            executeDiceConfigurationInputDtoSchema.parse(input)
          )
        ),
      execute: (input: ExecuteRollInputDto) =>
        request('rolls.execute', rollRecordDtoSchema, () => client.rolls.execute.mutate(input)),
      history: () =>
        request('rolls.history', rollHistoryResponseDtoSchema, () => client.rolls.history.query())
    },

    content: {
      backgrounds: contentDomain<
        BackgroundListResponseDto,
        BackgroundResponseDto,
        BackgroundAuthoringInputDto
      >('content.backgrounds', backgroundListResponseDtoSchema, backgroundResponseDtoSchema, {
        activate: (input) => client.content.backgrounds.activate.mutate(input),
        activateDraft: (id) => client.content.backgrounds.activateDraft.mutate({ id }),
        deleteActive: (id) => client.content.backgrounds.deleteActive.mutate({ id }),
        discardDraft: (id) => client.content.backgrounds.discardDraft.mutate({ id }),
        duplicate: (id) => client.content.backgrounds.duplicate.mutate({ id }),
        get: (input) => client.content.backgrounds.get.query(input),
        getDraft: (id) => client.content.backgrounds.getDraft.query({ id }),
        list: () => client.content.backgrounds.list.query(),
        saveDraft: (input) => client.content.backgrounds.saveDraft.mutate(input)
      }),
      classes: contentDomain<ClassListResponseDto, ClassResponseDto, ClassAuthoringInputDto>(
        'content.classes',
        classListResponseDtoSchema,
        classResponseDtoSchema,
        {
          activate: (input) => client.content.classes.activate.mutate(input),
          activateDraft: (id) => client.content.classes.activateDraft.mutate({ id }),
          deleteActive: (id) => client.content.classes.deleteActive.mutate({ id }),
          discardDraft: (id) => client.content.classes.discardDraft.mutate({ id }),
          duplicate: (id) => client.content.classes.duplicate.mutate({ id }),
          get: (input) => client.content.classes.get.query(input),
          getDraft: (id) => client.content.classes.getDraft.query({ id }),
          list: () => client.content.classes.list.query(),
          saveDraft: (input) => client.content.classes.saveDraft.mutate(input)
        }
      ),
      equipment: contentDomain<
        EquipmentListResponseDto,
        EquipmentResponseDto,
        EquipmentAuthoringInputDto
      >('content.equipment', equipmentListResponseDtoSchema, equipmentResponseDtoSchema, {
        activate: (input) => client.content.equipment.activate.mutate(input),
        activateDraft: (id) => client.content.equipment.activateDraft.mutate({ id }),
        deleteActive: (id) => client.content.equipment.deleteActive.mutate({ id }),
        discardDraft: (id) => client.content.equipment.discardDraft.mutate({ id }),
        duplicate: (id) => client.content.equipment.duplicate.mutate({ id }),
        get: (input) => client.content.equipment.get.query(input),
        getDraft: (id) => client.content.equipment.getDraft.query({ id }),
        list: () => client.content.equipment.list.query(),
        saveDraft: (input) => client.content.equipment.saveDraft.mutate(input)
      }),
      feats: contentDomain<FeatListResponseDto, FeatResponseDto, FeatAuthoringInputDto>(
        'content.feats',
        featListResponseDtoSchema,
        featResponseDtoSchema,
        {
          activate: (input) => client.content.feats.activate.mutate(input),
          activateDraft: (id) => client.content.feats.activateDraft.mutate({ id }),
          deleteActive: (id) => client.content.feats.deleteActive.mutate({ id }),
          discardDraft: (id) => client.content.feats.discardDraft.mutate({ id }),
          duplicate: (id) => client.content.feats.duplicate.mutate({ id }),
          get: (input) => client.content.feats.get.query(input),
          getDraft: (id) => client.content.feats.getDraft.query({ id }),
          list: () => client.content.feats.list.query(),
          saveDraft: (input) => client.content.feats.saveDraft.mutate(input)
        }
      ),
      races: contentDomain<RaceListResponseDto, RaceResponseDto, RaceAuthoringInputDto>(
        'content.races',
        raceListResponseDtoSchema,
        raceResponseDtoSchema,
        {
          activate: (input) => client.content.races.activate.mutate(input),
          activateDraft: (id) => client.content.races.activateDraft.mutate({ id }),
          deleteActive: (id) => client.content.races.deleteActive.mutate({ id }),
          discardDraft: (id) => client.content.races.discardDraft.mutate({ id }),
          duplicate: (id) => client.content.races.duplicate.mutate({ id }),
          get: (input) => client.content.races.get.query(input),
          getDraft: (id) => client.content.races.getDraft.query({ id }),
          list: () => client.content.races.list.query(),
          saveDraft: (input) => client.content.races.saveDraft.mutate(input)
        }
      ),
      spells: contentDomain<SpellListResponseDto, SpellResponseDto, SpellAuthoringInputDto>(
        'content.spells',
        spellListResponseDtoSchema,
        spellResponseDtoSchema,
        {
          activate: (input) => client.content.spells.activate.mutate(input),
          activateDraft: (id) => client.content.spells.activateDraft.mutate({ id }),
          deleteActive: (id) => client.content.spells.deleteActive.mutate({ id }),
          discardDraft: (id) => client.content.spells.discardDraft.mutate({ id }),
          duplicate: (id) => client.content.spells.duplicate.mutate({ id }),
          get: (input) => client.content.spells.get.query(input),
          getDraft: (id) => client.content.spells.getDraft.query({ id }),
          list: () => client.content.spells.list.query(),
          saveDraft: (input) => client.content.spells.saveDraft.mutate(input)
        }
      ),
      creatures: contentDomain<
        CreatureListResponseDto,
        CreatureResponseDto,
        CreatureAuthoringInputDto
      >('content.creatures', creatureListResponseDtoSchema, creatureResponseDtoSchema, {
        activate: (input) => client.content.creatures.activate.mutate(input),
        activateDraft: (id) => client.content.creatures.activateDraft.mutate({ id }),
        deleteActive: (id) => client.content.creatures.deleteActive.mutate({ id }),
        discardDraft: (id) => client.content.creatures.discardDraft.mutate({ id }),
        duplicate: (id) => client.content.creatures.duplicate.mutate({ id }),
        get: (input) => client.content.creatures.get.query(input),
        getDraft: (id) => client.content.creatures.getDraft.query({ id }),
        list: () => client.content.creatures.list.query(),
        saveDraft: (input) => client.content.creatures.saveDraft.mutate(input)
      }),
      vehicles: contentDomain<VehicleListResponseDto, VehicleResponseDto, VehicleAuthoringInputDto>(
        'content.vehicles',
        vehicleListResponseDtoSchema,
        vehicleResponseDtoSchema,
        {
          activate: (input) => client.content.vehicles.activate.mutate(input),
          activateDraft: (id) => client.content.vehicles.activateDraft.mutate({ id }),
          deleteActive: (id) => client.content.vehicles.deleteActive.mutate({ id }),
          discardDraft: (id) => client.content.vehicles.discardDraft.mutate({ id }),
          duplicate: (id) => client.content.vehicles.duplicate.mutate({ id }),
          get: (input) => client.content.vehicles.get.query(input),
          getDraft: (id) => client.content.vehicles.getDraft.query({ id }),
          list: () => client.content.vehicles.list.query(),
          saveDraft: (input) => client.content.vehicles.saveDraft.mutate(input)
        }
      )
    },

    systems: {
      get: (id: string) =>
        request('systems.get', systemResponseDtoSchema, () => client.systems.get.query({ id })),
      list: () =>
        request('systems.list', systemListResponseDtoSchema, () => client.systems.list.query())
    },

    nodeRuntime: {
      normalizeValues: (input: NodeRuntimeNormalizeValuesRequestDto) =>
        request('nodeRuntime.normalizeValues', nodeRuntimeNormalizeValuesResponseDtoSchema, () =>
          client.nodeRuntime.normalizeValues.mutate(input)
        ),
      resolve: (input: NodeRuntimeResolveRequestDto) =>
        request('nodeRuntime.resolve', nodeRuntimeResolveResponseDtoSchema, () =>
          client.nodeRuntime.resolve.mutate(input)
        )
    },

    routeIds: {
      bySubject: (input: RouteIdentityBySubjectRequestDto) =>
        request('routeIds.bySubject', routeIdentityDtoSchema.nullable(), () =>
          client.routeIds.bySubject.query(input)
        ),
      resolve: (input: RouteIdentityResolveRequestDto) =>
        request('routeIds.resolve', routeIdentityDtoSchema.nullable(), () =>
          client.routeIds.resolve.query(input)
        )
    }
  }
}

const trpcClient = createTrpcClient()

export const api = buildApi(trpcClient)

export function createServerApi(_userId?: string | null) {
  return api
}

export type Api = ReturnType<typeof buildApi>
