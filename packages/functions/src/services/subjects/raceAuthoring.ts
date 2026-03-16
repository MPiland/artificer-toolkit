import type { DBLike, RepositoryFindAllOptions } from '@artificer-toolkit/db'
import { createRaceRepository, upsertRace } from '@artificer-toolkit/db'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema'
import type { CompiledRace, RaceAuthored } from '@artificer-toolkit/shared'
import { compileRace } from '@artificer-toolkit/shared'
import { createSubjectAuthoringService } from './pipeline.js'

export interface RaceSubjectAuthoringDeps {
  validate?: (input: unknown) => RaceAuthored
  compile?: (authored: RaceAuthored) => CompiledRace
  persist?: (payload: { authored: RaceAuthored, compiled: CompiledRace }) => Promise<void>
  findById?: (id: string) => Promise<RaceAuthored | null>
  findAll?: (filter?: RepositoryFindAllOptions) => Promise<RaceAuthored[]>
}

export function createRaceSubjectAuthoringService(
  db: DBLike,
  deps: RaceSubjectAuthoringDeps = {}
) {
  const repo = createRaceRepository(db)

  return createSubjectAuthoringService<unknown, RaceAuthored, CompiledRace, void>({
    validate: deps.validate ?? ((input) => raceAuthoredDtoSchema.parse(input) as RaceAuthored),
    compile: deps.compile ?? compileRace,
    persist: deps.persist ?? (async ({ authored }) => {
      await upsertRace(db, authored, authored.systemId)
    }),
    findById: deps.findById ?? ((id) => repo.findById(id)),
    findAll: deps.findAll ?? ((filter) => repo.findAll(filter))
  })
}
