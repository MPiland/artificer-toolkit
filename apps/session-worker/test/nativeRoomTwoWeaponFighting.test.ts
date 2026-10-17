import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { shortsword } from '@artificer-toolkit/source-data/srd/equipment/shortsword.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

const FIGHTER_ACTOR_ID = testUuid(0xe00)
const FIGHTER_ID = testUuid(0xe01)
const WOLF_ID = testUuid(0xe02)

/** No Scene measures the Club's reach (D11); every attack acknowledges that. */
const RANGE: ['TARGET_RANGE_UNCHECKED'] = ['TARGET_RANGE_UNCHECKED']

/** The Fighter's Two-Weapon Fighting option, taken as the SRD authors it. */
const twoWeaponFighting = ((): ClassFeature => {
  const option = fighter.features
    ?.find(({ label }) => label === 'Fighting Style')
    ?.options?.find(({ label }) => label === 'Two-Weapon Fighting')
  if (!option) throw new Error('The SRD Fighter has no Two-Weapon Fighting option.')
  return {
    id: option.id,
    label: option.label,
    description: option.description,
    availableAtLevel: 1,
    order: 0,
    grants: option.grants
  }
})()

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A level 1 Fighter holding a Club in its main hand and a Shortsword in its off hand, whose every
 * attack d20 shows 15 (a hit) and whose damage die shows 2.
 */
function fighterRoom(style: boolean) {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: Array.from({ length: 12 }, (_, index) => (index % 2 === 0 ? 14 : 1)),
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    characterPlay: { equipped: true },
    characterEquipment: [shortsword],
    characterClassFeatures: style ? [twoWeaponFighting] : [],
    characterAction: (action) => action.label.includes('Club')
  })
}

type Room = Awaited<ReturnType<typeof fighterRoom>>

/** The Wolf's hit points lost to the settled attack of `commandId`. */
async function damageDealt(room: Room, commandId: string) {
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
  const { before, after } = execution.applicationOutputs.targetTransition
  return before.currentHitPoints - after.currentHitPoints
}

/** The bonus-action attacks the room offers the Fighter. */
async function bonusAttacks(room: Room) {
  return (await room.actionChoices()).actions.filter(
    ({ actionCost }) => actionCost === 'BONUS_ACTION'
  )
}

async function attack(room: Room, actionId = room.actionId) {
  const { command, answer } = await room.startAction(WOLF_ID, RANGE, null, null, actionId)
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

describe('a Fighter fighting with two Light weapons in the room', () => {
  it('offers the off-hand attack only after another Light weapon attack, and adds no damage modifier to it', async () => {
    const room = await fighterRoom(false)
    // No Attack action this turn, so neither Light weapon offers a bonus attack.
    expect(await bonusAttacks(room)).toEqual([])

    const main = await attack(room)
    expect(main.answer.type, JSON.stringify(main.answer)).toBe('COMMAND_COMMITTED')
    const mainDamage = await damageDealt(room, main.commandId)
    // The Club's Strength modifier is positive and adds to the Action attack.
    expect(mainDamage).toBeGreaterThan(2)

    // The Club was the Attack action's weapon, so only the Shortsword offers the off-hand attack.
    const [offHand, ...others] = await bonusAttacks(room)
    expect(others).toEqual([])
    expect(offHand?.label).toContain('Shortsword')

    const bonus = await attack(room, offHand!.id)
    expect(bonus.answer.type, JSON.stringify(bonus.answer)).toBe('COMMAND_COMMITTED')
    // The damage die shows 2 and the positive ability modifier is not added.
    expect(await damageDealt(room, bonus.commandId)).toBe(2)
  })

  it('refuses the off-hand attack once the Attack action with the other weapon is undone', async () => {
    const room = await fighterRoom(false)
    const main = await attack(room)
    expect(main.answer.type, JSON.stringify(main.answer)).toBe('COMMAND_COMMITTED')
    const [offHand] = await bonusAttacks(room)
    await undo(room)

    expect(await bonusAttacks(room)).toEqual([])
    const before = await readRoomHistory(room.room.base.stub)
    const refused = await attack(room, offHand!.id)
    expect(refused.answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(refused.answer)).toContain('SOURCE_REQUIREMENTS_NOT_MET')
    expect(await readRoomHistory(room.room.base.stub)).toEqual(before)
  })

  it('adds the ability modifier to the off-hand attack with the Two-Weapon Fighting style', async () => {
    const room = await fighterRoom(true)
    const main = await attack(room)
    expect(main.answer.type, JSON.stringify(main.answer)).toBe('COMMAND_COMMITTED')
    const mainDamage = await damageDealt(room, main.commandId)

    const [offHand] = await bonusAttacks(room)
    const bonus = await attack(room, offHand!.id)
    expect(bonus.answer.type, JSON.stringify(bonus.answer)).toBe('COMMAND_COMMITTED')
    // The finesse Shortsword attacks with the Fighter's best of Strength and Dexterity, which the
    // Club's Strength modifier matches; the style restores it in full.
    expect(await damageDealt(room, bonus.commandId)).toBe(mainDamage)
  })
})
