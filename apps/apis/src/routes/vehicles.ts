import { handleRequest, handleAuthoringRequest, createVehicleSubjectAuthoringService } from '@artificer-toolkit/functions'
import { getVehicleListQuery, createVehicleRepository } from '@artificer-toolkit/db'
import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { vehicleAuthoredDtoSchema, type VehicleAuthoredDto } from '@artificer-toolkit/schema'
import {
  normalizeAuthoredDetailResponse,
  normalizeAuthoredListResponse,
  normalizeAuthoringInput,
  normalizeAuthoringResult
} from './authoredContent.js'

function extractId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

export const getVehicleList = handleRequest(
  async (db, userId) => normalizeAuthoredListResponse(await getVehicleListQuery(db), userId),
  (_req: Request, userId: string) => [userId] as [string]
)

export const getVehicle = handleRequest<[string, string], Awaited<ReturnType<typeof normalizeAuthoredDetailResponse<VehicleAuthored>>>>(
  async (db, id, userId) => normalizeAuthoredDetailResponse(db, 'vehicles', await createVehicleRepository(db).findById(id), userId),
  (req: Request, userId: string) => [extractId(req), userId] as [string, string]
)

export const createVehicle = handleAuthoringRequest(async (db, body: VehicleAuthoredDto, userId) => {
  const service = createVehicleSubjectAuthoringService(db)
  const result = await service.execute(normalizeAuthoringInput(body, userId))
  return normalizeAuthoringResult(db, 'vehicles', result, userId)
}, (raw) => vehicleAuthoredDtoSchema.parse(raw) as VehicleAuthoredDto)
