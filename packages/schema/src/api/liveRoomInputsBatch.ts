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

type PagedResponse = Extract<LiveRoomInputsResponse, { kind: 'RUN' | 'CHARACTERS' }>

const isPaged = (response: LiveRoomInputsResponse): response is PagedResponse =>
  response.kind === 'RUN' || response.kind === 'CHARACTERS'

const documentsIn = (page: PagedResponse) =>
  page.kind === 'RUN'
    ? page.documents.length
    : page.parts.reduce(
        (total, part) => total + (part.status === 'ASSIGNED' ? part.documents.length : 0),
        0
      )

/** Appends `next`; null when a Run page was read at another version, which would tear the read. */
function append(batch: PagedResponse, next: PagedResponse): PagedResponse | null {
  if (batch.kind === 'RUN' && next.kind === 'RUN')
    return next.encounterVersion === batch.encounterVersion
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
 * Run and its Characters take a few subrequests instead of one per page or per Character. A page
 * read at a new Run version is left for the next call: the caller sees the version change between
 * responses and reads the Run again, as it does for pages read in separate calls.
 */
export async function readRoomInputsBatch(
  readPage: (input: LiveRoomInputsInput) => Promise<LiveRoomInputsResponse>,
  input: LiveRoomInputsInput
): Promise<LiveRoomInputsResponse> {
  const first = await readPage(input)
  const { scope } = input
  if (!isPaged(first) || (scope.kind !== 'RUN' && scope.kind !== 'CHARACTERS')) return first
  let batch = first
  let documents = documentsIn(first)
  let bytes = JSON.stringify(first).length
  while (
    batch.continueCursor &&
    documents < ROOM_INPUT_BATCH_DOCUMENTS &&
    bytes < ROOM_INPUT_BATCH_BYTES
  ) {
    const next = await readPage({ ...input, scope: { ...scope, cursor: batch.continueCursor } })
    if (!isPaged(next)) throw new Error('Room input page answered as another scope.')
    const appended = append(batch, next)
    if (!appended) break
    batch = appended
    documents += documentsIn(next)
    bytes += JSON.stringify(next).length
  }
  return batch
}
