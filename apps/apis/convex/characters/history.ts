import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  characterHistoryInputSchema,
  characterHistoryPageSchema
} from '@artificer-toolkit/schema/api/characterHistory'
import { query } from '../lib/queries'
import { presentCampaignCharacterHistory } from '@artificer-toolkit/rules-runtime/character/campaignCharacterPresentation'
import { requireIdentity } from '../lib/identity'
import { readCharacterReceiptHistory, readCharacterRecord, resolveCharacterId } from './documents'
import { readCharacterCampaign } from './context'
import { readCharacterRow } from './stateDocuments'

export const list = query({
  args: zodToConvexFields(characterHistoryInputSchema.shape),
  returns: zodToConvex(characterHistoryPageSchema),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const input = characterHistoryInputSchema.parse(args)
    const id = await resolveCharacterId(ctx, input.id)
    if (!id) throw new Error('Character history is unavailable for the current user.')
    const active = await readCharacterRow(ctx, id)
    if (!active || active.userId !== userId)
      throw new Error('Character history is unavailable for the current user.')
    const character = readCharacterRecord(active)
    const campaign = await readCharacterCampaign(ctx, character, userId)
    const result = await ctx.db
      .query('characterCommandReceipts')
      .withIndex('by_characterId_actorId_occurredAt_id', (q) =>
        q.eq('characterId', character.id).eq('actorId', userId)
      )
      .order('asc')
      .paginate({ ...input.paginationOpts, maximumRowsRead: 48, maximumBytesRead: 1024 * 1024 })
    return characterHistoryPageSchema.parse({
      ...result,
      characterId: character.id,
      page: presentCampaignCharacterHistory(
        { characterId: character.id, entries: result.page.map(readCharacterReceiptHistory) },
        campaign?.contentMaturity ?? null,
        'CHARACTER_OWNER'
      ).entries
    })
  }
})
