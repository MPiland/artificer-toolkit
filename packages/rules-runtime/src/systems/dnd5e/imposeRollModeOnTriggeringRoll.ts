import { dnd5eResolvedProposalTrace } from './dnd5eTestOperationKeys.js'

/** The D&D operation an `IMPOSE_ROLL_MODE_ON_TRIGGERING_ROLL` outcome (Protection) compiles to. */
export const DND5E_IMPOSE_ROLL_MODE_ON_TRIGGERING_ROLL_PROPOSAL_OPERATION_KEY =
  'dnd5e.impose-roll-mode-on-triggering-roll-proposal'

/** Whether a committed reaction execution resolved the roll-mode outcome, so the roll it answered takes that mode. */
export function executionImposesRollModeOnTriggeringRoll(execution: {
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
      DND5E_IMPOSE_ROLL_MODE_ON_TRIGGERING_ROLL_PROPOSAL_OPERATION_KEY
    ) !== undefined
  )
}
