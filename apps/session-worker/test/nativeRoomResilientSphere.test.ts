import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { resilientSphere } from '@artificer-toolkit/source-data/srd/spells/resilient-sphere.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readMaintainedStates, readZones } from './placedZoneRoomReads.js'
import { readPendingActionDecision } from './roomHistoryReads.js'

/**
 * QUALITY-15.T3y6a: the SRD Resilient Sphere names one creature, which makes a Dexterity save; a
 * failed save leaves the sphere as a zone on that creature's token for the caster's Concentration, and
 * a successful one leaves nothing. The real compile, cast, save and commit path run on it.
 */

const CASTER_ACTOR_ID = testUuid(0x3600)
const CASTER_ID = testUuid(0x3601)
const WOLF_ID = testUuid(0x3602)

/** A token is 100 px and a cell 5 ft: the Wolf stands 10 ft from the caster at (150, 150). */
const WOLF_AT = { x: 350, y: 150 }
/** The authored 2.5 ft (50 px) past the edge of the Wolf's 100 px token. */
const SPHERE_RADIUS = 100
/** Every d20 shows a natural 1 (a raw 0), or a natural 20 (a raw 19). */
const FAILED_SAVE_DIE = 0
const MADE_SAVE_DIE = 19

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

async function castSphere(die: number) {
  const room = await actionRoom({
    actors: [
      {
        ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        snapshot: { kind: 'CHARACTER', id: CASTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    positions: { [WOLF_ID]: WOLF_AT },
    characterSpellcasting: { spells: [resilientSphere], prepared: [resilientSphere.id] },
    characterAction: (action) => action.label === 'Resilient Sphere (4th level)',
    autoRoll: 'EVERYONE',
    fallbackRoll: die
  })
  const choices = await room.actionChoicesAsPlayer(CASTER_ACTOR_ID)
  expect(choices.actions.find(({ id }) => id === room.actionId)?.target).toMatchObject({
    kind: 'ACTORS',
    maxTargets: 1
  })
  const { answer } = await room.startActorsAction([WOLF_ID])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  return room
}

describe('Resilient Sphere as a zone a failed save leaves on its target (QUALITY-15.T3y6a)', () => {
  it('encloses a creature that fails its Dexterity save in a sphere on its token', async () => {
    const room = await castSphere(FAILED_SAVE_DIE)

    const [zone, ...others] = await readZones(room)
    expect(others).toEqual([])
    expect(zone?.placement).toMatchObject({
      anchorKind: 'TOKEN',
      sourceTokenId: room.room.scene.tokens[1]!.id,
      geometry: { frame: 'TOKEN_LOCAL', shape: { kind: 'CIRCLE', radius: SPHERE_RADIUS } },
      label: 'Resilient Sphere'
    })
    expect(await readMaintainedStates(room)).toHaveLength(1)
  }, 120000)

  it('leaves no sphere, and holds no Concentration, when the creature makes its save', async () => {
    const room = await castSphere(MADE_SAVE_DIE)

    expect(await readZones(room)).toEqual([])
    expect(await readMaintainedStates(room)).toEqual([])
  }, 120000)
})
