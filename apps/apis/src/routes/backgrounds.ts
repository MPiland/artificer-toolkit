import { handleRequest, handleAuthoringRequest, createBackgroundSubjectAuthoringService } from '@artificer-toolkit/functions'
import { getBackgroundListQuery } from '@artificer-toolkit/db'
import { createBackgroundRepository } from '@artificer-toolkit/db'
import type { BackgroundAuthored } from '@artificer-toolkit/shared'

function extractId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

// list
export const getBackgroundList = handleRequest(getBackgroundListQuery, () => [] as [])

// single
export const getBackground = handleRequest<[string], BackgroundAuthored | null>(
  (db, id) => createBackgroundRepository(db).findById(id),
  (req) => [extractId(req)]
)

// create/update
export const createBackground = handleAuthoringRequest(
  async (db, body) => {
    const service = createBackgroundSubjectAuthoringService(db)
    return service.execute(body)
  },
  (raw) => raw
)
