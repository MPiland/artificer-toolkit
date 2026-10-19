import {
  creatureFeature,
  srdCondition,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { escapeGrappleEffectDefinition } from '@artificer-toolkit/rules-runtime/testing/escapeGrappleEffectFixture'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, type ActionRoomConfig } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorConditionIds, readRoomHistory } from './roomHistoryReads.js'

const HELD_ID = testUuid(0xe20)
const GRAPPLER_ID = testUuid(0xe21)
const EFFECT_ID = testUuid(0xe22)
const GRAPPLED = srdCondition('Grappled')
const ENCOUNTER_COMMAND_FAILED = 'Live Session Encounter command failed in the room.'

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The held Wolf takes the first turn, so the grappler acts out of turn. */
function releaseRoom(
  options: Pick<ActionRoomConfig, 'playerControlledActorIds'> & { heldHidden?: boolean } = {}
) {
  return actionRoom({
    playerControlledActorIds: options.playerControlledActorIds,
    ownerFeatureId: creatureFeature(plainWolf, 'Bite').id,
    actors: [
      {
        ...srdCreatureActor({ id: HELD_ID, creature: plainWolf, conditionIds: [GRAPPLED] }),
        public: !options.heldHidden
      },
      srdCreatureActor({ id: GRAPPLER_ID, creature: plainWolf })
    ],
    seed: async ({ effects, encounterId, occurredAt }) => {
      await effects.create({
        id: EFFECT_ID,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: HELD_ID },
        lifecycle: { schemaVersion: 1, remainingTicks: null },
        definition: escapeGrappleEffectDefinition({
          encounterId,
          grapplerId: GRAPPLER_ID,
          conditionIds: [GRAPPLED],
          dc: 13
        }),
        occurredAt
      })
    }
  })
}

type ReleaseRoom = Awaited<ReturnType<typeof releaseRoom>>

async function releaseCommand(room: ReleaseRoom, actorId = GRAPPLER_ID) {
  return {
    type: 'RELEASE_RELATIONSHIP',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId,
    heldActorId: HELD_ID,
    activeEffectId: EFFECT_ID
  }
}

async function releaseState(room: ReleaseRoom) {
  const history = await readRoomHistory(room.room.base.stub)
  return {
    effectIds: history.activeEffects.map((effect) => effect.id),
    conditions: readActorConditionIds(history, HELD_ID),
    releases: history.commands.filter((command) => command.commandType === 'RELEASE_RELATIONSHIP'),
    holdEnds: history.commands.filter((command) => command.commandType === 'RELATIONSHIPS_ENDED')
  }
}

