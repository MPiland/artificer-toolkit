import { prepareCharacterSheetFromContext } from '@artificer-toolkit/rules-runtime/character/sheetPreparation'
import type { QueryCtx } from '../_generated/server'
import {
  listActiveRuleEffects,
  listCarriedActiveRuleEffects
} from '@artificer-toolkit/encounter-persistence/effectStore'
import { loadCharacterSheetInputs, type CharacterSheetSourceContext } from './sheetInputs'
import type { CharacterRecordRow, CharacterRow } from './stateDocuments'
import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'

export type { CharacterSheetSourceContext } from './sheetInputs'

/** Internal current-source rules preparation shared by Sheet-adjacent mechanics. */
export async function loadCharacterSheetFacts<TRow extends CharacterRecordRow = CharacterRow>(
  ctx: QueryCtx,
  userId: string,
  lookupId: string,
  campaignId?: string,
  sourceContext?: CharacterSheetSourceContext,
  catalogScope: 'active' | 'resolution' = 'active',
  authorityScope?: import('../campaigns/authority').CampaignInternalScope,
  /** The row this transaction just wrote, evaluated without reading it back. */
  written?: TRow,
  referenceSpellIds: readonly string[] = []
) {
  const loaded = await loadCharacterSheetInputs(
    ctx,
    userId,
    lookupId,
    campaignId,
    sourceContext,
    catalogScope,
    authorityScope,
    written,
    referenceSpellIds
  )
  if (!loaded) return null
  const evaluated = await prepareCharacterSheetFromContext({
    character: loaded.character,
    context: loaded.sourceContext.context,
    sheetState: loaded.sheetState,
    campaignContext: loaded.campaignContext,
    sourcePreparation: loaded.sourceContext.sourcePreparation,
    referenceSpellIds
  })
  return {
    ...loaded,
    ...evaluated,
    // The Character row was just loaded or written in this transaction.
    activeEffects: await listActiveRuleEffects(
      { db: createConvexEncounterStoreReader(ctx) },
      { kind: 'CHARACTER', characterId: loaded.active.id },
      { ownerVerified: true }
    ),
    concentrationEffects: await listCarriedActiveRuleEffects(
      { db: createConvexEncounterStoreReader(ctx) },
      loaded.active.id
    ).then((carried) => (carried.length === 0 ? null : carried)),
    sourceContext: {
      ...loaded.sourceContext,
      sourcePreparation: evaluated.prepared.sourcePreparation
    }
  }
}
