import {
  creatureFeature,
  srdCondition,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorConditionIds, readActorHitPoints, readRoomHistory } from './roomHistoryReads.js'
import { seededSrdCreature } from './seededSrdCreature.js'

const SPAWN_ID = testUuid(0xb10)
const TARGET_ID = testUuid(0xb11)
const GRAPPLED = srdCondition('Grappled')
const spawn = seededSrdCreature('Vampire Spawn')
/** The zero-based draw of a die that shows `face`. */
const draw = (face: number) => face - 1

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The Vampire Spawn claws a Wolf; its d20 shows 15 (a hit, not a critical), then its 2d4 show 3 and 3. */
function clawsRoom() {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: [15, 3, 3].map(draw),
    actors: [
      srdCreatureActor({ id: SPAWN_ID, creature: spawn }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(spawn, 'Claws').id
  })
}

type ClawsRoom = Awaited<ReturnType<typeof clawsRoom>>

/** The target's hit points and conditions after the Claws hit with the option labelled `label`. */
async function claw(room: ClawsRoom, label: string) {
  const choices = await room.actionChoices(SPAWN_ID)
  const claws = choices.actions.find(({ id }) => id === room.actionId)
  const options = claws?.target && 'choiceOptions' in claws.target ? claws.target.choiceOptions : []
  expect(options?.map((option) => option.label)).toEqual(['Damage', 'Grapple'])
  const option = options?.find((value) => value.label === label)
  if (!option) throw new Error(`The room offers no ${label} option.`)
  const { answer } = await room.startAction(
    TARGET_ID,
    ['TARGET_RANGE_UNCHECKED'],
    null,
    null,
    room.actionId,
    SPAWN_ID,
    option.id
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const history = await readRoomHistory(room.room.base.stub)
  return {
    hitPoints: readActorHitPoints(history, TARGET_ID),
    conditions: readActorConditionIds(history, TARGET_ID)
  }
}

describe('a Creature action that picks its outcome at use (SPELLS-33.T3a6, D148)', () => {
  it('lists the Claws’ options, and the Damage option only wounds', async () => {
    const full = readActorHitPoints(
      await readRoomHistory((await clawsRoom()).room.base.stub),
      TARGET_ID
    )
    const { hitPoints, conditions } = await claw(await clawsRoom(), 'Damage')
    expect(hitPoints).toBe(full - 9)
    expect(conditions).not.toContain(GRAPPLED)
  })

  it('grapples with the Grapple option and deals no damage', async () => {
    const full = readActorHitPoints(
      await readRoomHistory((await clawsRoom()).room.base.stub),
      TARGET_ID
    )
    const { hitPoints, conditions } = await claw(await clawsRoom(), 'Grapple')
    expect(hitPoints).toBe(full)
    expect(conditions).toContain(GRAPPLED)
  })

  it('refuses a Claws attack that names no option', async () => {
    const room = await clawsRoom()
    const { answer } = await room.startAction(
      TARGET_ID,
      ['TARGET_RANGE_UNCHECKED'],
      null,
      null,
      room.actionId,
      SPAWN_ID
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_REJECTED')
  })
})
