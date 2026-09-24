import { prepareEncounterTurn } from '@artificer-toolkit/rules-runtime/encounterTurnPreparation'
import type { MutationCtx } from '../_generated/server'
import type { MovementTarget } from './movementTargets'
import { prepareNativeTurnEffects } from './turnEffects'
import { prepareNativeTurnInitiative } from './turnInitiative'
import { prepareNativeTurnLegendaryActions } from './turnLegendaryAction'
import { prepareNativeTurnRecharge } from './turnRecharge'

/** Supplies native reads to the shared turn order; every pause leaves aggregate state untouched. */
export async function prepareNativeTurn(
  input: Parameters<
    typeof prepareEncounterTurn<NonNullable<MovementTarget['characterFacts']>>
  >[0] & { ctx: MutationCtx }
) {
  const { ctx, ...turn } = input
  return prepareEncounterTurn<NonNullable<MovementTarget['characterFacts']>>(turn, {
    effects: (stage) => prepareNativeTurnEffects({ ...stage, ctx }),
    legendary: (stage) => prepareNativeTurnLegendaryActions({ ...stage, ctx }),
    initiative: (stage) => prepareNativeTurnInitiative({ ...stage, ctx, campaign: turn.campaign }),
    recharge: (stage) =>
      prepareNativeTurnRecharge({ ...stage, ctx, userId: turn.campaign.ownerUserId })
  })
}
