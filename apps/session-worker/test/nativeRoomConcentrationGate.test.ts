import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { concentrationCapacityItem } from '@artificer-toolkit/rules-runtime/testing/concentrationCapacityItem'
import { bless } from '@artificer-toolkit/source-data/srd/spells/bless.js'
import { haste } from '@artificer-toolkit/source-data/srd/spells/haste.js'
import { shieldOfFaith } from '@artificer-toolkit/source-data/srd/spells/shield-of-faith.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-12.T2a through the room: a worn item whose authored capacity bonus is limited to spells of
 * 1st level or lower lets its holder keep a second Concentration only when the new spell and the
 * held one are both within that limit; otherwise a new Concentration replaces the old one.
 */

const CASTER_ACTOR_ID = testUuid(0xf00)
const CASTER_ID = testUuid(0xf01)
const WOLF_ID = testUuid(0xf02)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const gatedItem = concentrationCapacityItem({
  number: 930,
  label: 'Gated Capacity Item',
  bonus: 1,
  maxSpellLevel: 1
})

function spellRoom(equipment: readonly (typeof gatedItem)[]) {
  return actionRoom({
    autoRoll: 'BOTH',
    actors: [
      characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    characterSpellcasting: {
      spells: [shieldOfFaith, bless, haste],
      prepared: [shieldOfFaith.id, bless.id, haste.id]
    },
    characterEquipment: equipment,
    characterAction: (action) => action.label.startsWith(shieldOfFaith.label)
  })
}

type SpellRoom = Awaited<ReturnType<typeof spellRoom>>

/** Casts the spell whose label starts with `label` on the Wolf, soft-overriding the turn's one Action. */
async function cast(room: SpellRoom, label: string) {
  const actionId = (await room.actionChoices()).actions.find((action) =>
    action.label.startsWith(label)
  )?.id
  if (!actionId) throw new Error(`The caster offers no ${label}.`)
  const result = await room.startAction(
    WOLF_ID,
    ['ACTION_ECONOMY_UNAVAILABLE', 'TARGET_RANGE_UNCHECKED'],
    null,
    null,
    actionId
  )
  expect(result.answer.type, JSON.stringify(result.answer)).toBe('COMMAND_COMMITTED')
}

const heldStates = async (room: SpellRoom) =>
  (await readRoomHistory(room.room.base.stub)).maintainedStates

describe('Concentration capacity gated by spell level (SPELLS-12.T2a)', () => {
  it('keeps a second Concentration when both spells are within the limit', async () => {
    const room = await spellRoom([gatedItem])
    await cast(room, 'Shield of Faith (1st level)')
    await cast(room, 'Bless (1st level)')
    const held = await heldStates(room)
    expect(held).toHaveLength(2)
    expect(held.map((state) => state.descriptor.spellLevel)).toEqual([1, 1])
  })

  it('replaces the held Concentration when the new spell is above the limit', async () => {
    const room = await spellRoom([gatedItem])
    await cast(room, 'Shield of Faith (1st level)')
    const [first] = await heldStates(room)
    await cast(room, 'Haste (3rd level)')
    const held = await heldStates(room)
    expect(held).toHaveLength(1)
    expect(held[0]?.id).not.toBe(first?.id)
    expect(held[0]?.descriptor.spellLevel).toBe(3)
  })

  it('replaces a held Concentration that is above the limit with a spell within it', async () => {
    const room = await spellRoom([gatedItem])
    await cast(room, 'Haste (3rd level)')
    await cast(room, 'Bless (1st level)')
    const held = await heldStates(room)
    expect(held).toHaveLength(1)
    expect(held[0]?.descriptor.spellLevel).toBe(1)
  })

  it('replaces the held Concentration without the item', async () => {
    const room = await spellRoom([])
    await cast(room, 'Shield of Faith (1st level)')
    await cast(room, 'Bless (1st level)')
    expect(await heldStates(room)).toHaveLength(1)
  })
})
