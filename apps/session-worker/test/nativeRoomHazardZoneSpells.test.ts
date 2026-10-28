import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/effectActionContracts'
import { brownBear } from '@artificer-toolkit/source-data/srd/creatures/brown-bear.js'
import { chainLightning } from '@artificer-toolkit/source-data/srd/spells/chain-lightning.js'
import { cloudkill } from '@artificer-toolkit/source-data/srd/spells/cloudkill.js'
import { blackTentacles } from '@artificer-toolkit/source-data/srd/spells/black-tentacles.js'
import { grease } from '@artificer-toolkit/source-data/srd/spells/grease.js'
import { guardianOfFaith } from '@artificer-toolkit/source-data/srd/spells/guardian-of-faith.js'
import { incendiaryCloud } from '@artificer-toolkit/source-data/srd/spells/incendiary-cloud.js'
import { insectPlague } from '@artificer-toolkit/source-data/srd/spells/insect-plague.js'
import { moonbeam } from '@artificer-toolkit/source-data/srd/spells/moonbeam.js'
import { conditionTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { sleetStorm } from '@artificer-toolkit/source-data/srd/spells/sleet-storm.js'
import { spikeGrowth } from '@artificer-toolkit/source-data/srd/spells/spike-growth.js'
import { stinkingCloud } from '@artificer-toolkit/source-data/srd/spells/stinking-cloud.js'
import { web } from '@artificer-toolkit/source-data/srd/spells/web.js'
import { SRD_ACTION_ALLOWANCE_DEFINITION_ID as ACTION } from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { CreatureAuthored, SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { runInDurableObject } from 'cloudflare:test'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  endConcentrationAtSheet,
  hitPointsOf,
  readZones,
  walkerMoves
} from './placedZoneRoomReads.js'
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

/**
 * A 35-foot walk through the area that starts and ends outside it: the line runs 330 units off the
 * center, inside the 20-foot spheres' 400-unit reach, while the Wolf's 100-unit token at either end
 * stays clear of it.
 */
const SPHERE_CROSSING_Y = ZONE_CENTER.y + 330

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
    crossingY: SPHERE_CROSSING_Y,
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
    crossingY: SPHERE_CROSSING_Y,
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
    // The 5-foot beam: a walk through its center.
    crossingY: ZONE_CENTER.y,
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
    crossingY: SPHERE_CROSSING_Y,
    ability: 'DEXTERITY',
    turnTrigger: 'END_OF_TURN',
    casts: [{ label: 'Incendiary Cloud (8th level)', dice: 10 }]
  }
] as const

/**
 * The Character casts the action labelled `castLabel`; the Wolf, or `creature` in its place, stands
 * at `wolfAt`. `rolls` are the first dice draws (a face less one), before every die shows its lowest
 * face.
 */
function zoneRoom(
  { spell, slotSpell }: { spell: SpellAuthored; slotSpell?: SpellAuthored },
  castLabel: string,
  wolfAt: { x: number; y: number },
  rolls: readonly number[] = [],
  creature: CreatureAuthored = plainWolf
) {
  return actionRoom({
    actors: [casterActor, srdCreatureActor({ id: WOLF_ID, creature })],
    positions: { [WOLF_ID]: wolfAt },
    characterSpellcasting: {
      spells: slotSpell ? [spell, slotSpell] : [spell],
      prepared: [spell.id]
    },
    characterAction: (action) => action.label === castLabel,
    autoRoll: 'EVERYONE',
    rolls,
    fallbackRoll: DIE
  })
}

