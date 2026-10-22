import { runInDurableObject } from 'cloudflare:test'
import {
  projectNativeActionPending,
  readNativeActionPending
} from '@artificer-toolkit/encounter-persistence/actionPending'
import {
  projectNativeAreaActionPending,
  readNativeAreaActionPending
} from '@artificer-toolkit/encounter-persistence/actionAreaPending'
import {
  projectNativeBasicActionCheckPending,
  projectNativeD20WindowPending
} from '@artificer-toolkit/encounter-persistence/basicActionCheckPending'
import { projectNativeCleavingPending } from '@artificer-toolkit/encounter-persistence/cleavingPending'
import { readEncounterActorConditionState } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { projectNativeConcentrationPending } from '@artificer-toolkit/encounter-persistence/concentrationPending'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { readEncounterTimelinePage } from '@artificer-toolkit/encounter-persistence/timelinePages'
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

/** The conditions a Creature actor holds in the room's stored Run. */
export function readActorConditionIds(history: RoomHistory, actorId: string) {
  const row = history.actors.find(({ id }) => id === actorId)
  if (!row) throw new Error('Expected the actor in the stored Run.')
  const actor = readStoredRunActor(row)
  if (actor.kind === 'CHARACTER')
    throw new Error('A Character holds its conditions on the Character.')
  return readEncounterActorConditionState(actor.conditions).ids
}

/** The current hit points a Creature actor holds in the room's stored Run. */
export function readActorHitPoints(history: RoomHistory, actorId: string) {
  const row = history.actors.find(({ id }) => id === actorId)
  if (!row) throw new Error('Expected the actor in the stored Run.')
  const actor = readStoredRunActor(row)
  if (actor.kind === 'CHARACTER')
    throw new Error('A Character holds its hit points on the Character.')
  return actor.currentHitPoints
}

/** The damage-type record a Creature actor holds in the room's stored Run (empty when absent). */
export function readActorDamageTypesTaken(history: RoomHistory, actorId: string) {
  const row = history.actors.find(({ id }) => id === actorId)
  if (!row) throw new Error('Expected the actor in the stored Run.')
  const actor = readStoredRunActor(row)
  if (actor.kind === 'CHARACTER') throw new Error('A Character holds no damage-type record.')
  return actor.damageTypesSinceTurnStart ?? []
}

/** A stored receipt's rule execution, parsed by the shared contract. */
export function parseReceiptExecution(receipt: { resultJson: string }) {
  return storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
}

/**
 * The Encounter's one PENDING action decision (a d20 or outcome roll, or a contested Disarm roll),
 * projected as the room shows it to the GM (or, for an action d20, to a player when `isOwner` is
 * false); null when none waits.
 */
export function readPendingActionDecision(stub: RoomStub, isOwner = true) {
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
      kind === 'ENCOUNTER_DAMAGE_SAVE_CHECK'
        ? projectNativeConcentrationPending(occurrence, snapshot)
        : kind === 'ENCOUNTER_CONCEALMENT_CHECK' ||
            kind === 'ENCOUNTER_ESCAPE_CHECK' ||
            kind === 'ENCOUNTER_CHECK_ACTION'
          ? projectNativeBasicActionCheckPending(occurrence, snapshot)
          : kind === 'ENCOUNTER_D20_WINDOW'
            ? projectNativeD20WindowPending(occurrence, snapshot)
            : kind === 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING'
              ? projectNativeCleavingPending(occurrence, snapshot, {
                  isOwner: true,
                  controlledActorIds: actorIds,
                  visibleActorIds: actorIds
                })
              : kind === 'ENCOUNTER_AREA_ACTION'
                ? projectNativeAreaActionPending(
                    occurrence,
                    await readNativeAreaActionPending({ db: room.store }, occurrence),
                    {
                      isOwner,
                      controlledActorIds: isOwner ? actorIds : new Set(),
                      actors: room.documents('encounterRunActors').map(readStoredRunActor)
                    }
                  )
                : projectNativeActionPending(
                    occurrence,
                    await readNativeActionPending({ db: room.store }, occurrence),
                    isOwner
                  )
    if (!pending) throw new Error('The pending decision is not shown to the GM.')
    return {
      occurrence,
      encounterVersion: room.documents('encounterRuns')[0]!.version,
      pending
    }
  })
}

/** The stored context of the Encounter's one PENDING single-target action, server-side facts included. */
export function readPendingActionContext(stub: RoomStub) {
  return runInDurableObject(stub, async (_instance, context) => {
    const room = new RoomEncounterStore(context.storage)
    const occurrence = room
      .documents('encounterRuleOccurrences')
      .find((candidate) => candidate.state === 'PENDING')
    if (!occurrence) throw new Error('No action decision is pending.')
    return (await readNativeActionPending({ db: room.store }, occurrence)).context
  })
}

