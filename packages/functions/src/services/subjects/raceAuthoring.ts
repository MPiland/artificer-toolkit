import { createAuthoredVersionRepository, type DBLike } from '@artificer-toolkit/db'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { RACE_CATEGORY_CODE } from '@artificer-toolkit/shared/subjects/core'
import type { RaceAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  compileRace,
  resolveRaceAuthored,
  type CompiledRace
} from '@artificer-toolkit/shared/subjects/compilers'
import { createSubjectAuthoringService } from './pipeline.js'

export interface RaceSubjectAuthoringDeps {
  validate?: (input: unknown) => RaceAuthored
  compile?: (authored: RaceAuthored) => Promise<CompiledRace> | CompiledRace
}

export function createRaceSubjectAuthoringService(db: DBLike, deps: RaceSubjectAuthoringDeps = {}) {
  async function compileResolvedRace(authored: RaceAuthored): Promise<CompiledRace> {
    if (authored.category === RACE_CATEGORY_CODE.BASE) {
      return compileRace(resolveRaceAuthored(authored, () => null))
    }

    const cache = new Map<string, RaceAuthored>([[authored.id, authored]])

    const loadParent = async (id: string): Promise<RaceAuthored | null> => {
      if (cache.has(id)) {
        return cache.get(id) ?? null
      }

      const parent = await createAuthoredVersionRepository(db).findActive({
        subjectKind: 'RACE',
        subjectId: id
      })
      if (!parent) return null
      const parentRace = raceAuthoredDtoSchema.parse(parent.authored.document) as unknown as RaceAuthored
      if (parentRace.systemId !== authored.systemId) return null
      cache.set(id, parentRace)
      return parentRace
    }

    const parent = await loadParent(authored.parentRaceId)

    if (!parent) {
      throw new Error(
        `Subrace "${authored.id}" is missing parent race "${authored.parentRaceId}" during compilation.`
      )
    }

    return compileRace(resolveRaceAuthored(authored, (parentId) => cache.get(parentId) ?? null))
  }

  return createSubjectAuthoringService<unknown, RaceAuthored, CompiledRace>({
    validate: deps.validate ?? ((input) => raceAuthoredDtoSchema.parse(input) as RaceAuthored),
    compile: deps.compile ?? compileResolvedRace
  })
}
