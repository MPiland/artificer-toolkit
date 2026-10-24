import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { giantFrog } from '@artificer-toolkit/source-data/srd/creatures/giant-frog.js'
import { guard } from '@artificer-toolkit/source-data/srd/creatures/guard.js'
import { net } from '@artificer-toolkit/source-data/srd/equipment/net.js'
import { freedomOfMovement } from '@artificer-toolkit/source-data/srd/spells/freedom-of-movement.js'
import { holdPerson } from '@artificer-toolkit/source-data/srd/spells/hold-person.js'
import { conditionTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { web } from '@artificer-toolkit/source-data/srd/spells/web.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, type ActionRoomConfig } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { walkerMoves } from './placedZoneRoomReads.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2m2 (D187a): Freedom of Movement makes its holder immune to the paralyzed and
 * restrained conditions a magical source applies. A spell's condition is magical on every path that
 * applies it, a save (Hold Person) or a zone (Web); a grapple and a net are not.
 */

const CHARACTER_ACTOR_ID = testUuid(0x2d10)
const CHARACTER_ID = testUuid(0x2d11)
const GUARD_ID = testUuid(0x2d12)
const FROG_ID = testUuid(0x2d13)

const PARALYZED = conditionTypeId('PARALYZED')
const RESTRAINED = conditionTypeId('RESTRAINED')

/** No Scene measures the spell's range (D11). */
const RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']
/** Every die shows its lowest face, so each save fails; draws of 19 are natural 20s that hit, with or without disadvantage. */
const LOWEST = 0
const HITS = [19, 19]
/** 5 feet is 100 Scene units; the Character's token stands at (150, 150), the Guard's beside it. */
const WEB_CENTER = { x: 600, y: 600 }
const OUTSIDE_THE_WEB = { x: 950, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * The Guard's grant of the real Freedom of Movement, cast by `sourceActorId`: the seeded grant lasts
 * until that actor's next turn, past the Guard's own.
 */
const freedom = (warded: boolean, sourceActorId: string): Pick<ActionRoomConfig, 'seed'> =>
  warded
    ? {
        seed: seedModifierGrant({
          sourceActorId,
          holderActorId: GUARD_ID,
          lifecycle: {},
          effect: freedomOfMovement.effects?.[0],
          sourceLabel: freedomOfMovement.label
        })
      }
    : {}

/** The Character (first in the order) acting with `actionLabel`, and the Guard it acts on. */
function characterRoom(
  config: Pick<ActionRoomConfig, 'characterSpellcasting' | 'characterEquipment' | 'rolls'> & {
    actionLabel: string
    warded: boolean
    guardAt?: { x: number; y: number }
  }
) {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        snapshot: { kind: 'CHARACTER' as const, id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: GUARD_ID, creature: guard })
    ],
    ...(config.guardAt && { positions: { [GUARD_ID]: config.guardAt } }),
    ...(config.characterSpellcasting && { characterSpellcasting: config.characterSpellcasting }),
    ...(config.characterEquipment && { characterEquipment: config.characterEquipment }),
    characterAction: (action) => action.label.startsWith(config.actionLabel),
    autoRoll: 'EVERYONE',
    ...(config.rolls && { rolls: config.rolls }),
    fallbackRoll: LOWEST,
    ...freedom(config.warded, CHARACTER_ACTOR_ID)
  })
}

type Room = Awaited<ReturnType<typeof actionRoom>>

/** The Guard's stored conditions, as `{ conditionTypeId }` rows. */
async function conditionsOf(room: Room) {
  return vitalsOf(await readRoomHistory(room.room.base.stub)).find(({ id }) => id === GUARD_ID)
    ?.conditions
}

const committed = ({ answer }: { answer: { type: string } }) =>
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

describe('room Freedom of Movement (SPELLS-4.T2m2)', () => {
  it.each([
    {
      holder: 'paralyzes a Guard that fails its save',
      warded: false,
      expected: [{ conditionTypeId: PARALYZED }]
    },
    { holder: 'cannot paralyze a Guard holding the spell', warded: true, expected: [] }
  ])('Hold Person $holder', async ({ warded, expected }) => {
    const room = await characterRoom({
      characterSpellcasting: { spells: [holdPerson], prepared: [holdPerson.id] },
      actionLabel: holdPerson.label,
      warded
    })

    committed(await room.startAction(GUARD_ID, RANGE))

    expect(await conditionsOf(room)).toEqual(expected)
  })

  it.each([
    {
      holder: 'restrains a Guard that fails its save',
      warded: false,
      expected: [{ conditionTypeId: RESTRAINED }]
    },
    { holder: 'cannot restrain a Guard holding the spell', warded: true, expected: [] }
  ])('Web $holder', async ({ warded, expected }) => {
    const room = await characterRoom({
      characterSpellcasting: { spells: [web], prepared: [web.id] },
      actionLabel: web.label,
      guardAt: OUTSIDE_THE_WEB,
      warded
    })
    committed(await room.startAreaAction(WEB_CENTER))
    await room.advanceTurn()

    // The Guard walks into the webs on its turn and fails its save.
    await walkerMoves(room, [OUTSIDE_THE_WEB, WEB_CENTER])

    expect(await conditionsOf(room)).toEqual(expected)
  })

  it('does not stop a net from restraining the Guard', async () => {
    const room = await characterRoom({
      characterEquipment: [net],
      actionLabel: net.label,
      rolls: HITS,
      warded: true
    })

    committed(await room.startAction(GUARD_ID, []))

    expect(await conditionsOf(room)).toContainEqual({ conditionTypeId: RESTRAINED })
  })

  it('does not stop a Giant Frog’s grapple from restraining the Guard', async () => {
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: FROG_ID, creature: giantFrog }),
        srdCreatureActor({ id: GUARD_ID, creature: guard })
      ],
      ownerFeatureId: creatureFeature(giantFrog, 'Bite').id,
      autoRoll: 'EVERYONE',
      rolls: [19],
      fallbackRoll: LOWEST,
      ...freedom(true, FROG_ID)
    })

    committed(await room.startAction(GUARD_ID, []))

    expect(await conditionsOf(room)).toContainEqual({ conditionTypeId: RESTRAINED })
  })
})
