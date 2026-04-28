import { handleRequest, handleAuthoringRequest, createEquipmentSubjectAuthoringService } from '@artificer-toolkit/functions'
import { getEquipmentListQuery } from '@artificer-toolkit/db'
import { createEquipmentRepository } from '@artificer-toolkit/db'
import { equipmentAuthoredDtoSchema, type EquipmentAuthoredDto } from '@artificer-toolkit/schema'
import type { EquipmentAuthored, EquipmentVariantAuthored } from '@artificer-toolkit/shared'
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

// list
export const getEquipmentList = handleRequest(
  async (db, userId) => normalizeAuthoredListResponse(await getEquipmentListQuery(db), userId),
  (_req: Request, userId: string) => [userId] as [string]
)

// single
export const getEquipment = handleRequest<[string, string], Awaited<ReturnType<typeof normalizeAuthoredDetailResponse<EquipmentAuthored | EquipmentVariantAuthored>>>>(
  async (db, id, userId) => normalizeAuthoredDetailResponse(db, 'equipment', await createEquipmentRepository(db).findById(id), userId),
  (req: Request, userId: string) => [extractId(req), userId] as [string, string]
)

// create/update
export const createEquipment = handleAuthoringRequest(
  equipmentAuthoredDtoSchema,
  async (db, body: EquipmentAuthoredDto, userId) => {
    const service = createEquipmentSubjectAuthoringService(db)
    const result = await service.execute(normalizeAuthoringInput(body, userId))
    return normalizeAuthoringResult(db, 'equipment', result, userId)
  }
)
