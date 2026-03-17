import { handleRequest, handleAuthoringRequest, createCreatureSubjectAuthoringService } from '@artificer-toolkit/functions'
import { getCreatureListQuery, createCreatureRepository } from '@artificer-toolkit/db'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema'

function extractId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

export const getCreatureList = handleRequest(getCreatureListQuery, () => [] as [])

export const getCreature = handleRequest<[string], CreatureAuthored | null>((db, id) => createCreatureRepository(db).findById(id), (req: Request, _userId: string) => [extractId(req)] as [string])

export const createCreature = handleAuthoringRequest(creatureAuthoredDtoSchema, async (db, body) => {
  const service = createCreatureSubjectAuthoringService(db)
  return service.execute(body)
})
