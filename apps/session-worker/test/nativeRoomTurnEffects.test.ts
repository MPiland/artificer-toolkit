import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID } from '@artificer-toolkit/schema/shared/encounterLifecycle'
import { SRD_DAMAGE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { endTriggerEffectSeed, INVISIBLE_ID } from './endTriggerEffectSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import {
  parseReceiptExecution,
  readActorConditionIds,
  readRoomHistory,
  readRoomRollCards
} from './roomHistoryReads.js'
import { seedTurnSaveEffect } from './turnEvidenceFixture.js'

const FIRST_ID = testUuid(0x720)
const SECOND_ID = testUuid(0x721)
const CHARGE_ID = testUuid(0x722)
const FIRE_ID = SRD_DAMAGE_TYPES.find(({ code }) => code === 'FIRE')!.id

afterEach(() => {
  closeTrackedSockets()
})

/** The ADVANCE_TURN command from the Run's current version. */
function advanceCommand(room: Awaited<ReturnType<typeof movementRoom>>, expectedVersion: number) {
  const commandId = crypto.randomUUID()
  return {
    commandId,
    send: () =>
      room.send(commandId, {
        scope: 'ENCOUNTER',
        command: {
          type: 'ADVANCE_TURN',
          encounterId: room.encounterId,
          commandId,
          expectedVersion
        }
      })
  }
}

/** A turn with only Recharge to settle journals an INITIATIVE_COMPLETE receipt that retains it. */
function rechargeReceipt(receipt: { resultJson: string }) {
  const result = parseReceiptExecution(receipt)
  if (result.status !== 'INITIATIVE_COMPLETE')
    throw new Error(`Expected an initiative receipt, got ${result.status}.`)
  return result
}

function turnLifecycle(receipt: { resultJson: string }) {
  const result = parseReceiptExecution(receipt)
  if (result.status !== 'TURN_LIFECYCLE_COMPLETE')
    throw new Error(`Expected a turn lifecycle receipt, got ${result.status}.`)
  return result
}

