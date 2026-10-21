import {
  installedSrdCreature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { mage } from '@artificer-toolkit/source-data/srd/creatures/mage.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

const MAGE_ID = testUuid(0xb00)
const WOLF_ID = testUuid(0xb01)

afterEach(closeTrackedSockets)

async function mageRoom(pinSpells: boolean) {
  const creature = installedSrdCreature(mage)
  const dagger = creature.features.find(({ label }) => label.startsWith('Dagger'))
  if (!dagger) throw new Error('The Mage has no Dagger.')
  return actionRoom({
    actors: [
      srdCreatureActor({ id: MAGE_ID, creature }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    ownerFeatureId: dagger.id,
    pinSpells
  })
}

describe('a Creature casts from the Run’s pinned Spells in a real room (SPELLS-33.T3c2a2b)', () => {
  it('offers the Mage its pinned Spell casts, read from the room’s stored pins', async () => {
    const room = await mageRoom(true)
    const labels = (await room.actionChoices()).actions.map(({ label }) => label)
    expect(labels.some((label) => label.startsWith('Fireball'))).toBe(true)
    expect(labels).toContain('Fire Bolt')
  })

  it('offers no Spell cast from a Run that holds no pins, and never reads a source', async () => {
    const room = await mageRoom(false)
    const labels = (await room.actionChoices()).actions.map(({ label }) => label)
    expect(labels).not.toContain('Fire Bolt')
    expect(labels.some((label) => label.startsWith('Fireball'))).toBe(false)
  })
})
