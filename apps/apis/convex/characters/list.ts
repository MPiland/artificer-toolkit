import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { characterDraftListInputSchema } from '@artificer-toolkit/schema/api/characterDrafts'
import {
  characterListPageSchema,
  type CharacterListPage
} from '@artificer-toolkit/schema/api/characterList'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { readVisibleAuthoredRouteId } from '../content/routeIds'
import { readCharacterDraftSummary } from './documents'
import { readCharacterPlayRow } from './stateDocuments'

export const list = query({
  args: zodToConvexFields(characterDraftListInputSchema.shape),
  returns: zodToConvex(characterListPageSchema),
  handler: async (ctx, args): Promise<CharacterListPage> => {
    const { userId } = await requireIdentity(ctx)
    const { paginationOpts } = characterDraftListInputSchema.parse(args)
    const result = await ctx.db
      .query('characters')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .paginate({ ...paginationOpts, maximumRowsRead: 8, maximumBytesRead: 2 * 1024 * 1024 })
    return characterListPageSchema.parse({
      ...result,
      page: await Promise.all(
        result.page.map(async (row) => {
          const [play, draft, route] = await Promise.all([
            readCharacterPlayRow(ctx, row.id),
            ctx.db
              .query('characterDrafts')
              .withIndex('by_characterId', (q) => q.eq('characterId', row.id))
              .unique(),
            readVisibleAuthoredRouteId(ctx, { subjectId: row.id })
          ])
          if (play.userId !== row.userId) throw new Error('Stored Character ownership mismatch.')
          if (!route || route.subjectKind !== 'CHARACTER' || route.ownerUserId !== userId)
            throw new Error('Stored Character route identity mismatch.')
          if (draft && draft.publicId !== route.publicId)
            throw new Error('Stored Character draft route identity mismatch.')
          return {
            id: row.id,
            publicId: route.publicId,
            label: draft?.label ?? row.label,
            status: row.status,
            systemId: row.systemId,
            streamVersion: play.streamVersion,
            ...(draft ? { draft: readCharacterDraftSummary(draft, row) } : {})
          }
        })
      )
    })
  }
})
