import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { prepareTurnLegendaryActions } from '@artificer-toolkit/rules-runtime/encounterTurnLegendaryAction'

import type { MutationCtx } from '../_generated/server'
import type { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readDefinitionRoot } from '../content/definitionStore'
import { nextRollInt } from '../lib/rollRandom'
import { createRulesRuntime } from '../rules/runtime'
import { readRunActors } from './documents'
import { discoverNativeTurnLegendaryWindows } from './turnLegendaryDiscovery'
import { prepareNativeEncounterActionMechanics } from './actionMechanicsPreparation'

type Input = {
  ctx: MutationCtx
  state: EncounterRunState
  userId: string
  autoRoll: boolean
  occurrenceId: string
  root: TurnCoordinatorRootDto
  pending?: ServerRuleExecutionPendingSnapshotDto
  resolution?: ResolveRuleOccurrenceInputDto['resolution']
  updatedAt: string
  refreshIncoming?: boolean
  actors?: Readonly<Awaited<ReturnType<typeof readRunActors>>>
  movementTargets?: Parameters<typeof prepareNativeEncounterActionMechanics>[1]['movementTargets']
  startOutgoing?: boolean
}

/** Reconstructs every completed owner decision before extending a turn; it never writes mechanics. */
export async function prepareNativeTurnLegendaryActions(input: Input) {
  const { ctx, state, userId } = input
  return prepareTurnLegendaryActions<
    NonNullable<Awaited<ReturnType<typeof loadCharacterSheetFacts>>>
  >({
    state,
    userId,
    autoRoll: input.autoRoll,
    occurrenceId: input.occurrenceId,
    root: input.root,
    pending: input.pending,
    resolution: input.resolution,
    updatedAt: input.updatedAt,
    refreshIncoming: input.refreshIncoming,
    actors: input.actors ?? (await readRunActors(ctx, state)),
    movementTargets: input.movementTargets,
    startOutgoing: input.startOutgoing,
    discoverWindows: ({ actors, ...discovery }) =>
      discoverNativeTurnLegendaryWindows({
        ctx,
        userId,
        actors,
        ...discovery
      }),
    prepareMechanics: ({ actors, ...mechanics }) =>
      prepareNativeEncounterActionMechanics(ctx, {
        state,
        campaignOwnerUserId: userId,
        actors,
        ...mechanics,
        overridable: false
      }),
    definitions: {
      requireCurrent: async (definitionId) => {
        const definition = await readDefinitionRoot(ctx, definitionId, userId)
        if (!definition?.current)
          throw new Error('Legendary Action refresh definition is unavailable.')
        return definition.current
      }
    },
    createRuntime: () => createRulesRuntime(ctx, userId),
    rollD20: () => nextRollInt(20) + 1
  })
}
