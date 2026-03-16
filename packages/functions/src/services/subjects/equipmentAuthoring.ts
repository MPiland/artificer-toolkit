import type { DBLike, RepositoryFindAllOptions } from '@artificer-toolkit/db'
import { createEquipmentRepository, upsertEquipment } from '@artificer-toolkit/db'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema'
import type { CompiledEquipment, CompiledEquipmentVariant, EquipmentAuthored, EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { compileEquipment } from '@artificer-toolkit/shared'
import { createSubjectAuthoringService } from './pipeline.js'

type AnyEquipmentAuthored = EquipmentAuthored | EquipmentVariantAuthored
type AnyCompiledEquipment = CompiledEquipment | CompiledEquipmentVariant

export interface EquipmentSubjectAuthoringDeps {
  validate?: (input: unknown) => AnyEquipmentAuthored
  compile?: (authored: AnyEquipmentAuthored) => AnyCompiledEquipment
  persist?: (payload: { authored: AnyEquipmentAuthored, compiled: AnyCompiledEquipment }) => Promise<void>
  findById?: (id: string) => Promise<AnyEquipmentAuthored | null>
  findAll?: (filter?: RepositoryFindAllOptions) => Promise<AnyEquipmentAuthored[]>
}

export function createEquipmentSubjectAuthoringService(
  db: DBLike,
  deps: EquipmentSubjectAuthoringDeps = {}
) {
  const repo = createEquipmentRepository(db)

  return createSubjectAuthoringService<unknown, AnyEquipmentAuthored, AnyCompiledEquipment, void>({
    validate: deps.validate ?? ((input) => equipmentAuthoredDtoSchema.parse(input) as AnyEquipmentAuthored),
    compile: deps.compile ?? compileEquipment,
    persist: deps.persist ?? (async ({ authored }) => {
      await upsertEquipment(db, authored, authored.systemId)
    }),
    findById: deps.findById ?? ((id) => repo.findById(id)),
    findAll: deps.findAll ?? ((filter) => repo.findAll(filter))
  })
}
