import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/effectActionCompiler'
import { chainLightning } from '@artificer-toolkit/source-data/srd/spells/chain-lightning.js'
import { cloudkill } from '@artificer-toolkit/source-data/srd/spells/cloudkill.js'
import { incendiaryCloud } from '@artificer-toolkit/source-data/srd/spells/incendiary-cloud.js'
import { insectPlague } from '@artificer-toolkit/source-data/srd/spells/insect-plague.js'
import { moonbeam } from '@artificer-toolkit/source-data/srd/spells/moonbeam.js'
import { stinkingCloud } from '@artificer-toolkit/source-data/srd/spells/stinking-cloud.js'
import { SRD_ACTION_ALLOWANCE_DEFINITION_ID as ACTION } from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { hitPointsOf, readZones, walkerMoves } from './placedZoneRoomReads.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T1a and T1c: the SRD Cloudkill, Insect Plague, Moonbeam and Incendiary Cloud, authored
 * from core options, place their zone at a chosen point through a real cast in the local room. A
 * creature makes the save when it enters the area and at the turn boundary each spell names
 * (starting or ending its turn there), and takes the rolled damage on a failure.
 */

const CASTER_ACTOR_ID = testUuid(0x2440)
const CASTER_ID = testUuid(0x2441)
const WOLF_ID = testUuid(0x2442)

/** Every die the room rolls shows its lowest face: each save fails and each damage die is a 1. */
const DIE = 0

/** The fixture Character's spell save DC, which the zone pins at placement. */
const WIZARD_SAVE_DC = 11

/**
 * 5 feet is 100 Scene units on the 1000-unit map: the 20-foot-radius sphere reaches 400 units from
 * its center, short of the caster's token at (150, 150) and of the Wolf's starting point.
 */