describe('a source releases the creature it holds (D152), in the room', () => {
  it("frees the held creature for nothing, out of the source's turn", async () => {
    const room = await releaseRoom()
    const version = await room.version()
    const answer = await room.send(await releaseCommand(room))
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await room.version()).toBe(version + 1)

    const state = await releaseState(room)
    expect(state.effectIds).toEqual([])
    expect(state.conditions).toEqual([])
    expect(state.releases).toMatchObject([
      {
        label: 'Release',
        receipt: {
          actorId: GRAPPLER_ID,
          relationshipEnds: [
            { heldActorId: HELD_ID, activeEffectId: EFFECT_ID, removedConditionIds: [GRAPPLED] }
          ]
        }
      }
    ])
  })

  it('offers the source a release of each creature it holds, and the held creature none', async () => {
    const room = await releaseRoom({ playerControlledActorIds: [GRAPPLER_ID], heldHidden: true })
    expect((await room.actionChoices()).releases).toEqual([])
    await room.advanceTurn()
    const release = { heldActorId: HELD_ID, activeEffectId: EFFECT_ID }
    expect((await room.actionChoices(GRAPPLER_ID)).releases).toEqual([
      { ...release, label: 'Release Wolf' }
    ])
    expect((await room.actionChoicesAsPlayer(GRAPPLER_ID)).releases).toEqual([
      { ...release, label: 'Release a creature' }
    ])
  })

  it("offers each member the holds its creatures source on another creature's turn, and releases one there", async () => {
    const hold = {
      sourceActorId: GRAPPLER_ID,
      heldActorId: HELD_ID,
      activeEffectId: EFFECT_ID,
      drag: null
    }
    const stranger = await releaseRoom({ heldHidden: true })
    expect(await stranger.heldRelationships(true)).toEqual([])
    expect(await stranger.heldRelationships()).toEqual([{ ...hold, label: 'Release Wolf' }])

    const room = await releaseRoom({ playerControlledActorIds: [GRAPPLER_ID], heldHidden: true })
    // The held Wolf is acting, and the player's grappler still offers its release.
    expect(await room.heldRelationships(true)).toEqual([{ ...hold, label: 'Release a creature' }])
    const answer = await room.sendAsPlayer(await releaseCommand(room))
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await room.heldRelationships(true)).toEqual([])
    expect((await releaseState(room)).conditions).toEqual([])
  })

  it('refuses the held creature releasing a hold it does not source', async () => {
    const room = await releaseRoom()
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const answer = await room.send(await releaseCommand(room, HELD_ID))
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', code: 'UNAVAILABLE' })
    expect(
      logged.mock.calls
        .filter(([message]) => message === ENCOUNTER_COMMAND_FAILED)
        .map(([, error]) => (error instanceof Error ? error.message : error))
    ).toEqual(['The creature holds no such relationship.'])
    const state = await releaseState(room)
    expect(state.effectIds).toEqual([EFFECT_ID])
    expect(state.conditions).toEqual([GRAPPLED])
  })

  it('lets the player who controls the source release, and refuses one who does not', async () => {
    const stranger = await releaseRoom()
    const refused = await stranger.sendAsPlayer(await releaseCommand(stranger))
    expect(refused.type, JSON.stringify(refused)).toBe('COMMAND_REJECTED')
    expect((await releaseState(stranger)).effectIds).toEqual([EFFECT_ID])

    const owner = await releaseRoom({ playerControlledActorIds: [GRAPPLER_ID] })
    const answer = await owner.sendAsPlayer(await releaseCommand(owner))
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await releaseState(owner)).effectIds).toEqual([])
  })

  it('replays the same command without a second commit', async () => {
    const room = await releaseRoom()
    const command = await releaseCommand(room)
    expect((await room.send(command)).type).toBe('COMMAND_COMMITTED')
    const version = await room.version()
    const replayed = await room.send(command)
    expect(replayed.type, JSON.stringify(replayed)).toBe('COMMAND_COMMITTED')
    expect(await room.version()).toBe(version)
    expect((await releaseState(room)).releases).toHaveLength(1)
  })

  it('is not undone: the GM restores a released hold by hand', async () => {
    const room = await releaseRoom()
    expect((await room.send(await releaseCommand(room))).type).toBe('COMMAND_COMMITTED')
    const refused = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(refused.type, JSON.stringify(refused)).toBe('COMMAND_REJECTED')
    expect((await releaseState(room)).effectIds).toEqual([])
  })
})

/** The hold's end the room records once it breaks on its own. */
const HOLD_ENDED = {
  label: 'Hold ended',
  receipt: {
    relationshipEnds: [
      { heldActorId: HELD_ID, activeEffectId: EFFECT_ID, removedConditionIds: [GRAPPLED] }
    ]
  }
}

describe('a hold ends on its own once it breaks (D152), in the room', () => {
  /**
   * The GM teleports the held Wolf's token, which starts at (150, 150) beside the grappler at
   * (250, 150); tokens stand on 100px cells of 5 feet. Each move advances the Scene's version.
   */
  function heldMover(room: ReleaseRoom) {
    let from = { x: 150, y: 150 }
    let sceneVersion = room.room.scene.version
    return async (to: { x: number; y: number }) => {
      const answer = await room.room.teleport(
        [from, to],
        await room.version(),
        sceneVersion,
        room.room.moverTokenId
      )
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
      from = to
      sceneVersion += 1
    }
  }

  it('keeps the hold while the held creature stays within reach, and ends it once a move leaves it beyond', async () => {
    const room = await releaseRoom()
    const teleportHeld = heldMover(room)
    // Below the grappler, and diagonal to it, the Wolf is still adjacent.
    await teleportHeld({ x: 250, y: 250 })
    await teleportHeld({ x: 150, y: 250 })
    expect((await releaseState(room)).effectIds).toEqual([EFFECT_ID])

    await teleportHeld({ x: 550, y: 150 })
    await vi.waitFor(async () => expect((await releaseState(room)).effectIds).toEqual([]))
    const state = await releaseState(room)
    expect(state.conditions).toEqual([])
    expect(state.holdEnds).toMatchObject([HOLD_ENDED])
  })

  it('ends the hold once its source can no longer act', async () => {
    const room = await releaseRoom()
    const answer = await room.send({
      type: 'UPDATE_ACTOR',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      actorId: GRAPPLER_ID,
      currentHitPoints: 0
    })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await vi.waitFor(async () => expect((await releaseState(room)).effectIds).toEqual([]))
    const state = await releaseState(room)
    expect(state.conditions).toEqual([])
    expect(state.holdEnds).toMatchObject([HOLD_ENDED])
  })
})
