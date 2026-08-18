import type { DBLike } from '@artificer-toolkit/db'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import type { VehicleAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileVehicle, type CompiledVehicle } from '@artificer-toolkit/shared/subjects/compilers'
import { createSubjectAuthoringService } from './pipeline.js'

export interface VehicleSubjectAuthoringDeps {
  validate?: (input: unknown) => VehicleAuthored
  compile?: (authored: VehicleAuthored) => CompiledVehicle
}

export function createVehicleSubjectAuthoringService(
  db: DBLike,
  deps: VehicleSubjectAuthoringDeps = {}
) {
  return createSubjectAuthoringService<unknown, VehicleAuthored, CompiledVehicle>({
    validate:
      deps.validate ?? ((input) => vehicleAuthoredDtoSchema.parse(input) as VehicleAuthored),
    compile: deps.compile ?? compileVehicle
  })
}
