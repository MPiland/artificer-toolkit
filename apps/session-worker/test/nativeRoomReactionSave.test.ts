import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { resolveEncounterActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { DND5E_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import { SRD_ABILITY_DEFINITION_IDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  readPendingActionContext,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * QUALITY-8.T1b (D219): a reaction chosen against an attack on another creature runs as its own
 * action, and that action may need evidence of its own. Here a homebrew reaction makes the attacker
 * save first: while the save waits it is the Run's one pending decision and the Bite is suspended.
 * A failed save imposes the roll mode the reaction authors on the Bite; a successful one imposes
 * nothing. The GM may void the waiting save, which reopens the Bite's offer; the suspended Bite
 * itself cannot be voided, and nothing is undone while either waits.
 */

const ATTACKER_ID = testUuid(0x8a0)
const TARGET_ID = testUuid(0x8a1)
const REACTOR_ACTOR_ID = testUuid(0x8a2)
const REACTOR_ID = testUuid(0x8a3)
const attackBite = biteWolf('ATTACK')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A homebrew reaction: the attacker saves, and on a failure its attack is rolled with disadvantage. */
const unnerve: ClassFeature = {
  id: testUuid(0x8a7),
  label: 'Unnerve',
  description:
    'When a creature you see attacks another creature within 5 feet of you, it makes a Wisdom saving throw. On a failure the attack has disadvantage.',
  availableAtLevel: 1,
  order: 1,
  effects: [
    {
      id: testUuid(0x8a8),
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: testUuid(0x8a9),
          dcMethod: 'DERIVED_DC',
          abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.WISDOM,
          baseDc: 8,
          bonuses: [{ id: testUuid(0x8aa), bonusKind: 'PROFICIENCY_BONUS' }]
        },
        activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
        reactionTrigger: { kind: 'ATTACK_ON_OTHER', requiresSight: true, targetWithinFeet: 5 },
        range: {
          id: testUuid(0x8ab),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY,
          self: 'WARN'
        }
      },
      paths: [
        {
          id: testUuid(0x8ac),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: testUuid(0x8ad),
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: testUuid(0x8ae),
                effectKind: EFFECT_KIND.IMPOSE_ROLL_MODE_ON_TRIGGERING_ROLL,
                rollMode: 'DISADVANTAGE'
              }
            ]
          }
        }
      ]
    }
  ]
}

/** A Wolf whose Bite (+4) attacks a Wolf (AC 13), with the Character 5 feet beyond the bitten Wolf. */
function reactorRoom() {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attackBite }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf }),
      characterActor({ id: REACTOR_ACTOR_ID, characterId: REACTOR_ID })
    ],
    positions: { [REACTOR_ACTOR_ID]: { x: 350, y: 150 } },
    ownerFeatureId: creatureFeature(attackBite, 'Bite').id,
    characterClassFeatures: [unnerve],
    characterEquipment: []
  })
}
type Room = Awaited<ReturnType<typeof reactorRoom>>

/** The Character chooses the reaction against the Bite; the Bite's command and stored occurrence. */
async function chosen(room: Room) {
  const started = await room.startAction(TARGET_ID, [], room.sceneContext())
  expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'REACTION_CHOICE')
    throw new Error(`Expected the reaction choice, got ${decision.pending.kind}.`)
  const used = await room.resolve(decision, {
    kind: 'OPTION',
    optionId: decision.pending.options[0]!.optionId
  })
  expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
  return { biteCommandId: started.command.commandId.toLowerCase() }
}

/** The pending d20 prompt: the attacker's save, or the Bite's attack roll. */
async function d20Prompt(room: Room) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE')
    throw new Error(`Expected a d20 prompt, got ${decision.pending.kind}.`)
  return { decision, request: decision.pending.request }
}

/** Enters the attacker's save face; a 1 fails and a 20 succeeds whatever the DC. */
async function save(room: Room, face: 1 | 20) {
  const { decision, request } = await d20Prompt(room)
  const saved = await room.resolve(decision, {
    kind: 'ENTER_DICE',
    requestId: request.requestId,
    rawFaces: [face],
    rollMode: request.rollMode
  })
  expect(saved.type, JSON.stringify(saved)).toBe('COMMAND_COMMITTED')
}

async function reactionUsed(room: Room) {
  const row = (await readRoomHistory(room.room.base.stub)).actors.find(
    ({ id }) => id === REACTOR_ACTOR_ID
  )
  if (!row) throw new Error('The room holds no reactor.')
  return encounterRuleUsageUsed(readStoredRunActor(row), DND5E_REACTION_ALLOWANCE_DEFINITION_ID)
}

/** Each stored occurrence's state, the Bite's first. */
async function occurrenceStates(room: Room, biteCommandId: string) {
  const { occurrences } = await readRoomHistory(room.room.base.stub)
  const bite = occurrences.find(({ rootCommandId }) => rootCommandId === biteCommandId)
  if (!bite) throw new Error('The room holds no Bite occurrence.')
  return {
    bite,
    states: [
      bite.state,
      ...occurrences.filter((occurrence) => occurrence !== bite).map(({ state }) => state)
    ]
  }
}

