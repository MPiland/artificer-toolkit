import type { DBLike, RepositoryFindAllOptions } from '@artificer-toolkit/db'
import { createVehicleRepository, upsertVehicle } from '@artificer-toolkit/db'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import type { VehicleAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileVehicle, type CompiledVehicle } from '@artificer-toolkit/shared/subjects/compilers'
import { createSubjectAuthoringService } from './pipeline.js'

export interface VehicleSubjectAuthoringDeps {
  validate?: (input: unknown) => VehicleAuthored
  compile?: (authored: VehicleAuthored) => CompiledVehicle
  persist?: (payload: { authored: VehicleAuthored, compiled: CompiledVehicle }) => Promise<void>
  findById?: (id: string) => Promise<VehicleAuthored | null>
  findAll?: (filter?: RepositoryFindAllOptions) => Promise<VehicleAuthored[]>
}

export function createVehicleSubjectAuthoringService(
  db: DBLike,
  deps: VehicleSubjectAuthoringDeps = {}
) {
  const repo = createVehicleRepository(db)

  return createSubjectAuthoringService<unknown, VehicleAuthored, CompiledVehicle, void>({
    validate: deps.validate ?? ((input) => vehicleAuthoredDtoSchema.parse(input) as VehicleAuthored),
    compile: deps.compile ?? compileVehicle,
    persist: deps.persist ?? (async ({ authored }) => {
      await upsertVehicle(db, authored, authored.systemId)
    }),
    findById: deps.findById ?? ((id) => repo.findById(id)),
    findAll: deps.findAll ?? ((filter) => repo.findAll(filter))
  })
}
