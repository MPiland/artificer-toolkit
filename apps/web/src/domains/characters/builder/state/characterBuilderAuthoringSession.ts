import type {
  CharacterCreateAuthoringData,
  CharacterEditAuthoringData
} from '#app/routes/-routeLoaderData'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
import type { CharacterBuilderRouteMode } from '#forms/layout/authoredFormRouteContext'
import type { CharacterFormValues } from '../core/characterBuilder.types'
import { toCharacterFormValues } from '../shared/formNormalization'
import {
  getCharacterBuilderAuthoringState,
  type CharacterBuilderAuthoringState
} from './characterBuilderAuthoringState'

export type CharacterBuilderAuthoringSession = {
  baseActiveUpdatedAt: string | null
  characterId?: string
  draft: CharacterEditAuthoringData['draft'] | null
  fallbackLabel: string
  formKey: string
  hasActiveDraft: boolean
  hasInvalidDraft: boolean
  initialAuthoringState?: CharacterBuilderAuthoringState
  initialValues?: CharacterFormValues
  invalidDraftOnly: boolean
  isDraft: boolean
  kind: 'character-builder'
  mode: CharacterBuilderRouteMode
  notFound: boolean
  payload: CharacterBuilderPayloadDto | null
  readOnly: boolean
  subjectKindLabel: 'Character'
  subjectLabel: string
  systemId?: string
  systemRequired: boolean
}

export type ReadyCharacterBuilderAuthoringSession = CharacterBuilderAuthoringSession & {
  initialValues: NonNullable<CharacterBuilderAuthoringSession['initialValues']>
  payload: NonNullable<CharacterBuilderAuthoringSession['payload']>
}

export function createCharacterBuilderAuthoringSession({
  data,
  mode
}: {
  data: unknown
  mode: CharacterBuilderRouteMode
}): CharacterBuilderAuthoringSession {
  return mode === 'create' ? createCharacterCreateSession(data) : createCharacterEditSession(data)
}

function createCharacterCreateSession(data: unknown): CharacterBuilderAuthoringSession {
  const loaderData = data as CharacterCreateAuthoringData
  const payload = loaderData.payload
  const initialValues = payload ? toCharacterFormValues(payload) : undefined
  const subjectLabel = payload?.character.label || 'Untitled Character'

  return {
    baseActiveUpdatedAt: null,
    draft: null,
    fallbackLabel: 'Untitled Character',
    formKey: payload
      ? `character:create:${payload.character.id}`
      : 'character:create:system-required',
    hasActiveDraft: false,
    hasInvalidDraft: false,
    initialAuthoringState:
      payload && initialValues
        ? getCharacterBuilderAuthoringState({ payload, values: initialValues })
        : undefined,
    initialValues,
    invalidDraftOnly: false,
    isDraft: true,
    kind: 'character-builder',
    mode: 'create',
    notFound: false,
    payload,
    readOnly: false,
    subjectKindLabel: 'Character',
    subjectLabel,
    systemId: payload?.character.systemId,
    systemRequired: !payload
  }
}

function createCharacterEditSession(data: unknown): CharacterBuilderAuthoringSession {
  const loaderData = data as CharacterEditAuthoringData
  const payload = loaderData.draftPayload ?? loaderData.response
  const invalidDraftOnly =
    !loaderData.response && !loaderData.draftPayload && Boolean(loaderData.draft)
  const notFound = !loaderData.response && !loaderData.draftPayload && !loaderData.draft
  const baseActiveUpdatedAt = loaderData.draftPayload
    ? (loaderData.draft?.baseActiveUpdatedAt ?? loaderData.response?.baseActiveUpdatedAt ?? null)
    : (loaderData.response?.baseActiveUpdatedAt ?? null)
  const subjectLabel =
    payload?.character.label || loaderData.breadcrumbLabel || 'Untitled Character'
  const initialValues = payload ? toCharacterFormValues(payload) : undefined

  return {
    baseActiveUpdatedAt,
    characterId: loaderData.characterId,
    draft: loaderData.draft,
    fallbackLabel: 'Untitled Character',
    formKey: `character:${loaderData.characterId}:${loaderData.draft?.updatedAt ?? payload?.character.id ?? 'missing'}`,
    hasActiveDraft: Boolean(loaderData.response && loaderData.draftPayload),
    hasInvalidDraft: Boolean(loaderData.draft && !loaderData.draftPayload),
    initialAuthoringState:
      payload && initialValues
        ? getCharacterBuilderAuthoringState({ payload, values: initialValues })
        : undefined,
    initialValues,
    invalidDraftOnly,
    isDraft: Boolean(loaderData.draftPayload),
    kind: 'character-builder',
    mode: 'edit',
    notFound,
    payload,
    readOnly: false,
    subjectKindLabel: 'Character',
    subjectLabel,
    systemId: payload?.character.systemId,
    systemRequired: false
  }
}
