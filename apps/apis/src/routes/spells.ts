import { handleRequest, handleAuthoringRequest, createSpellSubjectAuthoringService } from '@artificer-toolkit/functions'
import { getSpellListQuery } from '@artificer-toolkit/db'
import { createSpellRepository } from '@artificer-toolkit/db'
import type { SpellAuthored } from '@artificer-toolkit/shared'
import { spellAuthoredDtoSchema, type SpellAuthoredDto } from '@artificer-toolkit/schema'
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
export const getSpellList = handleRequest(
  async (db, userId) => normalizeAuthoredListResponse(await getSpellListQuery(db), userId),
  (_req: Request, userId: string) => [userId] as [string]
)

// single
export const getSpell = handleRequest<[string, string], Awaited<ReturnType<typeof normalizeAuthoredDetailResponse<SpellAuthored>>>>(
  async (db, id, userId) => normalizeAuthoredDetailResponse(db, 'spells', await createSpellRepository(db).findById(id), userId),
  (req: Request, userId: string) => [extractId(req), userId] as [string, string]
)

// create/update
export const createSpell = handleAuthoringRequest(
  spellAuthoredDtoSchema,
  async (db, body: SpellAuthoredDto, userId) => {
    const service = createSpellSubjectAuthoringService(db)
    const result = await service.execute(normalizeAuthoringInput(body, userId))
    return normalizeAuthoringResult(db, 'spells', result, userId)
  }
)
