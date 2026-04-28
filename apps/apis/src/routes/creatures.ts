import { handleRequest, handleAuthoringRequest, createCreatureSubjectAuthoringService } from '@artificer-toolkit/functions'
import { getCreatureListQuery, createCreatureRepository } from '@artificer-toolkit/db'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { creatureAuthoredDtoSchema, type CreatureAuthoredDto } from '@artificer-toolkit/schema'
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

export const getCreatureList = handleRequest(
  async (db, userId) => normalizeAuthoredListResponse(await getCreatureListQuery(db), userId),
  (_req: Request, userId: string) => [userId] as [string]
)

export const getCreature = handleRequest<[string, string], Awaited<ReturnType<typeof normalizeAuthoredDetailResponse<CreatureAuthored>>>>(
  async (db, id, userId) => normalizeAuthoredDetailResponse(db, 'creatures', await createCreatureRepository(db).findById(id), userId),
  (req: Request, userId: string) => [extractId(req), userId] as [string, string]
)

export const createCreature = handleAuthoringRequest(async (db, body: CreatureAuthoredDto, userId) => {
  const service = createCreatureSubjectAuthoringService(db)
  const result = await service.execute(normalizeAuthoringInput(body, userId))
  return normalizeAuthoringResult(db, 'creatures', result, userId)
}, (raw) => creatureAuthoredDtoSchema.parse(raw) as CreatureAuthoredDto)
