import { z } from 'zod'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '../api/characterRules.js'
import {
  projectionChecksumSchema,
  projectionIdentifierSchema,
  projectionSchemaVersionSchema
} from './identity.js'

const characterStreamVersionSchema = z.number().int().min(0)

/**
 * Server-only Campaign mechanics overlay for one assigned Character. It binds
 * the exact Character-owned mechanics projection and the applied Campaign
 * mechanical context; it intentionally does not duplicate Character state.
 */
export const campaignCharacterMechanicsProjectionSchema = z.strictObject({
  campaignId: projectionIdentifierSchema,
  characterId: projectionIdentifierSchema,
  characterStreamVersion: characterStreamVersionSchema,
  baseMechanicsProjectionChecksum: projectionChecksumSchema,
  mechanicalContextChecksum: projectionChecksumSchema,
  projectionSchemaVersion: projectionSchemaVersionSchema,
  projectionChecksum: projectionChecksumSchema,
  rulePolicyInput: characterRulePolicyInputSchema,
  rulePolicyOutput: characterRulePolicyOutputSchema
})

export type CampaignCharacterMechanicsProjection = z.infer<
  typeof campaignCharacterMechanicsProjectionSchema
>
