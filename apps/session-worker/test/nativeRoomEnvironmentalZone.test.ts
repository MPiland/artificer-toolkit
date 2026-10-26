import {
  carryingZone,
  environmentalZones
} from '@artificer-toolkit/rules-runtime/testing/authoredZoneFixture'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ManifestAuthored } from '@artificer-toolkit/shared/authored'
import {
  SRD_CONDITION_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { hitPointsOf, readZones, revertLastAction, walkerMoves } from './placedZoneRoomReads.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * MOVE-3.2 (ADR 0038): the GM places an environmental zone built with the zone node map on the
 * Scene, and it resolves as the same zone an item leaves does. The SRD caltrop field and a pit
 * authored from core options are the fixtures; the real compile, plan, commit and entry path run on
 * them, and only who places the zone differs.
 */

const SPREADER_ACTOR_ID = testUuid(0x3b00)
const SPREADER_ID = testUuid(0x3b01)
const WALKER_ID = testUuid(0x3b02)

const FIELD_POINT = { x: 250, y: 150 }
const WALKER_START = { x: 450, y: 150 }
const WALK_INTO = [WALKER_START, FIELD_POINT]

/** Every die shows this face (zero-based): the wolf's Dexterity save is a 6, failing DC 10 and 15. */
const DIE = 3
const PRONE_ID = SRD_CONDITION_TYPES.find((condition) => condition.code === 'PRONE')!.id
const { caltropField, pit } = environmentalZones()

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A room whose Character carries an item placing `zone`, and a Wolf about to walk into it. */
function zoneRoom(zone: typeof pit) {
  const item = carryingZone(zone)
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: SPREADER_ACTOR_ID, characterId: SPREADER_ID }),
        snapshot: { kind: 'CHARACTER', id: SPREADER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WALKER_ID, creature: plainWolf })
    ],
    positions: { [WALKER_ID]: WALKER_START },
    characterEquipment: [item],
    characterAction: (action) => action.label === item.label,
    autoRoll: 'EVERYONE',
    fallbackRoll: DIE
  })
}

type Room = Awaited<ReturnType<typeof zoneRoom>>

async function gmPlaces(room: Room, zone: ManifestAuthored) {
  return room.send({
    type: 'PLACE_ZONE',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    zone,
    point: FIELD_POINT
  })
}

/** The Wolf's turn comes and it walks into the field: what the walk did to it. */
async function walkIn(room: Room) {
  await room.advanceTurn()
  const hitPointsBefore = (await hitPointsOf(room, WALKER_ID)) ?? 0
  const walk = await walkerMoves(room, WALK_INTO)
  const history = await readRoomHistory(room.room.base.stub)
  const conditions = (
    (vitalsOf(history).find((vitals) => vitals.id === WALKER_ID)?.conditions ?? []) as {
      conditionTypeId: string
    }[]
  ).map(({ conditionTypeId }) => conditionTypeId)
  return {
    lost: hitPointsBefore - ((await hitPointsOf(room, WALKER_ID)) ?? 0),
    terminalPosition: walk.terminalPosition,
    interruptions: walk.executions.map(({ execution }) => execution.movementInterruption),
    conditions
  }
}

describe('a GM environmental zone on the Scene (MOVE-3.2)', () => {
  it.each([
    ['caltrop field', caltropField, { lost: 1, prone: false }],
    ['pit', pit, { lost: 3, prone: true }]
  ])(
    'resolves the GM-placed %s for a creature walking in as the item-placed one',
    async (_name, zone, expected) => {
      const byItem = await zoneRoom(zone)
      const { answer } = await byItem.startAreaAction(FIELD_POINT)
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
      const byGm = await zoneRoom(zone)
      const placed = await gmPlaces(byGm, zone)
      expect(placed.type, JSON.stringify(placed)).toBe('COMMAND_COMMITTED')
      expect(await readZones(byGm)).toHaveLength(1)

      const itemWalk = await walkIn(byItem)
      const gmWalk = await walkIn(byGm)

      expect(gmWalk).toEqual(itemWalk)
      expect(gmWalk.interruptions).toEqual([{ kind: 'STOP' }])
      expect(gmWalk.lost).toBe(expected.lost)
      expect(gmWalk.conditions.includes(PRONE_ID)).toBe(expected.prone)
    }
  )

  it('removes the zone when the GM undoes placing it, so a creature walks through unharmed', async () => {
    const room = await zoneRoom(pit)
    const placed = await gmPlaces(room, pit)
    expect(placed.type, JSON.stringify(placed)).toBe('COMMAND_COMMITTED')

    await revertLastAction(room)

    expect(await readZones(room)).toEqual([])
    const walk = await walkIn(room)
    expect(walk).toMatchObject({ lost: 0, interruptions: [], terminalPosition: FIELD_POINT })
    expect(walk.conditions).not.toContain(PRONE_ID)
  })

  it("refuses a zone that needs a creature behind it, such as one using its caster's save DC", async () => {
    const room = await zoneRoom(pit)
    const sourceDc = structuredClone(pit)
    const behavior = sourceDc.components?.[0]?.behaviors?.[0]
    if (!behavior || !('savingThrow' in behavior.invocation))
      throw new Error('The pit must author a saving throw.')
    behavior.invocation.savingThrow = {
      ...behavior.invocation.savingThrow,
      dcMethod: 'SOURCE_SAVE_DC'
    }

    const refused = await gmPlaces(room, sourceDc)

    expect(refused).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'TARGET_UNAVAILABLE'
    })
    expect(await readZones(room)).toEqual([])
  })
})
