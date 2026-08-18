import type { DBLike } from '@artificer-toolkit/db'
import { featAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/feat'
import type { FeatAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileFeat, type CompiledFeat } from '@artificer-toolkit/shared/subjects/compilers'
import { createSubjectAuthoringService } from './pipeline.js'

export interface FeatSubjectAuthoringDeps {
  validate?: (input: unknown) => FeatAuthored
  compile?: (authored: FeatAuthored) => CompiledFeat
}

export function createFeatSubjectAuthoringService(db: DBLike, deps: FeatSubjectAuthoringDeps = {}) {
  return createSubjectAuthoringService<unknown, FeatAuthored, CompiledFeat>({
    validate: deps.validate ?? ((input) => featAuthoredDtoSchema.parse(input) as FeatAuthored),
    compile: deps.compile ?? compileFeat
  })
}
