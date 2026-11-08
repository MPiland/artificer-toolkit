import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'

/**
 * RELEASE-8.T8: a bound voluntary move records the mover's turn movement (D38), and the room pushes
 * the subscribed Encounter session again so the remaining-movement readout (D37) follows the move.
 */

const MOVER_ID = testUuid(0xb81)
const WATCHER_ID = testUuid(0xb82)
const MOVER_START: ScenePoint = { x: 150, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

describe('Encounter session push after a bound move (RELEASE-8.T8)', () => {
  it("pushes the GM's subscribed session with the mover's used movement", async () => {
    const room = await movementRoom({
      actors: [
        srdCreatureActor({ id: MOVER_ID, creature: plainWolf }),
        srdCreatureActor({ id: WATCHER_ID, creature: plainWolf })
      ],
      moverActorId: MOVER_ID,
      positions: { [MOVER_ID]: MOVER_START, [WATCHER_ID]: { x: 950, y: 150 } }
    })
    const { messages, socket } = room.base
    const usedFeet = (from: number) =>
      messages
        .slice(from)
        .flatMap((message) =>
          message.type === 'ENCOUNTER_SESSION' && message.session.held
            ? [message.session.state.turnMovement.find(({ actorId }) => actorId === MOVER_ID)?.used]
            : []
        )
    const subscribedAt = messages.length
    socket.send(JSON.stringify({ type: 'SUBSCRIBE_ENCOUNTER_SESSION', timeline: false }))
    // The first frame: the mover has not moved this turn.
    await vi.waitFor(() => expect(usedFeet(subscribedAt)).toHaveLength(1))
    expect(usedFeet(subscribedAt)[0] ?? 0).toBe(0)

    const movedAt = messages.length
    const moved = await room.move([MOVER_START, { x: 350, y: 150 }])

    expect(moved).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: { result: { delta: { kind: 'TOKEN_MOVED', position: { x: 350, y: 150 } } } }
    })
    // Two 5-ft squares walked.
    await vi.waitFor(() => expect(usedFeet(movedAt)).toEqual([10]))
  }, 120000)
})
