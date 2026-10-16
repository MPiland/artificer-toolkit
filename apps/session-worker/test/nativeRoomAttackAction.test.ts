import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  withEncounterAttackActionState,
  withEncounterRuleUsageUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { SRD_ACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

const FIGHTER_ACTOR_ID = testUuid(0xd00)
const FIGHTER_ID = testUuid(0xd01)
const WOLF_ID = testUuid(0xd02)

const extraAttack = (() => {
  const feature = fighter.features?.find(({ label }) => label === 'Extra Attack')
  if (!feature) throw new Error('The SRD Fighter has no Extra Attack Feature.')
  return feature
})()

/** No Scene measures the Club's reach (D11); every attack acknowledges that. */
const RANGE: ['TARGET_RANGE_UNCHECKED'] = ['TARGET_RANGE_UNCHECKED']

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A level 5 Fighter with Extra Attack and a Club, whose every attack d20 shows 15 (a hit) and d4 shows 2. */
function fighterRoom() {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: Array.from({ length: 12 }, (_, index) => (index % 2 === 0 ? 14 : 1)),
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    characterPlay: { equipped: true, fighterLevel: 5 },
    characterClassFeatures: [extraAttack],
    characterAction: (action) => action.label.includes('Club')
  })
}

type Room = Awaited<ReturnType<typeof fighterRoom>>

/** The settled attack receipt of `commandId`, parsed by the shared contract. */
async function settledAttack(room: Room, commandId: string) {
  const { receipts } = await readRoomHistory(room.room.base.stub)
  const receipt = receipts.find(
    (candidate) => candidate.commandId === commandId && candidate.commandType === 'RESOLVE_ACTION'
  )
  if (!receipt) throw new Error('The attack left no receipt.')
  const execution = parseReceiptExecution(receipt)
  if (
    execution.status !== 'COMPLETE' ||
    execution.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
  )
    throw new Error('Expected a settled attack on the Wolf.')
  return execution.applicationOutputs
}

async function attack(
  room: Room,
  acknowledgedWarnings: Parameters<Room['startAction']>[1] = RANGE
) {
  const { command, answer } = await room.startAction(WOLF_ID, acknowledgedWarnings)
  return { commandId: command.commandId, answer }
}

