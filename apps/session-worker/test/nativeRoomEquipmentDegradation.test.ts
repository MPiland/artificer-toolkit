import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { chainMail } from '@artificer-toolkit/source-data/srd/equipment/chain-mail.js'
import { leatherArmor } from '@artificer-toolkit/source-data/srd/equipment/leather-armor.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { runInDurableObject } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { seededSrdCreature } from './seededSrdCreature.js'

/**
 * SPELLS-33 T6i: a Black Pudding's Dissolving Pseudopod and a Rust Monster's Antennae corrode the
 * armor a Fighter wears through the generic `degradeEquipment` option. The penalty and a
 * destroyed item ride in the action's receipt and Character write, and the GM's undo restores them.
 */

const FIGHTER_ACTOR_ID = testUuid(0x1100)
const FIGHTER_ID = testUuid(0x1101)
const PUDDING_ID = testUuid(0x1102)
const RUST_MONSTER_ID = testUuid(0x1103)

/** Zero-based d20 face of a hit that is not a critical; every other die shows 1. */
const HIT_FACE = 18
const LOWEST_FACE = 0
const RANGE = ['TARGET_RANGE_UNCHECKED' as const]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Fighter wearing `armor`, struck first by `monster`'s `featureLabel` on its turn. */
function corrosionRoom(input: {
  monsterId: string
  creatureLabel: string
  featureLabel: string
  armor: typeof chainMail
  rolls: readonly number[]
}) {
  const creature = seededSrdCreature(input.creatureLabel)
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: input.rolls,
    fallbackRoll: LOWEST_FACE,
    actors: [
      srdCreatureActor({ id: input.monsterId, creature }),
      {
        ...characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
        snapshot: { kind: 'CHARACTER', id: FIGHTER_ID, systemId: srdSystemRecord.id }
      }
    ],
    ownerFeatureId: creatureFeature(creature, input.featureLabel).id,
    characterEquipment: [input.armor]
  })
}
type Room = Awaited<ReturnType<typeof corrosionRoom>>

/** The Fighter's play record: the corrosion and use of every item it carries. */
function readFighterPlay(room: Room) {
  return runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === FIGHTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row)
  })
}

async function strike(room: Room) {
  const { answer } = await room.startAction(FIGHTER_ACTOR_ID, RANGE)
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

describe('Dissolving Pseudopod corrodes worn armor in an Assisted Run (SPELLS-33 T6i)', () => {
  it('lowers the armor class a hit offers by one, cumulatively, and undo restores it', async () => {
    const room = await corrosionRoom({
      monsterId: PUDDING_ID,
      creatureLabel: 'Black Pudding',
      featureLabel: 'Pseudopod',
      armor: chainMail,
      rolls: [HIT_FACE]
    })
    const worn = await readFighterPlay(room)
    expect(worn.itemDegradation).toEqual([])

    await strike(room)
    const corroded = await readFighterPlay(room)
    expect(corroded.itemDegradation).toHaveLength(1)
    expect(corroded.itemDegradation[0]).toMatchObject({ penalty: 1 })
    expect(corroded.itemUsage).toEqual([])

    await undo(room)
    expect(await readFighterPlay(room)).toMatchObject({ itemDegradation: [], itemUsage: [] })
  })

  it('destroys armor whose offered armor class falls to 10, and undo gives it back', async () => {
    const room = await corrosionRoom({
      monsterId: PUDDING_ID,
      creatureLabel: 'Black Pudding',
      featureLabel: 'Pseudopod',
      armor: leatherArmor,
      rolls: [HIT_FACE]
    })

    await strike(room)
    const destroyed = await readFighterPlay(room)
    expect(destroyed.itemDegradation).toHaveLength(1)
    expect(destroyed.itemUsage).toEqual([
      { itemInstanceId: destroyed.itemDegradation[0]!.itemInstanceId, used: 1 }
    ])

    await undo(room)
    expect(await readFighterPlay(room)).toMatchObject({ itemDegradation: [], itemUsage: [] })
  })
})

describe('Rust Monster Antennae corrode worn metal armor on a failed save (SPELLS-33 T6i)', () => {
  it('rusts the chain mail once the Fighter fails its Dexterity save, and undo restores it', async () => {
    const room = await corrosionRoom({
      monsterId: RUST_MONSTER_ID,
      creatureLabel: 'Rust Monster',
      featureLabel: 'Antennae',
      armor: chainMail,
      rolls: [LOWEST_FACE]
    })

    await strike(room)
    const rusted = await readFighterPlay(room)
    expect(rusted.itemDegradation).toHaveLength(1)
    expect(rusted.itemDegradation[0]).toMatchObject({ penalty: 1 })

    await undo(room)
    expect(await readFighterPlay(room)).toMatchObject({ itemDegradation: [], itemUsage: [] })
  })
})
