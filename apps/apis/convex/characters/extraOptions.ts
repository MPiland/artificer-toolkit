import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  characterSheetExtraCatalogReadInputSchema,
  characterSheetExtraCatalogResponseDtoSchema,
  type CharacterSheetExtraCatalogResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import { query } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { catalogueItem } from '../content/catalogueItem'
import { readCharacterPublication, readCharacterSourceRoots, readCharacterSources } from './context'
import {
  presentCampaignPlainText,
  presentCampaignRichText
} from '@artificer-toolkit/shared/campaign/textPolicy'
import { readCharacterRecord, resolveCharacterId } from './documents'

export const list = query({
  args: zodToConvexFields(characterSheetExtraCatalogReadInputSchema.shape),
  returns: zodToConvex(characterSheetExtraCatalogResponseDtoSchema),
  handler: async (ctx, args): Promise<CharacterSheetExtraCatalogResponseDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = characterSheetExtraCatalogReadInputSchema.parse(args)
    const id = await resolveCharacterId(ctx, input.id)
    if (!id) throw new Error('Character extras are unavailable for the current user.')
    const active = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', id))
      .unique()
    if (!active || active.userId !== userId || active.status !== 'ACTIVE')
      throw new Error('Character extras are unavailable for the current user.')
    const character = readCharacterRecord(active)
    const sources = await readCharacterSources(ctx, character, userId)
    const roots = await readCharacterSourceRoots(ctx, character.systemId, sources, input.kind)
    const queryText = input.query?.toLowerCase()
    const candidates = roots
      .map((root) => ({
        root,
        label: sources.campaign
          ? presentCampaignPlainText(root.label, sources.campaign.contentMaturity)
          : root.label
      }))
      .filter(({ root, label }) => {
        if (queryText && !label.toLowerCase().includes(queryText)) return false
        if (!input.cursor) return true
        const order = label.localeCompare(input.cursor.label)
        return order > 0 || (order === 0 && root.id.localeCompare(input.cursor.id) > 0)
      })
      .sort(
        (left, right) =>
          left.label.localeCompare(right.label) || left.root.id.localeCompare(right.root.id)
      )
      .slice(0, input.limit + 1)
    const items = await Promise.all(
      candidates.slice(0, input.limit).map(async ({ root }) => {
        if (root.ownerUserId !== undefined && root.ownerUserId !== userId) {
          const publication = await readCharacterPublication(
            ctx,
            root,
            character.systemId,
            userId,
            sources
          )
          if (!publication || !sources.campaign)
            throw new Error('Character extra source is unavailable.')
          const { document } = publication
          const maturity = sources.campaign.contentMaturity
          return {
            id: document.id,
            label: presentCampaignPlainText(document.label, maturity),
            ...(document.description
              ? { description: presentCampaignRichText(document.description, maturity) }
              : {})
          }
        }
        const item = await catalogueItem(
          ctx,
          root,
          userId,
          root.ownerUserId ? 'OWNED' : 'MASTER',
          false
        )
        return {
          id: item.id,
          label: presentCampaignPlainText(
            item.label,
            sources.campaign?.contentMaturity ?? 'MATURE'
          ),
          ...(item.description
            ? {
                description: presentCampaignRichText(
                  item.description,
                  sources.campaign?.contentMaturity ?? 'MATURE'
                )
              }
            : {})
        }
      })
    )
    const last = items.at(-1)
    return characterSheetExtraCatalogResponseDtoSchema.parse({
      items,
      nextCursor:
        candidates.length > input.limit && last ? { id: last.id, label: last.label } : null
    })
  }
})
