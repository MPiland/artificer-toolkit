import { runInDurableObject } from 'cloudflare:test'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import {
  DND5E_FREE_REACTION_ALLOWANCE_DEFINITION_ID,
  DND5E_REACTION_ALLOWANCE_DEFINITION_ID
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { Dnd5eOptionalCombatRuleKindDto } from '@artificer-toolkit/schema/shared/optionalCombat'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { readRoomScene } from '../src/roomSceneRead.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { reactionClub } from './reactionClubFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

const ATTACKER_ID = testUuid(0x13a0)
const FIRST_TARGET_ID = testUuid(0x13a1)
const SECOND_TARGET_ID = testUuid(0x13a2)
const FIGHTER_ACTOR_ID = testUuid(0x13a3)
const FIGHTER_ID = testUuid(0x13a4)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * ATTACK-13.T1: a Wolf whose Bite reaches 20 ft, beside two plain Wolves, in that turn order. Every
 * die shows its minimum, so the Bites miss: the mark comes from the attack, not the hit, and the
 * reach shows it follows the attack's melee classification rather than its distance.
 */
function markingRoom(optionalCombatKinds: readonly Dnd5eOptionalCombatRuleKindDto[]) {
  const attacker = biteWolf('ATTACK', { reachFeet: 20 })
  return actionRoom({
    autoRoll: 'GAME_MASTER',
    fallbackRoll: 0,
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
      srdCreatureActor({ id: FIRST_TARGET_ID, creature: plainWolf }),
      srdCreatureActor({ id: SECOND_TARGET_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    optionalCombatKinds
  })
}

type MarkingRoom = Awaited<ReturnType<typeof markingRoom>>

/** The attacker's Bite at the Scene token of the target at `targetIndex`. */
async function bite(room: MarkingRoom, targetActorId: string, targetIndex: number) {
  const { answer } = await room.startAction(targetActorId, [], room.sceneContext(targetIndex))
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The marks the attacker holds on creatures: the effects it gave, by holder. */
async function marks(room: MarkingRoom) {
  return (await readRoomHistory(room.room.base.stub)).activeEffects
    .map(({ targetActorId, definitionJson }) => ({
      targetActorId,
      definition: JSON.parse(definitionJson)
    }))
    .filter(
      ({ definition }) =>
        definition.origin?.kind === 'ENCOUNTER' && definition.origin.sourceActorId === ATTACKER_ID
    )
    .map(({ targetActorId }) => targetActorId)
}

/** Ends turns until the attacker's next turn begins. */
async function untilAttackerTurn(room: MarkingRoom) {
  for (let turn = 0; turn < 3; turn++) await room.advanceTurn()
}

describe('room Marking (ATTACK-13.T1)', () => {
  it('marks a melee target until the end of the attacker’s next turn', async () => {
    const room = await markingRoom(['MARK'])
    await bite(room, FIRST_TARGET_ID, 1)
    expect(await marks(room)).toEqual([FIRST_TARGET_ID])

    await untilAttackerTurn(room)
    expect(await marks(room)).toEqual([FIRST_TARGET_ID])

    await room.advanceTurn()
    expect(await marks(room)).toEqual([])
  }, 120000)

  it('moves the attacker’s one mark to its new target, and an undo moves it back', async () => {
    const room = await markingRoom(['MARK'])
    await bite(room, FIRST_TARGET_ID, 1)
    await untilAttackerTurn(room)

    await bite(room, SECOND_TARGET_ID, 2)
    expect(await marks(room)).toEqual([SECOND_TARGET_ID])

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await marks(room)).toEqual([FIRST_TARGET_ID])
  }, 120000)

  it('marks nothing while Marking is off', async () => {
    const room = await markingRoom([])
    await bite(room, FIRST_TARGET_ID, 1)
    expect(await marks(room)).toEqual([])
  }, 120000)
})

/**
 * ATTACK-13.T2: a Fighter with a Club and a Reaction Club beside two Wolves, in that turn order.
 * Every die shows its minimum, so every attack misses and the Wolves keep walking.
 */
function fighterMarkingRoom() {
  return actionRoom({
    autoRoll: 'BOTH',
    fallbackRoll: 0,
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: FIRST_TARGET_ID, creature: plainWolf }),
      srdCreatureActor({ id: SECOND_TARGET_ID, creature: plainWolf })
    ],
    characterEquipment: [reactionClub],
    characterAction: (action) =>
      action.label.includes('Club') && !action.label.includes('Reaction'),
    optionalCombatKinds: ['MARK']
  })
}

/** Beside the Fighter, then out of its reach and back. */
const BESIDE: ScenePoint = { x: 250, y: 250 }
const AWAY: ScenePoint = { x: 250, y: 350 }

function sceneVersion(room: MarkingRoom) {
  return runInDurableObject(
    room.room.base.stub,
    async (_instance, context) =>
      readRoomScene(new RoomEncounterStore(context.storage), room.room.scene.id).header.version
  )
}

