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
import { readRoomHistory } from './roomHistoryReads.js'

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

/** Uses the one reaction the walk offered; the room's GM controls the reactor. */
async function useOfferedReaction(room: Room) {
  const pending = await room.pending()
  if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error(`Expected a reaction decision, got ${pending?.context.kind}.`)
  const option = pending.context.reactionTimeline[0]?.group.options[0]
  if (!option) throw new Error('The reaction decision offers no option.')
  return room.respond({ kind: 'OPTION', optionId: option.optionId })
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
      const used = await useOfferedReaction(room)
      expect(used.type).toBe('COMMAND_COMMITTED')

      const rootReceipt = await receiptOf(room, 'RESOLVE_RULE_OCCURRENCE')
      expect(rootReceipt.commandId).toBe(used.commandId)
      expect(rootReceipt.actorUserId).toBe(room.base.userId)
      const result = parseMovementResult(rootReceipt.result)
      const reaction = result.reactionExecutions[0]
      const concentration = reaction?.concentrationChecks?.[0]
      if (!reaction || !concentration) throw new Error('Expected the reaction Concentration child.')
      if (reaction.application.kind !== 'CHARACTER_MECHANICS_BATCH')
        throw new Error('Expected a Character movement reaction target.')
      const spatial = result.status === 'BATCH_COMPLETE' ? result.executions : []

      // The reaction spends the reactor's one Reaction.
      expect(reaction.allowance).toMatchObject({
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
          reaction.option.candidate.pathDistance
        )
      } else expect(spatial).toHaveLength(0)

      // The save is sourced by the Use response and rolled with advantage against DC 10.
      expect(concentration.sourceCommandId).toBe(used.commandId)
      const damage = reaction.characterTransitions.find(
        (transition) => transition.characterId === CHARACTER_ID
      )
      if (!damage) throw new Error('The reaction left no Character transition.')
      expect(concentration.result.applicationOutputs).toMatchObject({
        parentOccurrenceId: result.occurrenceId,
        application: { targetActorId: MOVER_ID },
        outcome: 'SAVE_FAILURE',
        d20: { rawFaces: [1, 1], rollMode: 'ADVANTAGE', dc: 10, modifier: 1 },
        cleanup: {
          maintainedStateId: CONCENTRATION_STATE_ID,
          removedDependentEffectIds: room.dependentEffectIds,
          // The cleanup advances the Character exactly one step past the damage.
          characterOwnerTransitions: [
            {
              characterId: CHARACTER_ID,
              beforeStreamVersion: damage.afterStreamVersion,
              afterStreamVersion: damage.afterStreamVersion + 1
            }
          ]
        }
      })
      expect(concentration.ownerTransitions).toMatchObject([
        { characterId: CHARACTER_ID, targetActorId: MOVER_ID }
      ])
      // One attack d20, two bite dice and the two d20s of the advantage save.
      expect(room.diceDrawn()).toBe(5)

      // The child's receipt is its own, linked to the Use and holding the same result as the root's.
      const child = (await room.receipts()).find(
        (entry) => entry.commandId === concentrationCommandId(concentration.result.occurrenceId)
      )
      if (!child) throw new Error('Movement Concentration receipt is unavailable.')
      expect(child.commandType).toBe('CONCENTRATION_CHECK')
      expect(child.actorUserId).toBe(room.base.userId)
      expect(storedRuleExecutionResultDtoSchema.parse(child.result)).toEqual(concentration.result)
      expect(result).toMatchObject({
        reactionExecutions: [{ concentrationChecks: [concentration] }]
      })
    },
    60_000
  )
})

