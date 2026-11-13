import { PATH_CODE } from '@artificer-toolkit/shared/core'

import type { CommittedExecutionOutputs } from '../../executionOutcomeCapability.js'
import { DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY } from './effectActionContracts.js'

/**
 * Whether a committed reaction execution authorized the stop its movement trigger authors, so the
 * move it answered ends where it stands. The compiler binds that authorization to the graph that
 * resolves the authored path: the TEST phase of an action that has one, and its one graph otherwise.
 * Legendary Resistance decides the save after that graph ran, so a failed save it turned into a
 * success stops the move only when the trigger authors the success path.
 */
export function executionStopsTriggeringMovement(execution: CommittedExecutionOutputs): boolean {
  const test =
    execution.phaseReceipts?.find(({ phase }) => phase === 'TEST')?.execution ?? execution
  if (!execution.applicationOutputs?.legendaryResistance?.use)
    return test.outputs.movementInterruption === true
  const authorization = test.evidence.trace.find(
    ({ operation }) => operation.key === DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY
  )
  return authorization?.inputs.authoredPath === PATH_CODE.ON_SAVE_SUCCESS
}
