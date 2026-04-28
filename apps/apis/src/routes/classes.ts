import { handleRequest, handleAuthoringRequest, createClassSubjectAuthoringService } from '@artificer-toolkit/functions'
import { getClassListQuery } from '@artificer-toolkit/db'
import { createClassRepository } from '@artificer-toolkit/db'
import type { ClassAuthored } from '@artificer-toolkit/shared'
import { classAuthoredDtoSchema, type ClassAuthoredDto } from '@artificer-toolkit/schema'
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
export const getClassList = handleRequest(
  async (db, userId) => normalizeAuthoredListResponse(await getClassListQuery(db), userId),
  (_req: Request, userId: string) => [userId] as [string]
)

// single
export const getClass = handleRequest<[string, string], Awaited<ReturnType<typeof normalizeAuthoredDetailResponse<ClassAuthored>>>>(
  async (db, id, userId) => normalizeAuthoredDetailResponse(db, 'classes', await createClassRepository(db).findById(id), userId),
  (req: Request, userId: string) => [extractId(req), userId] as [string, string]
)

// create/update
export const createClass = handleAuthoringRequest(
  async (db, body: ClassAuthoredDto, userId) => {
    const service = createClassSubjectAuthoringService(db)
    const result = await service.execute(normalizeAuthoringInput(body, userId))
    return normalizeAuthoringResult(db, 'classes', result, userId)
  },
  (raw) => classAuthoredDtoSchema.parse(raw) as ClassAuthoredDto
)
