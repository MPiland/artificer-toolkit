import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { cleric } from '@artificer-toolkit/source-data/srd/classes/cleric.js'
import { lifeDomainCleric } from '@artificer-toolkit/source-data/srd/classes/life-domain.js'
import { zombie } from '@artificer-toolkit/source-data/srd/creatures/zombie.js'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorHitPoints, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-31.T4f2c: Preserve Life is a pool heal the caster divides among the creatures they choose.
 * The pool is five points per cleric level, no creature is restored past half its maximum, and an
 * undead is not a valid target; the Channel Divinity use is spent once and one undo restores all.
 */

const ACTOR_ID = testUuid(0x9f0)
const CHARACTER_ID = testUuid(0x9f1)
const WOLF_IDS = [testUuid(0x9f2), testUuid(0x9f3), testUuid(0x9f4)] as const
const ZOMBIE_ID = testUuid(0x9f5)
const WOLF_HIT_POINTS = 1
const OTHER_RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

afterEach(closeTrackedSockets)

/** A 2nd-level Life cleric (a pool of 10; half a Wolf's maximum leaves room for 4) beside wounded Wolves and a Zombie. */
const room = () => {
  const channelDivinity = cleric.features?.find(({ label }) => label === 'Channel Divinity')
  const preserveLife = lifeDomainCleric.features?.find(
    ({ label }) => label === 'Channel Divinity: Preserve Life'
  )
  if (!channelDivinity || !preserveLife) throw new Error('The SRD authors Preserve Life.')
  return actionRoom({
    actors: [
      characterActor({ id: ACTOR_ID, characterId: CHARACTER_ID }),
      ...WOLF_IDS.map((id) =>
        srdCreatureActor({ id, creature: plainWolf, currentHitPoints: WOLF_HIT_POINTS })
      ),
      srdCreatureActor({ id: ZOMBIE_ID, creature: zombie, currentHitPoints: 1 })
    ],
    characterClassFeatures: [channelDivinity, preserveLife],
    characterPlay: { characterClass: cleric, classLevel: 2 },
    characterAction: (action) => action.label.includes('Preserve Life')
  })
}

type Room = Awaited<ReturnType<typeof room>>

const channelDivinityUsed = (fixture: Room) =>
  runInDurableObject(fixture.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row).resourceUsage.reduce((total, { used }) => total + used, 0)
  })

const hitPoints = async (fixture: Room, actorId: string) =>
  readActorHitPoints(await readRoomHistory(fixture.room.base.stub), actorId)

const preserve = async (
  fixture: Room,
  healShares: { actorId: string; amount: number }[] | undefined,
  actorIds: readonly string[] = healShares?.map(({ actorId }) => actorId) ?? []
) =>
  fixture.send({
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: OTHER_RANGE,
    encounterId: fixture.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await fixture.version(),
    actorId: ACTOR_ID,
    target: {
      kind: 'ACTORS',
      actorIds: [...actorIds],
      scene: null,
      ...(healShares ? { healShares } : {})
    },
    actionId: fixture.actionId,
    optionalCombatIntent: null,
    sceneContext: null
  })

describe('room Preserve Life (SPELLS-31.T4f2c)', () => {
  it('offers the pool and the half-maximum ceiling to divide', async () => {
    const fixture = await room()
    const choice = (await fixture.actionChoices()).actions.find(({ id }) => id === fixture.actionId)
    expect(choice?.dividedHeal).toEqual({ total: 10, ceiling: { numerator: 1, denominator: 2 } })
  }, 120000)

  it('heals each chosen creature by the caster’s share, spends the use once, and one undo restores all', async () => {
    const fixture = await room()
    const answer = await preserve(fixture, [
      { actorId: WOLF_IDS[0], amount: 4 },
      { actorId: WOLF_IDS[1], amount: 3 }
    ])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await hitPoints(fixture, WOLF_IDS[0])).toBe(WOLF_HIT_POINTS + 4)
    expect(await hitPoints(fixture, WOLF_IDS[1])).toBe(WOLF_HIT_POINTS + 3)
    expect(await hitPoints(fixture, WOLF_IDS[2])).toBe(WOLF_HIT_POINTS)
    expect(await channelDivinityUsed(fixture)).toBe(1)

    const undone = await fixture.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: fixture.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await fixture.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    for (const id of WOLF_IDS) expect(await hitPoints(fixture, id)).toBe(WOLF_HIT_POINTS)
    expect(await channelDivinityUsed(fixture)).toBe(0)
  }, 120000)

  it.each([
    ['a share past half the creature’s maximum', [{ actorId: WOLF_IDS[0], amount: 5 }]],
    ['shares that sum past the pool', WOLF_IDS.map((actorId) => ({ actorId, amount: 4 }))],
    [
      'a chosen creature with no share',
      [{ actorId: WOLF_IDS[0], amount: 2 }],
      WOLF_IDS.slice(0, 2)
    ],
    ['no shares at all', undefined, WOLF_IDS.slice(0, 1)]
  ] as const)(
    'refuses %s and changes nothing',
    async (_name, shares, actorIds) => {
      const fixture = await room()
      const refused = await preserve(fixture, shares ? [...shares] : undefined, actorIds)
      expect(refused.type, JSON.stringify(refused)).not.toBe('COMMAND_COMMITTED')
      for (const id of WOLF_IDS) expect(await hitPoints(fixture, id)).toBe(WOLF_HIT_POINTS)
      expect(await channelDivinityUsed(fixture)).toBe(0)
    },
    120000
  )

  it('refuses an undead target', async () => {
    const fixture = await room()
    const refused = await preserve(fixture, [{ actorId: ZOMBIE_ID, amount: 1 }])
    expect(refused.type, JSON.stringify(refused)).not.toBe('COMMAND_COMMITTED')
    expect(await hitPoints(fixture, ZOMBIE_ID)).toBe(1)
    expect(await channelDivinityUsed(fixture)).toBe(0)
  }, 120000)
})
