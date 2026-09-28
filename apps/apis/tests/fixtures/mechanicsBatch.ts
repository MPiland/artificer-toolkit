import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type { MutationCtx } from '../../convex/_generated/server'
import {
  loadCharacterSheetFacts,
  type CharacterSheetSourceContext
} from '../../convex/characters/sheetFacts'
import {
  readEncounterMechanicsBatchTarget,
  persistEncounterMechanicsBatchPlan,
  type EncounterMechanicsBatchResult
} from '@artificer-toolkit/encounter-persistence/mechanicsBatchPersistence'
import { encounterWriteTransaction } from '../../convex/encounters/encounterPorts'

export type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
export type { EncounterMechanicsBatchResult } from '@artificer-toolkit/encounter-persistence/mechanicsBatchPersistence'

/**
 * Plans a batch against current state as the room does and persists it with Convex's writer in the
 * caller's transaction; sourceContext reuses only authored sources.
 */
export async function applyEncounterMechanicsBatch(
  ctx: MutationCtx,
  input: EncounterMechanicsBatchInput,
  sourceContext?: CharacterSheetSourceContext
): Promise<EncounterMechanicsBatchResult> {
  const target = await readEncounterMechanicsBatchTarget(encounterWriteTransaction(ctx), input)
  const { actor, campaign, userId } = target
  if (sourceContext && actor.kind !== 'CHARACTER')
    throw new Error('Character Sheet source context requires a Character target.')
  const loaded =
    actor.kind === 'CHARACTER' && actor.sourceId
      ? await loadCharacterSheetFacts(
          ctx,
          campaign.ownerUserId,
          actor.sourceId,
          campaign.id,
          sourceContext
        )
      : null
  const plan = planEncounterMechanicsBatch({
    batch: target.input,
    actor,
    userId,
    characterFacts: loaded ?? undefined
  })
  return persistEncounterMechanicsBatchPlan(encounterWriteTransaction(ctx), target, {
    actor,
    character: loaded?.active ?? null,
    plan,
    ...(loaded ? { sourceContext: loaded.sourceContext } : {})
  })
}
