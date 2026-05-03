import {
  handleRequest,
  handleAuthoringRequest,
  createFeatSubjectAuthoringService,
  normalizeNodeRuntimeValues
} from '@artificer-toolkit/functions'
import { getFeatListQuery } from '@artificer-toolkit/db'
import { createFeatRepository } from '@artificer-toolkit/db'
import type { FeatAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  authoredDraftActivateRequestDtoSchema,
  authoredDraftSaveRequestDtoSchema
} from '@artificer-toolkit/schema/api/content'
import {
  featAuthoredDtoSchema,
  type FeatAuthoredDto
} from '@artificer-toolkit/schema/subjects/feat'
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
export const getFeatList = handleRequest(
  async (db, userId) => normalizeAuthoredListResponseWithDrafts(db, await getFeatListQuery(db), userId, 'FEAT'),
  (_req: Request, userId: string) => [userId] as [string]
)

// single
export const getFeat = handleRequest<[string, string], Awaited<ReturnType<typeof normalizeAuthoredDetailResponse<FeatAuthored>>>>(
  async (db, id, userId) => normalizeAuthoredDetailResponse(db, 'feats', await createFeatRepository(db).findById(id), userId),
  (req: Request, userId: string) => [extractId(req), userId] as [string, string]
)

export const getFeatDraft = handleRequest(
  async (db, id, userId) => getAuthoredDraft(db, 'FEAT', id, userId),
  (req: Request, userId: string) => [extractDraftSubjectIdFromRequest(req), userId] as [string, string]
)

export const saveFeatDraft = handleAuthoringRequest(
  authoredDraftSaveRequestDtoSchema,
  async (db, body, userId) => saveAuthoredDraft(db, {
    ...body,
    subjectKind: 'FEAT'
  }, userId)
)

export const discardFeatDraft = handleRequest(
  async (db, id, userId) => {
    await discardAuthoredDraft(db, 'FEAT', id, userId)
    return { ok: true }
  },
  (req: Request, userId: string) => [extractDraftSubjectIdFromRequest(req), userId] as [string, string]
)

export const activateFeatDraft = handleAuthoringRequest(
  authoredDraftActivateRequestDtoSchema,
  async (db, body, userId, req) => {
    const subjectId = resolveDraftActivationSubjectId('FEAT', body.subjectId, req)
    const draft = await requireAuthoredDraft(db, 'FEAT', subjectId, userId)
    const service = createFeatSubjectAuthoringService(db)
    const input = featAuthoredDtoSchema.parse(normalizeStoredDraftPayloadForActivation(draft, userId))
    const normalized = await normalizeNodeRuntimeValues(db, {
      mapId: 'feat',
      values: input
    })
    const normalizedBody = featAuthoredDtoSchema.parse(normalized.values)
    const result = await service.execute(normalizeActivatedAuthoringInput(normalizedBody as FeatAuthored, userId))
    await discardAuthoredDraft(db, 'FEAT', subjectId, userId)
    return normalizeAuthoringResult(db, 'feats', result as { authored: FeatAuthored }, userId)
  }
)

// create/update
export const createFeat = handleAuthoringRequest(
  featAuthoredDtoSchema,
  async (db, body: FeatAuthoredDto, userId) => {
    const service = createFeatSubjectAuthoringService(db)
    const input = featAuthoredDtoSchema.parse(body)
    const normalized = await normalizeNodeRuntimeValues(db, {
      mapId: 'feat',
      values: input
    })
    const normalizedBody = featAuthoredDtoSchema.parse(normalized.values)
    const result = await service.execute(normalizeActivatedAuthoringInput(normalizedBody as FeatAuthored, userId))
    await discardAuthoredDraft(db, 'FEAT', normalizedBody.id, userId)
    return normalizeAuthoringResult(db, 'feats', result as { authored: FeatAuthored }, userId)
  }
)
