import {
  handleRequest,
  handleAuthoringRequest,
  createBackgroundSubjectAuthoringService,
  normalizeNodeRuntimeValues
} from '@artificer-toolkit/functions'
import { getBackgroundListQuery } from '@artificer-toolkit/db'
import { createBackgroundRepository } from '@artificer-toolkit/db'
import type { BackgroundAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  authoredDraftActivateRequestDtoSchema,
  authoredDraftSaveRequestDtoSchema
} from '@artificer-toolkit/schema/api/content'
import {
  backgroundAuthoringInputDtoSchema,
  backgroundAuthoredDtoSchema,
  type BackgroundAuthoringInputDto
} from '@artificer-toolkit/schema/subjects/background'
import {
  discardAuthoredDraft,
  extractDraftSubjectIdFromRequest,
  getAuthoredDraft,
  normalizeAuthoredDetailResponse,
  normalizeAuthoredListResponseWithDrafts,
  normalizeActivatedAuthoringInput,
  normalizeAuthoringResult,
  normalizeStoredDraftPayloadForActivation,
  requireAuthoredDraft,
  resolveDraftActivationSubjectId,
  saveAuthoredDraft
} from './authoredContent.js'

function extractId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

// list
export const getBackgroundList = handleRequest(
  async (db, userId) => normalizeAuthoredListResponseWithDrafts(db, await getBackgroundListQuery(db), userId, 'BACKGROUND'),
  (_req: Request, userId: string) => [userId] as [string]
)

// single
export const getBackground = handleRequest<[string, string], Awaited<ReturnType<typeof normalizeAuthoredDetailResponse<BackgroundAuthored>>>>(
  async (db, id, userId) => normalizeAuthoredDetailResponse(db, 'backgrounds', await createBackgroundRepository(db).findById(id), userId),
  (req: Request, userId: string) => [extractId(req), userId] as [string, string]
)

export const getBackgroundDraft = handleRequest(
  async (db, id, userId) => getAuthoredDraft(db, 'BACKGROUND', id, userId),
  (req: Request, userId: string) => [extractDraftSubjectIdFromRequest(req), userId] as [string, string]
)

export const saveBackgroundDraft = handleAuthoringRequest(
  authoredDraftSaveRequestDtoSchema,
  async (db, body, userId) => saveAuthoredDraft(db, {
    ...body,
    subjectKind: 'BACKGROUND'
  }, userId)
)

export const discardBackgroundDraft = handleRequest(
  async (db, id, userId) => {
    await discardAuthoredDraft(db, 'BACKGROUND', id, userId)
    return { ok: true }
  },
  (req: Request, userId: string) => [extractDraftSubjectIdFromRequest(req), userId] as [string, string]
)

export const activateBackgroundDraft = handleAuthoringRequest(
  authoredDraftActivateRequestDtoSchema,
  async (db, body, userId, req) => {
    const subjectId = resolveDraftActivationSubjectId('BACKGROUND', body.subjectId, req)
    const draft = await requireAuthoredDraft(db, 'BACKGROUND', subjectId, userId)
    const service = createBackgroundSubjectAuthoringService(db)
    const input = backgroundAuthoredDtoSchema.parse(normalizeStoredDraftPayloadForActivation(draft, userId))
    const normalized = await normalizeNodeRuntimeValues(db, {
      mapId: 'background',
      values: { ...input }
    })
    const normalizedBody = backgroundAuthoredDtoSchema.parse(normalized.values)
    const result = await service.execute(normalizeActivatedAuthoringInput(normalizedBody, userId))
    await discardAuthoredDraft(db, 'BACKGROUND', subjectId, userId)
    return normalizeAuthoringResult(db, 'backgrounds', result, userId)
  }
)

// create/update
export const createBackground = handleAuthoringRequest(
  backgroundAuthoringInputDtoSchema,
  async (db, body: BackgroundAuthoringInputDto, userId) => {
    const service = createBackgroundSubjectAuthoringService(db)
    const normalized = await normalizeNodeRuntimeValues(db, {
      mapId: 'background',
      values: { ...body, userId }
    })
    const normalizedBody = backgroundAuthoredDtoSchema.parse(normalized.values)
    const result = await service.execute(normalizeActivatedAuthoringInput(normalizedBody, userId))
    await discardAuthoredDraft(db, 'BACKGROUND', normalizedBody.id, userId)
    return normalizeAuthoringResult(db, 'backgrounds', result, userId)
  }
)