/** The stored application context of the Encounter's one PENDING occurrence, whatever its kind. */
export function readPendingApplicationContext(stub: RoomStub) {
  return runInDurableObject(stub, async (_instance, context) => {
    const room = new RoomEncounterStore(context.storage)
    const occurrence = room
      .documents('encounterRuleOccurrences')
      .find((candidate) => candidate.state === 'PENDING')
    if (!occurrence) throw new Error('No decision is pending.')
    const snapshot = await readPendingSnapshot({ db: room.store }, occurrence)
    if (!snapshot) throw new Error('The pending occurrence holds no snapshot.')
    return snapshot.applicationContext
  })
}

/**
 * The pending area as one viewer reads it: the GM, or a player who controls `controlledActorIds`.
 * Null when the viewer has nothing in it to answer.
 */
export function readPendingAreaForViewer(
  stub: RoomStub,
  viewer: { isOwner: boolean; controlledActorIds: ReadonlySet<string> }
) {
  return runInDurableObject(stub, async (_instance, context) => {
    const room = new RoomEncounterStore(context.storage)
    const occurrence = room
      .documents('encounterRuleOccurrences')
      .find((candidate) => candidate.state === 'PENDING')
    if (!occurrence) throw new Error('No area is pending.')

    const pending = projectNativeAreaActionPending(
      occurrence,
      await readNativeAreaActionPending({ db: room.store }, occurrence),
      { ...viewer, actors: room.documents('encounterRunActors').map(readStoredRunActor) }
    )
    if (pending && pending.kind !== 'AREA_SAVES') throw new Error('The pending area is invalid.')
    return pending
  })
}

/**
 * What the pending area stored of each creature that was offered a Legendary Resistance choice: the
 * selection decided, or null while it waits.
 */
export function readPendingAreaChoices(stub: RoomStub) {
  return runInDurableObject(stub, async (_instance, context) => {
    const room = new RoomEncounterStore(context.storage)
    const occurrence = room
      .documents('encounterRuleOccurrences')
      .find((candidate) => candidate.state === 'PENDING')
    if (!occurrence) throw new Error('No area is pending.')
    const { targets } = await readNativeAreaActionPending({ db: room.store }, occurrence)
    return targets.flatMap((target) =>
      target.legendaryResistance
        ? [
            {
              actorId: target.actorId,
              selection: target.legendaryResistance.decision?.selection ?? null
            }
          ]
        : []
    )
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

/**
 * Each private roll the room retains: whose history holds it and whether the GM's reveal binding
 * rides along (a player's own copy has none).
 */
export function readRoomPrivateRollHolders(stub: RoomStub) {
  return runInDurableObject(stub, async (_instance, context) =>
    new RoomEncounterStore(context.storage)
      .records(ROOM_PRIVATE_ROLL)
      .map((record) => liveSessionCheckpointRetainedRollSchema.parse(JSON.parse(record.json)))
      .map(({ userId, record, gmCampaignRoll }) => ({ userId, rollId: record.id, gmCampaignRoll }))
  )
}

/** The bodies of the Run's chat entries, in the order the room stored them. */
export function readRoomChatBodies(stub: RoomStub) {
  return runInDurableObject(stub, async (_instance, context) =>
    new RoomEncounterStore(context.storage)
      .documents('campaignConversationEntryPayloads')
      .flatMap((payload) => (payload.kind === 'CHAT' && payload.body ? [payload.body] : []))
  )
}

/**
 * The Run's timeline page as the GM or a player reads it, produced by the shared page reader over
 * the room's stored commands, newest first.
 */
export function readRoomTimeline(
  stub: RoomStub,
  { player, userId }: { player: boolean; userId: string }
) {
  return runInDurableObject(stub, async (_instance, context) => {
    const room = new RoomEncounterStore(context.storage)
    const [run] = room.documents('encounterRuns')
    if (!run) throw new Error('The room holds no Run.')
    const commands = room.documents('encounterRunCommands')
    return readEncounterTimelinePage({
      campaignId: run.campaignId,
      player,
      userId,
      runVersion: run.version,
      cursorVersion: null,
      limit: 100,
      async *scan({ visibility, beforeVersion }) {
        const rows = commands
          .filter(
            (command) =>
              (command.version ?? 0) < beforeVersion &&
              (visibility === null || command.visibility === visibility)
          )
          .sort((left, right) => (right.version ?? 0) - (left.version ?? 0))
        for (const row of rows) yield row
      },
      read: async (command) => command
    })
  })
}
