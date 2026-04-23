import type { DBLike, RepositoryFindAllOptions } from '@artificer-toolkit/db'
import { createRaceRepository, upsertRace } from '@artificer-toolkit/db'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema'
import type { CompiledRace, RaceAuthored } from '@artificer-toolkit/shared'
import { compileRace, RACE_CATEGORY_CODE, resolveRaceAuthored } from '@artificer-toolkit/shared'
import { createSubjectAuthoringService } from './pipeline.js'

export interface RaceSubjectAuthoringDeps {
  validate?: (input: unknown) => RaceAuthored
  compile?: (authored: RaceAuthored) => Promise<CompiledRace> | CompiledRace
  persist?: (payload: { authored: RaceAuthored, compiled: CompiledRace }) => Promise<void>
  findById?: (id: string) => Promise<RaceAuthored | null>
  findAll?: (filter?: RepositoryFindAllOptions) => Promise<RaceAuthored[]>
}

export function createRaceSubjectAuthoringService(
  db: DBLike,
  deps: RaceSubjectAuthoringDeps = {}
) {
  const repo = createRaceRepository(db)

  async function compileResolvedRace(
    authored: RaceAuthored
  ): Promise<CompiledRace> {
    if (authored.category === RACE_CATEGORY_CODE.BASE) {
      return compileRace(resolveRaceAuthored(authored, () => null))
    }

    const cache = new Map<string, RaceAuthored>([[authored.id, authored]])

    const loadParent = async (id: string): Promise<RaceAuthored | null> => {
      if (cache.has(id)) {
        return cache.get(id) ?? null
      }

      const parent = await repo.findById(id)

      if (parent) {
        cache.set(id, parent)
      }

      return parent
    }

    const parent = await loadParent(authored.parentRaceId)

    if (!parent) {
      throw new Error(
        `Subrace "${authored.id}" is missing parent race "${authored.parentRaceId}" during compilation.`
      )
    }

    return compileRace(resolveRaceAuthored(
      authored,
      (parentId) => cache.get(parentId) ?? null
    ))
  }

  return createSubjectAuthoringService<unknown, RaceAuthored, CompiledRace, void>({
    validate: deps.validate ?? ((input) => raceAuthoredDtoSchema.parse(input) as RaceAuthored),
    compile: deps.compile ?? compileResolvedRace,
    persist: deps.persist ?? (async ({ authored }) => {
      await upsertRace(db, authored, authored.systemId)
    }),
    findById: deps.findById ?? ((id) => repo.findById(id)),
    findAll: deps.findAll ?? ((filter) => repo.findAll(filter))
  })
}
