export interface SubjectAuthoringPipelineDeps<TInput, TAuthored, TCompiled, TPersisted> {
  validate: (input: TInput) => TAuthored
  compile: (authored: TAuthored) => TCompiled
  persist: (payload: { authored: TAuthored, compiled: TCompiled }) => Promise<TPersisted> | TPersisted
}

export interface SubjectAuthoringPipelineResult<TAuthored, TCompiled, TPersisted> {
  authored: TAuthored
  compiled: TCompiled
  persisted: TPersisted
}

export function createSubjectAuthoringService<TInput, TAuthored, TCompiled, TPersisted>(
  deps: SubjectAuthoringPipelineDeps<TInput, TAuthored, TCompiled, TPersisted>
) {
  return {
    async execute(input: TInput): Promise<SubjectAuthoringPipelineResult<TAuthored, TCompiled, TPersisted>> {
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
