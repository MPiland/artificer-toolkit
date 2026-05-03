import {
  handleRequest,
  handleAuthoringRequest,
  createVehicleSubjectAuthoringService,
  normalizeNodeRuntimeValues
} from '@artificer-toolkit/functions'
import { getVehicleListQuery, createVehicleRepository } from '@artificer-toolkit/db'
import type { VehicleAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  authoredDraftActivateRequestDtoSchema,
  authoredDraftSaveRequestDtoSchema
} from '@artificer-toolkit/schema/api/content'
import {
  vehicleAuthoringInputDtoSchema,
  vehicleAuthoredDtoSchema,
  type VehicleAuthoringInputDto
} from '@artificer-toolkit/schema/subjects/vehicle'
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

function parseVehicleAuthored(input: unknown): VehicleAuthored {
  return vehicleAuthoredDtoSchema.parse(input) as VehicleAuthored
}

export const getVehicleList = handleRequest(async (db, userId) => normalizeAuthoredListResponseWithDrafts(db, await getVehicleListQuery(db), userId, 'VEHICLE'), (_req: Request, userId: string) => [userId] as [string])

export const getVehicle = handleRequest<[string, string], Awaited<ReturnType<typeof normalizeAuthoredDetailResponse<VehicleAuthored>>>>(async (db, id, userId) => normalizeAuthoredDetailResponse(db, 'vehicles', await createVehicleRepository(db).findById(id), userId), (req: Request, userId: string) => [extractId(req), userId] as [string, string])

export const getVehicleDraft = handleRequest(async (db, id, userId) => getAuthoredDraft(db, 'VEHICLE', id, userId), (req: Request, userId: string) => [extractDraftSubjectIdFromRequest(req), userId] as [string, string])

export const saveVehicleDraft = handleAuthoringRequest(authoredDraftSaveRequestDtoSchema, async (db, body, userId) => {
  await assertWritableAuthoredSubject(db, 'vehicles', 'VEHICLE', body.subjectId, userId)
  return saveAuthoredDraft(db, { ...body, subjectKind: 'VEHICLE' }, userId)
})

export const discardVehicleDraft = handleRequest(async (db, id, userId) => {
  await discardAuthoredDraft(db, 'VEHICLE', id, userId)
  return { ok: true }
}, (req: Request, userId: string) => [extractDraftSubjectIdFromRequest(req), userId] as [string, string])

export const activateVehicleDraft = handleAuthoringRequest(authoredDraftActivateRequestDtoSchema, async (db, body, userId, req) => {
  const subjectId = resolveDraftActivationSubjectId('VEHICLE', body.subjectId, req)
  const draft = await requireAuthoredDraft(db, 'VEHICLE', subjectId, userId)
  await assertWritableAuthoredSubject(db, 'vehicles', 'VEHICLE', subjectId, userId)
  const service = createVehicleSubjectAuthoringService(db)
  const input = parseVehicleAuthored(normalizeStoredDraftPayloadForActivation(draft, userId))
  const normalized = await normalizeNodeRuntimeValues(db, { mapId: 'vehicle', values: { ...input } })
  const normalizedBody = parseVehicleAuthored(normalized.values)
  const result = await service.execute(normalizeActivatedAuthoringInput(normalizedBody, userId))
  await discardAuthoredDraft(db, 'VEHICLE', subjectId, userId)
  return normalizeAuthoringResult(db, 'vehicles', result, userId)
})

export const createVehicle = handleAuthoringRequest(vehicleAuthoringInputDtoSchema, async (db, body: VehicleAuthoringInputDto, userId) => {
  await assertWritableAuthoredSubject(db, 'vehicles', 'VEHICLE', body.id, userId)
  const service = createVehicleSubjectAuthoringService(db)
  const input = parseVehicleAuthored({
    ...body,
    userId
  })
  const normalized = await normalizeNodeRuntimeValues(db, { mapId: 'vehicle', values: { ...input } })
  const normalizedBody = parseVehicleAuthored(normalized.values)
  const result = await service.execute(normalizeActivatedAuthoringInput(normalizedBody, userId))
  await discardAuthoredDraft(db, 'VEHICLE', normalizedBody.id, userId)
  return normalizeAuthoringResult(db, 'vehicles', result, userId)
})
