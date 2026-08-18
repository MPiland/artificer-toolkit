export interface SubjectAuthoringPipelineDeps<TInput, TAuthored, TCompiled> {
  validate: (input: TInput) => TAuthored
  compile: (authored: TAuthored) => Promise<TCompiled> | TCompiled
}

export interface PreparedSubjectAuthoring<TAuthored, TCompiled> {
  authored: TAuthored
  compiled: TCompiled
}

export function createSubjectAuthoringService<TInput, TAuthored, TCompiled>(
  deps: SubjectAuthoringPipelineDeps<TInput, TAuthored, TCompiled>
) {
  async function prepare(input: TInput): Promise<PreparedSubjectAuthoring<TAuthored, TCompiled>> {
    const authored = deps.validate(input)
    const compiled = await deps.compile(authored)
    return { authored, compiled }
  }

  return { prepare }
}
