import {
  authoredCataloguePageSchema,
  type AuthoredCataloguePage
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'
import { requireRulesCatalogueBinding } from '../content/catalogueBinding'
import { catalogueItem } from '../content/catalogueItem'
import { readRootCatalogue } from '../content/catalogueMetadata'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { campaignPartyInventoryListInputSchema } from '@artificer-toolkit/schema/api/campaignInventoryPages'
import { internalQuery } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { contentStream } from '../content/streams'
import { isImportRowVisible } from '../imports/visibility'

/** Complete official Equipment options under this Campaign's current catalogue binding. */
export const list = internalQuery({
  args: zodToConvexFields(campaignPartyInventoryListInputSchema.shape),
  returns: zodToConvex(authoredCataloguePageSchema),
  handler: async (ctx, args): Promise<AuthoredCataloguePage> => {
    const input = campaignPartyInventoryListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const { sourceIds } = await requireRulesCatalogueBinding(ctx, {
      systemId: campaign.gameSystemId,
      primaryRulesCatalogueId: campaign.primaryRulesCatalogueId,
      additionalRulesCatalogueIds: campaign.additionalRulesCatalogueIds
    })
    const result = await contentStream(ctx.db)
      .query('authoredRoots')
      .withIndex('by_system_kind_owner_name_id', (q) =>
        q
          .eq('systemId', campaign.gameSystemId)
          .eq('subjectKind', 'EQUIPMENT')
          .eq('ownerUserId', undefined)
      )
      .filterWith(
        async (root) =>
          sourceIds.has(root.contentSourceId) && (await isImportRowVisible(ctx, root.importJobId))
      )
      .paginate({
        ...input.paginationOpts,
        maximumRowsRead: 48,
        maximumBytesRead: 1024 * 1024
      })
    const page: AuthoredCataloguePage['page'] = []
    // A picker reads root catalogue facts alone and never loads the payload (D163).
    for (const root of result.page) {
      if (!readRootCatalogue(root).publishedActive) continue
      const item = await catalogueItem(ctx, root, userId, 'MASTER', false)
      page.push({
        ...item,
        label: presentCampaignPlainText(item.label, campaign.contentMaturity),
        description:
          item.description === null
            ? null
            : presentCampaignPlainText(item.description, campaign.contentMaturity)
      })
    }
    return authoredCataloguePageSchema.parse({ ...result, page })
  }
})
