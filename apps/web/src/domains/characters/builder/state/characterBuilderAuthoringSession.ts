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
  draft: NonNullable<CharacterBuilderAuthoringSession['draft']>
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
  const systemId = loaderData.systems[0]?.id

  return {
    draft: null,
    fallbackLabel: 'Untitled Character',
    formKey: 'character:create',
    hasActiveDraft: false,
    hasInvalidDraft: false,
    invalidDraftOnly: false,
    isDraft: true,
    kind: 'character-builder',
    mode: 'create',
    notFound: false,
    payload: null,
    readOnly: true,
    subjectKindLabel: 'Character',
    subjectLabel: 'Untitled Character',
    systemId,
    systemRequired: !systemId
  }
}

function createCharacterEditSession(data: unknown): CharacterBuilderAuthoringSession {
  const loaderData = data as CharacterEditAuthoringData
  const { payload, draft } = loaderData
  const invalidDraftOnly = !payload && draft?.draftState === 'DRAFT_ONLY'
  const notFound = !payload && !draft
  const subjectLabel =
    payload?.character.label || loaderData.breadcrumbLabel || 'Untitled Character'
  const initialValues = payload ? toCharacterFormValues(payload) : undefined

  return {
    characterId: loaderData.characterId,
    draft: loaderData.draft,
    fallbackLabel: 'Untitled Character',
    formKey: `character:${loaderData.characterId}:${draft?.id ?? 'active'}`,
    hasActiveDraft: draft?.draftState === 'ACTIVE_WITH_DRAFT',
    hasInvalidDraft: Boolean(draft && !payload),
    initialAuthoringState:
      payload && initialValues
        ? getCharacterBuilderAuthoringState({ payload, values: initialValues })
        : undefined,
    initialValues,
    invalidDraftOnly,
    isDraft: Boolean(draft),
    kind: 'character-builder',
    mode: draft?.mode ?? 'edit',
    notFound,
    payload,
    readOnly: !draft,
    subjectKindLabel: 'Character',
    subjectLabel,
    systemId: payload?.character.systemId,
    systemRequired: false
  }
}
