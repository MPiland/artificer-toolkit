import { z } from 'zod'

import { dnd5eOptionalCombatRuleKindDtoSchema } from '../shared/optionalCombat.js'
import { tableSafetyPracticeDtoSchema } from './tableSafety.js'
import { timestampSchema, uuidSchema, versionSchema } from './campaignContractSchemas.js'

const policyTextSchema = z.string().trim().min(1).max(4_000).nullable()
const optionalCombatDefinitionIdsDtoSchema = z
  .array(uuidSchema)
  .max(14)
  .default([])
  .superRefine((definitionIds, context) => {
    const sorted = [...definitionIds].sort((left, right) => left.localeCompare(right))
    if (definitionIds.some((definitionId, index) => definitionId !== sorted[index])) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Optional combat definition IDs must be sorted.'
      })
    }
    if (new Set(definitionIds).size !== definitionIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Optional combat definition IDs must be unique.'
      })
    }
  })
export const automationModeDtoSchema = z.enum(['AUTOMATIC', 'ASSISTED', 'MANUAL'])
export const manualReminderModeDtoSchema = z.enum(['OFF', 'SUBTLE'])

const campaignPlaySettingsBaseDtoSchema = z.strictObject({
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
  automationMode: automationModeDtoSchema.default('ASSISTED'),
  manualReminderMode: manualReminderModeDtoSchema.default('OFF'),
  initiativePolicyDefinitionId: uuidSchema.nullable().default(null),
  initiativeTieDefinitionId: uuidSchema.nullable().default(null),
  optionalCombatRuleDefinitionIds: optionalCombatDefinitionIdsDtoSchema,
  version: versionSchema,
  updatedAt: timestampSchema
})

function validateInitiativeSelection(
  settings: {
    initiativePolicyDefinitionId: string | null
    initiativeTieDefinitionId: string | null
  },
  context: z.RefinementCtx
) {
  if (
    settings.initiativeTieDefinitionId !== null &&
    settings.initiativePolicyDefinitionId === null
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['initiativeTieDefinitionId'],
      message: 'An initiative tie resolver requires an initiative policy.'
    })
  }
}

export const campaignPlaySettingsDtoSchema = campaignPlaySettingsBaseDtoSchema.superRefine(
  validateInitiativeSelection
)

export const getCampaignPlaySettingsInputSchema = z.strictObject({
  campaignId: uuidSchema
})

const campaignDefinitionOptionDtoSchema = z.strictObject({
  definitionId: uuidSchema,
  label: z.string().trim().min(1).max(160)
})

export const campaignInitiativePolicyOptionDtoSchema = campaignDefinitionOptionDtoSchema.extend({
  defaultTieResolverDefinitionId: uuidSchema,
  tieResolvers: z.array(campaignDefinitionOptionDtoSchema).min(1).max(16)
})

export const campaignOptionalCombatRuleOptionDtoSchema = campaignDefinitionOptionDtoSchema.extend({
  kind: dnd5eOptionalCombatRuleKindDtoSchema
})

export const campaignPlaySettingsOptionsDtoSchema = z.strictObject({
  initiativePolicies: z.array(campaignInitiativePolicyOptionDtoSchema),
  optionalCombatRules: z.array(campaignOptionalCombatRuleOptionDtoSchema).max(14)
})

export const saveCampaignPlaySettingsInputSchema = campaignPlaySettingsBaseDtoSchema
  .omit({ updatedAt: true, version: true })
  .extend({ expectedVersion: versionSchema })
  .superRefine(validateInitiativeSelection)

export type CampaignPlaySettingsDto = z.infer<typeof campaignPlaySettingsDtoSchema>
export type CampaignPlaySettingsOptionsDto = z.infer<typeof campaignPlaySettingsOptionsDtoSchema>
export type SaveCampaignPlaySettingsInput = z.input<typeof saveCampaignPlaySettingsInputSchema>
