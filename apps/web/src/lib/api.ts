import { getSupabaseBrowserClient } from '#supabase'
import type {
  BackgroundAuthoredDto,
  BackgroundListItemDto,
  CharacterBuilderPayloadDto,
  CharacterBuilderPreviewPayloadDto,
  CharacterBuilderResolveRequestDto,
  CharacterBuilderSaveRequestDto,
  CharacterCommandUnion,
  CharacterDraftRequestDto,
  CharacterListItemDto,
  CharacterListResponseDto,
  CharacterSheetResponseDto,
  ClassAuthoredDto,
  ClassListItemDto,
  EquipmentAuthoredDto,
  EquipmentListItemDto,
  FeatAuthoredDto,
  FeatListItemDto,
  FeatureDto,
  FeatureListItemDto,
  RaceAuthoredDto,
  RaceListItemDto,
  SpellAuthoredDto,
  SpellListItemDto,
  SystemListItemDto
} from '@artificer-toolkit/schema'

export type {
  BackgroundListItemDto,
  CharacterBuilderPayloadDto,
  CharacterBuilderPreviewPayloadDto,
  CharacterBuilderResolveRequestDto,
  CharacterBuilderSaveRequestDto,
  CharacterDraftRequestDto,
  CharacterListItemDto,
  CharacterListResponseDto,
  CharacterSheetResponseDto,
  ClassListItemDto,
  EquipmentListItemDto,
  FeatListItemDto,
  FeatureListItemDto,
  RaceListItemDto,
  SpellListItemDto,
  SystemListItemDto
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

export interface ListResponse<T> {
  items: T[]
  meta: Record<string, unknown>
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

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

async function apiFetch<T>(
  path: string,
  options: RequestInit,
  jwt: string | null
): Promise<T> {
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
      // Ignore JSON parse failures for non-JSON error bodies.
    }
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

function buildApi(getJwt: (() => Promise<string | null>) | string | null) {
  async function resolveJwt() {
    return typeof getJwt === 'function' ? await getJwt() : getJwt
  }

  async function get<T>(path: string): Promise<T> {
    const jwt = await resolveJwt()
    return apiFetch<T>(path, { method: 'GET' }, jwt)
  }

  async function post<T>(path: string, body?: unknown): Promise<T> {
    const jwt = await resolveJwt()
    return apiFetch<T>(
      path,
      {
        method: 'POST',
        body: body == null ? undefined : JSON.stringify(body)
      },
      jwt
    )
  }

  async function put<T>(path: string, body?: unknown): Promise<T> {
    const jwt = await resolveJwt()
    return apiFetch<T>(
      path,
      {
        method: 'PUT',
        body: body == null ? undefined : JSON.stringify(body)
      },
      jwt
    )
  }

  async function del<T>(path: string): Promise<T> {
    const jwt = await resolveJwt()
    return apiFetch<T>(path, { method: 'DELETE' }, jwt)
  }

  function contentDomain<TListItem, TDetail, TInput>(basePath: string) {
    return {
      list: () => get<ListResponse<TListItem>>(basePath),
      get: (id: string) => get<TDetail | null>(`${basePath}/${id}`),
      upsert: (input: TInput) => post<TDetail>(basePath, input)
    }
  }

  return {
    characters: {
      list: () => get<CharacterListResponseDto>('/characters'),
      draft: (input: CharacterDraftRequestDto) =>
        post<CharacterBuilderPayloadDto>('/characters/draft', input),
      get: (id: string) =>
        get<CharacterBuilderPayloadDto | null>(`/characters/${id}`),
      sheet: (id: string) =>
        get<CharacterSheetResponseDto | null>(`/characters/${id}/sheet`),
      resolve: (input: CharacterBuilderResolveRequestDto) =>
        post<CharacterBuilderPayloadDto>('/characters/resolve', input),
      previewSave: (input: CharacterBuilderSaveRequestDto) =>
        post<CharacterBuilderPreviewPayloadDto>('/characters/preview-save', input),
      upsert: (input: CharacterBuilderSaveRequestDto) =>
        post<CharacterBuilderPayloadDto>('/characters/upsert', input),
      history: (id: string) =>
        get<CharacterHistoryResponse>(`/characters/${id}/history`),
      command: (id: string, input: CharacterCommandUnion) =>
        post<void>(`/characters/${id}/commands`, input)
    },

    content: {
      backgrounds: contentDomain<
        BackgroundListItemDto,
        BackgroundAuthoredDto,
        BackgroundAuthoredDto
      >('/content/backgrounds'),

      classes: contentDomain<
        ClassListItemDto,
        ClassAuthoredDto,
        ClassAuthoredDto
      >('/content/classes'),

      equipment: contentDomain<
        EquipmentListItemDto,
        EquipmentAuthoredDto,
        EquipmentAuthoredDto
      >('/content/equipment'),

      feats: contentDomain<
        FeatListItemDto,
        FeatAuthoredDto,
        FeatAuthoredDto
      >('/content/feats'),

      races: contentDomain<
        RaceListItemDto,
        RaceAuthoredDto,
        RaceAuthoredDto
      >('/content/races'),

      spells: contentDomain<
        SpellListItemDto,
        SpellAuthoredDto,
        SpellAuthoredDto
      >('/content/spells'),

      features: contentDomain<
        FeatureListItemDto,
        FeatureDto,
        FeatureDto
      >('/content/features'),

      creatures: {
        list: () =>
          get<ListResponse<{ id: string, label: string, cr?: string }>>('/content/creatures'),
        get: (id: string) =>
          get<unknown>(`/content/creatures/${id}`)
      },

      vehicles: {
        list: () =>
          get<ListResponse<{ id: string, label: string }>>('/content/vehicles'),
        get: (id: string) =>
          get<unknown>(`/content/vehicles/${id}`)
      }
    },

    systems: {
      list: () => get<SystemListItemDto[]>('/systems'),
      get: (id: string) => get<unknown>(`/systems/${id}`)
    },

    _raw: { get, post, put, del }
  }
}

export const api = buildApi(getClientJwt)

export function createServerApi(jwt: string) {
  return buildApi(() => Promise.resolve(jwt))
}

export type Api = ReturnType<typeof buildApi>
