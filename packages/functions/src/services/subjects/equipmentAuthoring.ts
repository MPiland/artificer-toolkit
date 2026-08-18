import type { DBLike } from '@artificer-toolkit/db'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import type {
  EquipmentAuthored,
  EquipmentVariantAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import {
  compileEquipment,
  type CompiledEquipment,
  type CompiledEquipmentVariant
} from '@artificer-toolkit/shared/subjects/compilers'
import { createSubjectAuthoringService } from './pipeline.js'

type AnyEquipmentAuthored = EquipmentAuthored | EquipmentVariantAuthored
type AnyCompiledEquipment = CompiledEquipment | CompiledEquipmentVariant

export interface EquipmentSubjectAuthoringDeps {
  validate?: (input: unknown) => AnyEquipmentAuthored
  compile?: (authored: AnyEquipmentAuthored) => AnyCompiledEquipment
}

export function createEquipmentSubjectAuthoringService(
  db: DBLike,
  deps: EquipmentSubjectAuthoringDeps = {}
) {
  return createSubjectAuthoringService<unknown, AnyEquipmentAuthored, AnyCompiledEquipment>({
    validate:
      deps.validate ?? ((input) => equipmentAuthoredDtoSchema.parse(input) as AnyEquipmentAuthored),
    compile: deps.compile ?? compileEquipment
  })
}
