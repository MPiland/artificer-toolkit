import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, type ActionRoomConfig } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { maintenanceDefinition, surgeFeature } from './maintenanceSurgeFixture.js'
import { dependentEffectDefinition } from './movementRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * ROOM-6.3, 6.5, 6.6: the maintenance variants the real room settles. A Fighter's Targeted Surge
 * replaces the prior maintained state the Fighter already owns, whose dependents sit on Characters.
 */

const FIGHTER_ACTOR_ID = testUuid(0xe00)
const FIGHTER_ID = testUuid(0xe01)
const CLERIC_ACTOR_ID = testUuid(0xe02)
const CLERIC_ID = testUuid(0xe03)
const WOLF_ID = testUuid(0xe04)
const PRIOR_STATE_ID = testUuid(0xe10)
/** The captured Character page starts at Character stream version 1 (see `characterPageFixture`). */
const CAPTURED_STREAM_VERSION = 1

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const targetedSurge = surgeFeature({ seed: 0xe100, label: 'Targeted Surge', self: false })

/**
 * The Fighter already maintains a state under `emptyDependentPolicy`; each of `dependentActorIds`
 * (Character actors) holds one effect it maintains.
 */
function priorMaintenance(input: {
  emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY' | 'RETAIN_UNTIL_TERMINAL'
  dependentActorIds: readonly string[]
}): NonNullable<ActionRoomConfig['seed']> {
  return async ({ effects, encounterId, occurredAt }) => {
    await effects.createMaintainedState({
      id: PRIOR_STATE_ID,
      encounterId,
      ownerActorId: FIGHTER_ACTOR_ID,
      descriptor: {
        schemaVersion: 2,
        maintenanceDefinitionId: maintenanceDefinition.id,
        definitionChecksum: maintenanceDefinition.checksum,
        sourceActionId: testUuid(0xe30),
        sourceOccurrenceId: testUuid(0xe31),
        sourceActorId: FIGHTER_ACTOR_ID,
        replacementPolicy: 'REPLACE_SAME_DEFINITION',
        emptyDependentPolicy: input.emptyDependentPolicy
      },
      occurredAt
    })
    for (const [index, targetActorId] of input.dependentActorIds.entries())
      await effects.create({
        id: testUuid(0xe40 + index),
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId },
        maintainedEffectStateId: PRIOR_STATE_ID,
        lifecycle: { schemaVersion: 1, remainingTicks: 3 },
        definition: dependentEffectDefinition({ encounterId, sourceActorId: FIGHTER_ACTOR_ID }),
        occurredAt
      })
  }
}

/** The Fighter and the Cleric (a second player's Character) beside the Wolf the Surge targets. */
function maintenanceRoom(config: Pick<ActionRoomConfig, 'automationMode' | 'seed'>) {
  return actionRoom({
    ...config,
    // Assisted rooms wait for the player's roll; the others roll for the player or the GM.
    ...(config.automationMode !== 'ASSISTED' && { autoRoll: 'BOTH' as const }),
    // Each action's one d4 shows 1.
    rolls: [0, 0],
    characterPlay: { currentHitPoints: 5 },
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      characterActor({ id: CLERIC_ACTOR_ID, characterId: CLERIC_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    secondCharacter: { characterId: CLERIC_ID },
    characterClassFeatures: [targetedSurge],
    definitions: [maintenanceDefinition],
    characterAction: (action) => action.label.includes(targetedSurge.label)
  })
}
type Room = Awaited<ReturnType<typeof maintenanceRoom>>
type Decision = NonNullable<Awaited<ReturnType<typeof readPendingActionDecision>>>

const streamVersionOf = (room: Room, characterId: string) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === characterId)
    if (!row) throw new Error('Missing room Character play state.')
    return row.streamVersion
  })

/** The settled receipt of `commandId`, parsed, with the room's history. */
async function settledBy(room: Room, commandId: string) {
  const history = await readRoomHistory(room.room.base.stub)
  const receipt = history.receipts.find((candidate) => candidate.commandId === commandId)
  if (!receipt) throw new Error('The settling receipt is missing.')
  const execution = parseReceiptExecution(receipt)
  if (execution.status !== 'COMPLETE') throw new Error('The root action did not complete.')
  return { history, execution }
}

