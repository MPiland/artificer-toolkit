import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets, connectPlayer } from './liveRoomFixture.js'

/**
 * D39: a player's last shown decision settles as an answer, and the room keeps reporting that on
 * every later frame, so a client that renders the newest of several frames sent together still
 * sees it and ends the decision's drawer.
 */

const CLIMBER_ID = testUuid(0xea0)
const MOUNT_ID = testUuid(0xea1)
const CLIMBER_START: ScenePoint = { x: 150, y: 150 }
const MOUNT_START: ScenePoint = { x: 350, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

describe('the settled decision on a player’s Encounter session frames (D39)', () => {
  it('reports an answered decision on every frame after it, until the next decision is shown', async () => {
    const climber = { ...biteWolf('ATTACK'), size: 'SMALL' as const }
    const room = await actionRoom({
      autoRoll: 'BOTH',
      rolls: [19, 0, ...Array.from({ length: 8 }, () => 14)],
      actors: [
        srdCreatureActor({ id: CLIMBER_ID, creature: climber, disposition: 'FRIENDLY' }),
        srdCreatureActor({ id: MOUNT_ID, creature: { ...plainWolf, size: 'LARGE' } })
      ],
      positions: { [CLIMBER_ID]: CLIMBER_START, [MOUNT_ID]: MOUNT_START },
      optionalCombatKinds: ['CLIMB_ONTO_LARGER_CREATURE'],
      ownerFeatureId: creatureFeature(climber, 'Bite').id,
      playerControlledActorIds: [CLIMBER_ID]
    })
    const player = await connectPlayer(room.room.base)
    player.socket.send(JSON.stringify({ type: 'SUBSCRIBE_ENCOUNTER_SESSION', timeline: false }))
    const frames = () =>
      player.messages.flatMap((message) =>
        message.type === 'ENCOUNTER_SESSION' && message.session.held ? [message.session] : []
      )

    await room.room.move([CLIMBER_START, { x: 750, y: 150 }])
    await vi.waitFor(() =>
      expect(frames().at(-1)?.state.pending?.kind).toBe('MOVEMENT_PASSAGE_CHOICE')
    )
    const shownAt = frames().length
    const pending = await room.room.pending()
    if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE')
      throw new Error(`Expected a passage choice, got ${pending?.context.kind}.`)
    const climb = pending.context.options.find(
      (option) => option.ruleKind === 'CLIMB_ONTO_LARGER_CREATURE'
    )
    if (!climb) throw new Error('The climb option is missing.')
    await room.room.respond({ kind: 'PASSAGE_OPTION', optionId: climb.optionId })

    await vi.waitFor(() => expect(frames().at(-1)?.settlement?.outcome).toBe('ANSWER'))
    const answered = frames().slice(shownAt)
    expect(answered.length).toBeGreaterThan(0)
    expect(answered.map(({ settlement }) => settlement?.outcome)).toEqual(
      answered.map(() => 'ANSWER')
    )
  }, 120000)
})
