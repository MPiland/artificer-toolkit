import { runInDurableObject } from 'cloudflare:test'
import {
  projectNativeActionPending,
  readNativeActionPending
} from '@artificer-toolkit/encounter-persistence/actionPending'
import { projectNativeBasicActionCheckPending } from '@artificer-toolkit/encounter-persistence/basicActionCheckPending'
import { projectNativeCleavingPending } from '@artificer-toolkit/encounter-persistence/cleavingPending'
import { projectNativeConcentrationPending } from '@artificer-toolkit/encounter-persistence/concentrationPending'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { liveSessionCheckpointRetainedRollSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'

import { ROOM_PRIVATE_ROLL } from '../src/roomPrivateRolls.js'
import { RoomEncounterStore } from '../src/roomEncounterStore.js'

type RoomStub = DurableObjectStub

/**
 * The Run history the room alone holds (D85, D88): command rows, rule receipts and occurrences,
 * held app rolls and active effects, each in commit order.
 */
export function readRoomHistory(stub: RoomStub) {
  return runInDurableObject(stub, async (_instance, context) => {
    const store = new RoomEncounterStore(context.storage)
    return {
      runs: store.documents('encounterRuns'),
      actors: store.documents('encounterRunActors'),
      commands: store.documents('encounterRunCommands'),
      receipts: store.documents('encounterRuleReceipts'),
      occurrences: store.documents('encounterRuleOccurrences'),
      evidenceRolls: store.documents('encounterEvidenceRolls'),
      activeEffects: store.documents('encounterActiveRuleEffects'),
      maintainedStates: store.documents('encounterMaintainedEffectStates'),
      characterEffects: store.documents('characterActiveRuleEffects')
    }
  })
}

export type RoomHistory = Awaited<ReturnType<typeof readRoomHistory>>

/** A stored receipt's rule execution, parsed by the shared contract. */
export function parseReceiptExecution(receipt: { resultJson: string }) {
  return storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
}

/**
 * The Encounter's one PENDING action decision (a d20 or outcome roll, or a contested Disarm roll),
 * projected as the room shows it to the GM; null when none waits.
 */
export function readPendingActionDecision(stub: RoomStub) {
  return runInDurableObject(stub, async (_instance, context) => {
    const room = new RoomEncounterStore(context.storage)
    const occurrence = room
      .documents('encounterRuleOccurrences')
      .find((candidate) => candidate.state === 'PENDING')
    if (!occurrence) return null
    const snapshot = await readPendingSnapshot({ db: room.store }, occurrence)
    if (!snapshot) throw new Error('The pending occurrence holds no snapshot.')
    const actorIds = new Set(room.documents('encounterRunActors').map((actor) => actor.id))
    const { kind } = snapshot.applicationContext
    // The GM's view: every actor is theirs to answer for and to see.
    const pending =
      kind === 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK'
        ? projectNativeConcentrationPending(occurrence, snapshot)
        : kind === 'ENCOUNTER_BASIC_ACTION_CHECK'
          ? projectNativeBasicActionCheckPending(occurrence, snapshot)
          : kind === 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING'
            ? projectNativeCleavingPending(occurrence, snapshot, {
                isOwner: true,
                controlledActorIds: actorIds,
                visibleActorIds: actorIds
              })
            : projectNativeActionPending(
                occurrence,
                await readNativeActionPending({ db: room.store }, occurrence)
              )
    if (!pending) throw new Error('The pending decision is not shown to the GM.')
    return {
      occurrence,
      encounterVersion: room.documents('encounterRuns')[0]!.version,
      pending
    }
  })
}

/**
 * Every roll card the room holds: the table's roll entries and the GM's private history, each as
 * its roll record plus the audience it went to.
 */
export function readRoomRollCards(stub: RoomStub) {
  return runInDurableObject(stub, async (_instance, context) => {
    const room = new RoomEncounterStore(context.storage)
    const table = room
      .documents('campaignConversationEntryPayloads')
      .flatMap((payload) =>
        payload.kind === 'ROLL' && payload.roll
          ? [{ audience: 'TABLE' as const, roll: payload.roll }]
          : []
      )
    const privateRolls = room
      .records(ROOM_PRIVATE_ROLL)
      .map((record) => liveSessionCheckpointRetainedRollSchema.parse(JSON.parse(record.json)))
      .map(({ record }) => ({ audience: 'PRIVATE' as const, roll: record }))
    return [...table, ...privateRolls]
  })
}

/** The bodies of the Run's chat entries, in the order the room stored them. */
export function readRoomChatBodies(stub: RoomStub) {
  return runInDurableObject(stub, async (_instance, context) =>
    new RoomEncounterStore(context.storage)
      .documents('campaignConversationEntryPayloads')
      .flatMap((payload) => (payload.kind === 'CHAT' && payload.body ? [payload.body] : []))
  )
}
