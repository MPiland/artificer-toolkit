import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { huntersMark } from '@artificer-toolkit/source-data/srd/spells/hunters-mark.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets, connectPlayer } from './liveRoomFixture.js'
import { CONCENTRATION_STATE_ID, movementRoom } from './movementRoomFixture.js'

/**
 * SPELLS-8.6: a mark the Character's live Concentration keeps on a Creature shows on the room's Sheet
 * as the die it adds to the Character's damage against that Creature only (the room's fill of the
 * placed effects).
 */

const ACTOR_ID = testUuid(0x8f10)
const CHARACTER_ID = testUuid(0x8f11)
const WOLF_ID = testUuid(0x8f12)

afterEach(closeTrackedSockets)

function markingRoom(marked: boolean) {
  return movementRoom({
    actors: [
      characterActor({ id: ACTOR_ID, characterId: CHARACTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    moverActorId: ACTOR_ID,
    positions: { [ACTOR_ID]: { x: 150, y: 150 }, [WOLF_ID]: { x: 250, y: 150 } },
    characterPlay: { equipped: true },
    concentration: true,
    ...(marked && {
      seed: seedModifierGrant({
        sourceActorId: ACTOR_ID,
        holderActorId: WOLF_ID,
        lifecycle: {},
        effect: huntersMark.effects![0]!,
        sourceLabel: huntersMark.label,
        maintainedEffectStateId: CONCENTRATION_STATE_ID
      })
    })
  })
}

/** The added damage dice on the attack row of the Sheet the room sends the Character's player. */
async function attackRowDamageDice(room: Awaited<ReturnType<typeof markingRoom>>) {
  const player = await connectPlayer(room.base)
  player.socket.send(
    JSON.stringify({ type: 'SUBSCRIBE_CHARACTER_SHEET', characterId: CHARACTER_ID })
  )
  const sheet = await vi.waitFor(() => {
    const message = player.messages.find((each) => each.type === 'CHARACTER_SHEET')
    if (message?.type !== 'CHARACTER_SHEET') throw new Error('The room sent no Sheet.')
    return message.sheet
  })
  const row = sheet.actions.items.find((action) => action.mechanic?.attackBonus != null)
  if (!row?.mechanic) throw new Error('The Sheet lists no attack row.')
  return row.mechanic.damageAddedDice
}

describe("a live mark on the room's Sheet (SPELLS-8.6)", () => {
  it('lists the die the mark adds to damage against the marked Creature only', async () => {
    expect(await attackRowDamageDice(await markingRoom(true))).toEqual([
      {
        label: huntersMark.label,
        count: 1,
        faces: 6,
        sign: 'ADD',
        damageTypeId: null,
        againstHolderOnly: true
      }
    ])
  })

  it('lists no added damage die while the Character marks nothing', async () => {
    expect(await attackRowDamageDice(await markingRoom(false))).toBeUndefined()
  })
})
