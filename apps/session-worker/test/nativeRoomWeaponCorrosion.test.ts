import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { arrows } from '@artificer-toolkit/source-data/srd/equipment/arrows.js'
import { mace } from '@artificer-toolkit/source-data/srd/equipment/mace.js'
import { longbow } from '@artificer-toolkit/source-data/srd/equipment/longbow.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { runInDurableObject } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { seededSrdCreature } from './seededSrdCreature.js'

/**
 * SPELLS-33 T6i2: a Black Pudding's Corrosive Form degrades the nonmagical wood or metal weapon that
 * hits it through the generic `degradeEquipment` option. The penalty and a destroyed weapon ride in
 * the action's receipt and the attacker's Character write, and the GM's undo restores them.
 * Ammunition is not degraded: a tracked shot already spends one piece (ATTACK-19); untracked
 * ammunition is not counted by design (D4).
 */

const ATTACKER_ACTOR_ID = testUuid(0x1200)
const ATTACKER_ID = testUuid(0x1201)
const PUDDING_ID = testUuid(0x1202)
const RANGE = ['TARGET_RANGE_UNCHECKED' as const]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

function puddingRoom(config: {
  equipment: Parameters<typeof actionRoom>[0]['characterEquipment']
  weaponLabel: string
  trackAmmunition?: boolean
}) {
  return actionRoom({
    autoRoll: 'BOTH',
    trackAmmunition: config.trackAmmunition,
    rolls: Array.from({ length: 40 }, (_, index) => (index % 2 === 0 ? 18 : 1)),
    actors: [
      {
        ...characterActor({ id: ATTACKER_ACTOR_ID, characterId: ATTACKER_ID }),
        snapshot: { kind: 'CHARACTER', id: ATTACKER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: PUDDING_ID, creature: seededSrdCreature('Black Pudding') })
    ],
    characterEquipment: config.equipment,
    characterPlay: { carriedQuantity: 2 },
    characterAction: (action) => action.label.includes(config.weaponLabel)
  })
}
type Room = Awaited<ReturnType<typeof puddingRoom>>

function readAttackerPlay(room: Room) {
  return runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === ATTACKER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row)
  })
}

async function strike(room: Room) {
  const { answer } = await room.startAction(PUDDING_ID, RANGE)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
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

async function nextRound(room: Room) {
  await room.advanceTurn()
  await room.advanceTurn()
}

describe('Corrosive Form corrodes the weapon that hits the pudding (SPELLS-33 T6i2)', () => {
  it('gives a hit weapon a -1 penalty, and undo restores it', async () => {
    const room = await puddingRoom({ equipment: [mace], weaponLabel: 'Mace' })
    expect((await readAttackerPlay(room)).itemDegradation).toEqual([])

    await strike(room)
    const corroded = await readAttackerPlay(room)
    expect(corroded.itemDegradation).toHaveLength(1)
    expect(corroded.itemDegradation[0]).toMatchObject({ penalty: 1 })
    expect(corroded.itemUsage).toEqual([])

    await undo(room)
    expect(await readAttackerPlay(room)).toMatchObject({ itemDegradation: [], itemUsage: [] })
  })

  it('destroys the weapon at -5, and undo gives it back', async () => {
    const room = await puddingRoom({ equipment: [mace], weaponLabel: 'Mace' })
    for (let hit = 0; hit < 5; hit += 1) {
      await strike(room)
      if (hit < 4) await nextRound(room)
    }
    const destroyed = await readAttackerPlay(room)
    const [degraded] = destroyed.itemDegradation
    expect(degraded).toMatchObject({ penalty: 5 })
    expect(destroyed.itemUsage).toEqual([{ itemInstanceId: degraded!.itemInstanceId, used: 1 }])

    await undo(room)
    const restored = await readAttackerPlay(room)
    expect(restored.itemDegradation[0]).toMatchObject({ penalty: 4 })
    expect(restored.itemUsage).toEqual([])
  })

  it('spends the shot ammunition and leaves the bow unharmed', async () => {
    const room = await puddingRoom({
      equipment: [longbow, arrows],
      weaponLabel: 'Longbow',
      trackAmmunition: true
    })
    const piecesLeft = async () =>
      (await room.actionChoices()).actions
        .find(({ id }) => id === room.actionId)
        ?.ammunition?.map(({ quantity }) => quantity)

    expect(await piecesLeft()).toEqual([2])
    await strike(room)
    expect(await piecesLeft()).toEqual([1])
    expect((await readAttackerPlay(room)).itemDegradation).toEqual([])
  })
})