/** The reaction child's command id, read from the Run's commands. */
async function childCommandId(room: Room) {
  const children = (await readRoomHistory(room.room.base.stub)).commands.flatMap((row) => {
    if (row.commandType !== 'RESOLVE_ACTION') return []
    const command = resolveEncounterActionInputDtoSchema.parse(JSON.parse(row.commandJson))
    return command.systemTrigger?.trigger === 'REACTION' ? [command.commandId] : []
  })
  expect(children).toHaveLength(1)
  return children[0]
}

const undo = async (room: Room) =>
  room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })

describe('a reaction that needs its own save, chosen against an attack on another creature (QUALITY-8.T1b)', () => {
  it('asks the attacker for the save as the Run’s one pending decision and suspends the Bite, spending nothing yet', async () => {
    const room = await reactorRoom()
    const version = await room.version()
    const { biteCommandId } = await chosen(room)

    const { decision } = await d20Prompt(room)
    expect(decision.occurrence.id).not.toBe((await occurrenceStates(room, biteCommandId)).bite.id)
    expect((await occurrenceStates(room, biteCommandId)).states).toEqual(['SUSPENDED', 'PENDING'])
    expect(await reactionUsed(room)).toBe(0)
    expect(await room.version()).toBe(version)
  })

  it('rolls the Bite with disadvantage once the attacker fails the save, and spends the reaction', async () => {
    const room = await reactorRoom()
    const { biteCommandId } = await chosen(room)
    await save(room, 1)

    const { decision, request } = await d20Prompt(room)
    const { bite, states } = await occurrenceStates(room, biteCommandId)
    expect(decision.occurrence.id).toBe(bite.id)
    expect(states).toEqual(['PENDING', 'COMPLETED'])
    expect(request.rollMode).toBe('DISADVANTAGE')
    expect((await readPendingActionContext(room.room.base.stub)).reactionChildren).toEqual([
      { commandId: await childCommandId(room), rollMode: 'DISADVANTAGE' }
    ])
    expect(await reactionUsed(room)).toBe(1)
  })

  it('rolls the Bite as it was once the attacker succeeds on the save; the reaction is still spent', async () => {
    const room = await reactorRoom()
    const { biteCommandId } = await chosen(room)
    await save(room, 20)

    const { request } = await d20Prompt(room)
    expect((await occurrenceStates(room, biteCommandId)).states).toEqual(['PENDING', 'COMPLETED'])
    expect(request.rollMode).toBe('NORMAL')
    expect((await readPendingActionContext(room.room.base.stub)).reactionChildren).toEqual([
      { commandId: await childCommandId(room), rollMode: null }
    ])
    expect(await reactionUsed(room)).toBe(1)
  })

  it('refuses to void the suspended Bite while the save waits', async () => {
    const room = await reactorRoom()
    const { biteCommandId } = await chosen(room)
    const { bite } = await occurrenceStates(room, biteCommandId)

    const voided = await room.send({
      type: 'VOID_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: room.room.encounterId,
      expectedVersion: await room.version(),
      occurrenceId: bite.id,
      expectedOccurrenceVersion: bite.version
    })
    expect(voided.type, JSON.stringify(voided)).toBe('COMMAND_REJECTED')
    expect((await occurrenceStates(room, biteCommandId)).states).toEqual(['SUSPENDED', 'PENDING'])
  })

  it('reopens the Bite’s offer when the GM voids the waiting save; declined, the Bite is rolled as it was', async () => {
    const room = await reactorRoom()
    const { biteCommandId } = await chosen(room)
    const { decision } = await d20Prompt(room)

    const voided = await room.send({
      type: 'VOID_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: room.room.encounterId,
      expectedVersion: decision.encounterVersion,
      occurrenceId: decision.occurrence.id,
      expectedOccurrenceVersion: decision.occurrence.version
    })
    expect(voided.type, JSON.stringify(voided)).toBe('COMMAND_COMMITTED')
    expect((await occurrenceStates(room, biteCommandId)).states).toEqual(['PENDING', 'VOIDED'])
    expect(await reactionUsed(room)).toBe(0)

    const offer = await room.pendingDecision()
    expect(offer.pending.kind).toBe('REACTION_CHOICE')
    expect(
      (await readPendingActionContext(room.room.base.stub)).reactionChildren
    ).toBeUndefined()
    const declined = await room.resolve(offer, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')

    const { decision: attack, request } = await d20Prompt(room)
    expect(request.rollMode).toBe('NORMAL')
    const rolled = await room.resolve(attack, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [2],
      rollMode: request.rollMode
    })
    expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await reactionUsed(room)).toBe(0)
  })

  it('refuses undo while the save waits; one undo of the finished Bite restores the reaction', async () => {
    const room = await reactorRoom()
    const before = await readRoomHistory(room.room.base.stub)
    await chosen(room)
    expect((await undo(room)).type).toBe('COMMAND_REJECTED')

    await save(room, 1)
    const { decision: attack, request } = await d20Prompt(room)
    // 19 + 4 hits AC 13 alone; beside a 2 the lower face misses.
    const rolled = await room.resolve(attack, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [19, 2],
      rollMode: request.rollMode
    })
    expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
    expect(await reactionUsed(room)).toBe(1)

    const undone = await undo(room)
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await reactionUsed(room)).toBe(0)
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  })
})