/** Uses every reaction the walk offers in turn, returning each Use's command id in order. */
async function useEveryOfferedReaction(room: Room) {
  const commandIds: string[] = []
  for (let uses = 0; (await room.pending()) && uses < 5; uses++)
    commandIds.push((await useOfferedReaction(room)).commandId)
  return commandIds
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
      const commandIds = await useEveryOfferedReaction(room)

      const { result } = await lastDecisionResult(room)
      expect(commandIds).toHaveLength(2)
      expect(result.reactionExecutions).toHaveLength(2)
      expect(result.reactionExecutions.map((entry) => entry.ordinal)).toEqual([0, 1])
      expect(result.reactionExecutions.map((entry) => entry.sourceCommandId)).toEqual(commandIds)
      expect(result.terminalPosition).toEqual(destination)
      const [first, second] = result.reactionExecutions.map(
        (entry) => entry.option.candidate.pathDistance
      )
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
    const commandIds = await useEveryOfferedReaction(room)

    const { receipt, result } = await lastDecisionResult(room)
    if (result.status !== 'BATCH_COMPLETE' || result.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
      throw new Error('The mixed terminal kept no spatial receipt.')
    const [prefix, suffix] = result.executions
    if (!prefix || !suffix) throw new Error('Expected both spatial executions.')
    expect(result.executions.map((entry) => entry.candidate.candidate.effectId)).toEqual(
      room.spatialEffectIds
    )
    const reactionDistances = result.reactionExecutions.map(
      (entry) => entry.option.candidate.pathDistance
    )
    expect(reactionDistances).toHaveLength(2)
    expect(prefix.candidate.candidate.pathDistance).toBeLessThan(Math.min(...reactionDistances))
    expect(Math.max(...reactionDistances)).toBeLessThan(suffix.candidate.candidate.pathDistance)
    expect(result.terminalPosition).toEqual({ x: 600, y: 150 })
    // The last Use's response holds the one terminal receipt.
    const last = (await room.receipts()).filter((entry) => entry.commandId === commandIds.at(-1))
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
    const room = await reactionRoom(
      [
        { x: 50, y: 150 },
        { x: 250, y: 150 }
      ],
      [{ center: { x: 450, y: 150 }, radius: 5 }]
    )

    await room.move([start, { x: 700, y: 150 }])
    await useOfferedReaction(room)

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
    const [reaction] = completedReactionExecutions
    const [execution] = prefix.executions
    const choice = reactionTimeline[0]
    if (!reaction || !execution || !choice)
      throw new Error('Expected reaction, spatial and choice stages.')
    expect(execution.candidate.candidate.effectId).toBe(room.spatialEffectIds[0])
    expect(reaction.option.candidate.pathDistance).toBeLessThan(
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
      const used = await useOfferedReaction(room)

      expect(await room.pending()).toBeNull()
      const { receipt, result } = await lastDecisionResult(room)
      expect(receipt.commandId).toBe(used.commandId)
      expect((await room.receipts()).length).toBe(receiptsBefore + 1)
      expect(result.reactionExecutions).toHaveLength(1)
      const [reaction] = result.reactionExecutions
      expect(reaction).toMatchObject({
        ordinal: 0,
        sourceCommandId: used.commandId,
        option: { candidate: { reactorActorId: STOP_REACTOR_ID } }
      })
      const { pathDistance } = reaction!.option.candidate
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
          ...Object.fromEntries(ids.map((id, index) => [id, { x: 50 + index * 100, y: 150 }])),
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
      const used = await useOfferedReaction(room)

      expect(await room.pending()).not.toBeNull()
      const receipts = await room.receipts()
      expect(receipts).toHaveLength(receiptsBefore + 1)
      const response = receipts.find((entry) => entry.commandId === used.commandId)
      if (!response) throw new Error('The Use left no receipt.')
      const stored = storedRuleExecutionResultDtoSchema.parse(response.result)
      if (!('characterTransitions' in stored))
        throw new Error('Expected pending command transitions.')
      // The Character page starts at stream version 1 and the one hit advances it once.
      expect(stored.characterTransitions).toEqual([
        { characterId: CHARACTER_ID, beforeStreamVersion: 1, afterStreamVersion: 2 }
      ])
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
      await useOfferedReaction(room)
      const choice = await room.pending()
      if (
        choice?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
        choice.context.phase.kind !== 'LEGENDARY_RESISTANCE_CHOICE'
      )
        throw new Error('Expected the Legendary Resistance choice.')
      const answered = await room.respond(
        selection === 'USE'
          ? { kind: 'OPTION', optionId: choice.context.phase.resistance.useOptionId }
          : { kind: 'DECLINE' }
      )
      expect(answered.type).toBe('COMMAND_COMMITTED')

      const receipt = (await room.receipts()).find(
        (entry) => entry.commandId === answered.commandId
      )
      if (!receipt) throw new Error('The LR answer left no receipt.')
      const result = parseMovementResult(receipt.result)
      expect(result.reactionExecutions).toHaveLength(1)
      const reaction = result.reactionExecutions[0]!
      // The reactor's authored STOP binding fires on the failed-save path.
      expect(reaction.option.binding.movementInterruption).toEqual({
        kind: 'STOP',
        whenResultPath: 'ON_SAVE_FAIL'
      })
      expect(reaction.phaseReceipts?.[0]?.execution.outputs.resultPath).toBe('ON_SAVE_FAIL')
      expect(reaction.legendaryResistance?.use).toBe(selection === 'USE')
      if (reaction.application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
        throw new Error('Expected a Creature movement reaction target.')
      expect(reaction.application.targetFeatureResourceConsumption).toEqual(
        selection === 'USE' ? expect.objectContaining({ beforeUsed: 0, afterUsed: 1 }) : null
      )
      expect(reaction.option.candidate.contact).toEqual({ x: 200, y: 150 })
      expect(result.terminalPosition).toEqual(
        selection === 'USE' ? { x: 450, y: 150 } : reaction.option.candidate.contact
      )
      // A resisted save deals nothing; a failed one deals the bite's minimum (2d4 + 2).
      const { before, after } = reaction.application.targetTransition
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
          [CHARACTER_ACTOR_ID]: { x: 300, y: 150 },
          [REACTOR_FAR]: { x: 400, y: 150 },
          [MOVER_ID]: MOVER_START
        },
        autoRoll: 'BOTH',
        concentration: true,
        concentrationOwnerActorId: CHARACTER_ACTOR_ID,
        concentrationDependentActorIds: [CHARACTER_ACTOR_ID],
        // The effect is anchored to the mover's token and lies far from every target until it moves.
        spatialEffects: [{ center: { x: 900, y: 900 }, radius: 5, moving: { activation, hidden } }],
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
