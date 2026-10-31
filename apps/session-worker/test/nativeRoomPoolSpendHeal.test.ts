import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { paladin } from '@artificer-toolkit/source-data/srd/classes/paladin.js'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorHitPoints, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-31.T4f2a: Lay on Hands is an authored pool option with no feature-specific code. The
 * touching player chooses how many points to spend; the touched creature regains that many, the
 * pool pays them, and one undo restores both.
 */

const ACTOR_ID = testUuid(0x9e0)
const CHARACTER_ID = testUuid(0x9e1)
const WOLF_ID = testUuid(0x9e2)
const WOLF_HIT_POINTS = 2
const OTHER_RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

afterEach(closeTrackedSockets)

/** A 1st-level paladin (a pool of 5) beside a wounded Wolf. */
const room = () => {
  const layOnHands = paladin.features?.find(({ label }) => label === 'Lay on Hands')
  if (!layOnHands) throw new Error('The SRD authors Lay on Hands.')
  return actionRoom({
    actors: [
      characterActor({ id: ACTOR_ID, characterId: CHARACTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf, currentHitPoints: WOLF_HIT_POINTS })
    ],
    characterClassFeatures: [layOnHands],
    characterAction: (action) => action.label.startsWith('Lay on Hands')
  })
}

type Room = Awaited<ReturnType<typeof room>>

const poolUsed = (fixture: Room) =>
  runInDurableObject(fixture.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row).resourceUsage.reduce((total, { used }) => total + used, 0)
  })

const wolfHitPoints = async (fixture: Room) =>
  readActorHitPoints(await readRoomHistory(fixture.room.base.stub), WOLF_ID)

const touch = async (fixture: Room, spentUnits?: number) =>
  fixture.send({
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: OTHER_RANGE,
    encounterId: fixture.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await fixture.version(),
    actorId: ACTOR_ID,
    target: { kind: 'ACTOR', actorId: WOLF_ID },
    actionId: fixture.actionId,
    optionalCombatIntent: null,
    sceneContext: null,
    ...(spentUnits === undefined ? {} : { spentUnits })
  })

describe('room Lay on Hands (SPELLS-31.T4f2a)', () => {
  it('heals the touched creature by the points spent, pays the pool, and one undo restores both', async () => {
    const fixture = await room()
    const answer = await touch(fixture, 3)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await wolfHitPoints(fixture)).toBe(WOLF_HIT_POINTS + 3)
    expect(await poolUsed(fixture)).toBe(3)

    const undone = await fixture.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: fixture.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await fixture.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await wolfHitPoints(fixture)).toBe(WOLF_HIT_POINTS)
    expect(await poolUsed(fixture)).toBe(0)
  }, 120000)

  it('offers the pool as the amount to choose from and refuses more than it holds or no amount', async () => {
    const fixture = await room()
    const choice = (await fixture.actionChoices()).actions.find(({ id }) => id === fixture.actionId)
    expect(choice?.chosenSpend).toEqual({ unitCost: 1, max: 5 })

    for (const spentUnits of [6, undefined]) {
      const refused = await touch(fixture, spentUnits)
      expect(refused.type, JSON.stringify(refused)).not.toBe('COMMAND_COMMITTED')
    }
    expect(await wolfHitPoints(fixture)).toBe(WOLF_HIT_POINTS)
    expect(await poolUsed(fixture)).toBe(0)
  }, 120000)
})
