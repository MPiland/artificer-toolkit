import { handleRequest } from '@artificer-toolkit/functions'
import { getSystemListQuery } from '@artificer-toolkit/db'
import { createSystemRepository } from '@artificer-toolkit/db'
import type { SystemSeedRecord } from '@artificer-toolkit/db'

function extractId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

// list
export const getSystemList = handleRequest(getSystemListQuery, () => [] as [])

// single
export const getSystem = handleRequest<[string], SystemSeedRecord | null>(
  (db, id) => createSystemRepository(db).findById(id),
  (req: Request, _userId: string) => [extractId(req)] as [string]
)
