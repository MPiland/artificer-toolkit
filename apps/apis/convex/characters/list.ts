import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { characterDraftListInputSchema } from '@artificer-toolkit/schema/api/characterDrafts'
import {
  characterListPageSchema,
  type CharacterListPage
} from '@artificer-toolkit/schema/api/characterList'
import { query } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { readVisibleAuthoredRouteId } from '../content/routeIds'
import { readCharacterDraftSummary, readCharacterRecord } from './documents'

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
      // Bound full document joins as well as primary reads. Each draft can approach 1 MiB.
      .paginate({ ...paginationOpts, maximumRowsRead: 8, maximumBytesRead: 2 * 1024 * 1024 })
    return characterListPageSchema.parse({
      ...result,
      page: await Promise.all(
        result.page.map(async (active) => {
          const character = readCharacterRecord(active)
          const [draft, route] = await Promise.all([
            ctx.db
              .query('characterDrafts')
              .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
              .unique(),
            readVisibleAuthoredRouteId(ctx, { subjectId: character.id })
          ])
          if (!route || route.subjectKind !== 'CHARACTER' || route.ownerUserId !== userId)
            throw new Error('Stored Character route identity mismatch.')
          if (draft && draft.publicId !== route.publicId)
            throw new Error('Stored Character draft route identity mismatch.')
          return {
            id: character.id,
            publicId: route.publicId,
            label: draft?.label ?? character.label,
            status: active.status,
            systemId: character.systemId,
            streamVersion: active.streamVersion,
            ...(draft ? { draft: readCharacterDraftSummary(draft, active) } : {})
          }
        })
      )
    })
  }
})
