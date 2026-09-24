import { advanceNativeActionGraphs } from './actionExecution'
import {
  prepareNativeMovementReactionAction,
  discoverNativeMovementResistance,
  type executeNativeMovementReactionAction
} from './actionMovementReactions'
import { replayEncounterMovementReactionAction } from '@artificer-toolkit/rules-runtime/encounterMovementReactionReplay'
import type { MutationCtx } from '../_generated/server'
import type { ServerKernelRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { movementReactionActionExecutionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMovementReactionReceipts'
import type { z } from 'zod'

type MovementReactionActionExecutionDto = z.infer<typeof movementReactionActionExecutionDtoSchema>

/** Replays retained movement action evidence against current prepared facts without persistence or rolls. */
export async function replayNativeMovementReactionAction(input: {
  ctx?: MutationCtx
  runtime: Parameters<typeof advanceNativeActionGraphs>[0]['runtime']
  occurrenceId: string
  prepared: Awaited<ReturnType<typeof prepareNativeMovementReactionAction>>
  issuedSnapshot?: ServerKernelRuleExecutionPendingSnapshotDto
  retained:
    | { kind: 'PENDING'; snapshot: ServerKernelRuleExecutionPendingSnapshotDto }
    | { kind: 'COMPLETE'; receipt: MovementReactionActionExecutionDto }
}): Promise<Awaited<ReturnType<typeof executeNativeMovementReactionAction>>> {
  const ctx = input.ctx
  return replayEncounterMovementReactionAction({
    ...input,
    ...(ctx
      ? { discoverResistance: () => discoverNativeMovementResistance(ctx, input.prepared) }
      : {})
  })
}
