import { z } from 'zod'
import { getSupabaseBrowserClient } from '#supabase/client'
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
  characterListResponseDtoSchema,
  characterSheetResponseDtoSchema,
  type CharacterBuilderPayloadDto,
  type CharacterBuilderFormDto,
  type CharacterBuilderDraftDto,
  type CharacterBuilderDraftSaveRequestDto,
  type CharacterBuilderPreviewPayloadDto,
  type CharacterBuilderResolveRequestDto,
  type CharacterBuilderSaveRequestDto,
  type CharacterDraftRequestDto,
  type CharacterListItemDto,
  type CharacterListResponseDto,
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
  type SystemListItemDto
} from '@artificer-toolkit/schema/api/systems'
import type { CharacterCommandUnion } from '@artificer-toolkit/schema/domains/character/commands'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import type { BackgroundAuthoredDto } from '@artificer-toolkit/schema/subjects/background'
import type { ClassAuthoringInputDto } from '@artificer-toolkit/schema/subjects/class'
import type { CreatureAuthoredDto } from '@artificer-toolkit/schema/subjects/creature'
import type { EquipmentAuthoringInputDto } from '@artificer-toolkit/schema/subjects/equipment'
import type { FeatAuthoredDto } from '@artificer-toolkit/schema/subjects/feat'
import type { RaceAuthoredDto } from '@artificer-toolkit/schema/subjects/race'
import type { SpellAuthoredDto } from '@artificer-toolkit/schema/subjects/spell'
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
  CharacterBuilderPreviewPayloadDto,
  CharacterBuilderResolveRequestDto,
  CharacterBuilderSaveRequestDto,
  CharacterDraftRequestDto,
  CharacterListItemDto,
  CharacterListResponseDto,
  CharacterSheetResponseDto,
  ClassListItemDto,
  ClassListResponseDto,
  ClassResponseDto,
  ClassAuthoringInputDto,
  CreatureAuthoredDto,
  CreatureListItemDto,
  CreatureListResponseDto,
  CreatureResponseDto,
  EquipmentListItemDto,
  EquipmentListResponseDto,
  EquipmentResponseDto,
  FeatListItemDto,
  FeatListResponseDto,
  FeatResponseDto,
  FeatureListItemDto,
  FeatureListResponseDto,
  FeatureResponseDto,
  RaceAuthoredDto,
  NodeRuntimeNormalizeValuesRequestDto,
  NodeRuntimeNormalizeValuesResponseDto,
  NodeRuntimeResolveRequestDto,
  NodeRuntimeResolveResponseDto,
  RaceListItemDto,
  RaceListResponseDto,
  RaceResponseDto,
  SpellListItemDto,
  SpellListResponseDto,
  SpellResponseDto,
  SystemListItemDto,
  VehicleAuthoringInputDto,
  VehicleListItemDto,
  VehicleListResponseDto,
  VehicleResponseDto
}

export interface CharacterHistoryEntry {
  id: string
  characterId: string
  eventType: string
  summary: string
  occurredAt: string
}

export interface CharacterHistoryResponse {
  events: CharacterHistoryEntry[]
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const characterHistoryResponseSchema = z.object({
  events: z.array(z.object({
    id: z.string(),
    characterId: z.string(),
    eventType: z.string(),
    summary: z.string(),
    occurredAt: z.string()
  }))
})

async function getClientJwt(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function makeHeaders(jwt: string | null): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (jwt) headers.Authorization = `Bearer ${jwt}`
  return headers
}

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

async function apiFetch(
  path: string,
  options: RequestInit,
  jwt: string | null
): Promise<unknown> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...makeHeaders(jwt),
      ...(options.headers ?? {})
    }
  })

  if (!response.ok) {
    let message = `API error ${response.status}`
    try {
      const body = await response.json()
      message = body?.error ?? body?.message ?? message
    } catch {
      // Non-JSON error bodies keep the status-derived message.
    }
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) {
    return undefined
  }

  return response.json()
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