/** The first Wolf walks `path` on its own turn. */
async function walk(room: MarkingRoom, path: readonly ScenePoint[]) {
  const moved = await room.room.move(
    path,
    await room.version(),
    await sceneVersion(room),
    room.room.scene.tokens[1]!.id
  )
  expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
}

/** The Fighter takes the one opportunity attack the room offers it; returns that attack's roll mode. */
async function takeOpportunityAttack(room: MarkingRoom) {
  const pending = await room.room.pending()
  if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error(`Expected a reaction decision, got ${pending?.context.kind}.`)
  const option = pending.context.reactionTimeline[0]?.group.options[0]
  if (!option) throw new Error('The reaction decision offers no option.')
  const used = await room.room.respond({ kind: 'OPTION', optionId: option.optionId })
  expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
  const receipt = (await room.room.receipts()).find((entry) => entry.commandId === used.commandId)
  if (!receipt) throw new Error('The reaction left no receipt.')
  const result = storedRuleExecutionResultDtoSchema.parse(receipt.result)
  if (
    result.status !== 'MOVEMENT_COMPLETE' &&
    !(result.status === 'BATCH_COMPLETE' && result.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT')
  )
    throw new Error(`Expected a movement result, got ${result.status}.`)
  const { application } = result.reactionExecutions[0]!
  if (!('d20' in application) || !application.d20)
    throw new Error('Expected a reaction attack d20.')
  return application.d20.rollMode
}

/** The Fighter's spent reaction and this turn's record of its free reaction, with the Run's turn. */
async function fighterReactions(room: MarkingRoom) {
  const { runs, actors } = await readRoomHistory(room.room.base.stub)
  const fighter = actors.find(({ id }) => id === FIGHTER_ACTOR_ID)
  if (!fighter) throw new Error('The room holds no Fighter.')
  const { resources } = JSON.parse(fighter.stateJson) as {
    resources: {
      ruleUsage?: Record<string, number>
      turnUsage?: Record<string, { turnSequence: number; used: number }>
    }
  }
  return {
    turnSequence: readRunState(runs[0]!).turnSequence,
    reactionUsed: resources.ruleUsage?.[DND5E_REACTION_ALLOWANCE_DEFINITION_ID] ?? 0,
    freeReaction: resources.turnUsage?.[DND5E_FREE_REACTION_ALLOWANCE_DEFINITION_ID] ?? null
  }
}

describe('room Marking free opportunity attack (ATTACK-13.T2)', () => {
  it('attacks the marked creature with advantage, once a turn without the reaction', async () => {
    const room = await fighterMarkingRoom()
    await bite(room, FIRST_TARGET_ID, 1)
    await room.advanceTurn()
    const { turnSequence } = await fighterReactions(room)

    // The first leave is free: it spends this turn's free reaction, not the Fighter's reaction.
    await walk(room, [{ x: 250, y: 150 }, BESIDE, AWAY])
    expect(await takeOpportunityAttack(room)).toBe('ADVANTAGE')
    expect(await fighterReactions(room)).toEqual({
      turnSequence,
      reactionUsed: 0,
      freeReaction: { turnSequence, used: 1 }
    })

    // A move that settled the attack cannot be undone, so the record it spent stays.
    const sceneUndoId = crypto.randomUUID()
    const sceneUndo = await room.room.send(sceneUndoId, {
      scope: 'SCENE',
      command: {
        type: 'UNDO_LAST_SCENE_MOVE',
        commandId: sceneUndoId,
        expectedSceneVersion: await sceneVersion(room),
        sceneId: room.room.scene.id
      }
    })
    expect(sceneUndo).toMatchObject({
      type: 'COMMAND_REJECTED',
      message: 'This move settled Encounter mechanics and cannot be undone as a Scene move.'
    })
    expect((await fighterReactions(room)).freeReaction).toEqual({ turnSequence, used: 1 })

    // The second leave this turn spends the Fighter's reaction; a third has nothing left.
    await walk(room, [AWAY, BESIDE, AWAY])
    expect(await takeOpportunityAttack(room)).toBe('ADVANTAGE')
    expect(await fighterReactions(room)).toEqual({
      turnSequence,
      reactionUsed: 1,
      freeReaction: { turnSequence, used: 1 }
    })
    await walk(room, [AWAY, BESIDE, AWAY])
    expect(await room.room.pending()).toBeNull()

    // A GM turn move starts a new turn, so the free reaction is back while the reaction stays spent.
    await room.advanceTurn()
    await room.commit({
      type: 'PREVIOUS_TURN',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    const renewed = await fighterReactions(room)
    expect(renewed.turnSequence).toBeGreaterThan(turnSequence)
    await walk(room, [AWAY, BESIDE, AWAY])
    expect(await takeOpportunityAttack(room)).toBe('ADVANTAGE')
    expect(await fighterReactions(room)).toEqual({
      turnSequence: renewed.turnSequence,
      reactionUsed: 1,
      freeReaction: { turnSequence: renewed.turnSequence, used: 1 }
    })
  }, 180000)
})
