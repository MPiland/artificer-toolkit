import { runInDurableObject } from 'cloudflare:test'
import { characterActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { monk } from '@artificer-toolkit/source-data/srd/classes/monk.js'
import { wayOfTheOpenHand } from '@artificer-toolkit/source-data/srd/classes/way-of-the-open-hand.js'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

/**
 * QUALITY-15.T3d: Wholeness of Body heals its user by bonuses alone ("three times your monk
 * level"), with no authored base amount. The compiled graph binds the one amount the Sheet resolves
 * from the monk's level; the use is spent once and one undo restores both.
 */

const ACTOR_ID = testUuid(0x9d0)
const CHARACTER_ID = testUuid(0x9d1)
const MONK_LEVEL = 6
const WOUNDED_HIT_POINTS = 1

afterEach(closeTrackedSockets)

const room = () =>
  actionRoom({
    actors: [characterActor({ id: ACTOR_ID, characterId: CHARACTER_ID })],
    characterPlay: {
      characterClass: monk,
      characterSubclass: wayOfTheOpenHand,
      classLevel: MONK_LEVEL,
      currentHitPoints: WOUNDED_HIT_POINTS
    },
    characterAction: (action) => action.label.startsWith('Wholeness of Body')
  })

type Room = Awaited<ReturnType<typeof room>>

const play = (fixture: Room) =>
  runInDurableObject(fixture.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    const { hitpoints, resourceUsage } = readCharacterPlay(row)
    return {
      hitPoints: hitpoints.current,
      used: resourceUsage.reduce((total, { used }) => total + used, 0)
    }
  })

describe('room Wholeness of Body (QUALITY-15.T3d)', () => {
  it('heals three times the monk level, spends the use, and one undo restores both', async () => {
    const fixture = await room()
    const { answer } = await fixture.startAction(
      ACTOR_ID,
      [],
      null,
      null,
      fixture.actionId,
      ACTOR_ID
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await play(fixture)).toEqual({
      hitPoints: WOUNDED_HIT_POINTS + 3 * MONK_LEVEL,
      used: 1
    })

    const undone = await fixture.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: fixture.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await fixture.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await play(fixture)).toEqual({ hitPoints: WOUNDED_HIT_POINTS, used: 0 })
  }, 120000)
})
