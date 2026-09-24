import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  characterRestPreviewInputSchema,
  characterRestPreviewRequestDtoSchema,
  characterRestPreviewResponseDtoSchema,
  type CharacterRestPreviewRequestDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { rollRecordDtoSchema } from '@artificer-toolkit/schema/api/rolls'
import { resolveCharacterEffectiveMaximumHitPoints } from '@artificer-toolkit/shared/character'
import { evaluateCharacterRules } from '@artificer-toolkit/rules-runtime/character/characterRuleEvaluation'
import {
  mergeCampaignSheetAdjustments,
  projectCharacterRestForViewer
} from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import { CharacterSheetCommandError } from '@artificer-toolkit/rules-runtime/character/sheetCommandReducer'
import {
  buildCharacterRestPreview,
  validateCharacterRestRollEvidence
} from '@artificer-toolkit/rules-runtime/character/sheetRest'
import { query, type QueryCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { loadCharacterSheet } from './sheetPreparation'

/** Shared preparation for the read-only preview and the completing mutation's current read set. */
export async function prepareCharacterRest(
  ctx: QueryCtx,
  userId: string,
  current: NonNullable<Awaited<ReturnType<typeof loadCharacterSheet>>>,
  request: CharacterRestPreviewRequestDto
) {
  const input = characterRestPreviewRequestDtoSchema.parse(request)
  if (current.campaignContext.viewer === 'CAMPAIGN_OWNER' && input.resetMaximumHitPointModifier)
    throw new CharacterSheetCommandError(
      'Campaign owners cannot reset a player maximum-HP modifier.'
    )
  if (input.expectedVersion !== current.active.streamVersion)
    throw new CharacterSheetCommandError(
      'Character Sheet changed; refresh before previewing this rest.'
    )
  const roll = input.rollId
    ? await ctx.db
        .query('userRollHistory')
        .withIndex('by_userId_id', (q) =>
          q.eq('userId', userId).eq('id', input.rollId!.toLowerCase())
        )
        .unique()
    : null
  validateCharacterRestRollEvidence({
    characterId: current.active.id,
    rollId: input.rollId,
    evidence: input.rollEvidence,
    roll: roll && roll.consumedAt === undefined ? rollRecordDtoSchema.parse(roll) : null
  })
  const maximumModifier = input.resetMaximumHitPointModifier
    ? current.sheetState.adjustments.find(
        (adjustment) =>
          adjustment.family === 'HIT_POINTS' && adjustment.field === 'MAXIMUM_MODIFIER'
      )
    : undefined
  const restEvaluation = maximumModifier
    ? evaluateCharacterRules({
        ...current.evaluationInput,
        adjustments: mergeCampaignSheetAdjustments(
          current.sheetState.adjustments.filter(
            (adjustment) => adjustment.id !== maximumModifier.id
          ),
          current.campaignContext.adjustments
        )
      })
    : current.ruleEvaluation
  const preview = await buildCharacterRestPreview({
    character: current.character,
    resolution: current.resolution,
    characterAdjustments: current.sheetState.adjustments,
    effectiveMaximum: resolveCharacterEffectiveMaximumHitPoints(
      restEvaluation.output.derivedStats.maxHitPoints.effective
    ),
    restPolicy: restEvaluation.output.rest,
    sheet: current.sheet,
    input
  })
  return {
    preview: characterRestPreviewResponseDtoSchema.parse(preview),
    restPolicy: restEvaluation.output.rest,
    resetMaximumModifierId: preview.hitPoints.canResetMaximumHitPointModifier
      ? maximumModifier?.id
      : undefined,
    roll
  }
}

export const preview = query({
  args: zodToConvexFields(characterRestPreviewInputSchema.shape),
  returns: zodToConvex(characterRestPreviewResponseDtoSchema),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const input = characterRestPreviewInputSchema.parse(args)
    const current = await loadCharacterSheet(ctx, userId, input.id)
    if (!current)
      throw new CharacterSheetCommandError('Character Sheet is unavailable for the current user.')
    return projectCharacterRestForViewer(
      (await prepareCharacterRest(ctx, userId, current, input.input)).preview,
      current.campaignContext
    )
  }
})
