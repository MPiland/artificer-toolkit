import { handleRequest, handleAuthoringRequest, createSpellSubjectAuthoringService } from '@artificer-toolkit/functions'
import { getSpellListQuery } from '@artificer-toolkit/db'
import { createSpellRepository } from '@artificer-toolkit/db'
import type { SpellAuthored } from '@artificer-toolkit/shared'

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
  (req) => [extractId(req)]
)

// create/update
export const createSpell = handleAuthoringRequest(
  async (db, body) => {
    const service = createSpellSubjectAuthoringService(db)
    return service.execute(body)
  },
  (raw) => raw
)
