import {
  handleRequest,
  handleAuthoringRequest,
  createSpellSubjectAuthoringService,
  normalizeNodeRuntimeValues
} from '@artificer-toolkit/functions'
import { getSpellListQuery } from '@artificer-toolkit/db'
import { createSpellRepository } from '@artificer-toolkit/db'
import type { SpellAuthored } from '@artificer-toolkit/shared'
import {
  authoredDraftActivateRequestDtoSchema,
  authoredDraftSaveRequestDtoSchema,
  spellAuthoredDtoSchema,
  type SpellAuthoredDto
} from '@artificer-toolkit/schema'
import {
  discardAuthoredDraft,
  getAuthoredDraft,
  normalizeAuthoredDetailResponse,
  normalizeAuthoredListResponseWithDrafts,
  normalizeActivatedAuthoringInput,
  normalizeAuthoringResult,
  normalizeStoredDraftPayloadForActivation,
  requireAuthoredDraft,
  saveAuthoredDraft
} from './authoredContent.js'

function extractId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

function extractDraftSubjectId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1] === 'draft'
    ? segments[segments.length - 2]
    : segments[segments.length - 1]
}

// list
export const getSpellList = handleRequest(
  async (db, userId) => normalizeAuthoredListResponseWithDrafts(db, await getSpellListQuery(db), userId, 'SPELL'),
  (_req: Request, userId: string) => [userId] as [string]
)

// single
export const getSpell = handleRequest<[string, string], Awaited<ReturnType<typeof normalizeAuthoredDetailResponse<SpellAuthored>>>>(
  async (db, id, userId) => normalizeAuthoredDetailResponse(db, 'spells', await createSpellRepository(db).findById(id), userId),
  (req: Request, userId: string) => [extractId(req), userId] as [string, string]
)

export const getSpellDraft = handleRequest(
  async (db, id, userId) => getAuthoredDraft(db, 'SPELL', id, userId),
  (req: Request, userId: string) => [extractDraftSubjectId(req), userId] as [string, string]
)

export const saveSpellDraft = handleAuthoringRequest(
  authoredDraftSaveRequestDtoSchema,
  async (db, body, userId) => saveAuthoredDraft(db, {
    ...body,
    subjectKind: 'SPELL'
  }, userId)
)

export const discardSpellDraft = handleRequest(
  async (db, id, userId) => {
    await discardAuthoredDraft(db, 'SPELL', id, userId)
    return { ok: true }
  },
  (req: Request, userId: string) => [extractDraftSubjectId(req), userId] as [string, string]
)

export const activateSpellDraft = handleAuthoringRequest(
  authoredDraftActivateRequestDtoSchema,
  async (db, body, userId) => {
    const draft = await requireAuthoredDraft(db, 'SPELL', body.subjectId, userId)
    const service = createSpellSubjectAuthoringService(db)
    const input = spellAuthoredDtoSchema.parse(normalizeStoredDraftPayloadForActivation(draft, userId))
    const normalized = await normalizeNodeRuntimeValues(db, {
      mapId: 'spell',
      values: { ...input }
    })
    const normalizedBody = spellAuthoredDtoSchema.parse(normalized.values)
    const result = await service.execute(normalizeActivatedAuthoringInput(normalizedBody, userId))
    await discardAuthoredDraft(db, 'SPELL', normalizedBody.id, userId)
    return normalizeAuthoringResult(db, 'spells', result, userId)
  }
)

// create/update
export const createSpell = handleAuthoringRequest(
  spellAuthoredDtoSchema,
  async (db, body: SpellAuthoredDto, userId) => {
    const service = createSpellSubjectAuthoringService(db)
    const normalized = await normalizeNodeRuntimeValues(db, {
      mapId: 'spell',
      values: { ...body }
    })
    const normalizedBody = spellAuthoredDtoSchema.parse(normalized.values)
    const result = await service.execute(normalizeActivatedAuthoringInput(normalizedBody, userId))
    await discardAuthoredDraft(db, 'SPELL', normalizedBody.id, userId)
    return normalizeAuthoringResult(db, 'spells', result, userId)
  }
)
