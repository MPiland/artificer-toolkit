import type {
  CharacterCreateAuthoringData,
  CharacterEditAuthoringData
} from '#app/routes/-routeLoaderData'
import type { SystemListResponseDto } from '@artificer-toolkit/schema/api/systems'
import type { CharacterBuilderRouteMode } from '#forms/layout/authoredFormRouteContext'
import { isRecord } from '#app/forms/utils/valueGuards'
import type { CharacterFormValues } from '../core/characterBuilder.types'
import { toCharacterFormValues } from '../shared/formNormalization'

export type CharacterBuilderAuthoringSession = {
  characterId?: string
  draft: CharacterEditAuthoringData['draft'] | null
  fallbackLabel: string
  formKey: string
  hasActiveDraft: boolean
  initialValues?: CharacterFormValues
  isDraft: boolean
  kind: 'character-builder'
  mode: CharacterBuilderRouteMode
  notFound: boolean
  readOnly: boolean
  subjectKindLabel: 'Character'
  subjectLabel: string
  systemId?: string
  systemRequired: boolean
  systems: SystemListResponseDto
}

export type ReadyCharacterBuilderAuthoringSession = CharacterBuilderAuthoringSession & {
  draft: NonNullable<CharacterBuilderAuthoringSession['draft']>
  initialValues: NonNullable<CharacterBuilderAuthoringSession['initialValues']>
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

function isCharacterCreateAuthoringData(data: unknown): data is CharacterCreateAuthoringData {
  return isRecord(data) && Array.isArray(data.systems)
}

function isCharacterEditAuthoringData(data: unknown): data is CharacterEditAuthoringData {
  return isRecord(data) && typeof data.characterId === 'string' && 'activeCharacter' in data
}

function createCharacterCreateSession(data: unknown): CharacterBuilderAuthoringSession {
  if (!isCharacterCreateAuthoringData(data)) throw new Error('Character create data is invalid.')
  const loaderData = data
  const { systemId } = loaderData

  return {
    draft: null,
    fallbackLabel: 'Untitled Character',
    formKey: 'character:create',
    hasActiveDraft: false,
    isDraft: true,
    kind: 'character-builder',
    mode: 'create',
    notFound: false,
    readOnly: true,
    subjectKindLabel: 'Character',
    subjectLabel: 'Untitled Character',
    systemId,
    systemRequired: !systemId,
    systems: loaderData.systems
  }
}

function createCharacterEditSession(data: unknown): CharacterBuilderAuthoringSession {
  if (!isCharacterEditAuthoringData(data)) throw new Error('Character edit data is invalid.')
  const loaderData = data
  const { activeCharacter, draft } = loaderData
  const character = draft?.payload.character ?? activeCharacter

  return {
    characterId: loaderData.characterId,
    draft,
    fallbackLabel: 'Untitled Character',
    formKey: `character:${loaderData.characterId}:${draft?.id ?? 'active'}`,
    hasActiveDraft: draft?.draftState === 'ACTIVE_WITH_DRAFT',
    initialValues: draft ? toCharacterFormValues(draft.payload) : undefined,
    isDraft: Boolean(draft),
    kind: 'character-builder',
    mode: draft?.mode ?? 'edit',
    notFound: !character,
    readOnly: !draft,
    subjectKindLabel: 'Character',
    subjectLabel: character?.label || loaderData.breadcrumbLabel || 'Untitled Character',
    systemId: character?.systemId,
    systemRequired: false,
    systems: []
  }
}
