import type { DBLike, RepositoryFindAllOptions } from '@artificer-toolkit/db'
import { createClassRepository, upsertClass } from '@artificer-toolkit/db'
import { classAuthoredDtoSchema } from '@artificer-toolkit/schema'
import type { ClassAuthored, CompiledClass } from '@artificer-toolkit/shared'
import { compileClass } from '@artificer-toolkit/shared'
import { createSubjectAuthoringService } from './pipeline.js'

export interface ClassSubjectAuthoringDeps {
  validate?: (input: unknown) => ClassAuthored
  compile?: (authored: ClassAuthored) => CompiledClass
  persist?: (payload: { authored: ClassAuthored, compiled: CompiledClass }) => Promise<void>
  findById?: (id: string) => Promise<ClassAuthored | null>
  findAll?: (filter?: RepositoryFindAllOptions) => Promise<ClassAuthored[]>
}

export function createClassSubjectAuthoringService(
  db: DBLike,
  deps: ClassSubjectAuthoringDeps = {}
) {
  const repo = createClassRepository(db)

  return createSubjectAuthoringService<unknown, ClassAuthored, CompiledClass, void>({
    validate: deps.validate ?? ((input) => classAuthoredDtoSchema.parse(input) as ClassAuthored),
    compile: deps.compile ?? compileClass,
    persist: deps.persist ?? (async ({ authored }) => {
      await upsertClass(db, authored, authored.systemId)
    }),
    findById: deps.findById ?? ((id) => repo.findById(id)),
    findAll: deps.findAll ?? ((filter) => repo.findAll(filter))
  })
}
