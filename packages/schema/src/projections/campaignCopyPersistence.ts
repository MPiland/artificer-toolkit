import { z, lazySchema } from '../zod.js'
import { beginCampaignCopyInputSchema, campaignCopyStatusSchema } from '../api/campaignCopy.js'
import { createCampaignInputSchema } from '../api/campaignCore.js'
import { timestampSchema, uuidSchema } from '../api/campaignContractSchemas.js'
import { projectionChecksumSchema } from './identity.js'

export const campaignStoredCopySchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    ownerUserId: uuidSchema,
    command: beginCampaignCopyInputSchema,
    inputFingerprint: projectionChecksumSchema,
    destinationCampaignId: uuidSchema,
    settings: createCampaignInputSchema,
    attunementSlotOverride: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
    sourceNotebookRevision: z.nullable(uuidSchema),
    snapshotChecksum: projectionChecksumSchema,
    status: campaignCopyStatusSchema,
    terminalStatus: z.nullable(z.enum(['FAILED', 'CANCELLED'])),
    categoryIndex: z.number().check(z.int()).check(z.gte(0)).check(z.lte(3)),
    cursor: z.nullable(z.string()),
    copiedSections: z.number().check(z.int()).check(z.nonnegative()),
    failureReason: z.nullable(z.string().check(z.maxLength(500))),
    expiresAt: z.number().check(z.int()).check(z.positive()),
    createdAt: timestampSchema,
    updatedAt: timestampSchema
  })
)