describe('a room ADVANCE_TURN with turn active effects', () => {
  it('runs the outgoing END_OF_TURN then the incoming START_OF_TURN effect, rolls each save and journals both', async () => {
    const first = srdCreatureActor({ id: FIRST_ID, creature: plainWolf })
    const second = srdCreatureActor({ id: SECOND_ID, creature: plainWolf })
    let outgoingId = ''
    let incomingId = ''
    const effectDefinitions: Awaited<ReturnType<typeof seedTurnSaveEffect>>['definition'][] = []
    const room = await movementRoom({
      actors: [first, second],
      moverActorId: FIRST_ID,
      positions: { [FIRST_ID]: { x: 150, y: 150 }, [SECOND_ID]: { x: 250, y: 150 } },
      autoRoll: 'GAME_MASTER',
      // Zero-based dice: 0 is a natural 1, so the DC 30 saves fail and both effects damage.
      rolls: [0, 0],
      definitions: effectDefinitions,
      seed: async ({ effects, encounterId, occurredAt }) => {
        const outgoing = await seedTurnSaveEffect({
          effects,
          encounterId,
          actor: first,
          stage: 'END_OF_TURN',
          ticks: 2,
          damage: 2,
          occurredAt
        })
        const incoming = await seedTurnSaveEffect({
          effects,
          encounterId,
          actor: second,
          stage: 'START_OF_TURN',
          ticks: 1,
          damage: 1,
          occurredAt
        })
        outgoingId = outgoing.id
        incomingId = incoming.id
        effectDefinitions.push(outgoing.definition, incoming.definition)
      }
    })
    const before = await readRoomHistory(room.base.stub)
    const advance = advanceCommand(room, before.runs[0]!.version)
    const answer = await advance.send()
    expect(answer.type).toBe('COMMAND_COMMITTED')

    const held = await readRoomHistory(room.base.stub)
    const [command] = held.commands
    expect(held.commands).toHaveLength(1)
    expect(command).toMatchObject({
      commandId: advance.commandId,
      commandType: 'ADVANCE_TURN',
      actorUserId: room.base.userId
    })
    const [receipt] = held.receipts
    expect(held.receipts).toHaveLength(1)
    expect(receipt).toMatchObject({ commandId: advance.commandId, commandType: 'ADVANCE_TURN' })
    const lifecycle = turnLifecycle(receipt!)
    if (lifecycle.outgoingTurn.kind !== 'EXECUTED' || lifecycle.incomingTurn.kind !== 'EXECUTED')
      throw new Error('Expected both completed turn-effect phases.')
    expect(lifecycle.outgoingTurn.executions).toEqual([
      expect.objectContaining({
        activeEffectId: outgoingId,
        stage: 'END_OF_TURN',
        lifecycle: expect.objectContaining({
          kind: 'UPDATE',
          beforeRemainingTicks: 2,
          afterRemainingTicks: 1
        }),
        targetTransition: expect.objectContaining({
          before: expect.objectContaining({ currentHitPoints: plainWolf.hitPoints }),
          after: expect.objectContaining({ currentHitPoints: plainWolf.hitPoints - 2 })
        })
      })
    ])
    expect(lifecycle.incomingTurn.executions).toEqual([
      expect.objectContaining({
        activeEffectId: incomingId,
        stage: 'START_OF_TURN',
        lifecycle: expect.objectContaining({
          kind: 'EXPIRE',
          beforeRemainingTicks: 1,
          afterRemainingTicks: 0
        }),
        targetTransition: expect.objectContaining({
          before: expect.objectContaining({ currentHitPoints: plainWolf.hitPoints }),
          after: expect.objectContaining({ currentHitPoints: plainWolf.hitPoints - 1 })
        })
      })
    ])
    expect(
      [...lifecycle.outgoingTurn.executions, ...lifecycle.incomingTurn.executions].map(
        (execution) => execution.d20?.rawFaces
      )
    ).toEqual([[1], [1]])
    expect(room.diceDrawn()).toBe(2)
    // Auto-rolled turn saves are journaled in the receipt, not held as app evidence rolls.
    expect(held.evidenceRolls).toEqual([])
    // The ticking effect keeps its row at version 2; the expired one is gone.
    expect(held.activeEffects).toEqual([
      expect.objectContaining({
        id: outgoingId,
        version: 2,
        lifecycle: { schemaVersion: 1, remainingTicks: 1 }
      })
    ])

    // An exact retry replays the journal: no dice, no new row of any kind.
    const dice = room.diceDrawn()
    expect(await advance.send()).toEqual(answer)
    expect(room.diceDrawn()).toBe(dice)
    expect(await readRoomHistory(room.base.stub)).toEqual(held)
  })
})