async function castAtTheCenter(room: Room, center = ZONE_CENTER) {
  const { answer } = await room.startAreaAction(center)
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
  const { spell, ability, turnTrigger, casts, crossingY } = subject
  const [firstCast] = casts
  it('is placed at the chosen point and acts on entry and at its turn boundary', async () => {
    const room = await zoneRoom(subject, firstCast.label, OUTSIDE_THE_ZONE)
    const zone = await castAtTheCenter(room)
    expect(zone.placement).toMatchObject({
      anchorKind: 'FIXED',
      label: spell.label,
      triggerModes: ['ENTER', 'CROSS'],
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

  it('deals the damage to a creature that passes through the area and ends its move outside (SPELLS-4.T1f)', async () => {
    const start = { x: 250, y: crossingY }
    const end = { x: 950, y: crossingY }
    const room = await zoneRoom(subject, firstCast.label, start)
    await castAtTheCenter(room)
    await room.advanceTurn()
    const hitPointsBefore = await hitPointsOf(room, WOLF_ID)

    const walk = await walkerMoves(room, [start, end])

    expect(walk.terminalPosition).toEqual(end)
    expect(walk.executions).toHaveLength(1)
    expect(walk.executions[0]).toMatchObject({
      applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: firstCast.dice })]
    })
    expect(await hitPointsOf(room, WOLF_ID)).toBe((hitPointsBefore ?? 0) - firstCast.dice)
  })

  it(`makes a creature in the area save at its ${turnTrigger === 'START_OF_TURN' ? 'turn start' : 'turn end'} and take the damage`, async () => {
    // A creature in the area as it appears also saves then (SPELLS-4.T1g): the Brown Bear has the
    // hit points to take both.
    const room = await zoneRoom(subject, firstCast.label, ZONE_CENTER, [], brownBear)
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

/**
 * SPELLS-4.T2r (D187a): the SRD Guardian of Faith, authored from core options, places a 15-foot
 * reach at the chosen point. A creature that moves into it makes a Dexterity save the first time on
 * a turn, taking 20 radiant damage on a failure or half on a success; the caster leaves allies
 * unaffected. The guardian sits 28 feet from the caster; the Brown Bear starts 22.5 feet from it,
 * its token clear of the 300-unit reach, and steps 12.5 feet in, to 10 feet from the guardian.
 */
describe('the SRD Guardian of Faith zone (SPELLS-4.T2r)', () => {
  const castLabel = 'Guardian of Faith (4th level)'
  const guardian = { x: 600, y: 500 }
  const outside = { x: 600, y: 950 }
  const inside = { x: 600, y: 700 }
  const room = (rolls?: readonly number[]) =>
    zoneRoom({ spell: guardianOfFaith }, castLabel, outside, rolls, brownBear)

  it('is placed at the chosen point and acts only on entry, once a turn, with a Dexterity save', async () => {
    const zone = await castAtTheCenter(await room(), guardian)
    expect(zone.placement).toMatchObject({
      anchorKind: 'FIXED',
      label: guardianOfFaith.label,
      triggerModes: ['ENTER', 'CROSS'],
      maxApplicationsPerTurn: 1
    })
    // It acts on entry only, never at a turn's start or end.
    expect(zone.placement).not.toHaveProperty('turnTriggers')
    expect(JSON.parse(zone.definitionJson)).toMatchObject({
      adapterFacts: {
        [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]:
          SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
        [DND5E_SAVE_DC_FACT_KEY]: WIZARD_SAVE_DC
      }
    })
  })

  it.each([
    { outcome: 'fails', rolls: [], damage: 20 },
    // The save shows a 20.
    { outcome: 'makes', rolls: [19], damage: 10 }
  ])(
    'deals $damage radiant to a creature that enters and $outcome its save, and nothing on a second entry that turn',
    async ({ rolls, damage }) => {
      // The cast rolls nothing, so the first draw is the entry save.
      const zoneRoomed = await room(rolls)
      await castAtTheCenter(zoneRoomed, guardian)
      await zoneRoomed.advanceTurn()
      const hitPointsBefore = await hitPointsOf(zoneRoomed, WOLF_ID)

      const enters = await walkerMoves(zoneRoomed, [outside, inside])
      const leaves = await walkerMoves(zoneRoomed, [inside, outside])
      const reenters = await walkerMoves(zoneRoomed, [outside, inside])

      expect(enters.executions).toHaveLength(1)
      expect(enters.executions[0]).toMatchObject({
        applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: damage })]
      })
      expect(leaves.executions).toEqual([])
      expect(reenters.executions).toEqual([])
      expect(await hitPointsOf(zoneRoomed, WOLF_ID)).toBe((hitPointsBefore ?? 0) - damage)
    }
  )

  it('never puts a creature the caster left unaffected through the save or its damage', async () => {
    const zoneRoomed = await room()
    const { answer } = await zoneRoomed.startAreaAction(guardian, [], 'GM', [WOLF_ID])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await zoneRoomed.advanceTurn()
    const hitPointsBefore = await hitPointsOf(zoneRoomed, WOLF_ID)

    const walk = await walkerMoves(zoneRoomed, [outside, inside])

    expect(walk.executions).toEqual([])
    expect(await hitPointsOf(zoneRoomed, WOLF_ID)).toBe(hitPointsBefore)
  })
})

const PRONE_ID = conditionTypeId('PRONE')

async function conditionsOf(room: Room, actorId: string) {
  return vitalsOf(await readRoomHistory(room.room.base.stub)).find(({ id }) => id === actorId)
    ?.conditions
}

/**
 * SPELLS-4.T1d: zones whose failed save applies a condition and deals no damage. Sleet Storm's
 * 40-foot-radius cylinder covers most of the map, so it is centered in a corner, away from the
 * caster, and the Wolf walks in from the far side.
 */
const CONDITION_ZONES = [
  {
    spell: grease,
    castLabel: 'Grease (1st level)',
    turnTrigger: 'END_OF_TURN',
    perTurnLimit: undefined,
    center: ZONE_CENTER,
    outside: OUTSIDE_THE_ZONE,
    inside: ZONE_CENTER,
    // The save a creature in the area makes as it appears (SPELLS-4.T1g) shows a 20.
    appearRolls: [19]
  },
  {
    spell: sleetStorm,
    castLabel: 'Sleet Storm (3rd level)',
    turnTrigger: 'START_OF_TURN',
    perTurnLimit: 1,
    center: { x: 950, y: 950 },
    outside: { x: 100, y: 950 },
    inside: { x: 450, y: 950 },
    appearRolls: []
  }
] as const

describe.each(CONDITION_ZONES)('the SRD $spell.label zone (SPELLS-4.T1d)', (subject) => {
  const { spell, castLabel, turnTrigger, perTurnLimit, center, outside, inside, appearRolls } =
    subject
  const room = (wolfAt: { x: number; y: number }, rolls?: readonly number[]) =>
    zoneRoom({ spell }, castLabel, wolfAt, rolls)

  it('is placed at the chosen point with a Dexterity save at the caster’s DC', async () => {
    const zone = await castAtTheCenter(await room(outside), center)
    expect(zone.placement).toMatchObject({
      anchorKind: 'FIXED',
      label: spell.label,
      triggerModes: ['ENTER', 'CROSS'],
      turnTriggers: [turnTrigger]
    })
    expect(zone.placement.maxApplicationsPerTurn).toBe(perTurnLimit)
    expect(JSON.parse(zone.definitionJson)).toMatchObject({
      adapterFacts: {
        [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]:
          SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
        [DND5E_SAVE_DC_FACT_KEY]: WIZARD_SAVE_DC
      }
    })
  })

  it('knocks prone a creature that enters the area and fails its save, dealing no damage', async () => {
    const zoneRoomed = await room(outside)
    await castAtTheCenter(zoneRoomed, center)
    await zoneRoomed.advanceTurn()
    const hitPointsBefore = await hitPointsOf(zoneRoomed, WOLF_ID)

    const walk = await walkerMoves(zoneRoomed, [outside, inside])

    expect(walk.executions).toHaveLength(1)
    expect(walk.executions[0]).toMatchObject({
      applications: [{ kind: 'CONDITION_APPLY', conditionId: PRONE_ID, applied: true }]
    })
    expect(await conditionsOf(zoneRoomed, WOLF_ID)).toEqual([{ conditionTypeId: PRONE_ID }])
    expect(await hitPointsOf(zoneRoomed, WOLF_ID)).toBe(hitPointsBefore)
  })

  it(`knocks prone a creature in the area at its ${turnTrigger === 'START_OF_TURN' ? 'turn start' : 'turn end'}`, async () => {
    const zoneRoomed = await room(inside, appearRolls)
    const zone = await castAtTheCenter(zoneRoomed, center)
    expect(await conditionsOf(zoneRoomed, WOLF_ID)).toEqual([])

    const wolfStarts = await advanceTurn(zoneRoomed)
    expect(wolfStarts.outgoing).toBeUndefined()
    const wolfEnds = await advanceTurn(zoneRoomed)
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
          applications: [{ kind: 'CONDITION_APPLY', conditionId: PRONE_ID, applied: true }]
        }
      ]
    })
    expect(await conditionsOf(zoneRoomed, WOLF_ID)).toEqual([{ conditionTypeId: PRONE_ID }])
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

const RESTRAINED_ID = conditionTypeId('RESTRAINED')

/** The Wolf's effects, through which its zone holds a condition (D146), with their definitions. */
async function heldEffectsOf(room: Room) {
  return (await readRoomHistory(room.room.base.stub)).activeEffects
    .filter(({ targetActorId }) => targetActorId === WOLF_ID)
    .map(({ id, definitionJson }) => ({ id, definition: JSON.parse(definitionJson) }))
}

/** The Wolf, in its turn, tries to escape the effect `activeEffectId` with the check named. */
async function escapeWith(room: Room, activeEffectId: string, checkDefinitionId: string) {
  return room.send({
    type: 'ESCAPE',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId: WOLF_ID,
    activeEffectId,
    checkDefinitionId,
    acknowledgedWarnings: []
  })
}

/**
 * SPELLS-4.T1e: zones that hold the condition their failed save applies (D142, D146). The 20-foot
 * cube is centered on the map, clear of the caster's token and the Wolf's starting point. Each
 * offers an escape at the caster's save DC; Black Tentacles also deals its damage.
 */
const HELD_ZONES = [
  {
    spell: web,
    castLabel: 'Web (2nd level)',
    damage: 0,
    escapeChecks: ['STRENGTH'],
    endsOnLeavingArea: true
  },
  {
    spell: blackTentacles,
    castLabel: 'Black Tentacles (4th level)',
    // 3d6, every die a 1.
    damage: 3,
    escapeChecks: ['STRENGTH', 'DEXTERITY'],
    endsOnLeavingArea: false
  }
] as const

describe.each(HELD_ZONES)('the SRD $spell.label zone (SPELLS-4.T1e)', (subject) => {
  const { spell, castLabel, damage, escapeChecks, endsOnLeavingArea } = subject
  const room = (wolfAt: { x: number; y: number }, rolls?: readonly number[]) =>
    zoneRoom({ spell }, castLabel, wolfAt, rolls)

  /** The Wolf, in its turn, walks into the zone and fails its save. */
  async function restrainedWolf(rolls?: readonly number[]) {
    const zoneRoomed = await room(OUTSIDE_THE_ZONE, rolls)
    const zone = await castAtTheCenter(zoneRoomed)
    await zoneRoomed.advanceTurn()
    const hitPointsBefore = await hitPointsOf(zoneRoomed, WOLF_ID)
    const walk = await walkerMoves(zoneRoomed, [OUTSIDE_THE_ZONE, ZONE_CENTER])
    return { zoneRoomed, zone, hitPointsBefore, walk }
  }

  it('restrains and stops a creature that enters the area and fails its save, held by the zone', async () => {
    const { zoneRoomed, zone, hitPointsBefore, walk } = await restrainedWolf()

    // A zone that releases on leaving reacts to the exit as well.
    expect(zone.placement.triggerModes).toEqual(
      endsOnLeavingArea ? ['ENTER', 'EXIT', 'CROSS'] : ['ENTER', 'CROSS']
    )
    expect(zone.placement.heldCondition).toEqual({
      conditionId: RESTRAINED_ID,
      ...(endsOnLeavingArea ? { endsOnLeavingArea: true } : {}),
      escape: {
        activation: { code: 'ACTION', amount: 1 },
        checks: {
          skillIds: [],
          abilityDefinitionIds: escapeChecks.map((code) => SRD_ABILITY_DEFINITION_IDS[code]).sort()
        },
        dc: WIZARD_SAVE_DC
      }
    })
    expect(walk.executions).toHaveLength(1)
    expect(walk.executions[0]?.execution.movementInterruption).not.toBeNull()
    expect(walk.terminalPosition).not.toEqual(ZONE_CENTER)
    expect(await conditionsOf(zoneRoomed, WOLF_ID)).toEqual([{ conditionTypeId: RESTRAINED_ID }])
    expect(await hitPointsOf(zoneRoomed, WOLF_ID)).toBe((hitPointsBefore ?? 0) - damage)
    const [held, ...others] = await heldEffectsOf(zoneRoomed)
    expect(others).toEqual([])
    expect(held?.definition).toMatchObject({
      recurrence: { endOnEvents: endsOnLeavingArea ? ['ON_LEAVING_AREA'] : [] },
      stateContributions: [
        {
          kind: 'CONDITION_OWNERSHIP',
          conditionId: RESTRAINED_ID,
          baselinePresent: false,
          heldBySpatialEffectId: zone.id
        },
        { kind: 'CONDITION_ESCAPE', label: spell.label, dc: WIZARD_SAVE_DC }
      ]
    })
  })

  it(
    endsOnLeavingArea
      ? 'releases a creature that leaves the area, in a settled move'
      : 'keeps a creature that leaves the area restrained',
    async () => {
      const { zoneRoomed, walk } = await restrainedWolf()
      const versionBefore = await zoneRoomed.version()

      const leave = await walkerMoves(zoneRoomed, [walk.terminalPosition, OUTSIDE_THE_ZONE])

      expect(leave.terminalPosition).toEqual(OUTSIDE_THE_ZONE)
      expect(leave.executions).toEqual([])
      if (endsOnLeavingArea) {
        expect(leave.status).toBe('MOVEMENT_COMPLETE')
        expect(await zoneRoomed.version()).toBe(versionBefore + 1)
        expect(await heldEffectsOf(zoneRoomed)).toEqual([])
        expect(await conditionsOf(zoneRoomed, WOLF_ID)).toEqual([])
      } else {
        expect(leave.status).toBeNull()
        expect(await zoneRoomed.version()).toBe(versionBefore)
        expect(await heldEffectsOf(zoneRoomed)).toHaveLength(1)
        expect(await conditionsOf(zoneRoomed, WOLF_ID)).toEqual([
          { conditionTypeId: RESTRAINED_ID }
        ])
      }
    }
  )

  it('releases the creature when the caster’s Concentration on the zone ends', async () => {
    const { zoneRoomed } = await restrainedWolf()

    const answer = await endConcentrationAtSheet(zoneRoomed, CASTER_ID)

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await readZones(zoneRoomed)).toEqual([])
    expect(await heldEffectsOf(zoneRoomed)).toEqual([])
    expect(await conditionsOf(zoneRoomed, WOLF_ID)).toEqual([])
  })

  it('frees a creature whose escape check reaches the caster’s save DC', async () => {
    // The save fails on a 1, each damage die shows a 1, and the escape check shows a 20.
    const { zoneRoomed } = await restrainedWolf([0, ...Array<number>(damage).fill(0), 19])
    const [held] = await heldEffectsOf(zoneRoomed)
    if (!held) throw new Error('The zone holds no condition.')

    const answer = await escapeWith(zoneRoomed, held.id, SRD_ABILITY_DEFINITION_IDS.STRENGTH)

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await heldEffectsOf(zoneRoomed)).toEqual([])
    expect(await conditionsOf(zoneRoomed, WOLF_ID)).toEqual([])
    expect(await readZones(zoneRoomed)).toHaveLength(1)
  })

  it('keeps a creature whose escape check falls short restrained', async () => {
    const { zoneRoomed } = await restrainedWolf()
    const [held] = await heldEffectsOf(zoneRoomed)
    if (!held) throw new Error('The zone holds no condition.')

    const answer = await escapeWith(zoneRoomed, held.id, SRD_ABILITY_DEFINITION_IDS.STRENGTH)

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await heldEffectsOf(zoneRoomed)).map(({ id }) => id)).toEqual([held.id])
    expect(await conditionsOf(zoneRoomed, WOLF_ID)).toEqual([{ conditionTypeId: RESTRAINED_ID }])
  })

  it('restrains a creature that starts its turn in the area and fails its save', async () => {
    const zoneRoomed = await room(ZONE_CENTER)
    const zone = await castAtTheCenter(zoneRoomed)

    const wolfStarts = await advanceTurn(zoneRoomed)

    expect(wolfStarts.incoming).toMatchObject({
      kind: 'EXECUTED',
      executions: [{ candidate: { candidate: { effectId: zone.id, targetActorId: WOLF_ID } } }]
    })
    expect(await conditionsOf(zoneRoomed, WOLF_ID)).toEqual([{ conditionTypeId: RESTRAINED_ID }])
    expect(await heldEffectsOf(zoneRoomed)).toHaveLength(1)
  })
})

