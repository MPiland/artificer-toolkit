import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { resistance } from '@artificer-toolkit/source-data/srd/spells/resistance.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { legendaryWolf, plainWolf, saveStopWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf, fireballWolf } from './actionRoomFixture.js'
import { areaReceipts } from './areaRoomReads.js'
import { heldSaveDieEffect, seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { readPendingActionDecision, readRoomHistory, type RoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-31.T4c1b5 (D203): Legendary Resistance stays its own pause after the outcome is known. A
 * creature that spends an after-the-roll die in the d20 window and still fails its save is offered
 * Legendary Resistance next, at every site that has both pauses.
 */

const SOURCE_ID = testUuid(0x980)
const TARGET_ID = testUuid(0x981)
const DIE_ID = testUuid(0x982)
const OTHER_ID = testUuid(0x983)
const MOVER_START: ScenePoint = { x: 150, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const holdsDie = (actorId: string) =>
  seedModifierGrant({
    sourceActorId: actorId,
    holderActorId: actorId,
    lifecycle: {},
    effect: heldSaveDieEffect(),
    sourceLabel: resistance.label,
    id: DIE_ID
  })

const dieIds = async (history: Promise<RoomHistory>) =>
  (await history).activeEffects.map(({ id }) => id)

describe('single-target action save: window, then Legendary Resistance', () => {
  const saveBite = biteWolf('SAVE')

  /** The Bite's DC 10 save on a Legendary Resistance Wolf holding a die: a 1 and a 1 still fail. */
  function room() {
    return actionRoom({
      actors: [
        srdCreatureActor({ id: SOURCE_ID, creature: saveBite }),
        srdCreatureActor({ id: TARGET_ID, creature: legendaryWolf })
      ],
      ownerFeatureId: creatureFeature(saveBite, 'Bite').id,
      seed: holdsDie(TARGET_ID)
    })
  }
  type Room = Awaited<ReturnType<typeof room>>

  /** Rolls the failed save, spends the die on it, and returns the Legendary Resistance choice. */
  async function offered(target: Room) {
    expect((await target.startAction(TARGET_ID)).answer.type).toBe('COMMAND_COMMITTED')
    const save = await target.pendingDecision()
    if (save.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the save prompt.')
    const rolled = await target.resolve(save, {
      kind: 'ENTER_DICE',
      requestId: save.pending.request.requestId,
      rawFaces: [1],
      rollMode: save.pending.request.rollMode
    })
    expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
    const window = await target.pendingDecision()
    if (window.pending.kind !== 'ROLL_WINDOW') throw new Error('Expected the d20 window.')
    const used = await target.resolve(window, {
      kind: 'ROLL_WINDOW_USE',
      requestId: window.pending.requestId,
      optionId: window.pending.options[0]!.optionId,
      faces: [1]
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    const decision = await target.pendingDecision()
    if (decision.pending.kind !== 'LEGENDARY_RESISTANCE_CHOICE')
      throw new Error(`Expected the Legendary Resistance choice, got ${decision.pending.kind}.`)
    return { decision, pending: decision.pending }
  }

  function targetBatch(history: RoomHistory) {
    const batch = areaReceipts(history).children.find(
      ({ outputs }) =>
        outputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' && outputs.targetActorId === TARGET_ID
    )?.outputs
    if (batch?.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
      throw new Error('The Bite left no batch.')
    return batch
  }

  it('offers it after the die fails to save, and using it passes the save', async () => {
    const target = await room()
    const { decision, pending } = await offered(target)
    // Nothing is applied yet, and the die is not spent until the action settles.
    expect(areaReceipts(await readRoomHistory(target.room.base.stub)).children).toEqual([])

    const used = await target.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(target.room.base.stub)).toBeNull()
    const history = await readRoomHistory(target.room.base.stub)
    const batch = targetBatch(history)
    expect(batch.targetFeatureResourceConsumption).toEqual(
      expect.objectContaining({ beforeUsed: 0, afterUsed: 1 })
    )
    const { before, after } = batch.targetTransition
    expect(before.currentHitPoints - after.currentHitPoints).toBe(0)
    expect(await dieIds(Promise.resolve(history))).not.toContain(DIE_ID)
  })

  it('keeps the failure when declined, still spending the die the window used', async () => {
    const target = await room()
    const { decision } = await offered(target)

    const declined = await target.resolve(decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    const history = await readRoomHistory(target.room.base.stub)
    const batch = targetBatch(history)
    expect(batch.targetFeatureResourceConsumption).toBeNull()
    const { before, after } = batch.targetTransition
    expect(before.currentHitPoints - after.currentHitPoints).toBe(1)
    expect(await dieIds(Promise.resolve(history))).not.toContain(DIE_ID)
  })
})

describe('area save: window, then Legendary Resistance', () => {
  /** The Caster's area catches a Legendary Resistance Wolf holding a die and a plain Wolf. */
  function room() {
    return actionRoom({
      actors: [
        srdCreatureActor({ id: SOURCE_ID, creature: fireballWolf() }),
        srdCreatureActor({ id: TARGET_ID, creature: legendaryWolf }),
        srdCreatureActor({ id: OTHER_ID, creature: plainWolf })
      ],
      ownerFeatureId: fireballWolf().features?.find((feature) => feature.label === 'Bite')?.id,
      seed: holdsDie(TARGET_ID)
    })
  }
  type Room = Awaited<ReturnType<typeof room>>

  async function area(target: Room) {
    const decision = await readPendingActionDecision(target.room.base.stub)
    if (decision?.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    return { decision, pending: decision.pending }
  }

  /** Rolls every save as a 1, spends the die in the window, and returns the room awaiting the choice. */
  async function offered() {
    const target = await room()
    expect((await target.startAreaAction({ x: 50, y: 150 })).answer.type).toBe('COMMAND_COMMITTED')
    for (;;) {
      const { decision, pending } = await area(target)
      const [save] = pending.saves
      if (!save) break
      const rolled = await target.send(
        target.resolveCommand(decision, {
          kind: 'ENTER_DICE',
          requestId: save.request.requestId,
          rawFaces: [1],
          rollMode: save.request.rollMode
        })
      )
      expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
    }
    const window = await area(target)
    expect(window.pending.windows.map(({ targetActorId }) => targetActorId)).toEqual([TARGET_ID])
    const used = await target.send(
      target.resolveCommand(window.decision, {
        kind: 'ROLL_WINDOW_USE',
        requestId: window.pending.windows[0]!.requestId,
        optionId: window.pending.windows[0]!.options[0]!.optionId,
        faces: [1]
      })
    )
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    const choice = await area(target)
    expect(choice.pending.windows).toEqual([])
    expect(choice.pending.legendaryResistance.map(({ actorId }) => actorId)).toEqual([TARGET_ID])
    return { target, choice }
  }

  it.each(['USE', 'DECLINE'] as const)(
    'offers it after the die fails to save, and settles on %s',
    async (selection) => {
      const { target, choice } = await offered()
      const [offer] = choice.pending.legendaryResistance
      const answered = await target.send(
        target.resolveCommand(choice.decision, {
          kind: 'AREA_LEGENDARY_RESISTANCE',
          actorId: TARGET_ID,
          decision:
            selection === 'USE' ? { kind: 'USE', optionId: offer!.optionId } : { kind: 'DECLINE' }
        })
      )
      expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
      expect(await readPendingActionDecision(target.room.base.stub)).toBeNull()

      const history = await readRoomHistory(target.room.base.stub)
      const batch = areaReceipts(history).children.find(
        ({ outputs }) =>
          outputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' && outputs.targetActorId === TARGET_ID
      )?.outputs
      if (batch?.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
        throw new Error('The area left no batch for the creature.')
      expect(batch.targetFeatureResourceConsumption).toEqual(
        selection === 'USE' ? expect.objectContaining({ beforeUsed: 0, afterUsed: 1 }) : null
      )
      expect(batch.legendaryResistance).toMatchObject({ use: selection === 'USE' })
      // The die the window spent ends with the area either way.
      expect(history.activeEffects.map(({ id }) => id)).not.toContain(DIE_ID)
    },
    60_000
  )
})

describe('movement-reaction save: window, then Legendary Resistance', () => {
  const REACTOR_ID = testUuid(0x984)

  /** A Legendary Resistance mover holding a die is made to save (DC 30) by a friendly Wolf's reaction. */
  function room() {
    return movementRoom({
      actors: [
        srdCreatureActor({ id: REACTOR_ID, creature: saveStopWolf, disposition: 'FRIENDLY' }),
        srdCreatureActor({ id: TARGET_ID, creature: legendaryWolf })
      ],
      moverActorId: TARGET_ID,
      positions: { [REACTOR_ID]: { x: 50, y: 150 }, [TARGET_ID]: MOVER_START },
      autoRoll: 'BOTH',
      // Every die rolls its minimum: the DC 30 save fails with or without the die.
      fallbackRoll: 0,
      seed: holdsDie(TARGET_ID)
    })
  }
  type Room = Awaited<ReturnType<typeof room>>

  async function offered(mover: Room) {
    await mover.move([MOVER_START, { x: 450, y: 150 }])
    const reaction = await mover.pending()
    if (reaction?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
      throw new Error(`Expected a reaction decision, got ${reaction?.context.kind}.`)
    const option = reaction.context.reactionTimeline[0]?.group.options[0]
    if (!option) throw new Error('The reaction decision offers no option.')
    expect((await mover.respond({ kind: 'OPTION', optionId: option.optionId })).type).toBe(
      'COMMAND_COMMITTED'
    )
    const window = await mover.pending()
    if (
      window?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
      window.context.phase.kind !== 'ACTION_EVIDENCE' ||
      window.context.phase.pause?.kind !== 'ROLL_WINDOW'
    )
      throw new Error('Expected the mover to hold a d20 window on the reaction save.')
    const { pause } = window.context.phase
    const shown = await mover.pendingFor(false)
    if (shown?.kind !== 'ROLL_WINDOW') throw new Error(`Expected a d20 window, got ${shown?.kind}.`)
    const used = await mover.respond({
      kind: 'ROLL_WINDOW_USE',
      requestId: shown.requestId,
      optionId: pause.payload.offer.options[0]!.optionId,
      faces: [1]
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    const choice = await mover.pending()
    if (
      choice?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
      choice.context.phase.kind !== 'LEGENDARY_RESISTANCE_CHOICE'
    )
      throw new Error('Expected the Legendary Resistance choice after the window.')
    return choice.context.phase
  }

  it.each(['USE', 'DECLINE'] as const)(
    'offers it after the die fails to save, and settles on %s',
    async (selection) => {
      const mover = await room()
      const phase = await offered(mover)
      const answered = await mover.respond(
        selection === 'USE'
          ? { kind: 'OPTION', optionId: phase.resistance.useOptionId }
          : { kind: 'DECLINE' }
      )
      expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')

      const receipt = (await mover.receipts()).find(
        (entry) => entry.commandId === answered.commandId
      )
      if (!receipt) throw new Error('The Legendary Resistance answer left no receipt.')
      const result = storedRuleExecutionResultDtoSchema.parse(receipt.result)
      if (result.status !== 'MOVEMENT_COMPLETE') throw new Error(`Got ${result.status}.`)
      const [reaction] = result.reactionExecutions
      if (!reaction || reaction.application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
        throw new Error('Expected a Creature movement reaction target.')
      expect(reaction.legendaryResistance?.use).toBe(selection === 'USE')
      expect(reaction.application.targetFeatureResourceConsumption).toEqual(
        selection === 'USE' ? expect.objectContaining({ beforeUsed: 0, afterUsed: 1 }) : null
      )
      expect(result.terminalPosition).toEqual(
        selection === 'USE' ? { x: 450, y: 150 } : { x: 200, y: 150 }
      )
      expect(
        (await readRoomHistory(mover.base.stub)).activeEffects.map(({ id }) => id)
      ).not.toContain(DIE_ID)
    },
    60_000
  )
})
