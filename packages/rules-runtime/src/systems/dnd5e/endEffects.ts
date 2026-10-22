import { dnd5eResolvedProposalTrace } from './dnd5eTestOperationKeys.js'

/** The D&D operation an `END_EFFECTS` outcome (Lesser Restoration) compiles to. */
export const DND5E_END_EFFECTS_PROPOSAL_OPERATION_KEY = 'dnd5e.end-effects-proposal'

/** Whether a committed action execution resolved the end-effects outcome, so its commit ends the effects. */
export function executionEndsEffects(execution: {
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
      DND5E_END_EFFECTS_PROPOSAL_OPERATION_KEY
    ) !== undefined
  )
}
