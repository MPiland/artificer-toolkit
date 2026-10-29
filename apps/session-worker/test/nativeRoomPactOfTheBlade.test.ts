import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { warlock } from '@artificer-toolkit/source-data/srd/classes/warlock.js'
import { longsword } from '@artificer-toolkit/source-data/srd/equipment/longsword.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { seededSrdCreature } from './seededSrdCreature.js'
import {
  readActorHitPoints,
  readPendingActionContext,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * SPELLS-31.T4v (D156): Pact of the Blade binds a held melee weapon, which makes its Warlock
 * proficient with it and its attacks magical; Lifedrinker adds necrotic damage only to the hits of
 * a weapon that pact binds (BOUND_BY_EFFECT). The target is a Gargoyle, which resists the weapon
 * damage of nonmagical attacks.
 */

const CHARACTER_ACTOR_ID = testUuid(0xb50)
const CHARACTER_ID = testUuid(0xb51)
const GARGOYLE_ID = testUuid(0xb52)

/** No Scene measures the reach (D11). */
const RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Warlock option carried as a Feature of its own, gained at 1st level. */
function optionFeature(featureLabel: string, optionLabel: string, order: number): ClassFeature {
  const option = srdByLabel(
    srdByLabel(warlock.features ?? [], featureLabel).options ?? [],
    optionLabel
  )
  return {
    id: option.id,
    label: option.label,
    description: option.description,
    availableAtLevel: 1,
    order,
    effects: option.effects
  }
}

const PACT_OF_THE_BLADE = optionFeature('Pact Boon', 'Pact of the Blade', 90)
const LIFEDRINKER = optionFeature('Eldritch Invocations', 'Lifedrinker', 91)

/**
 * A 12th-level Warlock (first in the order) holding a Longsword, which its Class gives it no
 * proficiency with, then the Gargoyle. Strength 8 (-1) and Charisma 15 (+2) swap places in the
 * standard array. The Warlock's d20 and d8 show 19 and 8.
 */
function warlockRoom() {
  return actionRoom({
    rolls: [18, 7],
    fallbackRoll: 0,
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: GARGOYLE_ID, creature: seededSrdCreature('Gargoyle') })
    ],
    characterClassFeatures: [PACT_OF_THE_BLADE, LIFEDRINKER],
    characterEquipment: [longsword],
    characterPlay: {
      characterClass: warlock,
      classLevel: 12,
      equipped: true,
      abilityScores: { STRENGTH: 8, CHARISMA: 15 }
    },
    characterAction: (action) => action.label.startsWith('Pact of the Blade')
  })
}
type WarlockRoom = Awaited<ReturnType<typeof warlockRoom>>

/** Rolls and settles every roll the pending action asks for. */
async function settlePendingAction(room: WarlockRoom) {
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

/** Binds the held Longsword as the pact weapon, then passes the round back to the Warlock. */
async function bindLongsword(room: WarlockRoom) {
  const items = await room.actionItemChoices(CHARACTER_ACTOR_ID)
  const held = items.find(({ label }) => label === 'Longsword')
  if (!held) throw new Error(`The pact offers no Longsword: ${JSON.stringify(items)}`)
  const bound = await room.startAction(
    CHARACTER_ACTOR_ID,
    [],
    null,
    null,
    room.actionId,
    CHARACTER_ACTOR_ID,
    undefined,
    held.id
  )
  expect(bound.answer.type, JSON.stringify(bound.answer)).toBe('COMMAND_COMMITTED')
  // The pact took the Warlock's action, so the Longsword waits for the next round.
  await room.advanceTurn()
  await room.advanceTurn()
}

/** The Longsword attack at the Gargoyle: the d20 modifier it rolls and the hit points it deals. */
async function longswordAttack(room: WarlockRoom) {
  const { actions } = await room.actionChoices()
  const sword = actions.find(({ label }) => label.includes('Longsword'))
  if (!sword)
    throw new Error(`The Warlock offers no Longsword attack: ${actions.map(({ label }) => label)}`)
  const before = readActorHitPoints(await readRoomHistory(room.room.base.stub), GARGOYLE_ID)
  const attack = await room.startAction(GARGOYLE_ID, RANGE, null, null, sword.id)
  expect(attack.answer.type, JSON.stringify(attack.answer)).toBe('COMMAND_COMMITTED')
  const context = await readPendingActionContext(room.room.base.stub)
  if (context.kind !== 'ENCOUNTER_ACTION' || !context.d20Policy)
    throw new Error('Expected the pending attack d20.')
  const { modifier } = context.d20Policy
  await settlePendingAction(room)
  const after = readActorHitPoints(await readRoomHistory(room.room.base.stub), GARGOYLE_ID)
  return { modifier, damage: before - after }
}

describe('room Pact of the Blade and Lifedrinker (SPELLS-31.T4v)', () => {
  it('makes the bound Longsword proficient and magical, and only its hits drink life', async () => {
    const plain = await longswordAttack(await warlockRoom())

    const room = await warlockRoom()
    await bindLongsword(room)
    expect((await readRoomHistory(room.room.base.stub)).characterEffects).toHaveLength(1)
    const bound = await longswordAttack(room)

    // A 12th-level Warlock's proficiency bonus is +4.
    expect(bound.modifier).toBe(plain.modifier + 4)
    // The d8's 8 less 1 for Strength is 7 slashing, which the Gargoyle halves to 3 when nonmagical;
    // the unbound Longsword adds no necrotic damage.
    expect(plain.damage).toBe(3)
    // Bound, the full 7 slashing lands, and Lifedrinker adds the Charisma modifier (+2) as necrotic.
    expect(bound.damage).toBe(9)
  }, 120000)

  it('replaces the earlier binding when the pact is used again', async () => {
    const room = await warlockRoom()
    await bindLongsword(room)
    await bindLongsword(room)
    expect((await readRoomHistory(room.room.base.stub)).characterEffects).toHaveLength(1)
  }, 120000)
})
