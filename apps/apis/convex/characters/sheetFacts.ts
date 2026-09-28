import { prepareCharacterSheetFromContext } from '@artificer-toolkit/rules-runtime/character/sheetPreparation'
import type { QueryCtx } from '../_generated/server'
import { listActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'
import { loadCharacterSheetInputs, type CharacterSheetSourceContext } from './sheetInputs'

export type { CharacterSheetSourceContext } from './sheetInputs'

/** Internal current-source rules preparation shared by Sheet-adjacent mechanics. */
export async function loadCharacterSheetFacts(
  ctx: QueryCtx,
  userId: string,
  lookupId: string,
  campaignId?: string,
  sourceContext?: CharacterSheetSourceContext,
  catalogScope: 'active' | 'resolution' = 'active',
  authorityScope?: import('../campaigns/authority').CampaignInternalScope
) {
  const loaded = await loadCharacterSheetInputs(
    ctx,
    userId,
    lookupId,
    campaignId,
    sourceContext,
    catalogScope,
    authorityScope
  )
  if (!loaded) return null
  const evaluated = await prepareCharacterSheetFromContext({
    character: loaded.character,
    context: loaded.sourceContext.context,
    sheetState: loaded.sheetState,
    campaignContext: loaded.campaignContext,
    sourcePreparation: sourceContext?.sourcePreparation
  })
  return {
    ...loaded,
    ...evaluated,
    activeEffects: await listActiveRuleEffects(ctx, {
      kind: 'CHARACTER',
      characterId: loaded.active.id
    }),
    sourceContext: sourceContext ?? {
      ...loaded.sourceContext,
      sourcePreparation: evaluated.prepared.sourcePreparation
    }
  }
}
