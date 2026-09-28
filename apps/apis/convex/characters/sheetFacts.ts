import { prepareCharacterSheetFromContext } from '@artificer-toolkit/rules-runtime/character/sheetPreparation'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { listActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'
import { loadCharacterSheetInputs, type CharacterSheetSourceContext } from './sheetInputs'
import type { CharacterRecordRow } from './stateDocuments'

export type { CharacterSheetSourceContext } from './sheetInputs'

/** Internal current-source rules preparation shared by Sheet-adjacent mechanics. */
export async function loadCharacterSheetFacts<TRow extends CharacterRecordRow = Doc<'characters'>>(
  ctx: QueryCtx,
  userId: string,
  lookupId: string,
  campaignId?: string,
  sourceContext?: CharacterSheetSourceContext,
  catalogScope: 'active' | 'resolution' = 'active',
  authorityScope?: import('../campaigns/authority').CampaignInternalScope,
  /** The row this transaction just wrote, evaluated without reading it back. */
  written?: TRow
) {
  const loaded = await loadCharacterSheetInputs(
    ctx,
    userId,
    lookupId,
    campaignId,
    sourceContext,
    catalogScope,
    authorityScope,
    written
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
    // The Character row was just loaded or written in this transaction.
    activeEffects: await listActiveRuleEffects(
      ctx,
      { kind: 'CHARACTER', characterId: loaded.active.id },
      { ownerVerified: true }
    ),
    sourceContext: sourceContext ?? {
      ...loaded.sourceContext,
      sourcePreparation: evaluated.prepared.sourcePreparation
    }
  }
}
