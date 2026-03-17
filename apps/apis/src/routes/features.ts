import { handleRequest, handleAuthoringRequest, createFeatureAuthoringUseCaseService } from '@artificer-toolkit/functions'
import { getFeatureListQuery } from '@artificer-toolkit/db'
import { createFeatureRepository } from '@artificer-toolkit/db'
import type { FeatureAuthored, NodeSubjectCode } from '@artificer-toolkit/shared'
import { z } from 'zod'

const featureAuthoringBodySchema = z.object({
  feature: z.unknown(),
  systemId: z.string(),
})

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
  (req: Request, _userId: string) => [extractId(req)] as [string]
)

// create/update
export const createFeature = handleAuthoringRequest(
  featureAuthoringBodySchema,
  async (db, body) => {
    const service = createFeatureAuthoringUseCaseService(db)
    return service.execute(body)
  }
)
