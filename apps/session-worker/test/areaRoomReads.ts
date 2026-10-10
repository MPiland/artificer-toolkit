import { parseReceiptExecution, type RoomHistory } from './roomHistoryReads.js'

/** The settled receipts of the area root and of each target under it, in commit order. */
export function areaReceipts(history: RoomHistory) {
  const executions = history.receipts.map((receipt) => ({
    receipt,
    execution: parseReceiptExecution(receipt)
  }))
  return {
    roots: executions.flatMap(({ receipt, execution }) =>
      receipt.commandType === 'RESOLVE_ACTION' &&
      execution.status === 'AGGREGATE_CHOICE_COMPLETE' &&
      execution.applicationOutputs.kind === 'ENCOUNTER_AREA_ACTION'
        ? [{ receipt, outputs: execution.applicationOutputs }]
        : []
    ),
    children: executions.flatMap(({ receipt, execution }) =>
      execution.status === 'COMPLETE' &&
      (execution.applicationOutputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' ||
        execution.applicationOutputs.kind === 'CHARACTER_MECHANICS_BATCH')
        ? [{ receipt, outputs: execution.applicationOutputs }]
        : []
    )
  }
}

/** What an area changes of each actor: its hit points, conditions and spent Rule usage. */
export const vitalsOf = (history: RoomHistory) =>
  history.actors.map((row) => {
    const state = JSON.parse(row.stateJson) as {
      currentHitPoints?: number
      tempHitPoints?: number
      conditions?: unknown
      defeated?: boolean
      resources: { ruleUsage?: Record<string, number> }
    }
    return {
      id: row.id,
      currentHitPoints: state.currentHitPoints,
      tempHitPoints: state.tempHitPoints,
      conditions: state.conditions,
      defeated: state.defeated,
      spent: Object.entries(state.resources.ruleUsage ?? {}).filter(([, used]) => used !== 0)
    }
  })
