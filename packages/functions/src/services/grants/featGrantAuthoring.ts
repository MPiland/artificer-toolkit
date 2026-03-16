import type { DBLike } from '@artificer-toolkit/db'
import { createFeatGrantRepository, upsertFeatGrant } from '@artificer-toolkit/db'
import { featGrantDtoSchema } from '@artificer-toolkit/schema'
import type { CompiledFeatGrant, FeatGrantAuthored } from '@artificer-toolkit/shared'
import { compileFeatGrant } from '@artificer-toolkit/shared'
import type { RepositoryFindAllOptions } from '@artificer-toolkit/db'
import { createGrantAuthoringService } from './pipeline.js'

export interface FeatGrantAuthoringDeps {
  validate?: (input: unknown) => FeatGrantAuthored
  compile?: (authored: FeatGrantAuthored) => CompiledFeatGrant
  persist?: (payload: { authored: FeatGrantAuthored, compiled: CompiledFeatGrant }) => Promise<void>
  findById?: (id: string) => Promise<FeatGrantAuthored | null>
  findAll?: (filter?: RepositoryFindAllOptions) => Promise<FeatGrantAuthored[]>
}

export function createFeatGrantAuthoringService(
  db: DBLike,
  deps: FeatGrantAuthoringDeps = {}
) {
  const repo = createFeatGrantRepository(db)

  return createGrantAuthoringService<unknown, FeatGrantAuthored, CompiledFeatGrant, void>({
    validate: deps.validate ?? ((input) => featGrantDtoSchema.parse(input) as FeatGrantAuthored),
    compile: deps.compile ?? compileFeatGrant,
    persist: deps.persist ?? (async ({ authored }) => {
      await upsertFeatGrant(db, authored)
    }),
    findById: deps.findById ?? ((id) => repo.findById(id)),
    findAll: deps.findAll ?? ((filter) => repo.findAll(filter))
  })
}
