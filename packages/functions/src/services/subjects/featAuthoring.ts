import type { DBLike } from '@artificer-toolkit/db'
import { createFeatRepository, upsertFeat } from '@artificer-toolkit/db'
import { featAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/feat'
import type { FeatAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileFeat, type CompiledFeat } from '@artificer-toolkit/shared/subjects/compilers'
import type { RepositoryFindAllOptions } from '@artificer-toolkit/db'
import { createSubjectAuthoringService } from './pipeline.js'

export interface FeatSubjectAuthoringDeps {
  validate?: (input: unknown) => FeatAuthored
  compile?: (authored: FeatAuthored) => CompiledFeat
  persist?: (payload: { authored: FeatAuthored; compiled: CompiledFeat }) => Promise<void>
  findById?: (id: string) => Promise<FeatAuthored | null>
  findAll?: (filter?: RepositoryFindAllOptions) => Promise<FeatAuthored[]>
}

export function createFeatSubjectAuthoringService(db: DBLike, deps: FeatSubjectAuthoringDeps = {}) {
  const repo = createFeatRepository(db)

  return createSubjectAuthoringService<unknown, FeatAuthored, CompiledFeat, void>({
    validate: deps.validate ?? ((input) => featAuthoredDtoSchema.parse(input) as FeatAuthored),
    compile: deps.compile ?? compileFeat,
    persist:
      deps.persist ??
      (async ({ authored }) => {
        await upsertFeat(db, authored, authored.systemId)
      }),
    findById: deps.findById ?? ((id) => repo.findById(id)),
    findAll: deps.findAll ?? ((filter) => repo.findAll(filter))
  })
}
