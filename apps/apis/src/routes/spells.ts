import { handleRequest, handleAuthoringRequest, createSpellSubjectAuthoringService } from '@artificer-toolkit/functions'
import { getSpellListQuery } from '@artificer-toolkit/db'
import { createSpellRepository } from '@artificer-toolkit/db'
import type { SpellAuthored } from '@artificer-toolkit/shared'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema'

function extractId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

// list
export const getSpellList = handleRequest(getSpellListQuery, () => [] as [])

// single
export const getSpell = handleRequest<[string], SpellAuthored | null>(
  (db, id) => createSpellRepository(db).findById(id),
  (req: Request, _userId: string) => [extractId(req)] as [string]
)

// create/update
export const createSpell = handleAuthoringRequest(
  spellAuthoredDtoSchema,
  async (db, body) => {
    const service = createSpellSubjectAuthoringService(db)
    return service.execute(body)
  }
)
