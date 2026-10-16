/** The D&D operation a `CANCEL_TRIGGERING_EVENT` outcome (Counterspell) compiles to. */
export const DND5E_CANCEL_TRIGGERING_EVENT_PROPOSAL_OPERATION_KEY =
  'dnd5e.cancel-triggering-event-proposal'

/** Whether a committed reaction execution resolved the cancel outcome, so the event it answered has no effect. */
export function executionCancelsTriggeringEvent(execution: {
  evidence: { trace: readonly { operation: { key: string } }[] }
}): boolean {
  return execution.evidence.trace.some(
    (entry) => entry.operation.key === DND5E_CANCEL_TRIGGERING_EVENT_PROPOSAL_OPERATION_KEY
  )
}
