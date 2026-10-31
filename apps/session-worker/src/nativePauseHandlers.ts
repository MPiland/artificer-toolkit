import { attackRetargetPause } from './nativePauseAttackRetarget.js'
import { castReactionPause } from './nativePauseCastReaction.js'
import { d20WindowPause } from './nativePauseD20Window.js'
import { forcedMovementPause } from './nativePauseForcedMovement.js'
import { incomingGatePause } from './nativePauseIncomingGate.js'
import { legendaryResistancePause } from './nativePauseLegendaryResistance.js'
import { onHitPause, reactionPause } from './nativePauseReaction.js'
import type {
  NativePauseAnswer,
  NativePauseHandler,
  NativePauseKind,
  NativePauseReadInput,
  NativePauseSettleContext,
  NativePauseSettlement
} from './nativePauseTypes.js'

/**
 * The Worker's one handler per pause kind (ADR 0039 decision 3). The table is exhaustive: adding a kind
 * to the pause union fails to compile until it has a handler.
 */
const nativePauseHandlers = {
  D20_WINDOW: d20WindowPause,
  LEGENDARY_RESISTANCE: legendaryResistancePause,
  REACTION: reactionPause,
  CAST_REACTION: castReactionPause,
  INCOMING_GATE: incomingGatePause,
  ATTACK_RETARGET: attackRetargetPause,
  ON_HIT: onHitPause,
  FORCED_MOVEMENT: forcedMovementPause
} satisfies { [Kind in NativePauseKind]: NativePauseHandler<Kind> }

/** TypeScript cannot correlate a union kind with its table entry, so dispatch widens the handler once. */
const handlerOf = (kind: NativePauseKind) =>
  nativePauseHandlers[kind] as NativePauseHandler<NativePauseKind>

/** Reads the answer a response carries for the pause its action holds, or its own evidence when none. */
export function readNativePauseAnswer(
  input: Pick<NativePauseReadInput<NativePauseKind>, 'snapshot' | 'resolution'> & {
    pause: NativePauseReadInput<NativePauseKind>['pause'] | undefined
  }
): NativePauseAnswer {
  const { pause, snapshot, resolution } = input
  if (!pause) {
    if (
      resolution.kind !== 'ENTER_DICE' &&
      resolution.kind !== 'ENTER_INTEGER' &&
      resolution.kind !== 'SYSTEM_ROLL'
    )
      throw new Error('The action requires dice or integer evidence.')
    return { kind: 'EVIDENCE', answer: resolution }
  }
  return handlerOf(pause.kind).read({
    pause,
    snapshot,
    resolution,
    decision: resolution.kind === 'DECLINE' || resolution.kind === 'OPTION' ? resolution : null,
    dice:
      (resolution.kind === 'ENTER_DICE' || resolution.kind === 'SYSTEM_ROLL') &&
      snapshot.request.requestId === resolution.requestId
        ? resolution
        : null
  })
}

/** Settles an answer the rules graphs resume; null for a kind that pauses before they run. */
export async function settleNativePauseAnswer(
  answer: NativePauseAnswer | null,
  context: NativePauseSettleContext
): Promise<NativePauseSettlement | null> {
  if (!answer || answer.kind === 'EVIDENCE') return null
  return (await handlerOf(answer.kind).settle?.(answer.answer, context)) ?? null
}
