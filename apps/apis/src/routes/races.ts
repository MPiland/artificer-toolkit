import {
  handleRequest,
  handleAuthoringRequest,
  createRaceSubjectAuthoringService,
  normalizeNodeRuntimeValues
} from '@artificer-toolkit/functions'
import { getRaceListQuery } from '@artificer-toolkit/db'
import { createRaceRepository } from '@artificer-toolkit/db'
import type { RaceAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  authoredDraftActivateRequestDtoSchema,
  authoredDraftSaveRequestDtoSchema
} from '@artificer-toolkit/schema/api/content'
import {
  raceAuthoredDtoSchema
} from '@artificer-toolkit/schema/subjects/race'
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

function parseRaceAuthored(input: unknown): RaceAuthored {
  return raceAuthoredDtoSchema.parse(input) as RaceAuthored
}

// list
export const getRaceList = handleRequest(
  async (db, userId) => normalizeAuthoredListResponseWithDrafts(db, await getRaceListQuery(db), userId, 'RACE'),
  (_req: Request, userId: string) => [userId] as [string]
)

// single
export const getRace = handleRequest<[string, string], Awaited<ReturnType<typeof normalizeAuthoredDetailResponse<RaceAuthored>>>>(
  async (db, id, userId) => normalizeAuthoredDetailResponse(db, 'races', await createRaceRepository(db).findById(id), userId),
  (req: Request, userId: string) => [extractId(req), userId] as [string, string]
)

export const getRaceDraft = handleRequest(
  async (db, id, userId) => getAuthoredDraft(db, 'RACE', id, userId),
  (req: Request, userId: string) => [extractDraftSubjectIdFromRequest(req), userId] as [string, string]
)

export const saveRaceDraft = handleAuthoringRequest(
  authoredDraftSaveRequestDtoSchema,
  async (db, body, userId) => saveAuthoredDraft(db, {
    ...body,
    subjectKind: 'RACE'
  }, userId)
)

export const discardRaceDraft = handleRequest(
  async (db, id, userId) => {
    await discardAuthoredDraft(db, 'RACE', id, userId)
    return { ok: true }
  },
  (req: Request, userId: string) => [extractDraftSubjectIdFromRequest(req), userId] as [string, string]
)

export const activateRaceDraft = handleAuthoringRequest(
  authoredDraftActivateRequestDtoSchema,
  async (db, body, userId, req) => {
    const subjectId = resolveDraftActivationSubjectId('RACE', body.subjectId, req)
    const draft = await requireAuthoredDraft(db, 'RACE', subjectId, userId)
    const service = createRaceSubjectAuthoringService(db)
    const input = parseRaceAuthored(normalizeStoredDraftPayloadForActivation(draft, userId))
    const normalized = await normalizeNodeRuntimeValues(db, {
      mapId: 'race',
      values: { ...input }
    })
    const normalizedBody = parseRaceAuthored(normalized.values)
    const result = await service.execute(normalizeActivatedAuthoringInput(normalizedBody, userId))
    await discardAuthoredDraft(db, 'RACE', subjectId, userId)
    return normalizeAuthoringResult(db, 'races', result as { authored: RaceAuthored }, userId)
  }
)

// create/update
export const createRace = handleAuthoringRequest(
  raceAuthoredDtoSchema,
  async (db, body, userId) => {
    const service = createRaceSubjectAuthoringService(db)
    const input = parseRaceAuthored(body)
    const normalized = await normalizeNodeRuntimeValues(db, {
      mapId: 'race',
      values: { ...input }
    })
    const normalizedBody = parseRaceAuthored(normalized.values)
    const result = await service.execute(normalizeActivatedAuthoringInput(normalizedBody, userId))
    await discardAuthoredDraft(db, 'RACE', normalizedBody.id, userId)
    return normalizeAuthoringResult(db, 'races', result as { authored: RaceAuthored }, userId)
  }
)
