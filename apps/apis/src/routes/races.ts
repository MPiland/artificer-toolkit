import { handleRequest, handleAuthoringRequest, createRaceSubjectAuthoringService } from '@artificer-toolkit/functions'
import { getRaceListQuery } from '@artificer-toolkit/db'
import { createRaceRepository } from '@artificer-toolkit/db'
import type { RaceAuthored } from '@artificer-toolkit/shared'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema'

function extractId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

// list
export const getRaceList = handleRequest(getRaceListQuery, () => [] as [])

// single
export const getRace = handleRequest<[string], RaceAuthored | null>(
  (db, id) => createRaceRepository(db).findById(id),
  (req: Request, _userId: string) => [extractId(req)] as [string]
)

// create/update
export const createRace = handleAuthoringRequest(
  raceAuthoredDtoSchema,
  async (db, body) => {
    const service = createRaceSubjectAuthoringService(db)
    return service.execute(body)
  }
)
