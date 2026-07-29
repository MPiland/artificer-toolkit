import type { DBLike, RepositoryFindAllOptions } from '@artificer-toolkit/db'
import { createSpellRepository, upsertSpell } from '@artificer-toolkit/db'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileSpell, type CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { createSubjectAuthoringService } from './pipeline.js'

export interface SpellSubjectAuthoringDeps {
  validate?: (input: unknown) => SpellAuthored
  compile?: (authored: SpellAuthored) => CompiledSpell
  persist?: (payload: { authored: SpellAuthored; compiled: CompiledSpell }) => Promise<void>
  findById?: (id: string) => Promise<SpellAuthored | null>
  findAll?: (filter?: RepositoryFindAllOptions) => Promise<SpellAuthored[]>
}

export function createSpellSubjectAuthoringService(
  db: DBLike,
  deps: SpellSubjectAuthoringDeps = {}
) {
  const repo = createSpellRepository(db)

  return createSubjectAuthoringService<unknown, SpellAuthored, CompiledSpell, void>({
    validate: deps.validate ?? ((input) => spellAuthoredDtoSchema.parse(input) as SpellAuthored),
    compile: deps.compile ?? compileSpell,
    persist:
      deps.persist ??
      (async ({ authored }) => {
        await upsertSpell(db, authored, authored.systemId)
      }),
    findById: deps.findById ?? ((id) => repo.findById(id)),
    findAll: deps.findAll ?? ((filter) => repo.findAll(filter))
  })
}
