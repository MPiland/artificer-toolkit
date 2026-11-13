import type { TeleportAllowanceDestinationKind } from '@artificer-toolkit/shared/vtt/teleportAllowanceDestinationKind'

/** A committed rules execution, read back by the trace its System's outcome operations wrote. */
export type CommittedExecutionTrace = {
  evidence: {
    trace: readonly {
      nodeId: string
      operation: { key: string }
      inputs: Readonly<Record<string, unknown>>
      outputs: Readonly<Record<string, unknown>>
    }[]
  }
}

type CommittedGraphOutputs = {
  outputs: Readonly<Record<string, unknown>>
  evidence: {
    trace: readonly {
      operation: { key: string }
      inputs: Readonly<Record<string, unknown>>
    }[]
  }
}

/**
 * A committed rules execution's graph outputs, with those of each phase it ran in and the decision
 * its target made between them to turn a failed save into a success.
 */
export type CommittedExecutionOutputs = CommittedGraphOutputs & {
  phaseReceipts?: readonly { phase: string; execution: CommittedGraphOutputs }[]
  applicationOutputs?: { kind: string; legendaryResistance?: { use: boolean } | null }
}

/**
 * The outcomes a committed execution resolved that its commit applies outside the graph: the System
 * that compiled an outcome to its own operation is the one that reads it back.
 */
export interface ExecutionOutcomeCapabilityAdapter {
  gameSystemId: string
  /** Whether a reaction resolved the cancel outcome (Counterspell), so the event it answered has no effect. */
  cancelsTriggeringEvent(execution: CommittedExecutionTrace): boolean
  /** Whether a reaction resolved the roll-mode outcome (Protection), so the roll it answered takes that mode. */
  imposesRollModeOnTriggeringRoll(execution: CommittedExecutionTrace): boolean
  /**
   * The die a reaction rolled when it resolved the subtract outcome (Cutting Words), which the roll it
   * answered loses: its size and the faces it rolled. Null when it resolved none.
   */
  triggeringRollSubtraction(
    execution: CommittedExecutionTrace
  ): { faces: number; rolledFaces: number[] } | null
  /** Whether a reaction resolved the stop its movement trigger authors (Sentinel), so the move it answered ends there. */
  stopsTriggeringMovement(execution: CommittedExecutionOutputs): boolean
  /** Whether an action resolved the Dash outcome, so its commit adds the actor's speed to the turn. */
  addsSpeedToMovement(execution: CommittedExecutionTrace): boolean
  /** Whether an action resolved the end-effects outcome (Lesser Restoration), so its commit ends the effects. */
  endsEffects(execution: CommittedExecutionTrace): boolean
  /** The one-shot teleport an action granted (Misty Step), or null when it granted none. */
  teleportAllowance(
    execution: CommittedExecutionTrace
  ): { maxFeet: number; destinationKind: TeleportAllowanceDestinationKind } | null
}
