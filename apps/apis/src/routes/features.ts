import { handleRequest, handleAuthoringRequest, createFeatureAuthoringUseCaseService } from '@artificer-toolkit/functions'
import { getFeatureListQuery } from '@artificer-toolkit/db'
import { createFeatureRepository } from '@artificer-toolkit/db'
import type { FeatureAuthored, NodeSubjectCode } from '@artificer-toolkit/shared'

function extractId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

// list
export const getFeatureList = handleRequest(getFeatureListQuery, () => [] as [])

// single
export const getFeature = handleRequest<[string], FeatureAuthored<NodeSubjectCode> | null>(
  (db, id) => createFeatureRepository(db).findById(id),
  (req) => [extractId(req)]
)

// create/update
export const createFeature = handleAuthoringRequest(
  async (db, body) => {
    const service = createFeatureAuthoringUseCaseService(db)
    return service.execute(body as { feature: unknown, systemId: string })
  },
  (raw) => raw
)