function cloneAuthoredItem<TInput extends { id: string, label: string, status?: unknown }>(
  input: TInput
): TInput {
  return {
    ...input,
    id: crypto.randomUUID(),
    label: `${input.label} Copy`,
    ...('status' in input ? { status: 'DRAFT' } : {})
  }
}

interface AuthoredContentInput {
  id: string
  label: string
  status?: unknown
  userId?: string
  systemId: string
}

function buildApi(getJwt: (() => Promise<string | null>) | string | null) {
  async function resolveJwt() {
    return typeof getJwt === 'function' ? await getJwt() : getJwt
  }

  async function request<TSchema extends z.ZodTypeAny>(
    path: string,
    schema: TSchema,
    options: RequestInit = { method: 'GET' }
  ): Promise<z.infer<TSchema>> {
    const jwt = await resolveJwt()
    const value = await apiFetch(path, options, jwt)
    return parseResponse(path, schema, value)
  }

  async function get<TSchema extends z.ZodTypeAny>(path: string, schema: TSchema): Promise<z.infer<TSchema>> {
    return request(path, schema, { method: 'GET' })
  }

  async function post<TSchema extends z.ZodTypeAny>(
    path: string,
    schema: TSchema,
    body?: unknown
  ): Promise<z.infer<TSchema>> {
    return request(path, schema, {
      method: 'POST',
      body: body == null ? undefined : JSON.stringify(body)
    })
  }

  async function del(path: string): Promise<void> {
    const jwt = await resolveJwt()
    await apiFetch(path, { method: 'DELETE' }, jwt)
  }

  function buildDraftRequest<TInput extends AuthoredContentInput>(
    subjectKind: AuthoredSubjectKindDto,
    input: TInput
  ): AuthoredDraftSaveRequestDto {
    return {
      subjectKind,
      subjectId: input.id,
      systemId: input.systemId,
      label: input.label,
      payload: input as unknown as Record<string, unknown>
    }
  }

  function contentDomain<TList, TResponse, TInput extends AuthoredContentInput>(
    subjectKind: AuthoredSubjectKindDto,
    basePath: string,
    listSchema: z.ZodType<TList>,
    responseSchema: z.ZodType<TResponse>
  ) {
    return {
      list: () => get(basePath, listSchema),
      get: (id: string) => get(`${basePath}/${id}`, responseSchema),
      getDraft: (id: string) => get(`${basePath}/${id}/draft`, authoredDraftDtoSchema.nullable()),
      saveDraft: (input: TInput) => post(`${basePath}/draft`, authoredDraftDtoSchema, buildDraftRequest(subjectKind, input)),
      discardDraft: (id: string) => del(`${basePath}/${id}/draft`),
      activateDraft: (id: string) => post(`${basePath}/${id}/draft/activate`, responseSchema, {
        subjectKind,
        subjectId: id
      }),
      activate: (input: TInput) => post(basePath, responseSchema, input),
      upsert: (input: TInput) => post(basePath, responseSchema, input),
      duplicate: async (id: string) => {
        const detail = await get(`${basePath}/${id}`, responseSchema)
        if (!detail) return null

        const cloned = cloneAuthoredItem((detail as unknown as { item: TInput }).item)
        return post(`${basePath}/draft`, authoredDraftDtoSchema, buildDraftRequest(subjectKind, cloned))
      }
    }
  }

  return {
    characters: {
      list: () => get('/characters', characterListResponseDtoSchema),
      draft: (input: CharacterDraftRequestDto) => post('/characters/draft', characterBuilderPayloadDtoSchema, input),
      get: (id: string) => get(`/characters/${id}`, characterBuilderPayloadDtoSchema.nullable()),
      getDraft: (id: string) => get(`/characters/${id}/builder-draft`, characterBuilderDraftDtoSchema.nullable()),
      saveDraft: (id: string, input: CharacterBuilderDraftSaveRequestDto) => post(`/characters/${id}/builder-draft`, characterBuilderDraftDtoSchema, input),
      discardDraft: (id: string) => del(`/characters/${id}/builder-draft`),
      sheet: (id: string) => get(`/characters/${id}/sheet`, characterSheetResponseDtoSchema.nullable()),
      resolve: (input: CharacterBuilderResolveRequestDto) => post('/characters/resolve', characterBuilderPayloadDtoSchema, input),
      previewSave: (input: CharacterBuilderSaveRequestDto) => post('/characters/preview-save', characterBuilderPreviewPayloadDtoSchema, input),
      upsert: (input: CharacterBuilderSaveRequestDto) => post('/characters/upsert', characterBuilderPayloadDtoSchema, input),
      history: (id: string) => get(`/characters/${id}/history`, characterHistoryResponseSchema),
      command: (id: string, input: CharacterCommandUnion) => post(`/characters/${id}/commands`, z.void(), input)
    },

    content: {
      backgrounds: contentDomain<BackgroundListResponseDto, BackgroundResponseDto, BackgroundAuthoredDto>('BACKGROUND', '/content/backgrounds', backgroundListResponseDtoSchema, backgroundResponseDtoSchema),
      classes: contentDomain<ClassListResponseDto, ClassResponseDto, ClassAuthoringInputDto>('CLASS', '/content/classes', classListResponseDtoSchema, classResponseDtoSchema),
      equipment: contentDomain<EquipmentListResponseDto, EquipmentResponseDto, EquipmentAuthoringInputDto>('EQUIPMENT', '/content/equipment', equipmentListResponseDtoSchema, equipmentResponseDtoSchema),
      feats: contentDomain<FeatListResponseDto, FeatResponseDto, FeatAuthoredDto>('FEAT', '/content/feats', featListResponseDtoSchema, featResponseDtoSchema),
      races: contentDomain<RaceListResponseDto, RaceResponseDto, RaceAuthoredDto>('RACE', '/content/races', raceListResponseDtoSchema, raceResponseDtoSchema),
      spells: contentDomain<SpellListResponseDto, SpellResponseDto, SpellAuthoredDto>('SPELL', '/content/spells', spellListResponseDtoSchema, spellResponseDtoSchema),
      creatures: contentDomain<CreatureListResponseDto, CreatureResponseDto, CreatureAuthoredDto>('CREATURE', '/content/creatures', creatureListResponseDtoSchema, creatureResponseDtoSchema),
      vehicles: contentDomain<VehicleListResponseDto, VehicleResponseDto, VehicleAuthoringInputDto>('VEHICLE', '/content/vehicles', vehicleListResponseDtoSchema, vehicleResponseDtoSchema),
      features: {
        list: () => get('/content/features', featureListResponseDtoSchema),
        get: (id: string) => get(`/content/features/${id}`, featureResponseDtoSchema),
        upsert: (input: FeatureDto) => post('/content/features', featureResponseDtoSchema, input)
      }
    },

    systems: {
      list: () => get('/systems', systemListResponseDtoSchema),
      get: (id: string) => get(`/systems/${id}`, systemResponseDtoSchema)
    },

    nodeRuntime: {
      resolve: (input: NodeRuntimeResolveRequestDto) => post('/node-runtime/resolve', nodeRuntimeResolveResponseDtoSchema, input),
      normalizeValues: (input: NodeRuntimeNormalizeValuesRequestDto) => post('/node-runtime/normalize-values', nodeRuntimeNormalizeValuesResponseDtoSchema, input)
    },

    _raw: { get, post, del }
  }
}

export const api = buildApi(getClientJwt)

export function createServerApi(jwt: string | null) {
  return buildApi(() => Promise.resolve(jwt))
}

export type Api = ReturnType<typeof buildApi>
