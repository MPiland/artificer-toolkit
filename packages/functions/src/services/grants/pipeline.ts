export interface GrantAuthoringPipelineDeps<TInput, TAuthored, TCompiled, TPersisted> {
  validate: (input: TInput) => TAuthored
  compile: (authored: TAuthored) => TCompiled
  persist: (payload: { authored: TAuthored, compiled: TCompiled }) => Promise<TPersisted> | TPersisted
}

export interface GrantAuthoringPipelineResult<TAuthored, TCompiled, TPersisted> {
  authored: TAuthored
  compiled: TCompiled
  persisted: TPersisted
}

export function createGrantAuthoringService<TInput, TAuthored, TCompiled, TPersisted>(
  deps: GrantAuthoringPipelineDeps<TInput, TAuthored, TCompiled, TPersisted>
) {
  return {
    async execute(input: TInput): Promise<GrantAuthoringPipelineResult<TAuthored, TCompiled, TPersisted>> {
      const authored = deps.validate(input)
      const compiled = deps.compile(authored)
      const persisted = await deps.persist({ authored, compiled })

      return {
        authored,
        compiled,
        persisted
      }
    }
  }
}
