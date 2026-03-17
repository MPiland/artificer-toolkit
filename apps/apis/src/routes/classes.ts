import { handleRequest, handleAuthoringRequest, createClassSubjectAuthoringService } from '@artificer-toolkit/functions'
import { getClassListQuery } from '@artificer-toolkit/db'
import { createClassRepository } from '@artificer-toolkit/db'
import type { ClassAuthored } from '@artificer-toolkit/shared'
import { classAuthoredDtoSchema } from '@artificer-toolkit/schema'

function extractId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

// list
export const getClassList = handleRequest(getClassListQuery, () => [] as [])

// single
export const getClass = handleRequest<[string], ClassAuthored | null>(
  (db, id) => createClassRepository(db).findById(id),
  (req: Request, _userId: string) => [extractId(req)] as [string]
)

// create/update
export const createClass = handleAuthoringRequest(
  classAuthoredDtoSchema,
  async (db, body) => {
    const service = createClassSubjectAuthoringService(db)
    return service.execute(body)
  }
)