describe('a room ADVANCE_TURN that ends the round', () => {
  it('ends the incoming actor’s Concentration with no check when its START_OF_TURN damage defeats it (D95)', async () => {
    const first = srdCreatureActor({ id: FIRST_ID, creature: plainWolf })
    const second = srdCreatureActor({ id: SECOND_ID, creature: plainWolf, currentHitPoints: 1 })
    const effectDefinitions: Awaited<ReturnType<typeof seedTurnSaveEffect>>['definition'][] = []
    const room = await movementRoom({
      actors: [first, second],
      moverActorId: FIRST_ID,
      positions: { [FIRST_ID]: { x: 150, y: 150 }, [SECOND_ID]: { x: 250, y: 150 } },
      autoRoll: 'GAME_MASTER',
      // A natural 1 fails the DC 30 save, so the effect deals its 1 damage to the 1-hit-point holder.
      rolls: [0],
      definitions: effectDefinitions,
      concentration: true,
      concentrationOwnerActorId: SECOND_ID,
      seed: async ({ effects, encounterId, occurredAt }) => {
        const incoming = await seedTurnSaveEffect({
          effects,
          encounterId,
          actor: second,
          stage: 'START_OF_TURN',
          ticks: 1,
          damage: 1,
          occurredAt
        })
        effectDefinitions.push(incoming.definition)
      }
    })
    const before = await readRoomHistory(room.base.stub)
    expect(before.maintainedStates).toHaveLength(1)
    const answer = await advanceCommand(room, before.runs[0]!.version).send()
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const after = await readRoomHistory(room.base.stub)
    expect(after.maintainedStates).toEqual([])
    const ends = after.receipts.flatMap((receipt) => {
      const result = parseReceiptExecution(receipt)
      return result.status === 'AGGREGATE_CHOICE_COMPLETE' &&
        result.applicationOutputs.kind === 'CONCENTRATION_END'
        ? [result.applicationOutputs]
        : []
    })
    expect(ends).toMatchObject([{ ownerActorId: SECOND_ID, reason: 'DEFEATED' }])
    expect(
      after.receipts.filter((receipt) => receipt.commandType === 'CONCENTRATION_CHECK')
    ).toEqual([])
  })

  it.each([
    { face: 20, outcome: 'SAVE_SUCCESS' as const, kept: true },
    { face: 1, outcome: 'SAVE_FAILURE' as const, kept: false }
  ])(
    'rolls the incoming Creature’s Concentration check for the GM when its START_OF_TURN damage does not defeat it ($outcome)',
    async ({ face, outcome, kept }) => {
      const first = srdCreatureActor({ id: FIRST_ID, creature: plainWolf })
      const second = srdCreatureActor({ id: SECOND_ID, creature: plainWolf })
      const effectDefinitions: Awaited<ReturnType<typeof seedTurnSaveEffect>>['definition'][] = []
      const room = await movementRoom({
        actors: [first, second],
        moverActorId: FIRST_ID,
        positions: { [FIRST_ID]: { x: 150, y: 150 }, [SECOND_ID]: { x: 250, y: 150 } },
        autoRoll: 'GAME_MASTER',
        // A natural 1 fails the DC 30 turn save (1 damage), then the GM's Concentration die follows.
        rolls: [0, face - 1],
        definitions: effectDefinitions,
        concentration: true,
        concentrationOwnerActorId: SECOND_ID,
        seed: async ({ effects, encounterId, occurredAt }) => {
          const incoming = await seedTurnSaveEffect({
            effects,
            encounterId,
            actor: second,
            stage: 'START_OF_TURN',
            ticks: 1,
            damage: 1,
            occurredAt
          })
          effectDefinitions.push(incoming.definition)
        }
      })
      const before = await readRoomHistory(room.base.stub)
      expect(before.maintainedStates).toHaveLength(1)
      const answer = await advanceCommand(room, before.runs[0]!.version).send()
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

      const after = await readRoomHistory(room.base.stub)
      expect(after.maintainedStates).toHaveLength(kept ? 1 : 0)
      const checks = after.receipts.flatMap((receipt) => {
        const result = parseReceiptExecution(receipt)
        return result.status === 'COMPLETE' &&
          result.applicationOutputs.kind === 'CONCENTRATION_CHECK'
          ? [result.applicationOutputs]
          : []
      })
      expect(checks).toMatchObject([{ outcome }])
    }
  )

  it('journals the ROUND_WRAP advance in the receipt and the command row, with the new round current', async () => {
    const room = await movementRoom({
      actors: [
        srdCreatureActor({ id: FIRST_ID, creature: plainWolf }),
        srdCreatureActor({ id: SECOND_ID, creature: plainWolf })
      ],
      // The last actor of the round holds the turn.
      moverActorId: SECOND_ID,
      positions: { [FIRST_ID]: { x: 150, y: 150 }, [SECOND_ID]: { x: 250, y: 150 } }
    })
    const before = await readRoomHistory(room.base.stub)
    const advance = advanceCommand(room, before.runs[0]!.version)
    expect((await advance.send()).type).toBe('COMMAND_COMMITTED')

    const held = await readRoomHistory(room.base.stub)
    const [receipt] = held.receipts
    expect(held.receipts).toHaveLength(1)
    const result = parseReceiptExecution(receipt!)
    if (result.status !== 'INITIATIVE_COMPLETE') throw new Error(`Unexpected ${result.status}.`)
    expect(result).toMatchObject({
      commandType: 'ADVANCE_TURN',
      initiative: null,
      initiativeAdvance: {
        kind: 'ROUND_WRAP',
        cadence: 'ENCOUNTER_START',
        nextRound: 2,
        firstActorId: FIRST_ID
      }
    })
    expect(held.runs[0]).toMatchObject({ version: before.runs[0]!.version + 1 })
    expect(held.commands).toEqual([
      expect.objectContaining({
        commandId: advance.commandId,
        commandType: 'ADVANCE_TURN',
        ruleOccurrenceId: receipt!.occurrenceId,
        actorUserId: room.base.userId
      })
    ])
  })
})

