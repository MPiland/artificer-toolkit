import { z } from 'zod'

import { tableSafetyPracticeDtoSchema } from './tableSafety.js'
import { timestampSchema, uuidSchema, versionSchema } from './campaignContractSchemas.js'

const policyTextSchema = z.string().trim().min(1).max(4_000).nullable()

export const campaignPlaySettingsDtoSchema = z.strictObject({
  campaignId: uuidSchema,
  normalCadenceDays: z.number().int().min(1).max(365).nullable(),
  expectedDurationMinutes: z.number().int().min(15).max(1_440).nullable(),
  quorum: z.number().int().min(1).max(100).nullable(),
  absentCharacterPolicy: policyTextSchema,
  contentGuidance: policyTextSchema,
  allowedContentRules: policyTextSchema,
  tableConduct: policyTextSchema,
  contentBoundaries: policyTextSchema,
  safetyPractices: z.array(tableSafetyPracticeDtoSchema).max(6),
  liveSafetyMethod: z.string().trim().min(1).max(500).nullable(),
  version: versionSchema,
  updatedAt: timestampSchema
})

export const getCampaignPlaySettingsInputSchema = z.strictObject({
  campaignId: uuidSchema
})
export const saveCampaignPlaySettingsInputSchema = campaignPlaySettingsDtoSchema
  .omit({ updatedAt: true, version: true })
  .extend({ expectedVersion: versionSchema })

export type CampaignPlaySettingsDto = z.infer<typeof campaignPlaySettingsDtoSchema>
export type SaveCampaignPlaySettingsInput = z.input<typeof saveCampaignPlaySettingsInputSchema>
