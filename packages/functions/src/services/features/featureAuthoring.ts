import type { DBLike } from '@artificer-toolkit/db'
import { createFeatureRepository, upsertFeature } from '@artificer-toolkit/db'
import { featureDtoSchema } from '@artificer-toolkit/schema'
import type { CompiledFeature, FeatureAuthored, NodeSubjectCode } from '@artificer-toolkit/shared'
import { compileFeature } from '@artificer-toolkit/shared'
import type { RepositoryFindAllOptions } from '@artificer-toolkit/db'
import { createFeatureAuthoringService } from './pipeline.js'

export interface FeatureAuthoringInput {
  feature: unknown
  systemId: string
}

export interface ValidatedFeatureAuthoringInput {
  feature: FeatureAuthored<NodeSubjectCode>
  systemId: string
}

export interface FeatureAuthoringDeps {
  validate?: (input: FeatureAuthoringInput) => ValidatedFeatureAuthoringInput
  compile?: (validated: ValidatedFeatureAuthoringInput) => CompiledFeature
  persist?: (payload: { authored: ValidatedFeatureAuthoringInput, compiled: CompiledFeature }) => Promise<void>
  findById?: (id: string) => Promise<FeatureAuthored<NodeSubjectCode> | null>
  findAll?: (filter?: RepositoryFindAllOptions) => Promise<FeatureAuthored<NodeSubjectCode>[]>
}

export function createFeatureAuthoringUseCaseService(
  db: DBLike,
  deps: FeatureAuthoringDeps = {}
) {
  const repo = createFeatureRepository(db)

  const pipeline = createFeatureAuthoringService<FeatureAuthoringInput, ValidatedFeatureAuthoringInput, CompiledFeature, void>({
    validate: deps.validate ?? ((input) => ({
      feature: featureDtoSchema.parse(input.feature) as FeatureAuthored<NodeSubjectCode>,
      systemId: input.systemId
    })),
    compile: deps.compile ?? ((validated) => compileFeature(validated.feature)),
    persist: deps.persist ?? (async ({ authored }) => {
      await upsertFeature(db, authored.feature, authored.systemId)
    }),
    // Read path uses ValidatedFeatureAuthoringInput as TAuthored — provide no-op stubs
    // Real reads are exposed directly below, bypassing the write-pipeline's TAuthored constraint
    findById: (_id) => Promise.resolve(null),
    findAll: (_filter) => Promise.resolve([])
  })

  const _findById = deps.findById ?? ((id) => repo.findById(id))
  const _findAll = deps.findAll ?? ((filter) => repo.findAll(filter))

  return {
    execute: pipeline.execute.bind(pipeline),
    findById: _findById,
    findAll: _findAll
  }
}