describe('a room ADVANCE_TURN into a depleted Recharge Feature', () => {
  /** A wolf whose Bite recharges on 5-6; its one charge starts spent. */
  async function rechargeRoom(
    rolls: readonly number[],
    autoRoll: 'GAME_MASTER' | null = 'GAME_MASTER'
  ) {
    const charged = {
      ...plainWolf,
      features: plainWolf.features?.map((feature) =>
        feature.label !== 'Bite'
          ? feature
          : {
              ...feature,
              ruleDefinitionIds: [DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID],
              charges: {
                id: CHARGE_ID,
                limitKind: 'FIXED_AMOUNT' as const,
                scalingKind: 'NONE' as const,
                resetKind: 'MANUAL' as const,
                amount: 1
              }
            }
      )
    }
    const featureId = creatureFeature(charged, 'Bite').id
    const room = await movementRoom({
      actors: [
        srdCreatureActor({ id: FIRST_ID, creature: plainWolf }),
        srdCreatureActor({
          id: SECOND_ID,
          creature: charged,
          featureCharges: { [featureId]: 1 }
        })
      ],
      moverActorId: FIRST_ID,
      positions: { [FIRST_ID]: { x: 150, y: 150 }, [SECOND_ID]: { x: 250, y: 150 } },
      autoRoll: autoRoll ?? undefined,
      rolls
    })
    const before = await readRoomHistory(room.base.stub)
    const advance = advanceCommand(room, before.runs[0]!.version)
    const answer = await advance.send()
    expect(answer.type).toBe('COMMAND_COMMITTED')
    const held = await readRoomHistory(room.base.stub)
    const [receipt] = held.receipts
    return { room, featureId, held, receipt: receipt!, advance, answer }
  }

  it('keeps the charge spent on a die of 4 and journals the failed Recharge', async () => {
    // Zero-based d6: 3 is a 4, below the recharge threshold of 5.
    const { room, featureId, held, receipt, advance } = await rechargeRoom([3])
    const { rechargeExecutions } = rechargeReceipt(receipt)
    expect(rechargeExecutions).toEqual([
      expect.objectContaining({
        ordinal: 0,
        rawDie: 4,
        recharged: false,
        beforeUsed: 1,
        afterUsed: 1,
        candidate: expect.objectContaining({ actorId: SECOND_ID, featureId })
      })
    ])
    expect(held.commands).toEqual([
      expect.objectContaining({
        commandId: advance.commandId,
        commandType: 'ADVANCE_TURN',
        actorUserId: room.base.userId
      })
    ])
    expect(receipt.actorUserId).toBe(room.base.userId)
    // An auto-rolled Recharge die is journaled on the receipt, not held as an evidence roll.
    expect(held.evidenceRolls).toEqual([])
  })

  it('waits for an entered Recharge die, then journals the answering command on the root receipt', async () => {
    const { room, featureId, held, answer, advance } = await rechargeRoom([], null)
    // Nothing is journaled while the Recharge die is pending.
    expect(held.commands).toEqual([])
    expect(held.receipts).toEqual([])
    const [pending] = held.occurrences
    expect(pending).toMatchObject({ state: 'PENDING', rootCommandId: advance.commandId })
    if (
      answer.type !== 'COMMAND_COMMITTED' ||
      answer.delta?.scope !== 'ENCOUNTER' ||
      !('occurrence' in answer.delta.result)
    )
      throw new Error('Expected the pending occurrence in the answer.')
    const decision = answer.delta.result.occurrence?.pending
    if (decision?.kind !== 'RECHARGE_EVIDENCE') throw new Error('Expected a Recharge decision.')
    expect(decision).toMatchObject({ rollerActorId: SECOND_ID, occurrenceId: pending!.id })

    const resolveId = crypto.randomUUID()
    const resolution = {
      kind: 'ENTER_INTEGER',
      requestId: decision.request.requestId,
      value: 5
    }
    const resolved = await room.send(resolveId, {
      scope: 'ENCOUNTER',
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: room.encounterId,
        commandId: resolveId,
        expectedVersion: decision.encounterVersion,
        occurrenceId: decision.occurrenceId,
        expectedOccurrenceVersion: decision.occurrenceVersion,
        correlationId: null,
        resolution
      }
    })
    expect(resolved.type).toBe('COMMAND_COMMITTED')

    const settled = await readRoomHistory(room.base.stub)
    // The settled occurrence keeps one receipt, owned by the ADVANCE_TURN that opened it.
    const [receipt] = settled.receipts
    expect(settled.receipts).toHaveLength(1)
    expect(receipt).toMatchObject({
      commandId: advance.commandId,
      commandType: 'ADVANCE_TURN',
      actorUserId: room.base.userId
    })
    expect(rechargeReceipt(receipt!).rechargeExecutions).toEqual([
      expect.objectContaining({
        ordinal: 0,
        rawDie: 5,
        recharged: true,
        beforeUsed: 1,
        afterUsed: 0
      })
    ])
    expect(JSON.parse(receipt!.commandMetadataJson)).toMatchObject({
      transition: 'TURN_EFFECTS',
      commandType: 'ADVANCE_TURN',
      // The one answered Recharge die moved the occurrence from the version it waited at.
      terminalOccurrenceVersion: decision.occurrenceVersion + 1,
      resolutionCommands: [
        {
          kind: 'ENTER_INTEGER',
          commandId: resolveId,
          actorUserId: room.base.userId,
          expectedOccurrenceVersion: decision.occurrenceVersion,
          requestId: decision.request.requestId
        }
      ]
    })
    expect(settled.commands.map((command) => command.commandId)).toContain(advance.commandId)
    const recharged = settled.actors.find((actor) => actor.id === SECOND_ID)
    expect(JSON.parse(recharged!.stateJson)).toMatchObject({
      resources: { featureCharges: { [featureId]: 0 } }
    })
  })

  it('restores the charge on a die of 5 and journals the Recharge', async () => {
    const { room, featureId, held, receipt } = await rechargeRoom([4])
    const { rechargeExecutions } = rechargeReceipt(receipt)
    expect(rechargeExecutions).toEqual([
      expect.objectContaining({
        ordinal: 0,
        rawDie: 5,
        recharged: true,
        beforeUsed: 1,
        afterUsed: 0,
        candidate: expect.objectContaining({ actorId: SECOND_ID, featureId })
      })
    ])
    expect(receipt.actorUserId).toBe(room.base.userId)
    const recharged = held.actors.find((actor) => actor.id === SECOND_ID)
    expect(JSON.parse(recharged!.stateJson)).toMatchObject({
      resources: { featureCharges: { [featureId]: 0 } }
    })
  })

  describe('roll cards (ENCOUNTER-7.1)', () => {
    /** Every roll card of the turn (it holds only Recharge dice): audience, label and die. */
    async function rechargeCards(room: Awaited<ReturnType<typeof movementRoom>>) {
      return (await readRoomRollCards(room.base.stub)).map(({ audience, roll }) => ({
        audience,
        label: roll.source.label,
        total: roll.evidence.total
      }))
    }

    /** The pending Recharge decision, and the command that answers it. */
    function pendingRecharge(answer: Awaited<ReturnType<typeof rechargeRoom>>['answer']) {
      if (
        answer.type !== 'COMMAND_COMMITTED' ||
        answer.delta?.scope !== 'ENCOUNTER' ||
        !('occurrence' in answer.delta.result)
      )
        throw new Error('Expected the pending occurrence in the answer.')
      const decision = answer.delta.result.occurrence?.pending
      if (decision?.kind !== 'RECHARGE_EVIDENCE') throw new Error('Expected a Recharge decision.')
      return decision
    }

    function recharge(
      room: Awaited<ReturnType<typeof movementRoom>>,
      decision: ReturnType<typeof pendingRecharge>,
      command: Record<string, unknown>
    ) {
      const commandId = crypto.randomUUID()
      return room.send(commandId, {
        scope: 'ENCOUNTER',
        command: {
          encounterId: room.encounterId,
          commandId,
          expectedVersion: decision.encounterVersion,
          occurrenceId: decision.occurrenceId,
          expectedOccurrenceVersion: decision.occurrenceVersion,
          ...command
        }
      })
    }

    it('cards an auto-rolled die once', async () => {
      const { room } = await rechargeRoom([4])
      expect(await rechargeCards(room)).toEqual([
        { audience: 'TABLE', label: 'Bite recharge', total: 5 }
      ])
    })

    it('cards an entered die once', async () => {
      const { room, answer } = await rechargeRoom([], null)
      const decision = pendingRecharge(answer)
      const resolved = await recharge(room, decision, {
        type: 'RESOLVE_RULE_OCCURRENCE',
        correlationId: null,
        resolution: { kind: 'ENTER_INTEGER', requestId: decision.request.requestId, value: 5 }
      })
      expect(resolved.type).toBe('COMMAND_COMMITTED')
      expect(await rechargeCards(room)).toEqual([
        { audience: 'TABLE', label: 'Bite recharge', total: 5 }
      ])
    })

    it('cards an app-rolled die once, as its attempt', async () => {
      // The app's d6 shows 6.
      const { room, answer } = await rechargeRoom([5], null)
      const decision = pendingRecharge(answer)
      const rolled = await recharge(room, decision, {
        type: 'ROLL_RULE_EVIDENCE',
        requestId: decision.request.requestId,
        rollMode: null
      })
      expect(rolled.type).toBe('COMMAND_COMMITTED')
      const [held] = (await readRoomHistory(room.base.stub)).evidenceRolls
      const resolved = await recharge(room, decision, {
        type: 'RESOLVE_RULE_OCCURRENCE',
        correlationId: null,
        resolution: {
          kind: 'SYSTEM_ROLL',
          requestId: decision.request.requestId,
          rollId: held!.id
        }
      })
      expect(resolved.type).toBe('COMMAND_COMMITTED')
      expect(await rechargeCards(room)).toEqual([
        { audience: 'TABLE', label: 'Rolled by the app, attempt 1', total: 6 }
      ])
    })
  })
})

