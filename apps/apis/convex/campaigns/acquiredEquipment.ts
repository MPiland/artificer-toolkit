import type { MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import {
  campaignStoredPartyItemSchema,
  campaignStoredPartyInventorySchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import { readCampaignInventory } from './partyInventoryDocuments'
import { readVehicleCleanupLock } from './vehicleCleanupDocuments'
import { retainPartyEquipmentRules } from './partyEquipmentRetention'
import { readAcquiredEquipmentRules } from '@artificer-toolkit/rules-runtime/character/acquiredEquipmentRules'

/** Populate/refresh acquired rules before current share or publication authority disappears. */
export async function retainCampaignEquipmentRules(
  ctx: MutationCtx,
  campaign: Doc<'campaigns'>,
  targets: readonly { subjectKind: string; subjectId: string }[]
) {
  const ruleTargets = targets.filter(
    (target) => target.subjectKind === 'EQUIPMENT' || target.subjectKind === 'SPELL'
  )
  if (!ruleTargets.length) return
  const changedOwners = new Set<string | undefined>()
  const seen = new Set<string>()
  for await (const item of ctx.db
    .query('campaignPartyItems')
    .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))) {
    const { _id, _creationTime, ...stored } = item
    campaignStoredPartyItemSchema.parse(stored)
    if (seen.has(item.id)) throw new Error('Stored acquired Equipment identities are duplicated.')
    seen.add(item.id)
    const retainedRulesJson = await retainPartyEquipmentRules(ctx, campaign, item)
    const retained = readAcquiredEquipmentRules(
      retainedRulesJson,
      item.equipmentId,
      campaign.gameSystemId
    )
    if (
      retainedRulesJson !== item.retainedRulesJson &&
      retained.sources.some((source) =>
        ruleTargets.some(
          (target) =>
            target.subjectKind === source.subjectKind && target.subjectId === source.subjectId
        )
      )
    ) {
      await ctx.db.patch(item._id, { retainedRulesJson })
      changedOwners.add(item.vehicleId)
    }
  }
  for (const vehicleId of changedOwners) {
    const inventory = await readCampaignInventory(ctx, campaign.id, vehicleId)
    let cleanupJob: Doc<'campaignVehicleCleanupJobs'> | null = null
    if (vehicleId !== undefined) {
      const vehicle = await ctx.db
        .query('campaignVehicles')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', vehicleId))
        .unique()
      if (!vehicle || vehicle.campaignId !== campaign.id)
        throw new Error('Retained Equipment Vehicle scope is unavailable.')
      const lock = await readVehicleCleanupLock(ctx, vehicle)
      if (lock) {
        cleanupJob = await ctx.db
          .query('campaignVehicleCleanupJobs')
          .withIndex('by_publicId', (q) => q.eq('id', lock.jobId))
          .unique()
        if (!cleanupJob || cleanupJob.sourceInventoryVersion !== (inventory?.version ?? 0))
          throw new Error('Retained Equipment cleanup version is inconsistent.')
      }
    }
    const next = campaignStoredPartyInventorySchema.parse({
      campaignId: campaign.id,
      vehicleId,
      version: (inventory?.version ?? 0) + 1
    })
    if (inventory) await ctx.db.patch(inventory._id, { version: next.version })
    else await ctx.db.insert('campaignPartyInventories', next)
    // Trusted source loss joins the captured cleanup; the original grant and mode remain immutable.
    if (cleanupJob) await ctx.db.patch(cleanupJob._id, { sourceInventoryVersion: next.version })
  }
}
