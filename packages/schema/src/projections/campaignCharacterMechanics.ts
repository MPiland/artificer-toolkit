import { z } from '../zod.js'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '../api/characterRules.js'
import {
  projectionChecksumSchema,
  projectionIdentifierSchema,
  projectionSchemaVersionSchema
} from './identity.js'

const characterStreamVersionSchema = z.number().check(z.int()).check(z.gte(0))
const manualMaximumModifierOwnerSchema = z.nullable(z.enum(['CHARACTER', 'CAMPAIGN']))

/**
 * Server-only Campaign mechanics overlay for one assigned Character. It binds
 * the exact Character-owned mechanics projection and the applied Campaign
 * mechanical context; it intentionally does not duplicate Character state.
 */
const campaignCharacterMechanicsProjectionIdentitySchema = z.strictObject({
  campaignId: projectionIdentifierSchema,
  characterId: projectionIdentifierSchema,
  characterStreamVersion: characterStreamVersionSchema,
  baseMechanicsProjectionChecksum: projectionChecksumSchema,
  mechanicalContextChecksum: projectionChecksumSchema,
  manualMaximumModifierOwner: manualMaximumModifierOwnerSchema,
  projectionSchemaVersion: projectionSchemaVersionSchema,
  projectionChecksum: projectionChecksumSchema
})

export const campaignCharacterMechanicsProjectionSchema = z.discriminatedUnion('kind', [
  z.extend(campaignCharacterMechanicsProjectionIdentitySchema, {
    kind: z.literal('BASE_REFERENCE')
  }),
  z.extend(campaignCharacterMechanicsProjectionIdentitySchema, {
    kind: z.literal('MATERIALIZED'),
    rulePolicyInput: characterRulePolicyInputSchema,
    rulePolicyOutput: characterRulePolicyOutputSchema
  })
])

export type CampaignCharacterMechanicsProjection = z.infer<
  typeof campaignCharacterMechanicsProjectionSchema
>

export type ResolvedCampaignCharacterMechanicsProjection = CampaignCharacterMechanicsProjection & {
  rulePolicyInput: z.infer<typeof characterRulePolicyInputSchema>
  rulePolicyOutput: z.infer<typeof characterRulePolicyOutputSchema>
}
