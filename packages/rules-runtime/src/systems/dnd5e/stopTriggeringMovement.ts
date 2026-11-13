import type { CommittedExecutionOutputs } from '../../executionOutcomeCapability.js'

/**
 * Whether a committed reaction execution authorized the stop its movement trigger authors, so the
 * move it answered ends where it stands. The compiler binds that authorization to the graph that
 * resolves the authored path: the TEST phase of an action that has one, and its one graph otherwise.
 */
export function executionStopsTriggeringMovement(execution: CommittedExecutionOutputs): boolean {
  const test = execution.phaseReceipts?.find(({ phase }) => phase === 'TEST')
  return (test?.execution ?? execution).outputs.movementInterruption === true
}
