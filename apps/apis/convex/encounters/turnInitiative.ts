import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { createEncounterInitiativePendingSnapshot } from '@artificer-toolkit/rules-runtime/encounterInitiativeOccurrence'
import { prepareEncounterTurnInitiative } from '@artificer-toolkit/rules-runtime/encounterTurnInitiative'
import { restoreEncounterInitiativeTurnActors } from '@artificer-toolkit/rules-runtime/encounterTurnInitiativeReplay'
import type { MutationCtx } from '../_generated/server'
import { nextRollInt } from '../lib/rollRandom'
import { createRulesRuntime } from '../rules/runtime'
import { readRunActors } from './documents'
import { loadInitiativeDeclarationSources } from './initiativeDeclarationSources'
import { loadEncounterInitiativeSources } from './initiativeSources'
import type { MovementTarget } from './movementTargets'
import { prepareNativeTurnLegendaryActions } from './turnLegendaryAction'
import { prepareNativeTurnEffects } from './turnEffects'
import { createEncounterInitiativeStore } from './initiativeStore'

type InitiativeRoot = Parameters<typeof createEncounterInitiativePendingSnapshot>[0]['root']

/** Replays outgoing decisions before initiative consumes the staged Creature facts. */
export async function restoreNativeInitiativeTurnActors(input: {
  ctx: MutationCtx
  state: EncounterRunState
  campaign: { id: string; ownerUserId: string }
  root: InitiativeRoot
  occurrenceId: string
  updatedAt: string
}) {
  return restoreEncounterInitiativeTurnActors<NonNullable<MovementTarget['characterFacts']>>({
    ...input,
    readActors: () => readRunActors(input.ctx, input.state),
    readInitiativeRound: () =>
      createEncounterInitiativeStore(input.ctx).lockInitiativeRound({
        encounterId: input.state.id,
        round: input.state.round
      }),
    prepareEffects: (stage) => prepareNativeTurnEffects({ ...stage, ctx: input.ctx }),
    prepareLegendary: (stage) => prepareNativeTurnLegendaryActions({ ...stage, ctx: input.ctx })
  })
}
/** Starts the new round only after every outgoing owner window has settled. */
export async function prepareNativeTurnInitiative(input: {
  ctx: MutationCtx
  state: EncounterRunState
  campaign: { id: string; ownerUserId: string }
  root: TurnCoordinatorRootDto
  occurrenceId: string
  actors: readonly EncounterRunActorState[]
  autoRoll: boolean
  movementTargets?: ReadonlyMap<string, MovementTarget>
}) {
  const { ctx, state, campaign, actors } = input
  return prepareEncounterTurnInitiative({
    state,
    autoRoll: input.autoRoll,
    root: input.root,
    occurrenceId: input.occurrenceId,
    actors,
    loadSources: () =>
      loadEncounterInitiativeSources(ctx, state, campaign, actors, input.movementTargets),
    loadDeclarations: () =>
      loadInitiativeDeclarationSources(ctx, state, campaign, actors, input.movementTargets),
    createRuntime: () => createRulesRuntime(ctx, campaign.ownerUserId),
    integerSource: ({ min, max }) => min + nextRollInt(max - min + 1),
    createRequestId: () => crypto.randomUUID()
  })
}
