import { z } from '../zod.js'
import { uuidSchema, versionSchema } from '../api/campaignContractSchemas.js'
import { projectionChecksumSchema } from './identity.js'

/** Private native-scheduler continuation for Campaign-root inventory removal. */
export const campaignInventoryPurgePhaseSchema = z.enum([
  'VEHICLE_JOB',
  'VEHICLE_JOB_TOTALS',
  'VEHICLE_JOB_SEGMENTS',
  'PARTY_ITEMS',
  'PARTY_CURRENCY_GROUPS',
  'PARTY_CURRENCIES',
  'PARTY_INVENTORIES',
  'CURRENCY_DENOMINATIONS',
  'CURRENCY_SYSTEMS',
  'VEHICLES'
])

export const campaignInventoryPurgeGrantSchema = z.strictObject({
  // The Convex worker overlays this with v.id('campaigns').
  campaignRootId: z.string().check(z.minLength(1)),
  campaignId: uuidSchema,
  campaignVersion: versionSchema,
  actorUserId: uuidSchema,
  cleanupId: uuidSchema,
  grantChecksum: projectionChecksumSchema
})

export const campaignInventoryPurgeRunSchema = z.strictObject({
  grant: campaignInventoryPurgeGrantSchema,
  phase: campaignInventoryPurgePhaseSchema,
  jobId: z.optional(uuidSchema)
})

export type CampaignInventoryPurgeGrant = z.infer<typeof campaignInventoryPurgeGrantSchema>
export type CampaignInventoryPurgePhase = z.infer<typeof campaignInventoryPurgePhaseSchema>
export type CampaignInventoryPurgeRun = z.infer<typeof campaignInventoryPurgeRunSchema>
