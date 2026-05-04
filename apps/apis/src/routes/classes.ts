import {
  handleRequest,
  handleAuthoringRequest,
  createClassSubjectAuthoringService,
  normalizeNodeRuntimeValues
} from '@artificer-toolkit/functions'
import { getClassListQuery, createClassRepository } from '@artificer-toolkit/db'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  authoredDraftActivateRequestDtoSchema,
  authoredDraftSaveRequestDtoSchema
} from '@artificer-toolkit/schema/api/content'
import {
  classAuthoringInputDtoSchema,
  classAuthoredDtoSchema,
  type ClassAuthoringInputDto
} from '@artificer-toolkit/schema/subjects/class'
import {
  assertWritableAuthoredSubject,
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

function parseClassAuthored(input: unknown): ClassAuthored {
  return classAuthoredDtoSchema.parse(input) as ClassAuthored
}

export const getClassList = handleRequest(async (db, userId) => normalizeAuthoredListResponseWithDrafts(db, await getClassListQuery(db), userId, 'CLASS'), (_req: Request, userId: string) => [userId] as [string])

export const getClass = handleRequest<[string, string], Awaited<ReturnType<typeof normalizeAuthoredDetailResponse<ClassAuthored>>>>(async (db, id, userId) => normalizeAuthoredDetailResponse(db, 'classes', await createClassRepository(db).findById(id), userId), (req: Request, userId: string) => [extractId(req), userId] as [string, string])

export const getClassDraft = handleRequest(async (db, id, userId) => getAuthoredDraft(db, 'CLASS', id, userId), (req: Request, userId: string) => [extractDraftSubjectIdFromRequest(req), userId] as [string, string])

export const saveClassDraft = handleAuthoringRequest(authoredDraftSaveRequestDtoSchema, async (db, body, userId) => {
  await assertWritableAuthoredSubject(db, 'classes', 'CLASS', body.subjectId, userId)
  return saveAuthoredDraft(db, { ...body, subjectKind: 'CLASS' }, userId)
})

export const discardClassDraft = handleRequest(async (db, id, userId) => {
  await discardAuthoredDraft(db, 'CLASS', id, userId)
  return { ok: true }
}, (req: Request, userId: string) => [extractDraftSubjectIdFromRequest(req), userId] as [string, string])

export const activateClassDraft = handleAuthoringRequest(authoredDraftActivateRequestDtoSchema, async (db, body, userId, req) => {
  const subjectId = resolveDraftActivationSubjectId('CLASS', body.subjectId, req)
  const draft = await requireAuthoredDraft(db, 'CLASS', subjectId, userId)
  await assertWritableAuthoredSubject(db, 'classes', 'CLASS', subjectId, userId)
  const service = createClassSubjectAuthoringService(db)
  const input = normalizeStoredDraftPayloadForActivation(draft, userId) as Record<string, unknown>
  const normalized = await normalizeNodeRuntimeValues(db, { mapId: 'class', values: input })
  const normalizedBody = parseClassAuthored(normalized.values)
  const result = await service.execute(normalizeActivatedAuthoringInput(normalizedBody, userId))
  await discardAuthoredDraft(db, 'CLASS', subjectId, userId)
  return normalizeAuthoringResult(db, 'classes', result, userId)
})

export const createClass = handleAuthoringRequest(classAuthoringInputDtoSchema, async (db, body: ClassAuthoringInputDto, userId) => {
  await assertWritableAuthoredSubject(db, 'classes', 'CLASS', body.id, userId)
  const service = createClassSubjectAuthoringService(db)
  const normalized = await normalizeNodeRuntimeValues(db, {
    mapId: 'class',
    values: {
      ...body,
      userId
    }
  })
  const normalizedBody = parseClassAuthored(normalized.values)
  const result = await service.execute(normalizeActivatedAuthoringInput(normalizedBody, userId))
  await discardAuthoredDraft(db, 'CLASS', normalizedBody.id, userId)
  return normalizeAuthoringResult(db, 'classes', result, userId)
})
