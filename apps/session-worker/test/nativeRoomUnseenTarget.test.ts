import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

const ATTACKER_ID = testUuid(0xa00)
const SEEN_ID = testUuid(0xa01)
const UNSEEN_ID = testUuid(0xa02)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The player's wolf bites; a second wolf is drawn on the map and a third has its token hidden. */
function unseenRoom() {
  const wolf = biteWolf('ATTACK')
  return actionRoom({
    rolls: [15],
    playerControlledActorIds: [ATTACKER_ID],
    hiddenActorIds: [UNSEEN_ID],
    actors: [ATTACKER_ID, SEEN_ID, UNSEEN_ID].map((id) =>
      srdCreatureActor({ id, creature: wolf, disposition: 'HOSTILE' })
    ),
    ownerFeatureId: wolf.features?.find((feature) => feature.label === 'Bite')?.id
  })
}
type Room = Awaited<ReturnType<typeof unseenRoom>>

/** The player's Bite at `targetActorId`, on the player's own socket. */
async function biteAsPlayer(room: Room, targetActorId: string) {
  return room.sendAsPlayer({
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId: ATTACKER_ID,
    target: { kind: 'ACTOR', actorId: targetActorId },
    actionId: room.actionId,
    optionalCombatIntent: null,
    sceneContext: null
  })
}

const reveal = async (room: Room, level: 'UNNAMED' | 'NAMED' | null) =>
  room.send({
    type: 'UPDATE_ACTOR',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId: UNSEEN_ID,
    reveal: level
  })

describe('a player targeting a creature they cannot see (ATTACK-17.3)', () => {
  it('refuses a creature whose token the map hides, and takes it once the GM reveals it', async () => {
    const room = await unseenRoom()
    const before = await room.version()

    expect(await biteAsPlayer(room, UNSEEN_ID)).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'TARGET_UNAVAILABLE'
    })
    expect(await room.version()).toBe(before)

    expect((await reveal(room, 'UNNAMED')).type).toBe('COMMAND_COMMITTED')
    const answer = await biteAsPlayer(room, UNSEEN_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  })

  it('takes a creature the map draws, with nothing revealed', async () => {
    const room = await unseenRoom()
    const answer = await biteAsPlayer(room, SEEN_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  })

  it('lets the GM target a creature with a hidden token', async () => {
    const room = await unseenRoom()
    const { answer } = await room.startAction(UNSEEN_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  })

  it('takes the reveal from the GM alone', async () => {
    const room = await unseenRoom()
    const answer = await room.sendAsPlayer({
      type: 'UPDATE_ACTOR',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      actorId: UNSEEN_ID,
      reveal: 'NAMED'
    })
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'GM_ONLY' })
  })
})
