import { stream } from 'convex-helpers/server/stream'
import type { QueryCtx } from '../_generated/server'
import { contentSchema } from './schema'

export function contentStream(db: QueryCtx['db']) {
  // Forward the real reader methods so TypeScript checks the content-table view.
  return stream(
    { get: db.get, query: db.query, normalizeId: db.normalizeId, system: db.system },
    contentSchema
  )
}
