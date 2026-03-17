import type { DBLike, RepositoryFindAllOptions } from '@artificer-toolkit/db'
import { createCreatureRepository, upsertCreature } from '@artificer-toolkit/db'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema'
import type { CompiledCreature, CreatureAuthored } from '@artificer-toolkit/shared'
import { compileCreature } from '@artificer-toolkit/shared'
import { createSubjectAuthoringService } from './pipeline.js'

export interface CreatureSubjectAuthoringDeps {
  validate?: (input: unknown) => CreatureAuthored
  compile?: (authored: CreatureAuthored) => CompiledCreature
  persist?: (payload: { authored: CreatureAuthored, compiled: CompiledCreature }) => Promise<void>
  findById?: (id: string) => Promise<CreatureAuthored | null>
  findAll?: (filter?: RepositoryFindAllOptions) => Promise<CreatureAuthored[]>
}

export function createCreatureSubjectAuthoringService(
  db: DBLike,
  deps: CreatureSubjectAuthoringDeps = {}
) {
  const repo = createCreatureRepository(db)

  return createSubjectAuthoringService<unknown, CreatureAuthored, CompiledCreature, void>({
    validate: deps.validate ?? ((input) => creatureAuthoredDtoSchema.parse(input) as CreatureAuthored),
    compile: deps.compile ?? compileCreature,
    persist: deps.persist ?? (async ({ authored }) => {
      await upsertCreature(db, authored, authored.systemId)
    }),
    findById: deps.findById ?? ((id) => repo.findById(id)),
    findAll: deps.findAll ?? ((filter) => repo.findAll(filter))
  })
}
