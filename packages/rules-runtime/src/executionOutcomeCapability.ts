import type { TeleportAllowanceDestinationKind } from '@artificer-toolkit/shared/vtt/teleportAllowanceDestinationKind'

/** A committed rules execution, read back by the trace its System's outcome operations wrote. */
export type CommittedExecutionTrace = {
  evidence: {
    trace: readonly {
      operation: { key: string }
      outputs: Readonly<Record<string, unknown>>
    }[]
  }
}

/**
 * The outcomes a committed execution resolved that its commit applies outside the graph: the System
 * that compiled an outcome to its own operation is the one that reads it back.
 */
export interface ExecutionOutcomeCapabilityAdapter {
  gameSystemId: string
  /** Whether a reaction resolved the cancel outcome (Counterspell), so the event it answered has no effect. */
  cancelsTriggeringEvent(execution: CommittedExecutionTrace): boolean
  /** Whether an action resolved the Dash outcome, so its commit adds the actor's speed to the turn. */
  addsSpeedToMovement(execution: CommittedExecutionTrace): boolean
  /** Whether an action resolved the end-effects outcome (Lesser Restoration), so its commit ends the effects. */
  endsEffects(execution: CommittedExecutionTrace): boolean
  /** The one-shot teleport an action granted (Misty Step), or null when it granted none. */
  teleportAllowance(
    execution: CommittedExecutionTrace
  ): { maxFeet: number; destinationKind: TeleportAllowanceDestinationKind } | null
}
