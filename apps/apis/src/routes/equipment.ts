import { handleRequest, handleAuthoringRequest, createEquipmentSubjectAuthoringService } from '@artificer-toolkit/functions'
import { getEquipmentListQuery } from '@artificer-toolkit/db'
import { createEquipmentRepository } from '@artificer-toolkit/db'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema'

function extractId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

// list
export const getEquipmentList = handleRequest(getEquipmentListQuery, () => [] as [])

// single
export const getEquipment = handleRequest(
  (db, id: string) => createEquipmentRepository(db).findById(id),
  (req: Request, _userId: string) => [extractId(req)] as [string]
)

// create/update
export const createEquipment = handleAuthoringRequest(
  equipmentAuthoredDtoSchema,
  async (db, body) => {
    const service = createEquipmentSubjectAuthoringService(db)
    return service.execute(body)
  }
)