const ZONE_CENTER = { x: 600, y: 600 }
const OUTSIDE_THE_ZONE = { x: 950, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

type Room = Awaited<ReturnType<typeof actionRoom>>

const casterActor = {
  ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
  snapshot: { kind: 'CHARACTER' as const, id: CASTER_ID, systemId: srdSystemRecord.id }
}

/**
 * Each spell is cast at its own level and, when its damage scales, one above. `slotSpell` is a higher-level spell the Class
 * also publishes so the Character holds that slot (it gets slots up to its highest published spell,
 * at least the 5th). `dice` is the number of damage dice each cast rolls.
 */
const SPELLS = [
  {
    spell: cloudkill,
    slotSpell: chainLightning,
    ability: 'CONSTITUTION',
    turnTrigger: 'START_OF_TURN',
    casts: [
      { label: 'Cloudkill (5th level)', dice: 5 },
      { label: 'Cloudkill (6th level)', dice: 6 }
    ]
  },
  {
    spell: insectPlague,
    slotSpell: chainLightning,
    ability: 'CONSTITUTION',
    turnTrigger: 'END_OF_TURN',
    casts: [
      { label: 'Insect Plague (5th level)', dice: 4 },
      { label: 'Insect Plague (6th level)', dice: 5 }
    ]
  },
  {
    spell: moonbeam,
    slotSpell: undefined,
    ability: 'CONSTITUTION',
    turnTrigger: 'START_OF_TURN',
    casts: [
      { label: 'Moonbeam (2nd level)', dice: 2 },
      { label: 'Moonbeam (3rd level)', dice: 3 }
    ]
  },
  {
    // No higher-level damage, so the cast is offered only at the 8th level.
    spell: incendiaryCloud,
    slotSpell: undefined,
    ability: 'DEXTERITY',
    turnTrigger: 'END_OF_TURN',
    casts: [{ label: 'Incendiary Cloud (8th level)', dice: 10 }]
  }
] as const

/** The Character casts the action labelled `castLabel`; the Wolf stands at `wolfAt`. */
function zoneRoom(
  { spell, slotSpell }: { spell: SpellAuthored; slotSpell?: SpellAuthored },
  castLabel: string,
  wolfAt: { x: number; y: number }
) {
  return actionRoom({
    actors: [casterActor, srdCreatureActor({ id: WOLF_ID, creature: plainWolf })],
    positions: { [WOLF_ID]: wolfAt },
    characterSpellcasting: {
      spells: slotSpell ? [spell, slotSpell] : [spell],
      prepared: [spell.id]
    },
    characterAction: (action) => action.label === castLabel,
    autoRoll: 'EVERYONE',
    fallbackRoll: DIE
  })
}

async function castAtTheCenter(room: Room) {
  const { answer } = await room.startAreaAction(ZONE_CENTER)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const [zone, ...others] = await readZones(room)
  expect(others).toEqual([])
  if (!zone) throw new Error('The cast left no zone.')
  return zone
}

/** Ends the current turn and returns the zone phases its stored receipt keeps. */
async function advanceTurn(room: Room) {
  const command = {
    type: 'ADVANCE_TURN',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  }
  const answer = await room.send(command)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const receipt = (await readRoomHistory(room.room.base.stub)).receipts.find(
    (candidate) => candidate.commandId === command.commandId
  )
  if (!receipt) throw new Error('The command left no receipt.')
  const result = parseReceiptExecution(receipt)
  return {
    outgoing: 'outgoingZoneEffects' in result ? result.outgoingZoneEffects : undefined,
    incoming: 'incomingZoneEffects' in result ? result.incomingZoneEffects : undefined
  }
}

describe.each(SPELLS)('the SRD $spell.label zone (SPELLS-4.T1a, T1c)', (subject) => {
  const { spell, ability, turnTrigger, casts } = subject
  const [firstCast] = casts
  it('is placed at the chosen point and acts on entry and at its turn boundary', async () => {
    const room = await zoneRoom(subject, firstCast.label, OUTSIDE_THE_ZONE)
    const zone = await castAtTheCenter(room)
    expect(zone.placement).toMatchObject({
      anchorKind: 'FIXED',
      label: spell.label,
      triggerModes: ['ENTER'],
      turnTriggers: [turnTrigger],
      maxApplicationsPerTurn: 1
    })
    expect(JSON.parse(zone.definitionJson)).toMatchObject({
      adapterFacts: {
        [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]: SRD_ABILITY_DEFINITION_IDS[ability],
        [DND5E_SAVE_DC_FACT_KEY]: WIZARD_SAVE_DC
      }
    })
  })

  it.each<{ label: string; dice: number }>([...casts])(
    'deals the rolled damage of $label to a creature that enters the area and fails its save',
    async ({ label, dice }) => {
      const room = await zoneRoom(subject, label, OUTSIDE_THE_ZONE)
      await castAtTheCenter(room)
      await room.advanceTurn()
      const hitPointsBefore = await hitPointsOf(room, WOLF_ID)

      const walk = await walkerMoves(room, [OUTSIDE_THE_ZONE, ZONE_CENTER])

      expect(walk.executions).toHaveLength(1)
      expect(walk.executions[0]).toMatchObject({
        applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: dice })]
      })
      expect(await hitPointsOf(room, WOLF_ID)).toBe((hitPointsBefore ?? 0) - dice)
    }
  )

  it(`makes a creature in the area save at its ${turnTrigger === 'START_OF_TURN' ? 'turn start' : 'turn end'} and take the damage`, async () => {
    const room = await zoneRoom(subject, firstCast.label, ZONE_CENTER)
    const zone = await castAtTheCenter(room)
    const hitPointsBefore = await hitPointsOf(room, WOLF_ID)

    // The caster's turn ends outside the area; the Wolf's turn starts in it.
    const wolfStarts = await advanceTurn(room)
    expect(wolfStarts.outgoing).toBeUndefined()
    // The Wolf's turn ends in the area.
    const wolfEnds = await advanceTurn(room)
    const [acting, quiet] =
      turnTrigger === 'START_OF_TURN'
        ? [wolfStarts.incoming, wolfEnds.outgoing]
        : [wolfEnds.outgoing, wolfStarts.incoming]

    expect(quiet).toBeUndefined()
    expect(acting).toMatchObject({
      kind: 'EXECUTED',
      executions: [
        {
          candidate: { candidate: { effectId: zone.id, targetActorId: WOLF_ID } },
          applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: firstCast.dice })]
        }
      ]
    })
    expect(await hitPointsOf(room, WOLF_ID)).toBe((hitPointsBefore ?? 0) - firstCast.dice)
  })
})

describe('the SRD Stinking Cloud zone (SPELLS-20.T4b3b)', () => {
  it('costs a creature fully in the area its Action when it fails the save at its turn start', async () => {
    const room = await zoneRoom({ spell: stinkingCloud }, 'Stinking Cloud (3rd level)', ZONE_CENTER)
    const zone = await castAtTheCenter(room)
    expect(zone.placement).toMatchObject({
      label: stinkingCloud.label,
      triggerModes: [],
      turnTriggers: ['START_OF_TURN'],
      requiresFullyWithin: true,
      failedSaveLosesAction: true
    })
    const hitPointsBefore = await hitPointsOf(room, WOLF_ID)

    // The caster's turn ends outside the area; the Wolf's turn starts in it.
    const wolfStarts = await advanceTurn(room)

    expect(wolfStarts.incoming).toMatchObject({
      kind: 'EXECUTED',
      executions: [
        {
          candidate: { candidate: { effectId: zone.id, targetActorId: WOLF_ID } },
          applications: [],
          actionEconomy: { definitionId: ACTION, beforeUsed: 0, afterUsed: 1 }
        }
      ]
    })
    const wolf = vitalsOf(await readRoomHistory(room.room.base.stub)).find(
      ({ id }) => id === WOLF_ID
    )
    expect(wolf?.spent).toContainEqual([ACTION, 1])
    expect(await hitPointsOf(room, WOLF_ID)).toBe(hitPointsBefore)
  })
})
