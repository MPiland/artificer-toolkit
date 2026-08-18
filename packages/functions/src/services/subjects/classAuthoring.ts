import type { DBLike } from '@artificer-toolkit/db'
import { classAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileClass, type CompiledClass } from '@artificer-toolkit/shared/subjects/compilers'
import { createSubjectAuthoringService } from './pipeline.js'

export interface ClassSubjectAuthoringDeps {
  validate?: (input: unknown) => ClassAuthored
  compile?: (authored: ClassAuthored) => CompiledClass
}

export function createClassSubjectAuthoringService(
  db: DBLike,
  deps: ClassSubjectAuthoringDeps = {}
) {
  return createSubjectAuthoringService<unknown, ClassAuthored, CompiledClass>({
    validate: deps.validate ?? ((input) => classAuthoredDtoSchema.parse(input) as ClassAuthored),
    compile: deps.compile ?? compileClass
  })
}
