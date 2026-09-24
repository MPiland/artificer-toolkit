import { z } from '../zod.js'

import { dnd5eOptionalCombatRuleKindDtoSchema } from '../shared/reusableDefinitionIdentity.js'
import { tableSafetyPracticeDtoSchema } from './tableSafety.js'
import { timestampSchema, uuidSchema, versionSchema } from './campaignContractSchemas.js'

const policyTextSchema = z.nullable(
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(4_000))
)
const optionalCombatDefinitionIdsDtoSchema = z
  ._default(z.array(uuidSchema).check(z.maxLength(14)), [])
  .check(
    z.superRefine((definitionIds, context) => {
      const sorted = [...definitionIds].sort((left, right) => left.localeCompare(right))
      if (definitionIds.some((definitionId, index) => definitionId !== sorted[index])) {
        context.addIssue({
          code: 'custom',
          message: 'Optional combat definition IDs must be sorted.'
        })
      }
      if (new Set(definitionIds).size !== definitionIds.length) {
        context.addIssue({
          code: 'custom',
          message: 'Optional combat definition IDs must be unique.'
        })
      }
    })
  )
export const automationModeDtoSchema = z.enum(['AUTOMATIC', 'ASSISTED', 'MANUAL'])
export const manualReminderModeDtoSchema = z.enum(['OFF', 'SUBTLE'])

const campaignPlaySettingsBaseDtoSchema = z.strictObject({
  campaignId: uuidSchema,
  normalCadenceDays: z.nullable(z.number().check(z.int()).check(z.gte(1)).check(z.lte(365))),
  expectedDurationMinutes: z.nullable(
    z.number().check(z.int()).check(z.gte(15)).check(z.lte(1_440))
  ),
  quorum: z.nullable(z.number().check(z.int()).check(z.gte(1)).check(z.lte(100))),
  absentCharacterPolicy: policyTextSchema,
  contentGuidance: policyTextSchema,
  allowedContentRules: policyTextSchema,
  tableConduct: policyTextSchema,
  contentBoundaries: policyTextSchema,
  safetyPractices: z.array(tableSafetyPracticeDtoSchema).check(z.maxLength(6)),
  liveSafetyMethod: z.nullable(
    z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500))
  ),
  automationMode: z._default(automationModeDtoSchema, 'ASSISTED'),
  manualReminderMode: z._default(manualReminderModeDtoSchema, 'OFF'),
  initiativePolicyDefinitionId: z._default(z.nullable(uuidSchema), null),
  initiativeTieDefinitionId: z._default(z.nullable(uuidSchema), null),
  optionalCombatRuleDefinitionIds: optionalCombatDefinitionIdsDtoSchema,
  version: versionSchema,
  updatedAt: timestampSchema
})

function validateInitiativeSelection(
  settings: {
    initiativePolicyDefinitionId: string | null
    initiativeTieDefinitionId: string | null
  },
  context: z.core.$RefinementCtx
) {
  if (
    settings.initiativeTieDefinitionId !== null &&
    settings.initiativePolicyDefinitionId === null
  ) {
    context.addIssue({
      code: 'custom',
      path: ['initiativeTieDefinitionId'],
      message: 'An initiative tie resolver requires an initiative policy.'
    })
  }
}

export const campaignPlaySettingsDtoSchema = campaignPlaySettingsBaseDtoSchema.check(
  z.superRefine(validateInitiativeSelection)
)

export const getCampaignPlaySettingsInputSchema = z.strictObject({
  campaignId: uuidSchema
})

const campaignDefinitionOptionDtoSchema = z.strictObject({
  definitionId: uuidSchema,
  label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))
})

export const campaignInitiativePolicyOptionDtoSchema = z.extend(campaignDefinitionOptionDtoSchema, {
  defaultTieResolverDefinitionId: uuidSchema,
  tieResolvers: z
    .array(campaignDefinitionOptionDtoSchema)
    .check(z.minLength(1))
    .check(z.maxLength(16))
})

export const campaignOptionalCombatRuleOptionDtoSchema = z.extend(
  campaignDefinitionOptionDtoSchema,
  {
    kind: dnd5eOptionalCombatRuleKindDtoSchema
  }
)

export const campaignPlaySettingsOptionsDtoSchema = z.strictObject({
  initiativePolicies: z.array(campaignInitiativePolicyOptionDtoSchema),
  optionalCombatRules: z.array(campaignOptionalCombatRuleOptionDtoSchema).check(z.maxLength(14))
})

export const saveCampaignPlaySettingsInputSchema = z
  .extend(z.omit(campaignPlaySettingsBaseDtoSchema, { updatedAt: true, version: true }), {
    expectedVersion: versionSchema
  })
  .check(z.superRefine(validateInitiativeSelection))

export type CampaignPlaySettingsDto = z.infer<typeof campaignPlaySettingsDtoSchema>
export type CampaignPlaySettingsOptionsDto = z.infer<typeof campaignPlaySettingsOptionsDtoSchema>
export type SaveCampaignPlaySettingsInput = z.input<typeof saveCampaignPlaySettingsInputSchema>
