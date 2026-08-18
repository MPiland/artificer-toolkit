import type { DBLike } from '@artificer-toolkit/db'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  compileCreature,
  type CompiledCreature
} from '@artificer-toolkit/shared/subjects/compilers'
import { createSubjectAuthoringService } from './pipeline.js'

export interface CreatureSubjectAuthoringDeps {
  validate?: (input: unknown) => CreatureAuthored
  compile?: (authored: CreatureAuthored) => CompiledCreature
}

export function createCreatureSubjectAuthoringService(
  db: DBLike,
  deps: CreatureSubjectAuthoringDeps = {}
) {
  return createSubjectAuthoringService<unknown, CreatureAuthored, CompiledCreature>({
    validate:
      deps.validate ?? ((input) => creatureAuthoredDtoSchema.parse(input) as CreatureAuthored),
    compile: deps.compile ?? compileCreature
  })
}
