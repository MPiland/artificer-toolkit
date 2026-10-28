import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  OPTIONAL_POOL_STRIKE_CHARGE_ID,
  optionalPoolStrike,
  optionalSmite
} from '@artificer-toolkit/rules-runtime/testing/optionalSmite'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { paladin } from '@artificer-toolkit/source-data/srd/classes/paladin.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { SRD_DAMAGE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * ATTACK-9.4: a weapon hit holds for its attacker's choice to pay a spell slot for an authored optional
 * on-hit rider (Divine Smite's shape). The slot is spent with the outcome, a critical hit doubles the
 * rider's dice, and GM undo returns the slot.
 */

const FIGHTER_ACTOR_ID = testUuid(0xb10)
const FIGHTER_ID = testUuid(0xb11)
const WOLF_ID = testUuid(0xb12)

const RADIANT_ID = SRD_DAMAGE_TYPES.find(({ code }) => code === 'RADIANT')!.id
/** Zero-based d20 faces: a hit that is not a critical, and a natural 20. */
const HIT_FACE = 18
const CRITICAL_FACE = 19
/** Every die after the attack d20 shows 1. */
const LOWEST_FACE = 0
const SECOND_LEVEL = 2

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The SRD Ghoul, an undead, as the corpus seeds it (damage defenses resolved to the System's types). */
const srdGhoul = (() => {
  const record = srdBaselineContent.subjects.creatures.find(({ label }) => label === 'Ghoul')
  if (!record) throw new Error('The SRD Ghoul is missing.')
  return record
})()

/** The SRD Paladin's Divine Smite, reached at the 1st-level Fighter this room's Character is. */
const srdDivineSmite = (() => {
  const feature = paladin.features?.find(({ label }) => label === 'Divine Smite')
  if (!feature) throw new Error('The SRD Divine Smite is missing.')
  return { ...feature, availableAtLevel: 1 }
})()

/** A Fighter wielding a Club who carries an optional smite and can cast from two levels of slots. */
function smiterRoom(
  d20Face: number,
  smite: { feature: FeatureAuthored; target: CreatureAuthored } = {
    feature: optionalSmite(),
    target: plainWolf
  }
) {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: [d20Face],
    fallbackRoll: LOWEST_FACE,
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: smite.target })
    ],
    characterPlay: { equipped: true },
    characterClassFeatures: [smite.feature],
    characterSpellcasting: { spells: [shield], prepared: [shield.id] },
    characterAction: (action) => action.label.includes('Club')
  })
}
type Room = Awaited<ReturnType<typeof smiterRoom>>

/** Starts the Club attack; the room pauses at the hit for the attacker's on-hit choice. */
async function strikeToTheOffer(room: Room) {
  // No Scene is bound to measure the Club's reach (D11).
  const { answer } = await room.startAction(WOLF_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'ON_HIT_CHOICE')
    throw new Error(`Expected the on-hit choice, got ${decision.pending.kind}.`)
  return { decision, pending: decision.pending }
}

/** The Character's spent spell slots as the Sheet's play state records them. */
const readSpellSlots = (room: Room) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === FIGHTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row).spellSlots ?? []
  })

/** The settled Club attack on the Wolf. */
async function settledAttack(room: Room) {
  const { receipts } = await readRoomHistory(room.room.base.stub)
  const receipt = receipts.filter(({ commandType }) => commandType === 'RESOLVE_ACTION').at(-1)
  if (!receipt) throw new Error('The attack left no receipt.')
  const settled = parseReceiptExecution(receipt)
  if (
    settled.status !== 'COMPLETE' ||
    settled.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
  )
    throw new Error('Expected a settled Club attack on the Wolf.')
  return settled.applicationOutputs
}

const damageOfType = (batch: Awaited<ReturnType<typeof settledAttack>>, damageTypeId: string) =>
  batch.applications.flatMap((application) =>
    application.kind === 'DAMAGE' && application.damageTypeId === damageTypeId
      ? [application.requestedAmount]
      : []
  )

