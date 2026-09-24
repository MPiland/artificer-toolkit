import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type { MutationCtx } from '../_generated/server'
import { loadCharacterSheetFacts, type CharacterSheetSourceContext } from '../characters/sheetFacts'
import {
  readEncounterMechanicsBatchTarget,
  persistEncounterMechanicsBatchPlan,
  type EncounterMechanicsBatchResult
} from './mechanicsBatchPersistence'

export type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
export type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence'

/**
 * Plans against current state and commits inside the caller's transaction. Sequential movement
 * settlements deliberately reload facts after preceding contacts; sourceContext reuses only
 * authored sources, never prior Character play state or rules output.
 */
export async function applyEncounterMechanicsBatch(
  ctx: MutationCtx,
  input: EncounterMechanicsBatchInput,
  sourceContext?: CharacterSheetSourceContext
): Promise<EncounterMechanicsBatchResult> {
  const target = await readEncounterMechanicsBatchTarget(ctx, input)
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
  return persistEncounterMechanicsBatchPlan(ctx, target, {
    actor,
    character: loaded?.active ?? null,
    plan
  })
}
