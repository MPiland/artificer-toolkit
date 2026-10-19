import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { oathOfDevotion } from '@artificer-toolkit/source-data/srd/classes/oath-of-devotion.js'
import { paladin } from '@artificer-toolkit/source-data/srd/classes/paladin.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { seededSrdCreature } from './seededSrdCreature.js'
import {
  readActorHitPoints,
  readPendingActionContext,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * SPELLS-31.T4e (D156): a Paladin's Sacred Weapon, a core-option effect on a chosen weapon, in an
 * Encounter against a Gargoyle, which resists the weapon damage of nonmagical attacks.
 */

const CHARACTER_ACTOR_ID = testUuid(0xb40)
const CHARACTER_ID = testUuid(0xb41)
const GARGOYLE_ID = testUuid(0xb42)
const WOLF_ID = testUuid(0xb43)

/** No Scene measures the reach (D11). */
const RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const featureOf = (label: string) => {
  const feature = oathOfDevotion.features?.find((entry) => entry.label === label)
  if (!feature) throw new Error(`The Oath of Devotion has no "${label}" Feature.`)
  return feature
}

/**
 * A 3rd-level Paladin (first in the order) holding a Club, the Gargoyle, then a Wolf whose Bite
 * deals 5 damage. The Paladin's d20 and d4 show 19 and 4; the Wolf's d20 shows 19.
 */
async function paladinRoom(currentHitPoints?: number) {
  const wolf = biteWolf('ATTACK', { damage: 5 })
  const wolfActor = srdCreatureActor({ id: WOLF_ID, creature: wolf })
  const room = await actionRoom({
    rolls: [18, 3, 18],
    fallbackRoll: 0,
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: GARGOYLE_ID, creature: seededSrdCreature('Gargoyle') }),
      wolfActor
    ],
    characterClassFeatures: [featureOf('Channel Divinity: Sacred Weapon')],
    characterPlay: {
      // The Oath's Channel Divinity resource, on the class the Character levels in.
      characterClass: { ...paladin, resources: oathOfDevotion.resources },
      classLevel: 3,
      equipped: true,
      ...(currentHitPoints !== undefined ? { currentHitPoints } : {})
    },
    characterAction: (action) => action.label === 'Channel Divinity: Sacred Weapon'
  })
  return { room, biteActionId: room.featureActionId(wolfActor, creatureFeature(wolf, 'Bite').id) }
}
type PaladinRoom = Awaited<ReturnType<typeof paladinRoom>>['room']

/** Rolls and settles every roll the pending action asks for. */
async function settlePendingAction(room: PaladinRoom) {
  const { stub } = room.room.base
  for (
    let decision = await readPendingActionDecision(stub);
    decision;
    decision = await readPendingActionDecision(stub)
  ) {
    expect((await room.rollDice(decision)).type).toBe('COMMAND_COMMITTED')
    const held = (await readRoomHistory(stub)).evidenceRolls.at(-1)
    if (!held || !('request' in decision.pending)) throw new Error('The roll was not held.')
    const settled = await room.resolve(decision, {
      kind: 'SYSTEM_ROLL',
      requestId: decision.pending.request.requestId,
      rollId: held.id
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
  }
}

/** Starts Sacred Weapon on the held Club; the room's answer. */
async function startSacredWeapon(room: PaladinRoom) {
  const items = await room.actionItemChoices(CHARACTER_ACTOR_ID)
  expect(items.map(({ label }) => label)).toEqual(['Club'])
  return room.startAction(
    CHARACTER_ACTOR_ID,
    [],
    null,
    null,
    room.actionId,
    CHARACTER_ACTOR_ID,
    undefined,
    items[0]!.id
  )
}

async function imbueClub(room: PaladinRoom) {
  const cast = await startSacredWeapon(room)
  expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
}

/** The Paladin's Club attack at the Gargoyle: the d20 modifier it rolls and the hit points it deals. */
async function clubAttackOnGargoyle(room: PaladinRoom) {
  const club = (await room.actionChoices()).actions.find(({ label }) => label.includes('Club'))
  if (!club) throw new Error('The Paladin offers no Club attack.')
  const before = readActorHitPoints(await readRoomHistory(room.room.base.stub), GARGOYLE_ID)
  const attack = await room.startAction(GARGOYLE_ID, RANGE, null, null, club.id)
  expect(attack.answer.type, JSON.stringify(attack.answer)).toBe('COMMAND_COMMITTED')
  const context = await readPendingActionContext(room.room.base.stub)
  if (context.kind !== 'ENCOUNTER_ACTION' || !context.d20Policy)
    throw new Error('Expected the pending attack d20.')
  const { modifier } = context.d20Policy
  await settlePendingAction(room)
  const after = readActorHitPoints(await readRoomHistory(room.room.base.stub), GARGOYLE_ID)
  return { modifier, damage: before - after }
}

const characterEffects = async (room: PaladinRoom) =>
  (await readRoomHistory(room.room.base.stub)).characterEffects

describe('room Sacred Weapon (SPELLS-31.T4e)', () => {
  it('adds the Charisma bonus, at least +1, to the Club and makes its damage magical against a resistant Gargoyle', async () => {
    const plain = await clubAttackOnGargoyle((await paladinRoom()).room)

    const { room } = await paladinRoom()
    await imbueClub(room)
    expect(await characterEffects(room)).toHaveLength(1)
    // Sacred Weapon took the Paladin's action, so the Club waits for the next round.
    await room.advanceTurn()
    await room.advanceTurn()
    await room.advanceTurn()
    const imbued = await clubAttackOnGargoyle(room)

    // Charisma 8 is a -1 modifier, so the bonus is its minimum of +1.
    expect(imbued.modifier).toBe(plain.modifier + 1)
    // The Gargoyle halves nonmagical weapon damage; the imbued Club's damage is magical.
    expect(plain.damage).toBeGreaterThan(0)
    expect(imbued.damage).toBe(plain.damage * 2)
  }, 120000)

  it('ends when the Paladin falls unconscious', async () => {
    const { room, biteActionId } = await paladinRoom(1)
    await imbueClub(room)
    expect(await characterEffects(room)).toHaveLength(1)

    await room.advanceTurn()
    await room.advanceTurn()
    const bite = await room.startAction(CHARACTER_ACTOR_ID, [], null, null, biteActionId, WOLF_ID)
    expect(bite.answer.type, JSON.stringify(bite.answer)).toBe('COMMAND_COMMITTED')
    await settlePendingAction(room)

    expect(await characterEffects(room)).toEqual([])
  }, 120000)

  it('spends the Channel Divinity charge, so a second use warns that the resource is spent', async () => {
    const { room } = await paladinRoom()
    await imbueClub(room)
    await room.advanceTurn()
    await room.advanceTurn()
    await room.advanceTurn()

    const again = await startSacredWeapon(room)
    expect(again.answer.type).not.toBe('COMMAND_COMMITTED')
    expect(JSON.stringify(again.answer)).toContain('RESOURCE_UNAVAILABLE')
  }, 120000)
})
