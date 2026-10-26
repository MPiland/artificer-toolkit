import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { spatialDamageEffect } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf, forceOnFailedSave } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * ATTACK-15.T1g: zone damage settles through the shared mechanics batch seam, so a Character a zone
 * drops to 0 hit points gets the GM's consequence roll offer whether it walked in or was pushed in.
 * A token is 100 px, a cell 5 ft.
 */

const MOVER_ID = testUuid(0xd00)
const CHARACTER_ID = testUuid(0xd01)
const WOLF_ID = testUuid(0xd02)
const MOVER_START: ScenePoint = { x: 150, y: 150 }
const WOLF_AT: ScenePoint = { x: 150, y: 150 }
const PUSHED_FROM: ScenePoint = { x: 250, y: 150 }

const injuries = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
  (definition) => definition.document.kind === 'INJURIES'
)
if (!injuries) throw new Error('Missing published Injuries.')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

async function offersOf(stub: Parameters<typeof readRoomHistory>[0], actorId: string) {
  const row = (await readRoomHistory(stub)).actors.find(({ id }) => id === actorId)
  if (!row) throw new Error('Expected the actor in the stored Run.')
  return readStoredRunActor(row).consequenceRollOffers ?? []
}

const zeroOffer = {
  definitionId: injuries.id,
  label: injuries.label,
  triggers: [{ event: 'HIT_POINTS_ZERO' }]
}

describe('consequence roll offers for zone damage (ATTACK-15.T1g)', () => {
  function walkerRoom(currentHitPoints: number) {
    return movementRoom({
      actors: [characterActor({ id: MOVER_ID, characterId: CHARACTER_ID })],
      moverActorId: MOVER_ID,
      positions: { [MOVER_ID]: MOVER_START },
      autoRoll: 'PLAYER',
      characterPlay: { currentHitPoints },
      spatialEffects: [{ center: { x: 350, y: 150 }, radius: 50 }],
      optionalCombatKinds: ['INJURIES']
    })
  }

  it('offers the roll when a zone the Character walks into drops it to 0', async () => {
    const room = await walkerRoom(1)

    await room.move([MOVER_START, { x: 550, y: 150 }])

    const [move] = (await room.receipts()).filter(
      ({ commandType }) => commandType === 'MOVE_SCENE_TOKEN'
    )
    if (!move) throw new Error('Expected the move receipt.')
    expect(await offersOf(room.base.stub, MOVER_ID)).toMatchObject([
      { ...zeroOffer, sourceCommandId: move.commandId }
    ])
  })

  it('offers nothing for zone damage that leaves the Character standing', async () => {
    const room = await walkerRoom(20)

    await room.move([MOVER_START, { x: 550, y: 150 }])

    expect(await offersOf(room.base.stub, MOVER_ID)).toEqual([])
  })

  /** A Wolf whose Bite, which deals no damage, pushes the Character 10 ft through a 1-damage zone. */
  function pushRoom() {
    const creature = forceOnFailedSave(biteWolf('SAVE'), 'AWAY_FROM_SOURCE', 10)
    return actionRoom({
      rolls: [],
      fallbackRoll: 0,
      actors: [
        srdCreatureActor({ id: WOLF_ID, creature }),
        characterActor({ id: MOVER_ID, characterId: CHARACTER_ID })
      ],
      positions: { [WOLF_ID]: WOLF_AT, [MOVER_ID]: PUSHED_FROM },
      ownerFeatureId: creature.features.find(({ label }) => label === 'Bite')?.id,
      characterPlay: { currentHitPoints: 1 },
      optionalCombatKinds: ['INJURIES'],
      seed: async ({ spatial, encounterId }) => {
        await spatial.create(
          await spatialDamageEffect({
            encounterId,
            targetActorId: MOVER_ID,
            center: { x: 350, y: 150 },
            radius: 20,
            movementKinds: ['VOLUNTARY', 'FORCED'],
            triggerModes: ['ENTER', 'CROSS'],
            activation: 'REPEATABLE'
          })
        )
      }
    })
  }

  async function pushCharacter(room: Awaited<ReturnType<typeof pushRoom>>) {
    const { answer } = await room.startAction(MOVER_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the save prompt.')
    const { request } = decision.pending
    const resolved = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: request.rollMode === 'NORMAL' ? [1] : [1, 1],
      rollMode: request.rollMode
    })
    expect(resolved.type, JSON.stringify(resolved)).toBe('COMMAND_COMMITTED')
  }

  it('offers the roll when a zone the Character is pushed through drops it to 0', async () => {
    const room = await pushRoom()

    await pushCharacter(room)

    // The Bite only pushes: the drop, and so the offer, is the zone's, settled under the forced
    // Scene move that dealt it.
    expect(await offersOf(room.room.base.stub, MOVER_ID)).toMatchObject([zeroOffer])
    // Undo cannot restore zone damage to a Character, so the drop, and its offer, stand.
    const undo = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undo).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'REVERT_UNAVAILABLE' })
    expect(await offersOf(room.room.base.stub, MOVER_ID)).toMatchObject([zeroOffer])
  })
})
