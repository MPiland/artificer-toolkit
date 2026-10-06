import type { LiveRoomInputsInput, LiveRoomInputsResponse } from './liveRoomInputs.js'

/** One Convex query page; it stays far below the 16384-document and 8 MiB read limits. */
export const MAX_ROOM_INPUT_PAGE_DOCUMENTS = 1024
/**
 * A response stops taking pages once it holds this many documents or bytes, so it is at most one
 * page larger than the budget.
 */
export const ROOM_INPUT_BATCH_DOCUMENTS = 2048
export const ROOM_INPUT_BATCH_BYTES = 2 * 1024 * 1024
export const MAX_ROOM_INPUT_RESPONSE_DOCUMENTS =
  ROOM_INPUT_BATCH_DOCUMENTS + MAX_ROOM_INPUT_PAGE_DOCUMENTS

type PagedResponse = Extract<
  LiveRoomInputsResponse,
  {
    kind:
      | 'AUTHORITY'
      | 'CHAT_METADATA'
      | 'RUN'
      | 'SCENE'
      | 'SCENE_DEFINITION'
      | 'CHARACTERS'
      | 'DEFINITIONS'
  }
>

const isPaged = (response: LiveRoomInputsResponse): response is PagedResponse =>
  response.kind === 'AUTHORITY' ||
  response.kind === 'CHAT_METADATA' ||
  response.kind === 'RUN' ||
  response.kind === 'SCENE' ||
  response.kind === 'SCENE_DEFINITION' ||
  response.kind === 'DEFINITIONS' ||
  response.kind === 'CHARACTERS'

const documentsIn = (page: PagedResponse) =>
  page.kind === 'DEFINITIONS'
    ? page.definitions.length
    : page.kind === 'SCENE_DEFINITION'
      ? page.entities.length
      : page.kind !== 'CHARACTERS'
        ? page.documents.length
        : page.parts.reduce(
            (total, part) => total + (part.status === 'ASSIGNED' ? part.documents.length : 0),
            0
          )

/** Refuses pages with changed Run versions or Scene source/version pins. */
function append(batch: PagedResponse, next: PagedResponse): PagedResponse | null {
  if (batch.kind === 'DEFINITIONS' && next.kind === 'DEFINITIONS')
    return JSON.stringify(next.revisions) === JSON.stringify(batch.revisions)
      ? {
          ...batch,
          definitions: [...batch.definitions, ...next.definitions],
          continueCursor: next.continueCursor
        }
      : null
  if (batch.kind === 'SCENE_DEFINITION' && next.kind === 'SCENE_DEFINITION')
    return JSON.stringify(next.header) === JSON.stringify(batch.header) &&
      JSON.stringify(next.source) === JSON.stringify(batch.source)
      ? {
          ...batch,
          entities: [...batch.entities, ...next.entities],
          continueCursor: next.continueCursor
        }
      : null
  if (batch.kind === 'CHAT_METADATA' && next.kind === 'CHAT_METADATA')
    return {
      ...batch,
      documents: [...batch.documents, ...next.documents],
      continueCursor: next.continueCursor
    }
  if (batch.kind === 'AUTHORITY' && next.kind === 'AUTHORITY')
    return JSON.stringify(next.revisions) === JSON.stringify(batch.revisions)
      ? {
          ...batch,
          documents: [...batch.documents, ...next.documents],
          accountUserIds: [...batch.accountUserIds, ...next.accountUserIds],
          continueCursor: next.continueCursor
        }
      : null
  if (batch.kind === 'RUN' && next.kind === 'RUN')
    return next.encounterVersion === batch.encounterVersion
      ? {
          ...batch,
          documents: [...batch.documents, ...next.documents],
          continueCursor: next.continueCursor
        }
      : null
  if (batch.kind === 'SCENE' && next.kind === 'SCENE')
    return next.sceneVersion === batch.sceneVersion &&
      next.source.sceneId === batch.source.sceneId &&
      next.source.definitionSaveId === batch.source.definitionSaveId &&
      next.source.definitionVersion === batch.source.definitionVersion &&
      next.source.presentationVersion === batch.source.presentationVersion
      ? {
          ...batch,
          documents: [...batch.documents, ...next.documents],
          continueCursor: next.continueCursor
        }
      : null
  if (batch.kind === 'CHARACTERS' && next.kind === 'CHARACTERS')
    return { ...batch, parts: [...batch.parts, ...next.parts], continueCursor: next.continueCursor }
  throw new Error('Room input page answered as another scope.')
}

/**
 * Answers one Worker call with as many consecutive query pages as fit the batch budget, so a large
 * Run, Scene and Characters take a few subrequests instead of one per page or per Character. A
 * page with changed source/version pins is left for the next call: the caller sees the change
 * between responses and retries the whole read.
 */
export async function readRoomInputsBatch(
  readPage: (input: LiveRoomInputsInput) => Promise<LiveRoomInputsResponse>,
  input: LiveRoomInputsInput
): Promise<LiveRoomInputsResponse> {
  const first = await readPage(input)
  const { scope } = input
  if (!isPaged(first)) return first
  if (
    scope.kind !== 'AUTHORITY' &&
    scope.kind !== 'CHAT_METADATA' &&
    scope.kind !== 'RUN' &&
    scope.kind !== 'SCENE' &&
    scope.kind !== 'SCENE_DEFINITION' &&
    scope.kind !== 'DEFINITIONS' &&
    scope.kind !== 'CHARACTERS'
  )
    return first
  let batch = first
  let documents = documentsIn(first)
  let bytes = JSON.stringify(first).length
  while (
    batch.continueCursor &&
    documents < ROOM_INPUT_BATCH_DOCUMENTS &&
    bytes < ROOM_INPUT_BATCH_BYTES
  ) {
    if (scope.kind !== batch.kind) throw new Error('Room input page answered as another scope.')
    const nextInput: LiveRoomInputsInput = {
      ...input,
      scope:
        scope.kind === 'SCENE' && batch.kind === 'SCENE'
          ? { ...scope, cursor: batch.continueCursor }
          : scope.kind === 'SCENE_DEFINITION' && batch.kind === 'SCENE_DEFINITION'
            ? { ...scope, cursor: batch.continueCursor }
            : scope.kind === 'DEFINITIONS' && batch.kind === 'DEFINITIONS'
              ? { ...scope, cursor: batch.continueCursor }
              : scope.kind === 'RUN' && batch.kind === 'RUN'
                ? { ...scope, cursor: batch.continueCursor }
                : scope.kind === 'AUTHORITY' && batch.kind === 'AUTHORITY'
                  ? { ...scope, cursor: batch.continueCursor }
                  : scope.kind === 'CHAT_METADATA' && batch.kind === 'CHAT_METADATA'
                    ? { ...scope, cursor: batch.continueCursor }
                    : scope.kind === 'CHARACTERS' && batch.kind === 'CHARACTERS'
                      ? { ...scope, cursor: batch.continueCursor }
                      : scope
    }
    const next = await readPage(nextInput)
    if (!isPaged(next)) throw new Error('Room input page answered as another scope.')
    const appended = append(batch, next)
    if (!appended) break
    batch = appended
    documents += documentsIn(next)
    bytes += JSON.stringify(next).length
  }
  return batch
}
