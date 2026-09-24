import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { requireRulesCatalogueBinding } from '../content/catalogueBinding'
import {
  canReadAuthoredRoot,
  readAuthoredVersion,
  readPublishedDocument
} from '../content/documents'
import { readCampaignSharedRootPublication } from './contentAccess'

/** Instance creation and definition-dependent writes use current Campaign source authority. */
export async function requireCampaignVehicleDefinition(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  vehicleDefinitionId: string
) {
  const root = await ctx.db
    .query('authoredRoots')
    .withIndex('by_publicId', (q) => q.eq('id', vehicleDefinitionId))
    .unique()
  if (!root || root.subjectKind !== 'VEHICLE' || root.systemId !== campaign.gameSystemId)
    throw new Error('Campaign Vehicle definition is unavailable.')
  const { sourceIds } = await requireRulesCatalogueBinding(ctx, {
    systemId: campaign.gameSystemId,
    primaryRulesCatalogueId: campaign.primaryRulesCatalogueId,
    additionalRulesCatalogueIds: campaign.additionalRulesCatalogueIds
  })
  if (
    root.ownerUserId === undefined &&
    sourceIds.has(root.contentSourceId) &&
    (await canReadAuthoredRoot(ctx, root, null))
  ) {
    const document = vehicleAuthoredDtoSchema.parse(
      await readPublishedDocument(ctx, root, await readAuthoredVersion(ctx, root))
    )
    // Canonical imported Vehicle documents predate the optional authored status field.
    if (document.status !== undefined && document.status !== 'ACTIVE')
      throw new Error('Campaign Vehicle definition is unavailable.')
    return
  }
  const publication = await readCampaignSharedRootPublication(ctx, campaign, 'VEHICLE', root.id)
  if (publication?.subjectKind !== 'VEHICLE')
    throw new Error('Choose an enabled official Vehicle or a Vehicle shared with this Campaign.')
}