describe('room optional on-hit rider paid with a spell slot (ATTACK-9.4)', () => {
  it('holds the hit for the attacker’s choice, applying and spending nothing', async () => {
    const room = await smiterRoom(HIT_FACE)
    const { pending } = await strikeToTheOffer(room)

    expect(pending.attackerActorId).toBe(FIGHTER_ACTOR_ID)
    expect(pending.allowedResponses).toEqual(['DECLINE', 'OPTION'])
    // One option for each slot level the room's Character holds.
    expect(
      pending.options.map((option) => [
        option.kind,
        option.kind === 'SPELL_SLOT' ? option.slotLevel : null
      ])
    ).toEqual([1, SECOND_LEVEL, 3, 4, 5].map((level) => ['SPELL_SLOT', level]))
    const history = await readRoomHistory(room.room.base.stub)
    expect(history.receipts.filter(({ commandType }) => commandType === 'RESOLVE_ACTION')).toEqual(
      []
    )
    expect(await readSpellSlots(room)).toEqual([])
  })

  it('adds 3d8 radiant for a 2nd-level slot, spends the slot, and undoes with the hit', async () => {
    const room = await smiterRoom(HIT_FACE)
    const before = await readRoomHistory(room.room.base.stub)
    const { decision, pending } = await strikeToTheOffer(room)
    const option = pending.options.find(
      (option) => option.kind === 'SPELL_SLOT' && option.slotLevel === SECOND_LEVEL
    )!

    const used = await room.resolve(decision, { kind: 'OPTION', optionId: option.optionId })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()

    const batch = await settledAttack(room)
    expect(damageOfType(batch, RADIANT_ID)).toEqual([3])
    expect(batch.spellCastConsumption).toMatchObject({
      owner: { kind: 'CHARACTER', characterId: FIGHTER_ID },
      spellId: null,
      candidateId: null,
      slotKey: 'STANDARD:2',
      beforeUsed: 0,
      afterUsed: 1
    })
    // The attack d20 and the Club's d4, then the three d8.
    expect(room.room.diceDrawn()).toBe(1 + 1 + 3)
    expect(await readSpellSlots(room)).toEqual([{ slotKey: 'STANDARD:2', used: 1 }])

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await readSpellSlots(room)).toEqual([])
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  })

  it('doubles the rider’s dice on a critical hit', async () => {
    const room = await smiterRoom(CRITICAL_FACE)
    const { decision, pending } = await strikeToTheOffer(room)
    const option = pending.options.find(
      (option) => option.kind === 'SPELL_SLOT' && option.slotLevel === SECOND_LEVEL
    )!

    const used = await room.resolve(decision, { kind: 'OPTION', optionId: option.optionId })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')

    const batch = await settledAttack(room)
    expect(batch.d20).toMatchObject({ selectedNatural: 20, resultPath: 'ON_CRIT' })
    expect(damageOfType(batch, RADIANT_ID)).toEqual([6])
  })

  it('adds nothing and spends nothing when declined', async () => {
    const room = await smiterRoom(HIT_FACE)
    const { decision } = await strikeToTheOffer(room)

    const declined = await room.resolve(decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')

    const batch = await settledAttack(room)
    expect(damageOfType(batch, RADIANT_ID)).toEqual([])
    expect(batch.spellCastConsumption).toBeNull()
    expect(await readSpellSlots(room)).toEqual([])
  })

  it('adds the SRD Divine Smite’s extra d8 against an undead, doubled on a critical hit', async () => {
    const room = await smiterRoom(CRITICAL_FACE, { feature: srdDivineSmite, target: srdGhoul })
    const { decision, pending } = await strikeToTheOffer(room)
    const option = pending.options.find(
      (option) => option.kind === 'SPELL_SLOT' && option.slotLevel === SECOND_LEVEL
    )!

    const used = await room.resolve(decision, { kind: 'OPTION', optionId: option.optionId })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')

    // 3d8 for the 2nd-level slot and 1d8 against the undead, every die doubled by the critical hit.
    const radiantDamage = damageOfType(await settledAttack(room), RADIANT_ID)
    expect(radiantDamage.reduce((total, amount) => total + amount, 0)).toBe(2 * (3 + 1))
  })
})

const FORCE_ID = SRD_DAMAGE_TYPES.find(({ code }) => code === 'FORCE')!.id

/** The Character's recorded uses of the pool the homebrew strike spends. */
const readPoolUsed = (room: Room) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === FIGHTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return (readCharacterPlay(row).resourceUsage ?? [])
      .filter(
        ({ owner }) =>
          owner.kind === 'AUTHORED_SOURCE' && owner.chargeId === OPTIONAL_POOL_STRIKE_CHARGE_ID
      )
      .map(({ used }) => used)
  })

/** The room's Character carries a homebrew strike that spends 2 of its pool of `maximum` charges. */
const strikerRoom = (maximum: number) =>
  smiterRoom(HIT_FACE, {
    feature: optionalPoolStrike({ maximum, cost: 2, diceConfig: '2d6', damageTypeCode: 'FORCE' }),
    target: plainWolf
  })

describe('room optional on-hit rider paid from a resource pool (SPELLS-31.T5r-a)', () => {
  it('offers the pool, spends its charges with the outcome and returns them on undo', async () => {
    const room = await strikerRoom(3)
    const before = await readRoomHistory(room.room.base.stub)
    const { decision, pending } = await strikeToTheOffer(room)

    expect(pending.options).toMatchObject([{ kind: 'RESOURCE_POOL', cost: 2 }])
    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0]!.optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')

    const batch = await settledAttack(room)
    expect(damageOfType(batch, FORCE_ID)).toEqual([2])
    expect(batch.spellCastConsumption).toBeNull()
    expect(await readPoolUsed(room)).toEqual([2])

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await readPoolUsed(room)).toEqual([0])
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  })

  it('spends nothing when declined', async () => {
    const room = await strikerRoom(3)
    const { decision } = await strikeToTheOffer(room)

    const declined = await room.resolve(decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    expect(damageOfType(await settledAttack(room), FORCE_ID)).toEqual([])
    expect(await readPoolUsed(room)).toEqual([])
  })

  it('offers no choice when the pool cannot cover the cost', async () => {
    const room = await strikerRoom(1)
    const { answer } = await room.startAction(WOLF_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(damageOfType(await settledAttack(room), FORCE_ID)).toEqual([])
  })
})
