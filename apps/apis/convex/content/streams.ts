import { stream } from 'convex-helpers/server/stream'
import { defineSchema } from 'convex/server'
import type { QueryCtx } from '../_generated/server'
import { buildContentTables } from './schema'

const buildContentSchema = () => defineSchema(buildContentTables())
let contentSchema: ReturnType<typeof buildContentSchema> | undefined

export function contentStream(db: QueryCtx['db']) {
  // Forward the real reader methods so TypeScript checks the content-table view.
  return stream(
    { get: db.get, query: db.query, normalizeId: db.normalizeId, system: db.system },
    (contentSchema ??= buildContentSchema())
  )
}
