import {
  handleRequest,
  handleAuthoringRequest,
  createFeatSubjectAuthoringService,
  normalizeNodeRuntimeValues
} from '@artificer-toolkit/functions'
import { getFeatListQuery } from '@artificer-toolkit/db'
import { createFeatRepository } from '@artificer-toolkit/db'
import type { FeatAuthored } from '@artificer-toolkit/shared'
import { featAuthoredDtoSchema, type FeatAuthoredDto } from '@artificer-toolkit/schema'
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
export const getFeatList = handleRequest(
  async (db, userId) => normalizeAuthoredListResponse(await getFeatListQuery(db), userId),
  (_req: Request, userId: string) => [userId] as [string]
)

// single
export const getFeat = handleRequest<[string, string], Awaited<ReturnType<typeof normalizeAuthoredDetailResponse<FeatAuthored>>>>(
  async (db, id, userId) => normalizeAuthoredDetailResponse(db, 'feats', await createFeatRepository(db).findById(id), userId),
  (req: Request, userId: string) => [extractId(req), userId] as [string, string]
)

// create/update
export const createFeat = handleAuthoringRequest(
  featAuthoredDtoSchema,
  async (db, body: FeatAuthoredDto, userId) => {
    const service = createFeatSubjectAuthoringService(db)
    const input = featAuthoredDtoSchema.parse(body)
    const normalized = await normalizeNodeRuntimeValues(db, {
      mapId: 'feat',
      values: input
    })
    const normalizedBody = featAuthoredDtoSchema.parse(normalized.values)
    const result = await service.execute(normalizeAuthoringInput(normalizedBody as FeatAuthored, userId))
    return normalizeAuthoringResult(db, 'feats', result as { authored: FeatAuthored }, userId)
  }
)
