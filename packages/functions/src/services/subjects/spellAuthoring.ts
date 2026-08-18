import type { DBLike } from '@artificer-toolkit/db'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileSpell, type CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { createSubjectAuthoringService } from './pipeline.js'

export interface SpellSubjectAuthoringDeps {
  validate?: (input: unknown) => SpellAuthored
  compile?: (authored: SpellAuthored) => CompiledSpell
}

export function createSpellSubjectAuthoringService(
  db: DBLike,
  deps: SpellSubjectAuthoringDeps = {}
) {
  return createSubjectAuthoringService<unknown, SpellAuthored, CompiledSpell>({
    validate: deps.validate ?? ((input) => spellAuthoredDtoSchema.parse(input) as SpellAuthored),
    compile: deps.compile ?? compileSpell
  })
}
