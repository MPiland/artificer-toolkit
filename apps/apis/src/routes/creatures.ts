import {
  handleRequest,
  handleAuthoringRequest,
  createCreatureSubjectAuthoringService,
  normalizeNodeRuntimeValues
} from '@artificer-toolkit/functions'
import { getCreatureListQuery, createCreatureRepository } from '@artificer-toolkit/db'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import {
  authoredDraftActivateRequestDtoSchema,
  authoredDraftSaveRequestDtoSchema,
  creatureAuthoredDtoSchema,
  type CreatureAuthoredDto
} from '@artificer-toolkit/schema'
import {
  discardAuthoredDraft,
  extractDraftSubjectIdFromRequest,
  getAuthoredDraft,
  assertWritableAuthoredSubject,
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

export const getCreatureList = handleRequest(
  async (db, userId) => normalizeAuthoredListResponseWithDrafts(db, await getCreatureListQuery(db), userId, 'CREATURE'),
  (_req: Request, userId: string) => [userId] as [string]
)

export const getCreature = handleRequest<[string, string], Awaited<ReturnType<typeof normalizeAuthoredDetailResponse<CreatureAuthored>>>>(
  async (db, id, userId) => normalizeAuthoredDetailResponse(db, 'creatures', await createCreatureRepository(db).findById(id), userId),
  (req: Request, userId: string) => [extractId(req), userId] as [string, string]
)

export const getCreatureDraft = handleRequest(
  async (db, id, userId) => getAuthoredDraft(db, 'CREATURE', id, userId),
  (req: Request, userId: string) => [extractDraftSubjectIdFromRequest(req), userId] as [string, string]
)

export const saveCreatureDraft = handleAuthoringRequest(
  authoredDraftSaveRequestDtoSchema,
  async (db, body, userId) => saveAuthoredDraft(db, {
    ...body,
    subjectKind: 'CREATURE'
  }, userId)
)

export const discardCreatureDraft = handleRequest(
  async (db, id, userId) => {
    await discardAuthoredDraft(db, 'CREATURE', id, userId)
    return { ok: true }
  },
  (req: Request, userId: string) => [extractDraftSubjectIdFromRequest(req), userId] as [string, string]
)

export const activateCreatureDraft = handleAuthoringRequest(
  authoredDraftActivateRequestDtoSchema,
  async (db, body, userId, req) => {
    const subjectId = resolveDraftActivationSubjectId('CREATURE', body.subjectId, req)
    const draft = await requireAuthoredDraft(db, 'CREATURE', subjectId, userId)
    await assertWritableAuthoredSubject(db, 'creatures', 'CREATURE', subjectId, userId)
    const service = createCreatureSubjectAuthoringService(db)
    const input = creatureAuthoredDtoSchema.parse(normalizeStoredDraftPayloadForActivation(draft, userId))
    const normalized = await normalizeNodeRuntimeValues(db, {
      mapId: 'creature',
      values: { ...input }
    })
    const normalizedBody = creatureAuthoredDtoSchema.parse(normalized.values)
    const result = await service.execute(normalizeActivatedAuthoringInput(normalizedBody, userId))
    await discardAuthoredDraft(db, 'CREATURE', subjectId, userId)
    return normalizeAuthoringResult(db, 'creatures', result, userId)
  }
)

export const createCreature = handleAuthoringRequest(
  creatureAuthoredDtoSchema,
  async (db, body: CreatureAuthoredDto, userId) => {
    await assertWritableAuthoredSubject(db, 'creatures', 'CREATURE', body.id, userId)
    const service = createCreatureSubjectAuthoringService(db)
    const normalized = await normalizeNodeRuntimeValues(db, {
      mapId: 'creature',
      values: { ...body }
    })
    const normalizedBody = creatureAuthoredDtoSchema.parse(normalized.values)
    const result = await service.execute(normalizeActivatedAuthoringInput(normalizedBody, userId))
    await discardAuthoredDraft(db, 'CREATURE', normalizedBody.id, userId)
    return normalizeAuthoringResult(db, 'creatures', result, userId)
  }
)
