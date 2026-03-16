import { handleRequest, handleAuthoringRequest, createFeatSubjectAuthoringService } from '@artificer-toolkit/functions'
import { getFeatListQuery } from '@artificer-toolkit/db'
import { createFeatRepository } from '@artificer-toolkit/db'
import type { FeatAuthored } from '@artificer-toolkit/shared'

function extractId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

// list
export const getFeatList = handleRequest(getFeatListQuery, () => [] as [])

// single
export const getFeat = handleRequest<[string], FeatAuthored | null>(
  (db, id) => createFeatRepository(db).findById(id),
  (req) => [extractId(req)]
)

// create/update
export const createFeat = handleAuthoringRequest(
  async (db, body) => {
    const service = createFeatSubjectAuthoringService(db)
    return service.execute(body)
  },
  (raw) => raw
)