async function undo(room: Room) {
  const answer = await room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

describe('a Fighter’s Attack action in the room', () => {
  it('spends one Action on two attacks, warns on the third, and returns the slot when the second is undone', async () => {
    const room = await fighterRoom()
    const club = (await room.actionChoices()).actions.find(({ label }) => label.includes('Club'))
    expect(club?.attackSlot).toEqual({ number: 1, total: 2 })
    expect((await room.actionChoices()).openAttackAction).toBeNull()

    const first = await attack(room)
    expect(first.answer.type, JSON.stringify(first.answer)).toBe('COMMAND_COMMITTED')
    const firstOutputs = await settledAttack(room, first.commandId)
    expect(firstOutputs.actionEconomyTransition).toMatchObject({ beforeUsed: 0, afterUsed: 1 })
    expect(firstOutputs.attackActionTransition).toEqual({
      before: null,
      after: {
        kind: 'ATTACK_ACTION',
        turnSequence: expect.any(Number),
        total: 2,
        attacks: [
          {
            actionId: room.actionId,
            targetIds: [WOLF_ID],
            // The record names the Club it was made with, for the off-hand requirement.
            item: { itemInstanceId: expect.any(String), properties: club.properties }
          }
        ]
      }
    })
    const clubItem = firstOutputs.attackActionTransition?.after.attacks[0]?.item
    if (!clubItem) throw new Error('The first attack recorded no item.')
    const afterFirst = await room.actionChoices()
    expect(afterFirst.openAttackAction).toEqual({
      made: 1,
      total: 2,
      lastActionId: room.actionId,
      lastTargetIds: [WOLF_ID]
    })
    expect(afterFirst.actions.find(({ id }) => id === room.actionId)?.attackSlot).toEqual({
      number: 2,
      total: 2
    })

    // The second attack fills the open Attack action: no Action spent, no warning to acknowledge.
    const second = await attack(room)
    expect(second.answer.type, JSON.stringify(second.answer)).toBe('COMMAND_COMMITTED')
    const secondOutputs = await settledAttack(room, second.commandId)
    expect(secondOutputs.actionEconomyTransition).toBeNull()
    expect(secondOutputs.attackActionTransition).toMatchObject({
      before: { attacks: [{ actionId: room.actionId, item: clubItem }] },
      after: {
        total: 2,
        attacks: [
          { actionId: room.actionId, item: clubItem },
          { actionId: room.actionId, item: clubItem }
        ]
      }
    })
    expect((await room.actionChoices()).openAttackAction).toMatchObject({ made: 2, total: 2 })

    // A third attack needs a second Action, and the turn has none.
    const beforeRefused = await readRoomHistory(room.room.base.stub)
    const refused = await attack(room)
    expect(refused.answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(refused.answer)).toContain('ACTION_ECONOMY_UNAVAILABLE')
    expect(await readRoomHistory(room.room.base.stub)).toEqual(beforeRefused)

    // Undoing the second attack returns its slot: attacking again warns of nothing.
    await undo(room)
    expect((await room.actionChoices()).openAttackAction).toMatchObject({ made: 1, total: 2 })
    const again = await attack(room)
    expect(again.answer.type, JSON.stringify(again.answer)).toBe('COMMAND_COMMITTED')
    expect((await settledAttack(room, again.commandId)).actionEconomyTransition).toBeNull()

    // Overriding the warning spends another Action and opens a new Attack action; undoing it restores the full one.
    const override = await attack(room, [...RANGE, 'ACTION_ECONOMY_UNAVAILABLE'])
    expect(override.answer.type, JSON.stringify(override.answer)).toBe('COMMAND_COMMITTED')
    const overrideOutputs = await settledAttack(room, override.commandId)
    expect(overrideOutputs.actionEconomyTransition).toMatchObject({ beforeUsed: 1, afterUsed: 2 })
    expect(overrideOutputs.attackActionTransition).toMatchObject({
      before: {
        attacks: [
          { actionId: room.actionId, item: clubItem },
          { actionId: room.actionId, item: clubItem }
        ]
      },
      after: { total: 2, attacks: [{ actionId: room.actionId, item: clubItem }] }
    })
    await undo(room)
    expect((await room.actionChoices()).openAttackAction).toMatchObject({ made: 2, total: 2 })
  })
})

describe('an incapacitated Fighter finishing its Attack action in the room', () => {
  it('warns before the attack that fills a slot, which still spends no Action', async () => {
    const incapacitated = srdSystemRecord.conditionTypes.find(
      (condition) => condition.code === 'INCAPACITATED'
    )
    if (!incapacitated) throw new Error('The SRD Incapacitated condition is missing.')
    // The Fighter made its first attack this turn (the Run is on turn sequence 1) and was then incapacitated.
    const base = characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID })
    const spent = encounterRunActorStateSchema.parse({
      ...base,
      resources: withEncounterRuleUsageUsed(base, SRD_ACTION_ALLOWANCE_DEFINITION_ID, 1)
    })
    const actor = encounterRunActorStateSchema.parse({
      ...spent,
      resources: withEncounterAttackActionState(spent, {
        kind: 'ATTACK_ACTION',
        turnSequence: 1,
        total: 2,
        attacks: [{ actionId: testUuid(0xd10), targetIds: [WOLF_ID] }]
      })
    })
    const room = await actionRoom({
      autoRoll: 'BOTH',
      rolls: Array.from({ length: 12 }, (_, index) => (index % 2 === 0 ? 14 : 1)),
      actors: [actor, srdCreatureActor({ id: WOLF_ID, creature: plainWolf })],
      characterPlay: {
        equipped: true,
        fighterLevel: 5,
        conditions: [{ conditionTypeId: incapacitated.id, label: 'Incapacitated' }]
      },
      characterClassFeatures: [extraAttack],
      characterAction: (action) => action.label.includes('Club')
    })

    const club = (await room.actionChoices()).actions.find(({ label }) => label.includes('Club'))
    expect(club?.attackSlot).toBeNull()
    expect(club?.warnings.map(({ code }) => code)).toContain('ACTION_ECONOMY_UNAVAILABLE')

    const refused = await attack(room)
    expect(refused.answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(refused.answer)).toContain('ACTION_ECONOMY_UNAVAILABLE')

    // Overridden, it still fills the slot and spends nothing.
    const override = await attack(room, [...RANGE, 'ACTION_ECONOMY_UNAVAILABLE'])
    expect(override.answer.type, JSON.stringify(override.answer)).toBe('COMMAND_COMMITTED')
    const outputs = await settledAttack(room, override.commandId)
    expect(outputs.actionEconomyTransition).toBeNull()
    expect(outputs.attackActionTransition).toMatchObject({
      before: { attacks: [{}] },
      after: { total: 2, attacks: [{}, { actionId: room.actionId }] }
    })
  })
})
