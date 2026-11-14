import { concentrationCommandId } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { SRD_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import {
  legendaryWolf,
  plainWolf,
  reactionWolf,
  saveStopWolf,
  stopReactionWolf
} from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  CONCENTRATION_STATE_ID,
  concentrationAdvantageFeature,
  movementRoom,
  type MovementRoomConfig
} from './movementRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

/**
 * The movement evidence a room holds and Convex never sees (D88): receipts, evidence rolls and
 * command rows. The apps/apis movement tests assert the state Convex does observe and cite these.
 */

const MOVER_ID = testUuid(0x200)
const REACTOR_ID = testUuid(0x201)
const CHARACTER_ID = testUuid(0x400)

const MOVER_START: ScenePoint = { x: 150, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

type Room = Awaited<ReturnType<typeof movementRoom>>

async function receiptOf(room: Room, commandType: string) {
  const receipt = (await room.receipts()).find((entry) => entry.commandType === commandType)
  if (!receipt) throw new Error(`No ${commandType} receipt was committed.`)
  return receipt
}

/**
 * The settled action a used reaction ran as (D219): the receipt of `commandId` and its result.
 */
async function settledActionOf(room: Room, commandId: string) {
  const receipt = (await room.receipts()).find((entry) => entry.commandId === commandId)
  if (!receipt) throw new Error('The reaction left no action receipt.')
  const result = storedRuleExecutionResultDtoSchema.parse(receipt.result)
  if (result.status !== 'COMPLETE')
    throw new Error(`Expected a settled action, got ${result.status}.`)
  return { receipt, outputs: result.applicationOutputs, occurrenceId: result.occurrenceId }
}

describe('a used automatic reaction followed by a failed Concentration save', () => {
  it.each([{ withSuffix: false }, { withSuffix: true }])(
    'records the save, its cleanup and linked receipts with spatial suffix $withSuffix',
    async ({ withSuffix }) => {
      const room = await movementRoom({
        actors: [
          srdCreatureActor({ id: REACTOR_ID, creature: reactionWolf }),
          characterActor({ id: MOVER_ID, characterId: CHARACTER_ID })
        ],
        moverActorId: MOVER_ID,
        positions: { [REACTOR_ID]: { x: 50, y: 150 }, [MOVER_ID]: MOVER_START },
        autoRoll: 'BOTH',
        concentration: true,
        concentrationDependentActorIds: [MOVER_ID],
        characterClassFeatures: [concentrationAdvantageFeature],
        // The reaction's attack is a 15; its damage and the advantage save land on the minimum.
        rolls: [14],
        fallbackRoll: 0,
        // The suffix effect lies beyond the reaction's contact, where a STOP-less walk goes on to cross it.
        spatialEffects: withSuffix ? [{ center: { x: 375, y: 150 }, radius: 5 }] : []
      })

      await room.move([MOVER_START, { x: 450, y: 150 }])
      const used = await room.useReaction()
      expect(used.answer.type).toBe('COMMAND_COMMITTED')

      // Restated (QUALITY-18.T2b3): the Use answer has no receipt of its own. The reaction runs as
      // the reactor's own action (D219), so its receipt holds what the reaction did, and the room's
      // resume of the move, made as the Campaign owner, holds how the move ended (ruling 7: with no
      // reaction execution of its own).
      const reaction = await settledActionOf(room, used.childCommandId)
      expect(reaction.receipt).toMatchObject({
        commandType: 'RESOLVE_ACTION',
        actorUserId: room.base.userId
      })
      if (reaction.outputs.kind !== 'CHARACTER_MECHANICS_BATCH')
        throw new Error('Expected a Character movement reaction target.')
      const rootReceipt = await receiptOf(room, 'RESOLVE_RULE_OCCURRENCE')
      expect(rootReceipt.commandId).toBe(used.resumeCommandId)
      expect(rootReceipt.actorUserId).toBe(room.base.userId)
      const result = parseMovementResult(rootReceipt.result)
      expect(result.reactionExecutions).toEqual([])
      const spatial = result.status === 'BATCH_COMPLETE' ? result.executions : []

      // The reaction spends the reactor's one Reaction.
      expect(reaction.outputs.actionEconomyTransition).toMatchObject({
        definitionId: SRD_REACTION_ALLOWANCE_DEFINITION_ID,
        beforeUsed: 0,
        afterUsed: 1
      })
      // A suffix effect beyond the contact applies after the reaction, once, to the Character.
      if (withSuffix) {
        expect(spatial).toHaveLength(1)
        expect(spatial[0]?.candidate.candidate).toMatchObject({
          effectId: room.spatialEffectIds[0],
          targetActorId: MOVER_ID
        })
        expect(spatial[0]!.candidate.candidate.pathDistance).toBeGreaterThan(
          used.option.candidate.pathDistance
        )
      } else expect(spatial).toHaveLength(0)

      // Restated (QUALITY-18.T2b3): the save is the Concentration check of the reaction's own
      // action (D219), not a check the move's terminal embeds: one receipt of its own, under the
      // id its occurrence derives, parented by the action's occurrence instead of the move's. It
      // is still rolled with advantage against DC 10.
      const checks = (await room.receipts()).filter(
        (entry) => entry.commandType === 'DAMAGE_SAVE_CHECK'
      )
      expect(checks).toHaveLength(1)
      const [check] = checks
      const concentration = storedRuleExecutionResultDtoSchema.parse(check!.result)
      if (concentration.status !== 'COMPLETE')
        throw new Error(`Expected a settled Concentration check, got ${concentration.status}.`)
      expect(check!.commandId).toBe(concentrationCommandId(concentration.occurrenceId))
      expect(check!.actorUserId).toBe(room.base.userId)
      // Restated (QUALITY-18.T2b3): the action's Character batch names the stream version its
      // damage left, where the move's reaction execution listed the transition.
      const damagedStreamVersion = reaction.outputs.targetCharacterStreamVersion
      if (damagedStreamVersion === null)
        throw new Error('The reaction left the Character as it was.')
      expect(concentration.applicationOutputs).toMatchObject({
        kind: 'DAMAGE_SAVE_CHECK',
        parentOccurrenceId: reaction.occurrenceId,
        application: { targetActorId: MOVER_ID },
        outcome: 'SAVE_FAILURE',
        d20: { rawFaces: [1, 1], rollMode: 'ADVANTAGE', dc: 10, modifier: 1 },
        cleanup: {
          maintainedStateId: CONCENTRATION_STATE_ID,
          removedDependentEffectIds: room.dependentEffectIds,
          removedZoneIds: [],
          // The cleanup advances the Character exactly one step past the damage.
          characterOwnerTransitions: [
            {
              characterId: CHARACTER_ID,
              beforeStreamVersion: damagedStreamVersion,
              afterStreamVersion: damagedStreamVersion + 1
            }
          ]
        }
      })
      // One attack d20, two bite dice and the two d20s of the advantage save.
      expect(room.diceDrawn()).toBe(5)
    },
    60_000
  )
})

/** Uses every reaction the walk offers in turn, returning each Use in order. */
async function useEveryOfferedReaction(room: Room) {
  const uses: Awaited<ReturnType<Room['useReaction']>>[] = []
  while ((await room.pending()) && uses.length < 5) uses.push(await room.useReaction())
  return uses
}

/** A stored result of a movement that carries its reactions: completed outright, or with its spatial prefix. */
function parseMovementResult(raw: unknown) {
  const result = storedRuleExecutionResultDtoSchema.parse(raw)
  if (
    result.status === 'MOVEMENT_COMPLETE' ||
    (result.status === 'BATCH_COMPLETE' && result.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT')
  )
    return result
  throw new Error(`Expected a movement result, got ${result.status}.`)
}

/** The terminal result of the last decision answered. */
async function lastDecisionResult(room: Room) {
  const receipt = (await room.receipts())
    .filter((entry) => entry.commandType === 'RESOLVE_RULE_OCCURRENCE')
    .at(-1)
  if (!receipt) throw new Error('No decision receipt was committed.')
  return { receipt, result: parseMovementResult(receipt.result) }
}

describe('used automatic reactions of a Creature walking east', () => {
  const start = { x: 150, y: 150 }
  const reactorIds = [testUuid(0x211), testUuid(0x212)] as const

  /** FRIENDLY reaction Wolves at `reactorPositions` around a HOSTILE Wolf; every Bite hits. */
  function reactionRoom(
    reactorPositions: readonly ScenePoint[],
    spatialEffects: MovementRoomConfig['spatialEffects'] = []
  ) {
    const ids = reactorIds.slice(0, reactorPositions.length)
    return movementRoom({
      actors: [
        ...ids.map((id) =>
          srdCreatureActor({ id, creature: reactionWolf, disposition: 'FRIENDLY' })
        ),
        srdCreatureActor({ id: MOVER_ID, creature: plainWolf })
      ],
      moverActorId: MOVER_ID,
      positions: {
        ...Object.fromEntries(ids.map((id, index) => [id, reactorPositions[index]!])),
        [MOVER_ID]: start
      },
      autoRoll: 'GAME_MASTER',
      // Each Use draws an attack d20 (a 15) and two bite dice (the minimum).
      rolls: [14, 0, 0, 14, 0, 0],
      fallbackRoll: 0,
      spatialEffects
    })
  }

  it.each([
    {
      label: 'one boundary',
      positions: [
        { x: 50, y: 150 },
        { x: 50, y: 150 }
      ]
    },
    {
      label: 'distinct boundaries',
      positions: [
        { x: 50, y: 150 },
        { x: 150, y: 150 }
      ]
    }
  ])(
    'retains both Uses in order at $label, each sourced by its response',
    async ({ positions }) => {
      const room = await reactionRoom(positions)
      const destination = { x: 450, y: 150 }

      await room.move([start, destination])
      const uses = await useEveryOfferedReaction(room)

      const { receipt, result } = await lastDecisionResult(room)
      expect(uses).toHaveLength(2)
      // Restated (QUALITY-18.T2b3): the move's terminal result no longer lists its reactions
      // (ruling 7). Each Use runs as an action of its own (D219), so the two Uses are the two
      // action receipts, in order, each under the command id its own choice derives, and the
      // terminal is the receipt of the room's resume after the last one.
      expect(result.reactionExecutions).toEqual([])
      expect(
        (await room.receipts())
          .filter((entry) => entry.commandType === 'RESOLVE_ACTION')
          .map((entry) => entry.commandId)
      ).toEqual(uses.map((use) => use.childCommandId))
      expect(receipt.commandId).toBe(uses[1]!.resumeCommandId)
      expect(result.terminalPosition).toEqual(destination)
      const [first, second] = uses.map((use) => use.option.candidate.pathDistance)
      if (positions[0]!.x !== positions[1]!.x) expect(first).toBeLessThan(second!)
      else expect(first).toBe(second)
    },
    60_000
  )

  it('records a pending movement as a Scene-only version transition (D88)', async () => {
    const room = await reactionRoom([{ x: 50, y: 150 }])

    await room.move([start, { x: 450, y: 150 }])

    expect(await room.pending()).not.toBeNull()
    const receipt = await receiptOf(room, 'MOVE_SCENE_TOKEN')
    expect(receipt.metadata).toMatchObject({
      encounterVersionTransition: 'UNCHANGED',
      sceneVersionTransition: 'ADVANCED'
    })
  }, 60_000)

  it.each([
    {
      label: 'a spatial prefix applied',
      spatialEffects: [{ center: { x: 275, y: 150 }, radius: 5 }]
    },
    { label: 'no spatial effect crossed', spatialEffects: [] }
  ])(
    'commits one movement receipt for a pause with $label, advancing the Run only for the prefix (D88)',
    async ({ spatialEffects }) => {
      const room = await reactionRoom([{ x: 150, y: 150 }], spatialEffects)
      const runVersion = async () => (await readRoomHistory(room.base.stub)).runs[0]!.version
      const runCommands = async () => (await readRoomHistory(room.base.stub)).commands.length
      const receiptsBefore = (await room.receipts()).length
      const versionBefore = await runVersion()
      const commandsBefore = await runCommands()
      const advances = spatialEffects.length > 0

      await room.move([start, { x: 600, y: 150 }])

      const pending = await room.pending()
      expect(pending?.context.kind).toBe('ENCOUNTER_MOVEMENT_REACTION')
      expect((await room.receipts()).length).toBe(receiptsBefore + 1)
      const receipt = await receiptOf(room, 'MOVE_SCENE_TOKEN')
      expect(receipt.metadata).toMatchObject({
        encounterVersionTransition: advances ? 'ADVANCED' : 'UNCHANGED'
      })
      expect(await runVersion()).toBe(versionBefore + (advances ? 1 : 0))
      expect(await runCommands()).toBe(commandsBefore + (advances ? 1 : 0))
    },
    60_000
  )

  it('commits one movement receipt for an assisted spatial save pause, leaving the Run and its commands unchanged (D88)', async () => {
    const room = await movementRoom({
      actors: [srdCreatureActor({ id: MOVER_ID, creature: plainWolf })],
      moverActorId: MOVER_ID,
      positions: { [MOVER_ID]: start },
      spatialEffects: [{ center: { x: 275, y: 150 }, radius: 5, save: true }]
    })
    const history = async () => readRoomHistory(room.base.stub)
    const before = await history()
    const receiptsBefore = (await room.receipts()).length

    await room.move([start, { x: 600, y: 150 }])

    const pending = await room.pending()
    expect(pending?.context).toMatchObject({
      kind: 'ENCOUNTER_SPATIAL_MOVEMENT'
    })
    expect((await room.receipts()).length).toBe(receiptsBefore + 1)
    const receipt = await receiptOf(room, 'MOVE_SCENE_TOKEN')
    expect(receipt.metadata).toMatchObject({ encounterVersionTransition: 'UNCHANGED' })
    const after = await history()
    expect(after.runs[0]!.version).toBe(before.runs[0]!.version)
    expect(after.commands).toHaveLength(before.commands.length)
  }, 60_000)

  it('settles a crossed spatial prefix before its reactions and a suffix after them', async () => {
    const room = await reactionRoom(
      [
        { x: 150, y: 150 },
        { x: 150, y: 150 }
      ],
      [
        { center: { x: 275, y: 150 }, radius: 5 },
        { center: { x: 475, y: 150 }, radius: 5, variant: 1 }
      ]
    )

    await room.move([start, { x: 600, y: 150 }])
    const uses = await useEveryOfferedReaction(room)

    const { receipt, result } = await lastDecisionResult(room)
    if (result.status !== 'BATCH_COMPLETE' || result.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
      throw new Error('The mixed terminal kept no spatial receipt.')
    const [prefix, suffix] = result.executions
    if (!prefix || !suffix) throw new Error('Expected both spatial executions.')
    expect(result.executions.map((entry) => entry.candidate.candidate.effectId)).toEqual(
      room.spatialEffectIds
    )
    // Restated (QUALITY-18.T2b3): the terminal no longer lists the reactions (ruling 7), so each
    // reaction's contact is read from the option its Use chose.
    const reactionDistances = uses.map((use) => use.option.candidate.pathDistance)
    expect(reactionDistances).toHaveLength(2)
    expect(prefix.candidate.candidate.pathDistance).toBeLessThan(Math.min(...reactionDistances))
    expect(Math.max(...reactionDistances)).toBeLessThan(suffix.candidate.candidate.pathDistance)
    expect(result.terminalPosition).toEqual({ x: 600, y: 150 })
    // Restated (QUALITY-18.T2b3): the room's resume after the last Use holds the one terminal
    // receipt; the Use's own answer is the reaction's action.
    const last = (await room.receipts()).filter(
      (entry) => entry.commandId === uses.at(-1)?.resumeCommandId
    )
    expect(last).toHaveLength(1)
    expect(last[0]).toEqual(receipt)
  }, 60_000)

  it('keeps the exact queued faces of a suffix spatial save rolled after the reaction', async () => {
    const room = await reactionRoom(
      [{ x: 150, y: 150 }],
      [{ center: { x: 475, y: 150 }, radius: 5, save: true }]
    )

    await room.move([start, { x: 600, y: 150 }])
    await useEveryOfferedReaction(room)

    const { result } = await lastDecisionResult(room)
    if (result.status !== 'BATCH_COMPLETE' || result.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
      throw new Error('The suffix save kept no spatial receipt.')
    const [save] = result.executions
    // The reaction draws the first three queued dice (attack d20, two bite dice); the save takes the
    // next queued 14, which is a natural 15 against DC 30.
    expect(save?.d20).toMatchObject({
      rollMode: 'NORMAL',
      rawFaces: [15],
      selectedNatural: 15,
      defenseOrDc: 30
    })
    expect(room.diceDrawn()).toBe(4)
  }, 60_000)

  it('settles a spatial prefix between a used reaction and the later choice', async () => {
    // The later reactor stands one cell off the path: walking through a hostile creature with no
    // way to pass it is refused (SPELLS-33.T6k1).
    const room = await reactionRoom(
      [
        { x: 50, y: 150 },
        { x: 250, y: 250 }
      ],
      [{ center: { x: 450, y: 150 }, radius: 5 }]
    )

    await room.move([start, { x: 700, y: 150 }])
    const used = await room.useReaction()

    const pending = await room.pending()
    if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
      throw new Error('Expected the later reaction choice.')
    const {
      appliedSpatialPrefix: prefix,
      completedReactionExecutions,
      reactionTimeline
    } = pending.context
    if (prefix?.status !== 'BATCH_COMPLETE' || prefix.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
      throw new Error('Expected the applied spatial prefix.')
    // Restated (QUALITY-18.T2b3): the used reaction ran as an action of its own (D219), so the
    // move records no completed execution for it (ruling 7); its contact is the chosen option's.
    expect(completedReactionExecutions).toEqual([])
    expect((await settledActionOf(room, used.childCommandId)).receipt.commandType).toBe(
      'RESOLVE_ACTION'
    )
    const [execution] = prefix.executions
    const choice = reactionTimeline[0]
    if (!execution || !choice) throw new Error('Expected spatial and choice stages.')
    expect(execution.candidate.candidate.effectId).toBe(room.spatialEffectIds[0])
    expect(used.option.candidate.pathDistance).toBeLessThan(
      execution.candidate.candidate.pathDistance
    )
    expect(execution.candidate.candidate.pathDistance).toBeLessThan(choice.group.pathDistance)
  }, 60_000)
})

describe("stops a Character's movement at a used reaction", () => {
  const start = { x: 150, y: 150 }
  const destination = { x: 450, y: 150 }
  const STOP_REACTOR_ID = testUuid(0x221)

  it.each([{ withSpatialPrefix: false }, { withSpatialPrefix: true }])(
    'with spatial prefix $withSpatialPrefix, leaving what lies beyond the contact unapplied',
    async ({ withSpatialPrefix }) => {
      const room = await movementRoom({
        actors: [
          srdCreatureActor({ id: STOP_REACTOR_ID, creature: stopReactionWolf }),
          srdCreatureActor({ id: REACTOR_ID, creature: reactionWolf }),
          characterActor({ id: MOVER_ID, characterId: CHARACTER_ID })
        ],
        moverActorId: MOVER_ID,
        positions: {
          [STOP_REACTOR_ID]: { x: 50, y: 150 },
          [REACTOR_ID]: { x: 150, y: 150 },
          [MOVER_ID]: start
        },
        autoRoll: 'GAME_MASTER',
        // The Bite's attack d20 is the only die that matters: the prefix deals fixed damage.
        rolls: [14, 0, 0],
        fallbackRoll: 0,
        spatialEffects: withSpatialPrefix
          ? [
              { center: { x: 230, y: 150 }, radius: 5 },
              { center: { x: 375, y: 150 }, radius: 5, variant: 1 }
            ]
          : []
      })

      await room.move([start, destination])
      const receiptsBefore = (await room.receipts()).length
      const used = await room.useReaction()

      expect(await room.pending()).toBeNull()
      const { receipt, result } = await lastDecisionResult(room)
      // Restated (QUALITY-18.T2b3): the Use runs the reaction as the reactor's own action (D219)
      // and the room then resumes the move, so the answer leaves two receipts, the action's and
      // the resume's, and the terminal is the resume's with no reaction execution (ruling 7). The
      // one reaction is the action receipt under the id the choice derives, for the chosen option.
      expect(receipt.commandId).toBe(used.resumeCommandId)
      expect((await room.receipts()).length).toBe(receiptsBefore + 2)
      expect(result.reactionExecutions).toEqual([])
      expect((await settledActionOf(room, used.childCommandId)).receipt.commandType).toBe(
        'RESOLVE_ACTION'
      )
      expect(used.option.candidate.reactorActorId).toBe(STOP_REACTOR_ID)
      const { pathDistance } = used.option.candidate
      expect(pathDistance).toBeGreaterThan(0)
      expect(pathDistance).toBeLessThan(destination.x - start.x)
      // The STOP ends the walk at the contact, not at the destination.
      expect(result.terminalPosition).toEqual({ x: start.x + pathDistance, y: start.y })
      expect(result.terminalPosition).not.toEqual(destination)
      if (withSpatialPrefix) {
        if (result.status !== 'BATCH_COMPLETE')
          throw new Error('Expected the spatial prefix to be retained at the STOP.')
        // Only the effect before the contact applied; the one beyond it stays unapplied.
        expect(result.executions.map((entry) => entry.candidate.candidate.effectId)).toEqual([
          room.spatialEffectIds[0]
        ])
        expect(result.executions[0]!.candidate.candidate.pathDistance).toBeLessThan(pathDistance)
      }
    },
    60_000
  )
})

describe('a used automatic Character mutation at the next choice', () => {
  it.each(['ROOT', 'RESPONSE'] as const)(
    'records exactly one Character transition after a %s choice',
    async (stage) => {
      const reactorIds = [testUuid(0x231), testUuid(0x232), testUuid(0x233)]
      const ids = stage === 'ROOT' ? reactorIds.slice(0, 2) : reactorIds
      const room = await movementRoom({
        actors: [
          ...ids.map((id) => srdCreatureActor({ id, creature: reactionWolf })),
          characterActor({ id: MOVER_ID, characterId: CHARACTER_ID })
        ],
        moverActorId: MOVER_ID,
        positions: {
          // The third reactor stands one cell off the path, which the mover may not walk through.
          ...Object.fromEntries(
            ids.map((id, index) => [id, { x: 50 + index * 100, y: index === 2 ? 250 : 150 }])
          ),
          [MOVER_ID]: MOVER_START
        },
        autoRoll: 'GAME_MASTER',
        // The one Use draws an attack d20 (a 15) and two bite dice (the minimum); a Decline draws none.
        rolls: [14, 0, 0],
        fallbackRoll: 0
      })

      await room.move([MOVER_START, { x: 250 + ids.length * 100, y: 150 }])
      if (stage === 'RESPONSE') await room.respond({ kind: 'DECLINE' })
      const receiptsBefore = (await room.receipts()).length
      const used = await room.useReaction()

      expect(await room.pending()).not.toBeNull()
      // Restated (QUALITY-18.T2b3): a Use commits two receipts, the reaction's own action and the
      // room's resume of the move (D219), where the Use answer committed one. The one Character
      // transition is the action's; the resume, which paused at the next choice, records none.
      const receipts = await room.receipts()
      expect(receipts).toHaveLength(receiptsBefore + 2)
      const reaction = await settledActionOf(room, used.childCommandId)
      if (reaction.outputs.kind !== 'CHARACTER_MECHANICS_BATCH')
        throw new Error('Expected a Character movement reaction target.')
      // The Character page starts at stream version 1 and the one hit advances it once.
      expect(reaction.outputs.targetCharacterStreamVersion).toBe(2)
      const resume = receipts.find((entry) => entry.commandId === used.resumeCommandId)
      if (!resume) throw new Error('The room left no resume receipt.')
      const stored = storedRuleExecutionResultDtoSchema.parse(resume.result)
      if (!('characterTransitions' in stored))
        throw new Error('Expected pending command transitions.')
      expect(stored.characterTransitions).toEqual([])
    },
    60_000
  )
})

describe('a failed movement-reaction save against Legendary Resistance', () => {
  it.each(['USE', 'DECLINE'] as const)(
    'stops the walk on the failed save after the mover answers %s',
    async (selection) => {
      const room = await movementRoom({
        actors: [
          srdCreatureActor({ id: REACTOR_ID, creature: saveStopWolf, disposition: 'FRIENDLY' }),
          srdCreatureActor({ id: MOVER_ID, creature: legendaryWolf })
        ],
        moverActorId: MOVER_ID,
        positions: { [REACTOR_ID]: { x: 50, y: 150 }, [MOVER_ID]: MOVER_START },
        autoRoll: 'BOTH',
        // Every die rolls its minimum: the DC 30 save fails and the bite deals its minimum.
        fallbackRoll: 0
      })

      await room.move([MOVER_START, { x: 450, y: 150 }])
      const used = await room.useReaction()
      // Restated (QUALITY-18.T2b3): the Legendary Resistance choice is the reaction's own action's
      // (D219), read and answered as any action's while the move is SUSPENDED, where it was a
      // phase of the move's decision.
      const choice = await readPendingActionDecision(room.base.stub)
      if (choice?.pending.kind !== 'LEGENDARY_RESISTANCE_CHOICE')
        throw new Error('Expected the Legendary Resistance choice.')
      const answered = await room.respondToChild(
        selection === 'USE'
          ? { kind: 'OPTION', optionId: choice.pending.options[0]!.optionId }
          : { kind: 'DECLINE' }
      )
      expect(answered.type).toBe('COMMAND_COMMITTED')

      // Restated (QUALITY-18.T2b3): what the reaction did is the result of its action's receipt,
      // and how the move ended is the result of the room's resume, which lists no reaction
      // execution (ruling 7).
      const reaction = await settledActionOf(room, used.childCommandId)
      const resume = (await room.receipts()).find(
        (entry) => entry.commandId === used.resumeCommandId
      )
      if (!resume) throw new Error('The room left no resume receipt.')
      const result = parseMovementResult(resume.result)
      expect(result.reactionExecutions).toEqual([])
      // The reactor's authored STOP binding fires on the failed-save path.
      expect(used.option.binding.movementInterruption).toEqual({
        kind: 'STOP',
        whenResultPath: 'ON_SAVE_FAIL'
      })
      if (reaction.outputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
        throw new Error('Expected a Creature movement reaction target.')
      expect(reaction.outputs.legendaryResistance?.originalExecution.outputs.resultPath).toBe(
        'ON_SAVE_FAIL'
      )
      expect(reaction.outputs.legendaryResistance?.use).toBe(selection === 'USE')
      expect(reaction.outputs.targetFeatureResourceConsumption).toEqual(
        selection === 'USE' ? expect.objectContaining({ beforeUsed: 0, afterUsed: 1 }) : null
      )
      expect(used.option.candidate.contact).toEqual({ x: 200, y: 150 })
      expect(result.terminalPosition).toEqual(
        selection === 'USE' ? { x: 450, y: 150 } : used.option.candidate.contact
      )
      // A resisted save deals nothing; a failed one deals the bite's minimum (2d4 + 2).
      const { before, after } = reaction.outputs.targetTransition
      expect(before.currentHitPoints - after.currentHitPoints).toBe(selection === 'USE' ? 0 : 4)
    },
    60_000
  )
})

describe('a moving spatial effect shared by a Concentration Character and a later target', () => {
  const REACTOR_NEAR = testUuid(0x241)
  const REACTOR_FAR = testUuid(0x242)
  const CHARACTER_ACTOR_ID = testUuid(0x243)

  it.each([
    { label: 'a one-shot', activation: 'ONE_SHOT' as const, hidden: false },
    { label: 'a hidden repeatable', activation: 'REPEATABLE' as const, hidden: true }
  ])(
    'applies $label effect to both targets and checks Concentration only for the Character',
    async ({ activation, hidden }) => {
      const room = await movementRoom({
        actors: [
          srdCreatureActor({ id: REACTOR_NEAR, creature: reactionWolf, disposition: 'FRIENDLY' }),
          characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
          srdCreatureActor({ id: REACTOR_FAR, creature: reactionWolf, disposition: 'FRIENDLY' }),
          srdCreatureActor({ id: MOVER_ID, creature: plainWolf })
        ],
        moverActorId: MOVER_ID,
        positions: {
          [REACTOR_NEAR]: { x: 100, y: 150 },
          // One cell off the path, which the mover may not walk through (SPELLS-33.T6k1); the effect
          // reaches them across the shared token edge.
          [CHARACTER_ACTOR_ID]: { x: 300, y: 250 },
          [REACTOR_FAR]: { x: 400, y: 250 },
          [MOVER_ID]: MOVER_START
        },
        autoRoll: 'BOTH',
        concentration: true,
        concentrationOwnerActorId: CHARACTER_ACTOR_ID,
        concentrationDependentActorIds: [CHARACTER_ACTOR_ID],
        // The effect is anchored to the mover's token and lies far from every target until it moves.
        spatialEffects: [
          { center: { x: 900, y: 900 }, radius: 55, moving: { activation, hidden } }
        ],
        // Every die rolls its minimum: each reaction's attack misses and the Concentration save fails.
        fallbackRoll: 0
      })

      await room.move([MOVER_START, { x: 650, y: 150 }])
      await useEveryOfferedReaction(room)

      const { result } = await lastDecisionResult(room)
      if (result.status !== 'BATCH_COMPLETE' || result.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
        throw new Error('Expected the shared-effect spatial terminal.')
      // The effect applies to each target it crosses: the Character, then the later Wolf.
      const executions = result.executions.filter(
        (execution) => execution.candidate.candidate.effectId === room.spatialEffectIds[0]
      )
      expect(executions).toHaveLength(2)
      const characterExecution = executions.find(
        (execution) => execution.candidate.candidate.targetActorId === CHARACTER_ACTOR_ID
      )
      const laterExecution = executions.find(
        (execution) => execution.candidate.candidate.targetActorId === REACTOR_FAR
      )
      expect(characterExecution?.concentrationChecks).toMatchObject([
        {
          result: {
            applicationOutputs: {
              outcome: 'SAVE_FAILURE',
              cleanup: { maintainedStateId: CONCENTRATION_STATE_ID }
            }
          }
        }
      ])
      expect(laterExecution).toBeDefined()
      expect(laterExecution?.concentrationChecks).toBeUndefined()
    },
    60_000
  )
})
