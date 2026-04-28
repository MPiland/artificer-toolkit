import { handleRequest, handleAuthoringRequest, createBackgroundSubjectAuthoringService } from '@artificer-toolkit/functions'
import { getBackgroundListQuery } from '@artificer-toolkit/db'
import { createBackgroundRepository } from '@artificer-toolkit/db'
import type { BackgroundAuthored } from '@artificer-toolkit/shared'
import { backgroundAuthoredDtoSchema, type BackgroundAuthoredDto } from '@artificer-toolkit/schema'
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
export const getBackgroundList = handleRequest(
  async (db, userId) => normalizeAuthoredListResponse(await getBackgroundListQuery(db), userId),
  (_req: Request, userId: string) => [userId] as [string]
)

// single
export const getBackground = handleRequest<[string, string], Awaited<ReturnType<typeof normalizeAuthoredDetailResponse<BackgroundAuthored>>>>(
  async (db, id, userId) => normalizeAuthoredDetailResponse(db, 'backgrounds', await createBackgroundRepository(db).findById(id), userId),
  (req: Request, userId: string) => [extractId(req), userId] as [string, string]
)

// create/update
export const createBackground = handleAuthoringRequest(async (db, body: BackgroundAuthoredDto, userId) => {
  const service = createBackgroundSubjectAuthoringService(db)
  const result = await service.execute(normalizeAuthoringInput(body, userId))
  return normalizeAuthoringResult(db, 'backgrounds', result, userId)
}, (raw) => backgroundAuthoredDtoSchema.parse(raw) as BackgroundAuthoredDto)
