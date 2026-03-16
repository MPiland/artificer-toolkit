import type { RepositoryFindAllOptions } from '@artificer-toolkit/db'

export interface FeatureAuthoringPipelineDeps<TInput, TAuthored, TCompiled, TPersisted> {
  validate: (input: TInput) => TAuthored
  compile: (authored: TAuthored) => TCompiled
  persist: (payload: { authored: TAuthored, compiled: TCompiled }) => Promise<TPersisted> | TPersisted
  findById: (id: string) => Promise<TAuthored | null>
  findAll: (filter?: RepositoryFindAllOptions) => Promise<TAuthored[]>
}

export interface FeatureAuthoringPipelineResult<TAuthored, TCompiled, TPersisted> {
  authored: TAuthored
  compiled: TCompiled
  persisted: TPersisted
}

export function createFeatureAuthoringService<TInput, TAuthored, TCompiled, TPersisted>(
  deps: FeatureAuthoringPipelineDeps<TInput, TAuthored, TCompiled, TPersisted>
) {
  return {
    async execute(input: TInput): Promise<FeatureAuthoringPipelineResult<TAuthored, TCompiled, TPersisted>> {
      const authored = deps.validate(input)
      const compiled = deps.compile(authored)
      const persisted = await deps.persist({ authored, compiled })

      return {
        authored,
        compiled,
        persisted
      }
    },

    findById(id: string): Promise<TAuthored | null> {
      return deps.findById(id)
    },

    findAll(filter?: RepositoryFindAllOptions): Promise<TAuthored[]> {
      return deps.findAll(filter)
    }
  }
}
