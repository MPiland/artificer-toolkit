import {
  handleRequest,
  handleAuthoringRequest,
  createEquipmentSubjectAuthoringService,
  normalizeNodeRuntimeValues
} from '@artificer-toolkit/functions'
import { getEquipmentListQuery } from '@artificer-toolkit/db'
import { createEquipmentRepository } from '@artificer-toolkit/db'
import {
  authoredDraftActivateRequestDtoSchema,
  authoredDraftSaveRequestDtoSchema
} from '@artificer-toolkit/schema/api/content'
import {
  equipmentAuthoringInputDtoSchema,
  equipmentAuthoredDtoSchema,
  type EquipmentAuthoringInputDto
} from '@artificer-toolkit/schema/subjects/equipment'
import type { EquipmentAuthored, EquipmentVariantAuthored } from '@artificer-toolkit/shared/subjects/authored'
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
export const getEquipmentList = handleRequest(async (db, userId) => normalizeAuthoredListResponseWithDrafts(db, await getEquipmentListQuery(db), userId, 'EQUIPMENT'), (_req: Request, userId: string) => [userId] as [string])

// single
export const getEquipment = handleRequest<[string, string], Awaited<ReturnType<typeof normalizeAuthoredDetailResponse<EquipmentAuthored | EquipmentVariantAuthored>>>>(async (db, id, userId) => normalizeAuthoredDetailResponse(db, 'equipment', await createEquipmentRepository(db).findById(id), userId), (req: Request, userId: string) => [extractId(req), userId] as [string, string])

export const getEquipmentDraft = handleRequest(async (db, id, userId) => getAuthoredDraft(db, 'EQUIPMENT', id, userId), (req: Request, userId: string) => [extractDraftSubjectIdFromRequest(req), userId] as [string, string])

export const saveEquipmentDraft = handleAuthoringRequest(authoredDraftSaveRequestDtoSchema, async (db, body, userId) => {
  const draftBody = {
    ...body,
    subjectKind: 'EQUIPMENT' as const
  }
  return saveAuthoredDraft(db, draftBody, userId)
})

export const discardEquipmentDraft = handleRequest(async (db, id, userId) => {
  await discardAuthoredDraft(db, 'EQUIPMENT', id, userId)
  return { ok: true }
}, (req: Request, userId: string) => [extractDraftSubjectIdFromRequest(req), userId] as [string, string])

export const activateEquipmentDraft = handleAuthoringRequest(authoredDraftActivateRequestDtoSchema, async (db, body, userId, req) => {
  const subjectId = resolveDraftActivationSubjectId('EQUIPMENT', body.subjectId, req)
  const draft = await requireAuthoredDraft(db, 'EQUIPMENT', subjectId, userId)
  const service = createEquipmentSubjectAuthoringService(db)
  const input = equipmentAuthoredDtoSchema.parse(normalizeStoredDraftPayloadForActivation(draft, userId))
  const normalized = await normalizeNodeRuntimeValues(db, {
    mapId: 'equipment',
    values: { ...input }
  })
  const normalizedBody = equipmentAuthoredDtoSchema.parse(normalized.values)
  const result = await service.execute(normalizeActivatedAuthoringInput(normalizedBody, userId))
  await discardAuthoredDraft(db, 'EQUIPMENT', subjectId, userId)
  return normalizeAuthoringResult(db, 'equipment', result, userId)
})

// create/update
export const createEquipment = handleAuthoringRequest(equipmentAuthoringInputDtoSchema, async (db, body: EquipmentAuthoringInputDto, userId) => {
  const service = createEquipmentSubjectAuthoringService(db)
  const input = equipmentAuthoredDtoSchema.parse({
    ...body,
    userId
  })
  const normalized = await normalizeNodeRuntimeValues(db, {
    mapId: 'equipment',
    values: { ...input }
  })
  const normalizedBody = equipmentAuthoredDtoSchema.parse(normalized.values)
  const result = await service.execute(normalizeActivatedAuthoringInput(normalizedBody, userId))
  await discardAuthoredDraft(db, 'EQUIPMENT', normalizedBody.id, userId)
  return normalizeAuthoringResult(db, 'equipment', result, userId)
})
