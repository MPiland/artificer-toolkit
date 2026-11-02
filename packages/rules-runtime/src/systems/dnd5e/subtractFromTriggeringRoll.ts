import { dnd5eResolvedProposalTrace } from './dnd5eTestOperationKeys.js'

/** The D&D operation a `SUBTRACT_FROM_TRIGGERING_ROLL` outcome (Cutting Words) compiles to. */
export const DND5E_SUBTRACT_FROM_TRIGGERING_ROLL_PROPOSAL_OPERATION_KEY =
  'dnd5e.subtract-from-triggering-roll-proposal'

/** Whether a committed reaction execution resolved the subtract outcome, so the roll it answered loses the die. */
export function executionSubtractsFromTriggeringRoll(execution: {
  evidence: {
    trace: readonly {
      operation: { key: string }
      outputs: Readonly<Record<string, unknown>>
    }[]
  }
}): boolean {
  return (
    dnd5eResolvedProposalTrace(
      execution.evidence.trace,
      DND5E_SUBTRACT_FROM_TRIGGERING_ROLL_PROPOSAL_OPERATION_KEY
    ) !== undefined
  )
}