/** What a room holds of the maintenance a paused or settled action touches. */
async function maintained(room: Room) {
  const history = await readRoomHistory(room.room.base.stub)
  return {
    states: history.maintainedStates.map(({ id }) => id),
    characterEffects: history.characterEffects.map(({ id }) => id).sort(),
    activeEffects: history.activeEffects.map(({ id }) => id).sort(),
    streams: {
      fighter: await streamVersionOf(room, FIGHTER_ID),
      cleric: await streamVersionOf(room, CLERIC_ID)
    }
  }
}

/** The player rolls the paused action's request: the held roll the answer will name. */
async function holdRoll(room: Room, decision: Decision) {
  expect((await room.rollDice(decision)).type).toBe('COMMAND_COMMITTED')
  const held = (await readRoomHistory(room.room.base.stub)).evidenceRolls.at(-1)
  if (!held) throw new Error('The room holds no roll.')
  return held.id
}

/** The command that answers the paused action's request with the held roll `rollId`. */
function answerWithRoll(room: Room, decision: Decision, rollId: string) {
  if (!('request' in decision.pending)) throw new Error('The decision holds no roll request.')
  return room.resolveCommand(decision, {
    kind: 'SYSTEM_ROLL',
    requestId: decision.pending.request.requestId,
    rollId
  })
}

const bothCharacters = [FIGHTER_ACTOR_ID, CLERIC_ACTOR_ID]
const bothOwnersAdvanced = [
  {
    characterId: FIGHTER_ID,
    beforeStreamVersion: CAPTURED_STREAM_VERSION,
    afterStreamVersion: CAPTURED_STREAM_VERSION + 1
  },
  {
    characterId: CLERIC_ID,
    beforeStreamVersion: CAPTURED_STREAM_VERSION,
    afterStreamVersion: CAPTURED_STREAM_VERSION + 1
  }
]

