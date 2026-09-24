import { z } from 'zod'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { internalQuery } from '../_generated/server'

const uuidSchema = z.string().check(z.uuid())
const inputSchema = z.strictObject({ campaignId: uuidSchema })

export const openSessionIds = internalQuery({
  args: zodToConvexFields(inputSchema.shape),
  returns: zodToConvex(z.array(uuidSchema)),
  handler: async (ctx, args) => {
    const { campaignId } = inputSchema.parse(args)
    const ids: string[] = []
    for await (const session of ctx.db
      .query('campaignSessions')
      .withIndex('by_campaignId_status_sessionNumber', (q) =>
        q.eq('campaignId', campaignId.toLowerCase()).eq('status', 'OPEN')
      ))
      ids.push(session.id)
    return ids
  }
})
