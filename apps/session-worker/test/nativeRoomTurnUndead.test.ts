import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { cleric } from '@artificer-toolkit/source-data/srd/classes/cleric.js'
import { TURNED_INSTRUCTIONS } from '@artificer-toolkit/source-data/srd/classes/turned.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { answerAllSaves } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorHitPoints, readRoomHistory } from './roomHistoryReads.js'
import { seededSrdCreature } from './seededSrdCreature.js'

/**
 * QUALITY-15.T3h (D187a): a Cleric's Turn Undead, whose failed save both turns the undead for a
 * minute (a timed GM ruling) and destroys the weak ones (a challenge rating gated kill), cast
 * through a real room. A level 5 Cleric destroys undead of challenge rating 1/2 or less.
 */

const CLERIC_ACTOR_ID = testUuid(0x7e0)
const CLERIC_ID = testUuid(0x7e1)
const WIGHT_ID = testUuid(0x7e2)
const SKELETON_ID = testUuid(0x7e3)
const channelDivinity = cleric.features?.find(({ label }) => label === 'Channel Divinity')
if (!channelDivinity) throw new Error('The Cleric authors no Channel Divinity.')
/** One minute of 6-second turns. */
const ONE_MINUTE = 10

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A 5th-level Cleric beside a Wight (challenge rating 3) and a Skeleton (challenge rating 1/4). */
function turnUndeadRoom() {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CLERIC_ACTOR_ID, characterId: CLERIC_ID }),
        snapshot: { kind: 'CHARACTER', id: CLERIC_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WIGHT_ID, creature: seededSrdCreature('Wight') }),
      srdCreatureActor({ id: SKELETON_ID, creature: seededSrdCreature('Skeleton') })
    ],
    characterPlay: { characterClass: cleric, classLevel: 5 },
    characterClassFeatures: [channelDivinity],
    characterAction: (action) => action.label.startsWith('Channel Divinity')
  })
}

type TurnUndeadRoom = Awaited<ReturnType<typeof turnUndeadRoom>>

/** The rulings the Wight's held effects carry, with the turns each effect has left. */
async function wightRulings(room: TurnUndeadRoom) {
  const { activeEffects } = await readRoomHistory(room.room.base.stub)
  return activeEffects
    .filter(({ targetActorId }) => targetActorId === WIGHT_ID)
    .map(({ definitionJson, lifecycle }) => ({
      rulings: activeRuleEffectDefinitionDtoSchema
        .parse(JSON.parse(definitionJson))
        .stateContributions.filter(({ kind }) => kind === 'GM_RULING'),
      remainingTicks: lifecycle.remainingTicks
    }))
}

/** The Cleric turns undead; both undead fail their saves. */
async function turnUndead(room: TurnUndeadRoom) {
  const { answer } = await room.startCasterCenteredAreaAction(['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  await answerAllSaves(room)
}

describe('Turn Undead as a timed ruling beside a gated kill in the room (QUALITY-15.T3h)', () => {
  it('turns the Wight for a minute and destroys the Skeleton in the same failed save', async () => {
    const room = await turnUndeadRoom()
    await turnUndead(room)

    expect(await wightRulings(room)).toEqual([
      {
        rulings: [
          {
            kind: 'GM_RULING',
            rulingOutcomeId: expect.any(String),
            label: 'Turned',
            instructions: TURNED_INSTRUCTIONS
          }
        ],
        remainingTicks: ONE_MINUTE
      }
    ])
    // The Wight is above the gate's challenge rating, so it is turned and not destroyed.
    const history = await readRoomHistory(room.room.base.stub)
    expect(readActorHitPoints(history, WIGHT_ID)).toBeGreaterThan(0)
    expect(readActorHitPoints(history, SKELETON_ID)).toBe(0)
  }, 120000)

  it('undoes the use, leaving no ruling and the Skeleton standing', async () => {
    const room = await turnUndeadRoom()
    const before = readActorHitPoints(await readRoomHistory(room.room.base.stub), SKELETON_ID)
    await turnUndead(room)
    expect(await wightRulings(room)).toHaveLength(1)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await wightRulings(room)).toEqual([])
    expect(readActorHitPoints(await readRoomHistory(room.room.base.stub), SKELETON_ID)).toBe(before)
  }, 120000)
})