/**
 * SPELLS-4.T1h (D156): the SRD Spike Growth, authored from core options, deals its 2d4 piercing to
 * a creature for every 5 feet it moves within the area, each step its own damage, and doubles the
 * cost of moving there. A creature standing at the center walks 15 feet east, all inside the
 * 400-unit radius.
 */
describe('the SRD Spike Growth zone (SPELLS-4.T1h)', () => {
  const subject = { spell: spikeGrowth }
  const castLabel = 'Spike Growth (2nd level)'
  const fifteenFeetEast = { x: ZONE_CENTER.x + 300, y: ZONE_CENTER.y }

  async function wolfFeetMoved(room: Room) {
    const movements = await runInDurableObject(room.room.base.stub, async (_instance, context) =>
      new RoomEncounterStore(context.storage).documents('encounterTurnMovements')
    )
    return movements
      .filter(({ actorId }) => actorId === WOLF_ID)
      .reduce((total, { usedFeet }) => total + usedFeet, 0)
  }

  it('is placed at the chosen point as a doubled-cost zone acting per 5 feet moved', async () => {
    const room = await zoneRoom(subject, castLabel, OUTSIDE_THE_ZONE)
    const zone = await castAtTheCenter(room)

    expect(zone.placement).toMatchObject({
      anchorKind: 'FIXED',
      label: 'Spike Growth',
      triggerModes: ['ENTER', 'CROSS'],
      movementKinds: ['VOLUNTARY', 'FORCED'],
      movementCostMultiplier: 2,
      distanceStep: 5
    })
    expect(zone.placement).not.toHaveProperty('maxApplicationsPerTurn')
  })

  it('deals 2d4 for each 5 feet walked within the area and charges double the movement', async () => {
    const room = await zoneRoom(subject, castLabel, ZONE_CENTER)
    await castAtTheCenter(room)
    await room.advanceTurn()
    const hitPointsBefore = await hitPointsOf(room, WOLF_ID)

    const walk = await walkerMoves(room, [ZONE_CENTER, fifteenFeetEast])

    expect(walk.terminalPosition).toEqual(fifteenFeetEast)
    expect(walk.executions).toHaveLength(3)
    for (const execution of walk.executions)
      expect(execution).toMatchObject({
        applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: 2 })]
      })
    expect(await hitPointsOf(room, WOLF_ID)).toBe((hitPointsBefore ?? 0) - 6)
    expect(await wolfFeetMoved(room)).toBe(30)
  })

  it('stops a creature its step drops to 0 Hit Points where that step completes', async () => {
    // Each of the first two steps rolls two 4s: 16 damage, past the Wolf's hit points.
    const room = await zoneRoom(subject, castLabel, ZONE_CENTER, [3, 3, 3, 3])
    await castAtTheCenter(room)
    await room.advanceTurn()

    const walk = await walkerMoves(room, [ZONE_CENTER, fifteenFeetEast])

    expect(walk.terminalPosition).toEqual({ x: ZONE_CENTER.x + 200, y: ZONE_CENTER.y })
    expect(walk.executions).toHaveLength(2)
    expect(await hitPointsOf(room, WOLF_ID)).toBe(0)
  })
})
