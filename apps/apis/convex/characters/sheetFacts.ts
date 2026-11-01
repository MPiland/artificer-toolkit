import { prepareCharacterSheetFromContext } from '@artificer-toolkit/rules-runtime/character/sheetPreparation'
import type { QueryCtx } from '../_generated/server'
import {
  listActiveRuleEffects,
  listCarriedActiveRuleEffects
} from '@artificer-toolkit/encounter-persistence/effectStore'
import { readSystem } from '../content/systemDocuments'
import { deriveOnce } from '@artificer-toolkit/encounter-persistence/transactionReads'
import type { CharacterSheetFingerprintReads } from './sheetSections'
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
  referenceSpellIds: readonly string[] = [],
  /** What a fingerprint read in this transaction already loaded. */
  reads?: Partial<CharacterSheetFingerprintReads>
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
    referenceSpellIds,
    reads?.system && reads.sources
      ? { system: deriveOnce(reads.system, readSystem), sources: reads.sources }
      : undefined
  )
  if (!loaded) return null
  const evaluated = await prepareCharacterSheetFromContext({
    character: loaded.character,
    context: loaded.sourceContext.context,
    sheetState: loaded.sheetState,
    campaignContext: loaded.campaignContext,
    sourcePreparation: loaded.sourceContext.sourcePreparation,
    referenceSpellIds,
    builderPreparation: loaded.sourceContext.builderPreparation
  })
  const reader = { db: createConvexEncounterStoreReader(ctx) }
  const activeEffects =
    reads?.activeEffects ??
    (await listActiveRuleEffects(
      reader,
      { kind: 'CHARACTER', characterId: loaded.active.id },
      { ownerVerified: true }
    ))
  const carriedEffects =
    reads?.carriedEffects ?? (await listCarriedActiveRuleEffects(reader, loaded.active.id))
  return {
    ...loaded,
    ...evaluated,
    // The Character row was just loaded or written in this transaction.
    activeEffects,
    concentrationEffects: carriedEffects.length === 0 ? null : carriedEffects,
    sourceContext: {
      ...loaded.sourceContext,
      sourcePreparation: evaluated.prepared.sourcePreparation,
      builderPreparation: evaluated.builderPreparation
    }
  }
}
