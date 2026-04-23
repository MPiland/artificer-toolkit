/**
 * Typed REST client for apps/apis.
 *
 * Client-side usage:
 *   const api = createApi()          // auto-injects JWT from Supabase session
 *   const chars = await api.characters.list()
 *
 * SSR server function usage:
 *   const api = createApi(jwt)       // JWT extracted from getSupabaseServerClient()
 *   const chars = await api.characters.list()
 */

import { getSupabaseBrowserClient } from '#supabase'
import type {
  BackgroundAuthoredDto,
  ClassAuthoredDto,
  EquipmentAuthoredDto,
  FeatAuthoredDto,
  RaceAuthoredDto,
  SpellAuthoredDto,
  FeatureDto,
  SystemListItemDto,
  CharacterCommandUnion,
  BackgroundListItemDto,
  ClassListItemDto,
  EquipmentListItemDto,
  FeatListItemDto,
  RaceListItemDto,
  SpellListItemDto,
  FeatureListItemDto,
} from '@artificer-toolkit/schema'
import type { CharacterBuildState, EngineCharacterOutput } from '@artificer-toolkit/shared'

export type {
  BackgroundListItemDto,
  ClassListItemDto,
  EquipmentListItemDto,
  FeatListItemDto,
  RaceListItemDto,
  SpellListItemDto,
  FeatureListItemDto,
}

// ─── Response shapes ────────────────────────────────────────────────────────

export interface ListResponse<T> {
  items: T[]
  meta: Record<string, unknown>
}

export interface CharacterListItem {
  id: string
  name: string
  systemId: string
  systemLabel?: string
  raceSummary?: string
  classSummary?: string
  level?: number
  updatedAt: string
  createdAt: string
}

export interface CharacterGetResponse {
  buildState: CharacterBuildState
  engineOutput: EngineCharacterOutput
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

export interface CreateCharacterInput {
  name: string
  systemId: string
}

// ─── Core fetch helper ───────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function getClientJwt(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function makeHeaders(jwt: string | null): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`
  return headers
}

async function apiFetch<T>(
  path: string,
  options: RequestInit,
  jwt: string | null
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...makeHeaders(jwt),
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    let message = `API error ${res.status}`
    try {
      const body = await res.json()
      message = body?.error ?? body?.message ?? message
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, message)
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T

  return res.json() as Promise<T>
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

// ─── Factory ─────────────────────────────────────────────────────────────────

function buildApi(getJwt: () => Promise<string | null> | string | null) {
  async function resolveJwt() {
    return typeof getJwt === 'function' ? await getJwt() : getJwt
  }

  async function get<T>(path: string): Promise<T> {
    const jwt = await resolveJwt()
    return apiFetch<T>(path, { method: 'GET' }, jwt)
  }

  async function post<T>(path: string, body?: unknown): Promise<T> {
    const jwt = await resolveJwt()
    return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }, jwt)
  }

  async function put<T>(path: string, body?: unknown): Promise<T> {
    const jwt = await resolveJwt()
    return apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }, jwt)
  }

  async function del<T>(path: string): Promise<T> {
    const jwt = await resolveJwt()
    return apiFetch<T>(path, { method: 'DELETE' }, jwt)
  }

  // ─── Content helpers ──────────────────────────────────────────────────────

  function contentDomain<TListItem, TDetail, TInput>(basePath: string) {
    return {
      list: () => get<ListResponse<TListItem>>(basePath),
      get: (id: string) => get<TDetail | null>(`${basePath}/${id}`),
      upsert: (input: TInput) => post<TDetail>(`${basePath}`, input),
    }
  }

  // ─── API surface ──────────────────────────────────────────────────────────

  return {
    characters: {
      list: () =>
        get<ListResponse<CharacterListItem>>('/characters'),

      get: (id: string) =>
        get<CharacterGetResponse>(`/characters/${id}`),

      history: (id: string) =>
        get<CharacterHistoryResponse>(`/characters/${id}/history`),

      create: (input: CreateCharacterInput) =>
        post<CharacterListItem>('/characters', input),

      command: (id: string, input: CharacterCommandUnion) =>
        post<void>(`/characters/${id}/commands`, input),
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
          get<ListResponse<{ id: string; label: string; cr?: string }>>('/content/creatures'),
        get: (id: string) =>
          get<unknown>(`/content/creatures/${id}`),
      },

      vehicles: {
        list: () =>
          get<ListResponse<{ id: string; label: string }>>('/content/vehicles'),
        get: (id: string) =>
          get<unknown>(`/content/vehicles/${id}`),
      },
    },

    systems: {
      list: () => get<SystemListItemDto[]>('/systems'),
    },

    // Expose raw verbs for one-off calls
    _raw: { get, post, put, del },
  }
}

// ─── Client-side singleton (auto-injects JWT) ────────────────────────────────

export const api = buildApi(getClientJwt)

// ─── SSR factory (pass JWT from getSupabaseServerClient) ─────────────────────

export function createServerApi(jwt: string) {
  return buildApi(() => jwt)
}

export type Api = ReturnType<typeof buildApi>
