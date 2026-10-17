import { expect } from 'vitest'

import type { actionRoom } from './actionRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  type RoomHistory
} from './roomHistoryReads.js'

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
      spent: Object.entries(state.resources.ruleUsage ?? {})
    }
  })

/** Where each actor's token stands in the Scene the room last synced to the GM. */
export function tokenPositions(room: Awaited<ReturnType<typeof actionRoom>>) {
  const sync = room.room.base.messages.findLast((message) => message.type === 'STATE_SYNC')
  if (sync?.type !== 'STATE_SYNC' || !sync.state.scene)
    throw new Error('The room has sent the GM no Scene.')
  const tokens = sync.state.scene.tokens
  return (actorId: string) =>
    tokens.find(({ id }) => id === `f${actorId.slice(1)}`)?.position ?? null
}

/** Answers every save the area still waits on with `faces[actorId]` (a failing 1 unless named). */
export async function answerAllSaves(
  room: Awaited<ReturnType<typeof actionRoom>>,
  faces: Record<string, number> = {}
) {
  for (;;) {
    const decision = await readPendingActionDecision(room.room.base.stub)
    if (decision?.pending.kind !== 'AREA_SAVES') return
    const [save] = decision.pending.saves
    if (!save) return
    const answer = await room.send(
      room.resolveCommand(decision, {
        kind: 'ENTER_DICE',
        requestId: save.request.requestId,
        rawFaces: [faces[save.actorId] ?? 1],
        rollMode: save.request.rollMode
      })
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  }
}
