import type { DBLike, RepositoryFindAllOptions } from '@artificer-toolkit/db'
import { createBackgroundRepository, upsertBackground } from '@artificer-toolkit/db'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import type { BackgroundAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileBackground, type CompiledBackground } from '@artificer-toolkit/shared/subjects/compilers'
import { createSubjectAuthoringService } from './pipeline.js'

export interface BackgroundSubjectAuthoringDeps {
  validate?: (input: unknown) => BackgroundAuthored
  compile?: (authored: BackgroundAuthored) => CompiledBackground
  persist?: (payload: { authored: BackgroundAuthored, compiled: CompiledBackground }) => Promise<void>
  findById?: (id: string) => Promise<BackgroundAuthored | null>
  findAll?: (filter?: RepositoryFindAllOptions) => Promise<BackgroundAuthored[]>
}

export function createBackgroundSubjectAuthoringService(
  db: DBLike,
  deps: BackgroundSubjectAuthoringDeps = {}
) {
  const repo = createBackgroundRepository(db)

  return createSubjectAuthoringService<unknown, BackgroundAuthored, CompiledBackground, void>({
    validate: deps.validate ?? ((input) => backgroundAuthoredDtoSchema.parse(input) as BackgroundAuthored),
    compile: deps.compile ?? compileBackground,
    persist: deps.persist ?? (async ({ authored }) => {
      await upsertBackground(db, authored, authored.systemId)
    }),
    findById: deps.findById ?? ((id) => repo.findById(id)),
    findAll: deps.findAll ?? ((filter) => repo.findAll(filter))
  })
}
