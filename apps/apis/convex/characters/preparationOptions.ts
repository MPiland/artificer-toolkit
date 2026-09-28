import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import { presentCampaignCharacterText } from '@artificer-toolkit/rules-runtime/character/campaignCharacterPresentation'
import { characterSheetReadInputSchema } from '@artificer-toolkit/schema/api/characterSheetData'
import {
  characterPreparationOptionsResponseDtoSchema,
  type CharacterPreparationOptionsResponseDto
} from '@artificer-toolkit/schema/api/characterPreparationOptions'
import {
  buildCharacterPreparationOptions,
  collectCharacterSpellPreparationEligibility
} from '@artificer-toolkit/rules-runtime/character/characterSpellPreparationEligibility'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { loadCharacterSheet } from './sheetPreparation'

export function projectCharacterPreparationOptions(
  current: NonNullable<Awaited<ReturnType<typeof loadCharacterSheet>>>
) {
  return characterPreparationOptionsResponseDtoSchema.parse(
    presentCampaignCharacterText(
      buildCharacterPreparationOptions({
        characterId: current.character.id,
        streamVersion: current.sheet.meta.streamVersion,
        eligibility: collectCharacterSpellPreparationEligibility({
          rulePolicyInput: current.ruleEvaluation.facts,
          rulePolicyOutput: current.ruleEvaluation.output
        }),
        summaries: current.evaluationInput.context.catalog.spells,
        committedSpells: current.sheet.spells.spells,
        classes: current.resolution.registry.classes
      }),
      current.contentMaturity,
      current.campaignContext.viewer
    )
  )
}

export const get = query({
  args: zodToConvexFields(characterSheetReadInputSchema.shape),
  returns: v.union(v.null(), zodToConvex(characterPreparationOptionsResponseDtoSchema)),
  handler: async (ctx, args): Promise<CharacterPreparationOptionsResponseDto | null> => {
    const { userId } = await requireIdentity(ctx)
    const { id } = characterSheetReadInputSchema.parse(args)
    const current = await loadCharacterSheet(ctx, userId, id)
    if (!current) return null
    return projectCharacterPreparationOptions(current)
  }
})
