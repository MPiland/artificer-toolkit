import { z, lazySchema } from '../zod.js'

import { dnd5eOptionalCombatRuleKindDtoSchema } from '../shared/reusableDefinitionIdentity.js'
import { tableSafetyPracticeDtoSchema } from './tableSafety.js'
import { timestampSchema, uuidSchema, versionSchema } from './campaignContractSchemas.js'

const policyTextSchema = lazySchema(() =>
  z.nullable(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(4_000)))
)
const optionalCombatDefinitionIdsDtoSchema = lazySchema(() =>
  z._default(z.array(uuidSchema).check(z.maxLength(14)), []).check(
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
)
export const automationModeDtoSchema = lazySchema(() => z.enum(['ASSISTED', 'MANUAL']))
export type AutomationModeDto = z.infer<typeof automationModeDtoSchema>
/** How concealed zones are noticed: the GM is prompted on a sighting, or only a Search finds them (MOVE-3.5). */
export const zoneNoticingModeDtoSchema = lazySchema(() => z.enum(['GM_PROMPT', 'SEARCH_ONLY']))
export type ZoneNoticingModeDto = z.infer<typeof zoneNoticingModeDtoSchema>

const campaignPlaySettingsBaseDtoSchema = lazySchema(() =>
  z.strictObject({
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
    /** When on, each ammunition attack draws its pieces from the chosen stack (ATTACK-19.4, D4). */
    trackAmmunition: z._default(z.boolean(), false),
    zoneNoticing: z._default(zoneNoticingModeDtoSchema, 'GM_PROMPT'),
    initiativePolicyDefinitionId: z._default(z.nullable(uuidSchema), null),
    initiativeTieDefinitionId: z._default(z.nullable(uuidSchema), null),
    optionalCombatRuleDefinitionIds: optionalCombatDefinitionIdsDtoSchema,
    version: versionSchema,
    updatedAt: timestampSchema
  })
)

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

export const campaignPlaySettingsDtoSchema = lazySchema(() =>
  campaignPlaySettingsBaseDtoSchema.check(z.superRefine(validateInitiativeSelection))
)

export const getCampaignPlaySettingsInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema
  })
)

const campaignDefinitionOptionDtoSchema = lazySchema(() =>
  z.strictObject({
    definitionId: uuidSchema,
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))
  })
)

export const campaignInitiativePolicyOptionDtoSchema = lazySchema(() =>
  z.extend(campaignDefinitionOptionDtoSchema, {
    defaultTieResolverDefinitionId: uuidSchema,
    tieResolvers: z
      .array(campaignDefinitionOptionDtoSchema)
      .check(z.minLength(1))
      .check(z.maxLength(16))
  })
)

export const campaignOptionalCombatRuleOptionDtoSchema = lazySchema(() =>
  z.extend(campaignDefinitionOptionDtoSchema, {
    kind: dnd5eOptionalCombatRuleKindDtoSchema
  })
)

export const campaignPlaySettingsOptionsDtoSchema = lazySchema(() =>
  z.strictObject({
    initiativePolicies: z.array(campaignInitiativePolicyOptionDtoSchema),
    optionalCombatRules: z.array(campaignOptionalCombatRuleOptionDtoSchema).check(z.maxLength(14))
  })
)

export const saveCampaignPlaySettingsInputSchema = lazySchema(() =>
  z
    .extend(z.omit(campaignPlaySettingsBaseDtoSchema, { updatedAt: true, version: true }), {
      expectedVersion: versionSchema
    })
    .check(z.superRefine(validateInitiativeSelection))
)

export type CampaignPlaySettingsDto = z.infer<typeof campaignPlaySettingsDtoSchema>
export type CampaignPlaySettingsOptionsDto = z.infer<typeof campaignPlaySettingsOptionsDtoSchema>
export type SaveCampaignPlaySettingsInput = z.input<typeof saveCampaignPlaySettingsInputSchema>
