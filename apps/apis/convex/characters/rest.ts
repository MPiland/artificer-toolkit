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
import { projectCharacterRestForViewer } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import { mergeCampaignSheetAdjustments } from '@artificer-toolkit/rules-runtime/character/sheetAdjustmentIdentity'
import { CharacterSheetCommandError } from '@artificer-toolkit/rules-runtime/character/sheetCommandReducer'
import {
  buildCharacterRestPreview,
  validateCharacterRestRollEvidence
} from '@artificer-toolkit/rules-runtime/character/sheetRest'
import { activeEffectEndsOnRest } from '@artificer-toolkit/rules-runtime/character/sheetRestEndedEffects'
import { effectiveHitPointMaximum } from '@artificer-toolkit/rules-runtime/character/activeEffectGrantTotals'
import { characterHitPointMaximumFraction } from '@artificer-toolkit/rules-runtime/conditionHitPointMaximum'
import { readDefinitionRoot } from '../content/definitionStore'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { loadCharacterSheet } from './sheetPreparation'
import { assertConvexOwnsCharacterPlay } from '../liveSessions/authorityGuard'

/**
 * Reads a hit-die roll's one stored record by id, with the step that spends it. Campaign rests
 * settle only from rolls the GM can see: the caller's TABLE or To GM chat entry, or the GM's own
 * retained roll once revealed. A personal Character outside a Campaign settles from the caller's
 * retained history.
 *
 * A chat entry is found by the caller's nonce for it, which a Sheet roll's entry sets to the roll's
 * id, so the lookup needs no index of its own. A roll inside a card the rules post for an action
 * (its nonce is not a roll id) is never rest evidence.
 */
async function readRestRoll(
  ctx: QueryCtx,
  userId: string,
  campaignId: string | null,
  lookupId: string
) {
  const rollId = lookupId.toLowerCase()
  const retained = await ctx.db
    .query('userRollHistory')
    .withIndex('by_userId_id', (q) => q.eq('userId', userId).eq('id', rollId))
    .unique()
  if (retained) {
    const gmRoll = retained.gmCampaignRoll
    if (campaignId !== null && gmRoll?.campaignId !== campaignId)
      throw new CharacterSheetCommandError(
        'Campaign rest rolls must be retained for this Campaign; roll again within it.'
      )
    return {
      record: rollRecordDtoSchema.parse(retained),
      consumedAt: retained.consumedAt,
      spend: (mutation: MutationCtx, at: string) =>
        mutation.db.patch(retained._id, { consumedAt: at })
    }
  }
  if (campaignId === null) return null
  const entry = await ctx.db
    .query('campaignConversationEntries')
    .withIndex('by_campaignId_authorUserId_clientNonce', (q) =>
      q.eq('campaignId', campaignId).eq('authorUserId', userId).eq('clientNonce', rollId)
    )
    .unique()
  const stored = entry?.rolls.find(({ roll }) => roll.id === rollId)
  if (!entry || !stored) return null
  return {
    record: stored.roll,
    consumedAt: stored.consumedAt,
    spend: (mutation: MutationCtx, at: string) =>
      mutation.db.patch(entry._id, {
        rolls: entry.rolls.map((candidate) =>
          candidate === stored ? { ...candidate, consumedAt: at } : candidate
        )
      })
  }
}

/** Shared preparation for the read-only preview and the completing mutation's current read set. */
export async function prepareCharacterRest(
  ctx: QueryCtx,
  userId: string,
  current: NonNullable<Awaited<ReturnType<typeof loadCharacterSheet>>>,
  request: CharacterRestPreviewRequestDto
) {
  const input = characterRestPreviewRequestDtoSchema.parse(request)
  await assertConvexOwnsCharacterPlay(ctx, current.active.id)
  if (current.campaignContext.viewer === 'CAMPAIGN_OWNER' && input.resetMaximumHitPointModifier)
    throw new CharacterSheetCommandError(
      'Campaign owners cannot reset a player maximum-HP modifier.'
    )
  if (input.expectedVersion !== current.active.play.streamVersion)
    throw new CharacterSheetCommandError(
      'Character Sheet changed; refresh before previewing this rest.'
    )
  const roll = input.rollId
    ? await readRestRoll(ctx, userId, current.campaignContext.campaignId, input.rollId)
    : null
  validateCharacterRestRollEvidence({
    characterId: current.active.id,
    rollId: input.rollId,
    evidence: input.rollEvidence,
    roll: roll && roll.consumedAt === null ? roll.record : null
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
  const definitionReader =
    current.sourceContext.context.sourceAccess.campaign?.ownerUserId ?? current.character.userId
  // A long rest lowers exhaustion, which can lift a condition's maximum-HP fraction (SPELLS-10.T1b).
  const maximumFraction =
    input.restKind === 'LONG'
      ? await characterHitPointMaximumFraction({
          character: {
            systemId: current.character.systemId,
            state: {
              ...current.character.state,
              exhaustion:
                restEvaluation.output.rest.exhaustionAfterLongRest > 0
                  ? { level: restEvaluation.output.rest.exhaustionAfterLongRest }
                  : null
            }
          },
          readCurrentDefinition: async (definitionId) =>
            (await readDefinitionRoot(ctx, definitionId, definitionReader))?.current ?? null
        })
      : (current.character.state.hitpoints.maximumFraction ?? null)
  const preview = await buildCharacterRestPreview({
    character: current.character,
    resolution: current.resolution,
    characterAdjustments: current.sheetState.adjustments,
    // The maximum after the rest: effects the rest ends no longer apply.
    effectiveMaximum: effectiveHitPointMaximum(
      resolveCharacterEffectiveMaximumHitPoints(
        restEvaluation.output.derivedStats.maxHitPoints.effective
      ),
      current.activeEffects.filter((effect) => !activeEffectEndsOnRest(effect, input.restKind)),
      maximumFraction
    ),
    restPolicy: restEvaluation.output.rest,
    sheet: current.sheet,
    input
  })
  return {
    preview: characterRestPreviewResponseDtoSchema.parse(preview),
    restPolicy: restEvaluation.output.rest,
    maximumFraction,
    resetMaximumModifierId: preview.hitPoints.canResetMaximumHitPointModifier
      ? maximumModifier?.id
      : undefined,
    roll
  }
}

export const preview = query({
  args: () => zodToConvexFields(characterRestPreviewInputSchema.shape),
  returns: () => zodToConvex(characterRestPreviewResponseDtoSchema),
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
