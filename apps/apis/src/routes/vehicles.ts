import { handleRequest, handleAuthoringRequest, createVehicleSubjectAuthoringService } from '@artificer-toolkit/functions'
import { getVehicleListQuery, createVehicleRepository } from '@artificer-toolkit/db'
import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema'

function extractId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

export const getVehicleList = handleRequest(getVehicleListQuery, () => [] as [])

export const getVehicle = handleRequest<[string], VehicleAuthored | null>((db, id) => createVehicleRepository(db).findById(id), (req: Request, _userId: string) => [extractId(req)] as [string])

export const createVehicle = handleAuthoringRequest(vehicleAuthoredDtoSchema, async (db, body) => {
  const service = createVehicleSubjectAuthoringService(db)
  return service.execute(body)
})
