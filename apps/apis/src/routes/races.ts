import { handleRequest, handleAuthoringRequest, createRaceSubjectAuthoringService } from '@artificer-toolkit/functions'
import { getRaceListQuery } from '@artificer-toolkit/db'
import { createRaceRepository } from '@artificer-toolkit/db'
import type { RaceAuthored } from '@artificer-toolkit/shared'
import { raceAuthoredDtoSchema, type RaceAuthoredDto } from '@artificer-toolkit/schema'
import {
  normalizeAuthoredDetailResponse,
  normalizeAuthoredListResponse,
  normalizeAuthoringInput,
  normalizeAuthoringResult
} from './authoredContent.js'

function extractId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

// list
export const getRaceList = handleRequest(
  async (db, userId) => normalizeAuthoredListResponse(await getRaceListQuery(db), userId),
  (_req: Request, userId: string) => [userId] as [string]
)

// single
export const getRace = handleRequest<[string, string], Awaited<ReturnType<typeof normalizeAuthoredDetailResponse<RaceAuthored>>>>(
  async (db, id, userId) => normalizeAuthoredDetailResponse(db, 'races', await createRaceRepository(db).findById(id), userId),
  (req: Request, userId: string) => [extractId(req), userId] as [string, string]
)

// create/update
export const createRace = handleAuthoringRequest(
  raceAuthoredDtoSchema,
  async (db, body: RaceAuthoredDto, userId) => {
    const service = createRaceSubjectAuthoringService(db)
    const result = await service.execute(normalizeAuthoringInput(body as RaceAuthored, userId))
    return normalizeAuthoringResult(db, 'races', result as { authored: RaceAuthored }, userId)
  }
)
