import type { DBLike } from '@artificer-toolkit/db'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import type { BackgroundAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  compileBackground,
  type CompiledBackground
} from '@artificer-toolkit/shared/subjects/compilers'
import { createSubjectAuthoringService } from './pipeline.js'

export interface BackgroundSubjectAuthoringDeps {
  validate?: (input: unknown) => BackgroundAuthored
  compile?: (authored: BackgroundAuthored) => CompiledBackground
}

export function createBackgroundSubjectAuthoringService(
  db: DBLike,
  deps: BackgroundSubjectAuthoringDeps = {}
) {
  return createSubjectAuthoringService<unknown, BackgroundAuthored, CompiledBackground>({
    validate:
      deps.validate ?? ((input) => backgroundAuthoredDtoSchema.parse(input) as BackgroundAuthored),
    compile: deps.compile ?? compileBackground
  })
}
