/** The D&D operation a Dash's `ADD_SPEED_TO_MOVEMENT` outcome compiles to. */
export const DND5E_ADD_SPEED_TO_MOVEMENT_PROPOSAL_OPERATION_KEY =
  'dnd5e.add-speed-to-movement-proposal'

/** Whether a committed action execution resolved the Dash outcome, so its commit adds the speed bonus. */
export function executionAddsSpeedToMovement(execution: {
  evidence: { trace: readonly { operation: { key: string } }[] }
}): boolean {
  return execution.evidence.trace.some(
    (entry) => entry.operation.key === DND5E_ADD_SPEED_TO_MOVEMENT_PROPOSAL_OPERATION_KEY
  )
}
