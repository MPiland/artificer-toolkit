import {
  characterBuilderPayloadDtoSchema,
  type CharacterBuilderIntentCacheDto,
  type CharacterBuilderPayloadDto
} from '@artificer-toolkit/schema/api/characterBuilder'
import {
  characterBuilderPreviewOutputSchema,
  type CharacterBuilderPreviewOutput
} from '@artificer-toolkit/schema/api/characterBuilderQueries'
import type { CampaignContentMaturity } from '@artificer-toolkit/shared/campaign/textPolicy'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { resolveFeatureOptionEligibility } from './builderEligibility.js'
import type { prepareCharacterBuilderFromContext } from './builderPreparation.js'
import { createCharacterBuilderChangePreview } from './builderPresentation.js'
import { resolveCharacterBuilder } from './builderResolution.js'
import type { CharacterBuilderContext } from './builderTypes.js'
import { presentCampaignCharacterText } from './campaignCharacterPresentation.js'
import {
  stripCharacterBuilderResolution,
  toCharacterBuilderPayload
} from './characterBuilderView.js'
import { evaluateCharacterRules } from './characterRuleEvaluation.js'

/**
 * The Builder payload for a candidate Character over an assembled Builder context, whether that
 * context came from Convex reads or from content snapshots. The owner sees the Campaign text policy.
 */
export async function resolveCharacterBuilderPayload(
  character: CharacterAuthored,
  context: CharacterBuilderContext & Required<Pick<CharacterBuilderContext, 'presentation'>>,
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
            spellsById: context.spellsById
          })
      })
  })
  const payload = toCharacterBuilderPayload(
    character,
    resolution,
    context.presentation,
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

/** The read-only structural preview of a prepared (not finalized) Builder candidate. */
export function toCharacterBuilderPreviewOutput(
  prepared: Pick<
    Awaited<ReturnType<typeof prepareCharacterBuilderFromContext>>,
    'candidate' | 'character' | 'context' | 'resolution'
  >,
  current: CharacterAuthored | null,
  contentMaturity: CampaignContentMaturity | null
): CharacterBuilderPreviewOutput {
  const predictedStatus = prepared.resolution.readiness.ready ? 'ACTIVE' : 'DRAFT'
  return characterBuilderPreviewOutputSchema.parse({
    character: { ...prepared.character, status: predictedStatus },
    ...presentCampaignCharacterText(
      {
        resolution: stripCharacterBuilderResolution(prepared.resolution),
        preview: createCharacterBuilderChangePreview({
          previousCharacter: current ?? prepared.candidate,
          nextCharacter: prepared.character,
          predictedStatus,
          context: prepared.context
        })
      },
      contentMaturity,
      'CHARACTER_OWNER'
    )
  })
}
