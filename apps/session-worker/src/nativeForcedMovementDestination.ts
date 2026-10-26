import { type LiveSessionForcedMovement } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import {
  holdForForcedMovementDestination,
  settleForcedMovementDestination
} from '@artificer-toolkit/rules-runtime/encounterForcedMovementChoice'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'

import { type ForcedMovementPick } from './nativeAreaPreparation.js'

type HoldInput = Parameters<typeof holdForForcedMovementDestination>[0]
type SettleInput = Parameters<typeof settleForcedMovementDestination>[0]

/**
 * The destination pick a settled single-target outcome's forced movements owe their source (D157).
 * With a pick owed and no answer, the sealed choice the action or contest pauses on, holding the
 * settled `completion` so the resume never re-runs it; otherwise the movements, the answered
 * target landing on its picked square.
 */
export async function planForcedMovementDestination<
  Movement extends LiveSessionForcedMovement
>(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  encounterId: string
  sourceActorId: string
  outcomePhase: HoldInput['outcomePhase']
  /** Null when nothing settled that could move a creature. */
  settled: {
    pick: ForcedMovementPick
    movements: readonly Movement[]
    completion: HoldInput['completion']
  } | null
  answer: Omit<SettleInput, 'runtime'> | null
}) {
  const { runtime, settled, answer } = input
  const { owed } = settled?.movements.length
    ? await settled.pick({
        encounterId: input.encounterId,
        sourceActorId: input.sourceActorId,
        movements: settled.movements
      })
    : { owed: null }
  if (owed && settled && !answer)
    return {
      kind: 'HELD' as const,
      held: await holdForForcedMovementDestination({
        runtime,
        occurrenceId: input.occurrenceId,
        completion: settled.completion,
        outcomePhase: input.outcomePhase,
        targetActorId: owed.targetActorId,
        positions: owed.positions
      })
    }
  if (answer && !owed) throw new Error('The forced-movement destination is no longer owed.')
  const position =
    answer && owed
      ? await settleForcedMovementDestination({
          runtime,
          continuation: answer.continuation,
          offer: answer.offer,
          position: answer.position
        })
      : null
  return {
    kind: 'SETTLED' as const,
    movements: (settled?.movements ?? []).map((movement) =>
      movement.targetActorId === owed?.targetActorId ? { ...movement, position } : movement
    )
  }
}
