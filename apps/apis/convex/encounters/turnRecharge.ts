import { prepareEncounterTurnRecharge } from '@artificer-toolkit/rules-runtime/encounterTurnRecharge'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import type { MutationCtx } from '../_generated/server'
import { readDefinitionRoot } from '../content/definitionStore'
import { nextRollInt } from '../lib/rollRandom'
import { createRulesRuntime } from '../rules/runtime'
import { readRunActors } from './documents'

/** Plans native start-of-turn Recharge without mutating the Run or its actors. */
export async function prepareNativeTurnRecharge(input: {
  ctx: MutationCtx
  state: EncounterRunState
  userId: string
  root: TurnCoordinatorRootDto
  occurrenceId: string
  actors?: EncounterRunActorState[]
  pending?: ServerRuleExecutionPendingSnapshotDto
  rawDie?: number
  autoRoll: boolean
}) {
  return prepareEncounterTurnRecharge({
    state: input.state,
    autoRoll: input.autoRoll,
    root: input.root,
    occurrenceId: input.occurrenceId,
    actors: input.actors ?? (await readRunActors(input.ctx, input.state)),
    ...(input.pending ? { pending: input.pending } : {}),
    ...(input.rawDie === undefined ? {} : { rawDie: input.rawDie }),
    definitions: {
      requireCurrent: async (definitionId) => {
        const root = await readDefinitionRoot(input.ctx, definitionId, input.userId)
        if (!root?.current || root.current.gameSystemId !== input.state.gameSystemId)
          throw new Error('Recharge definition is unavailable.')
        return root.current
      }
    },
    createRuntime: () => createRulesRuntime(input.ctx, input.userId),
    rollD6: () => nextRollInt(6) + 1
  })
}
