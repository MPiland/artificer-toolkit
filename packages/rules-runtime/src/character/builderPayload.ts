import {
  characterBuilderPayloadDtoSchema,
  type CharacterBuilderIntentCacheDto,
  type CharacterBuilderPayloadDto
} from '@artificer-toolkit/schema/api/characterBuilder'
import type { CampaignContentMaturity } from '@artificer-toolkit/shared/campaign/textPolicy'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { resolveFeatureOptionEligibility } from './builderEligibility.js'
import { resolveCharacterBuilder } from './builderResolution.js'
import type { CharacterBuilderContext } from './builderTypes.js'
import { presentCampaignCharacterText } from './campaignCharacterPresentation.js'
import { toCharacterBuilderPayload } from './characterBuilderView.js'
import { evaluateCharacterRules } from './characterRuleEvaluation.js'

/**
 * The Builder payload for a candidate Character over an assembled Builder context, whether that
 * context came from Convex reads or from content snapshots. The owner sees the Campaign text policy.
 */
export async function resolveCharacterBuilderPayload(
  character: CharacterAuthored,
  context: CharacterBuilderContext,
  input: {
    mode: 'create' | 'edit'
    previousCharacter: CharacterAuthored | null
    builderIntent?: CharacterBuilderIntentCacheDto
    publicId: string
    baseActiveUpdatedAt: string | null
    contentMaturity: CampaignContentMaturity | null
  }
): Promise<CharacterBuilderPayloadDto> {
  const resolution = await resolveCharacterBuilder({
    character,
    mode: input.mode,
    context,
    previousCharacter: input.previousCharacter,
    resolveFeatureOptions: (options) =>
      resolveFeatureOptionEligibility({
        ...options,
        evaluate: async (character, eligibilityFacets) =>
          evaluateCharacterRules({
            character,
            context,
            eligibilityFacets,
            spellDocumentsById: context.spellDocumentsById
          })
      })
  })
  const payload = toCharacterBuilderPayload(
    character,
    resolution,
    input.builderIntent,
    input.baseActiveUpdatedAt,
    input.publicId
  )
  return characterBuilderPayloadDtoSchema.parse({
    ...payload,
    ...presentCampaignCharacterText(
      { resolution: payload.resolution, references: payload.references, view: payload.view },
      input.contentMaturity,
      'CHARACTER_OWNER'
    )
  })
}