describe('ongoing damage that reaches the holder of a damage-triggered effect (SPELLS-27.T4b)', () => {
  const EFFECT_ID = testUuid(0x5643)

  /** The invisible first creature takes 2 damage from its END_OF_TURN effect as its turn ends. */
  async function endTurnOfInvisibleCreature(damageTypeIds: string[] | null) {
    const first = srdCreatureActor({
      id: FIRST_ID,
      creature: plainWolf,
      conditionIds: [INVISIBLE_ID]
    })
    const second = srdCreatureActor({ id: SECOND_ID, creature: plainWolf })
    const effectDefinitions: Awaited<ReturnType<typeof seedTurnSaveEffect>>['definition'][] = []
    const seedTrigger = endTriggerEffectSeed({
      effectId: EFFECT_ID,
      holderActorId: FIRST_ID,
      sourceActorId: SECOND_ID,
      triggers: [{ event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds }]
    })
    const room = await movementRoom({
      actors: [first, second],
      moverActorId: FIRST_ID,
      positions: { [FIRST_ID]: { x: 150, y: 150 }, [SECOND_ID]: { x: 250, y: 150 } },
      autoRoll: 'GAME_MASTER',
      // A natural 1 fails the DC 30 turn save, so the 2 damage always lands.
      rolls: [0],
      definitions: effectDefinitions,
      seed: async (context) => {
        const ticking = await seedTurnSaveEffect({
          effects: context.effects,
          encounterId: context.encounterId,
          actor: first,
          stage: 'END_OF_TURN',
          ticks: 2,
          damage: 2,
          occurredAt: context.occurredAt
        })
        effectDefinitions.push(ticking.definition)
        await seedTrigger(context)
      }
    })
    const before = await readRoomHistory(room.base.stub)
    const answer = await advanceCommand(room, before.runs[0]!.version).send()
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const history = await readRoomHistory(room.base.stub)
    return {
      triggerEffectHeld: history.activeEffects.some(({ id }) => id === EFFECT_ID),
      invisible: readActorConditionIds(history, FIRST_ID).includes(INVISIBLE_ID)
    }
  }

  it('ends the effect, and releases its condition, when the damage lands', async () => {
    expect(await endTurnOfInvisibleCreature(null)).toEqual({
      triggerEffectHeld: false,
      invisible: false
    })
  })

  it('keeps the effect when the damage is of a type the trigger does not name', async () => {
    expect(await endTurnOfInvisibleCreature([FIRE_ID])).toEqual({
      triggerEffectHeld: true,
      invisible: true
    })
  })
})
