import { handleRequest, handleAuthoringRequest, createFeatGrantAuthoringService } from '@artificer-toolkit/functions'
import { createFeatGrantRepository } from '@artificer-toolkit/db'
import type { FeatGrantAuthored } from '@artificer-toolkit/shared/authored'
import { featGrantDtoSchema } from '@artificer-toolkit/schema/grants/feat'

function extractId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

// single
export const getFeatGrant = handleRequest<[string], FeatGrantAuthored | null>(
  (db, id) => createFeatGrantRepository(db).findById(id),
  (req: Request, _userId: string) => [extractId(req)] as [string]
)

// create/update
export const createFeatGrant = handleAuthoringRequest(
  featGrantDtoSchema,
  async (db, body) => {
    const service = createFeatGrantAuthoringService(db)
    return service.execute(body)
  }
)
