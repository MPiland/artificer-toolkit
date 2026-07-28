import {
  createCharacterDraftForUser,
  createCharacterForUser,
  discardCharacterBuilderDraftForUser,
  dispatchCommandForUser,
  getCharacterBuilderDraftForUser,
  getCharacterForUser,
  getCharacterHistoryForUser,
  getCharacterSheetForUser,
  handleAuthoringRequest,
  handleRequest,
  listCharactersForUser,
  previewCharacterRestForUser,
  previewCharacterSaveForUser,
  resolveCharacterForUser,
  saveCharacterBuilderDraftForUser,
  upsertCharacterBuilderForUser
} from '@artificer-toolkit/functions'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import {
  characterBuilderCommitRequestDtoSchema,
  characterBuilderDraftSaveRequestDtoSchema,
  characterBuilderResolveRequestDtoSchema,
  characterBuilderSaveRequestDtoSchema,
  characterDraftRequestDtoSchema,
  characterRestPreviewRequestDtoSchema,
  characterSheetCommandInputDtoSchema
} from '@artificer-toolkit/schema/api/characters'

function extractId(request: Request): string {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

function extractCharacterIdBeforeSegment(request: Request, segment: string): string {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean)
  const segmentIndex = segments.lastIndexOf(segment)
  return segmentIndex > 0 ? segments[segmentIndex - 1] : extractId(request)
}

function extractCharacterIdFromBuilderDraftRoute(request: Request): string {
  return extractCharacterIdBeforeSegment(request, 'builder-draft')
}

export const listCharacters = handleRequest(
  listCharactersForUser,
  (_request: Request, userId: string) => [userId] as [string]
)

export const createCharacterDraft = handleAuthoringRequest(
  characterDraftRequestDtoSchema,
  createCharacterDraftForUser
)

export const getCharacterBuilderDraft = handleRequest(
  getCharacterBuilderDraftForUser,
  (request: Request, userId: string) =>
    [extractCharacterIdFromBuilderDraftRoute(request), userId] as [string, string]
)

export const saveCharacterBuilderDraft = handleAuthoringRequest(
  characterBuilderDraftSaveRequestDtoSchema,
  (db, body, userId, request) =>
    saveCharacterBuilderDraftForUser(
      db,
      extractCharacterIdFromBuilderDraftRoute(request),
      body,
      userId
    )
)

export const discardCharacterBuilderDraft = handleRequest(
  discardCharacterBuilderDraftForUser,
  (request: Request, userId: string) =>
    [extractCharacterIdFromBuilderDraftRoute(request), userId] as [string, string]
)

export const createCharacter = handleAuthoringRequest(
  characterAuthoredDtoSchema,
  createCharacterForUser
)

export const getCharacter = handleRequest(
  getCharacterForUser,
  (request: Request) => [extractId(request)] as [string]
)

export const getCharacterSheet = handleRequest(
  getCharacterSheetForUser,
  (request: Request) => [extractCharacterIdBeforeSegment(request, 'sheet')] as [string]
)

export const previewCharacterRest = handleAuthoringRequest(
  characterRestPreviewRequestDtoSchema,
  (db, input, userId, request) =>
    previewCharacterRestForUser(
      db,
      extractCharacterIdBeforeSegment(request, 'rest-preview'),
      input,
      userId
    )
)

export const resolveCharacter = handleAuthoringRequest(
  characterBuilderResolveRequestDtoSchema,
  resolveCharacterForUser
)

export const previewCharacterSave = handleAuthoringRequest(
  characterBuilderSaveRequestDtoSchema,
  previewCharacterSaveForUser
)

export const upsertCharacterBuilder = handleAuthoringRequest(
  characterBuilderCommitRequestDtoSchema,
  upsertCharacterBuilderForUser
)

export const dispatchCommand = handleAuthoringRequest(
  characterSheetCommandInputDtoSchema,
  (db, command, userId, request) =>
    dispatchCommandForUser(
      db,
      extractCharacterIdBeforeSegment(request, 'commands'),
      command,
      userId
    )
)

export const getCharacterHistory = handleRequest(
  getCharacterHistoryForUser,
  (request: Request, userId: string) =>
    [extractCharacterIdBeforeSegment(request, 'history'), userId] as [string, string]
)