describe('a replaced maintained state whose dependents sit on several Characters (ROOM-6.3)', () => {
  const seed = priorMaintenance({
    emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY',
    dependentActorIds: bothCharacters
  })

  it('ends a dependent on each Character and advances each Character once', async () => {
    const room = await maintenanceRoom({ seed })
    expect((await maintained(room)).characterEffects).toHaveLength(2)

    const { command, answer } = await room.startAction(WOLF_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const { history, execution } = await settledBy(room, command.commandId)
    const [replacement] = history.maintainedStates
    expect(history.maintainedStates).toHaveLength(1)
    expect(replacement!.id).not.toBe(PRIOR_STATE_ID)
    expect(history.characterEffects).toEqual([])
    expect(execution.applicationOutputs).toMatchObject({
      kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
      sourceCharacterId: FIGHTER_ID,
      sourceCharacterStreamVersion: CAPTURED_STREAM_VERSION + 1,
      maintenanceTransition: {
        kind: 'REPLACE_SAME_DEFINITION',
        priorState: { id: PRIOR_STATE_ID },
        removedDependentEffects: [
          expect.objectContaining({ kind: 'CHARACTER', characterId: FIGHTER_ID }),
          expect.objectContaining({ kind: 'CHARACTER', characterId: CLERIC_ID })
        ],
        characterOwnerTransitions: bothOwnersAdvanced,
        createdState: { id: replacement!.id, sourceActorId: FIGHTER_ACTOR_ID }
      }
    })
    expect((await maintained(room)).streams).toEqual({
      fighter: CAPTURED_STREAM_VERSION + 1,
      cleric: CAPTURED_STREAM_VERSION + 1
    })
  })

  it('still ends the dependent of a Character the GM removed from the Run (detached owner)', async () => {
    const room = await maintenanceRoom({ seed })
    await room.commit({
      type: 'REMOVE_ACTOR',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      actorId: CLERIC_ACTOR_ID
    })
    // D82: a GM removal leaves initiative but keeps the Character's actor and effects.
    expect((await maintained(room)).characterEffects).toHaveLength(2)

    const { command, answer } = await room.startAction(WOLF_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const { history, execution } = await settledBy(room, command.commandId)
    expect(history.characterEffects).toEqual([])
    expect(history.maintainedStates).toHaveLength(1)
    expect(history.maintainedStates[0]!.id).not.toBe(PRIOR_STATE_ID)
    expect(execution.applicationOutputs).toMatchObject({
      maintenanceTransition: { characterOwnerTransitions: bothOwnersAdvanced }
    })
  })
})

describe('an empty prior state retained until terminal (ROOM-6.5)', () => {
  it('is replaced by the next action: no dependent ends and no Character is written for it', async () => {
    const room = await maintenanceRoom({
      seed: priorMaintenance({
        emptyDependentPolicy: 'RETAIN_UNTIL_TERMINAL',
        dependentActorIds: []
      })
    })
    expect(await maintained(room)).toMatchObject({
      states: [PRIOR_STATE_ID],
      characterEffects: [],
      activeEffects: []
    })

    const { command, answer } = await room.startAction(WOLF_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const { history, execution } = await settledBy(room, command.commandId)
    const [replacement] = history.maintainedStates
    expect(history.maintainedStates).toHaveLength(1)
    expect(replacement!.id).not.toBe(PRIOR_STATE_ID)
    expect(execution.applicationOutputs).toMatchObject({
      kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
      maintenanceTransition: {
        kind: 'REPLACE_SAME_DEFINITION',
        priorState: { id: PRIOR_STATE_ID },
        removedDependentEffects: [],
        characterOwnerTransitions: [],
        createdState: { id: replacement!.id, sourceActorId: FIGHTER_ACTOR_ID }
      }
    })
    expect(history.activeEffects).toEqual([
      expect.objectContaining({ maintainedEffectStateId: replacement!.id })
    ])
  })
})

describe('an Assisted action that replaces maintenance (ROOM-6.6)', () => {
  const seed = priorMaintenance({
    emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY',
    dependentActorIds: bothCharacters
  })

  it('writes no maintenance while it waits for the roll, and settles it with the terminal answer', async () => {
    const room = await maintenanceRoom({ automationMode: 'ASSISTED', seed })
    const seeded = await maintained(room)

    const { answer } = await room.startAction(WOLF_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const decision = await room.pendingDecision()
    expect(await maintained(room)).toEqual(seeded)

    const rollId = await holdRoll(room, decision)
    expect(await maintained(room)).toEqual(seeded)

    const answerCommand = answerWithRoll(room, decision, rollId)
    const settled = await room.send(answerCommand)
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')

    const { history, execution } = await settledBy(room, answerCommand.commandId)
    expect(history.maintainedStates.map(({ id }) => id)).not.toContain(PRIOR_STATE_ID)
    expect(history.characterEffects).toEqual([])
    expect(execution.applicationOutputs).toMatchObject({
      maintenanceTransition: {
        priorState: { id: PRIOR_STATE_ID },
        characterOwnerTransitions: bothOwnersAdvanced
      }
    })
  })

  it('refuses the answer when an owner Character changed while it waited, writing nothing', async () => {
    const room = await maintenanceRoom({ automationMode: 'ASSISTED', seed })
    const seeded = await maintained(room)
    const started = await room.startAction(WOLF_ID)
    expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
    const rollId = await holdRoll(room, await room.pendingDecision())

    // The Cleric's owner plays its Sheet, moving the stream the paused action's maintenance read.
    const sheetCommandId = crypto.randomUUID()
    const clericOwner = await room.room.asPlayer('OTHER_PLAYER')
    const sheet = await clericOwner.send(sheetCommandId, {
      scope: 'CHARACTER_SHEET',
      characterId: CLERIC_ID,
      encounterId: room.room.encounterId,
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 1,
        commandId: sheetCommandId,
        expectedVersion: seeded.streams.cleric
      }
    })
    expect(sheet.type, JSON.stringify(sheet)).toBe('COMMAND_COMMITTED')
    const changed = await maintained(room)
    expect(changed.streams.cleric).toBe(seeded.streams.cleric + 1)

    const refused = await room.send(answerWithRoll(room, await room.pendingDecision(), rollId))
    expect(refused.type, JSON.stringify(refused)).toBe('COMMAND_REJECTED')
    expect(await maintained(room)).toEqual(changed)
    expect(changed).toMatchObject({
      states: [PRIOR_STATE_ID],
      characterEffects: seeded.characterEffects
    })
  })
})
