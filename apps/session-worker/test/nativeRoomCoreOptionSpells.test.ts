import { runInDurableObject } from 'cloudflare:test'
import { readStoredActorSnapshot } from '@artificer-toolkit/encounter-persistence/actorSnapshots'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { snapshotCreatureEquipmentLoadout } from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { MAX_ACTIVE_EFFECT_STORED_TICKS } from '@artificer-toolkit/schema/shared/activeRuleEffectLifecycle'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { chainMail } from '@artificer-toolkit/source-data/srd/equipment/chain-mail.js'
import { longsword } from '@artificer-toolkit/source-data/srd/equipment/longsword.js'
import { flameBlade } from '@artificer-toolkit/source-data/srd/spells/flame-blade.js'
import { guidingBolt } from '@artificer-toolkit/source-data/srd/spells/guiding-bolt.js'
import { heatMetal } from '@artificer-toolkit/source-data/srd/spells/heat-metal.js'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { mageArmor } from '@artificer-toolkit/source-data/srd/spells/mage-armor.js'
import { mindBlank } from '@artificer-toolkit/source-data/srd/spells/mind-blank.js'
import { passWithoutTrace } from '@artificer-toolkit/source-data/srd/spells/pass-without-trace.js'
import { produceFlame } from '@artificer-toolkit/source-data/srd/spells/produce-flame.js'
import { damageTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { shillelagh } from '@artificer-toolkit/source-data/srd/spells/shillelagh.js'
import { trueStrike } from '@artificer-toolkit/source-data/srd/spells/true-strike.js'
import { vampiricTouch } from '@artificer-toolkit/source-data/srd/spells/vampiric-touch.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { seededSrdCreature } from './seededSrdCreature.js'
import { endConcentrationAtSheet } from './placedZoneRoomReads.js'
import {
  parseReceiptExecution,
  readActorHitPoints,
  readPendingActionContext,
  readPendingApplicationContext,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * SPELLS-4.T2a3 (D156): spells converted from closed rules to core options hold their grant in an
 * Encounter, where it counts against the creatures that act on its holder.
 */

const CHARACTER_ACTOR_ID = testUuid(0xa30)
const CHARACTER_ID = testUuid(0xa31)
const WOLF_ID = testUuid(0xa32)
const FIRST_ALLY_ID = testUuid(0xa33)
const SECOND_ALLY_ID = testUuid(0xa34)

/** No Scene measures the touch range (D11). */
const RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The Character (first in the order) who prepares Mage Armor, then a Wolf whose Bite attacks. */
async function mageArmorRoom() {
  const wolf = biteWolf('ATTACK')
  const wolfActor = srdCreatureActor({ id: WOLF_ID, creature: wolf })
  const room = await actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      wolfActor
    ],
    characterSpellcasting: { spells: [mageArmor], prepared: [mageArmor.id] },
    characterAction: (action) => action.label.startsWith(mageArmor.label)
  })
  return { room, biteActionId: room.featureActionId(wolfActor, creatureFeature(wolf, 'Bite').id) }
}

/** On the Wolf's turn, the armor class its Bite at the Character must beat. */
async function biteArmorClass({ room, biteActionId }: Awaited<ReturnType<typeof mageArmorRoom>>) {
  await room.advanceTurn()
  const bite = await room.startAction(CHARACTER_ACTOR_ID, [], null, null, biteActionId, WOLF_ID)
  expect(bite.answer.type, JSON.stringify(bite.answer)).toBe('COMMAND_COMMITTED')
  const context = await readPendingActionContext(room.room.base.stub)
  if (context.kind !== 'ENCOUNTER_ACTION' || !context.d20Policy)
    throw new Error('Expected the pending attack d20.')
  return context.d20Policy.dc
}

describe('room Mage Armor (SPELLS-4.T2a3)', () => {
  it('sets the unarmored Character’s armor class to 13 + Dexterity against a Wolf’s Bite', async () => {
    // Unarmored, the Character's armor class is 10 + Dexterity; Mage Armor makes the base 13.
    const unarmored = await biteArmorClass(await mageArmorRoom())

    const fixture = await mageArmorRoom()
    const cast = await fixture.room.startAction(CHARACTER_ACTOR_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')

    expect(await biteArmorClass(fixture)).toBe(unarmored + 3)
  }, 120000)
})

type ActionRoom = Awaited<ReturnType<typeof actionRoom>>

/** Rolls and settles every roll the pending action asks for, in the mode the rules derived. */
async function settlePendingAction(room: ActionRoom) {
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

describe('room Guiding Bolt (SPELLS-4.T2a3)', () => {
  it('gives the next attack against its target advantage, and the attack after it none', async () => {
    const wolf = biteWolf('ATTACK')
    const allies = [FIRST_ALLY_ID, SECOND_ALLY_ID].map((id) =>
      srdCreatureActor({ id, creature: wolf, disposition: 'FRIENDLY' })
    )
    const room = await actionRoom({
      // Guiding Bolt's d20 shows 19 and hits; every later die shows its minimum, so the bites miss.
      rolls: [18],
      fallbackRoll: 0,
      actors: [
        {
          ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
          snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
        },
        ...allies,
        srdCreatureActor({ id: WOLF_ID, creature: wolf })
      ],
      characterSpellcasting: { spells: [guidingBolt], prepared: [guidingBolt.id] },
      characterAction: (action) => action.label.startsWith(guidingBolt.label)
    })
    const cast = await room.startAction(WOLF_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    await settlePendingAction(room)

    /** On the next ally's turn, the mode its Bite at the marked Wolf rolls in; the Bite then settles. */
    const biteRollMode = async (ally: (typeof allies)[number]) => {
      await room.advanceTurn()
      const bite = await room.startAction(
        WOLF_ID,
        [],
        null,
        null,
        room.featureActionId(ally, creatureFeature(wolf, 'Bite').id),
        ally.id
      )
      expect(bite.answer.type, JSON.stringify(bite.answer)).toBe('COMMAND_COMMITTED')
      const decision = await room.pendingDecision()
      if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the Bite d20.')
      const { rollMode } = decision.pending.request
      await settlePendingAction(room)
      return rollMode
    }
    // Both Bites come before the end of the caster's next turn; the first, a miss, uses the mark up.
    expect(await biteRollMode(allies[0]!)).toBe('ADVANTAGE')
    expect(await biteRollMode(allies[1]!)).toBe('NORMAL')
  }, 120000)
})

describe('room Pass without Trace (SPELLS-4.T2a3)', () => {
  it('adds 10 to the Stealth of each creature the caster chose, and not to an enemy left out', async () => {
    const wolf = biteWolf('ATTACK')
    const allies = [FIRST_ALLY_ID, SECOND_ALLY_ID].map((id) =>
      srdCreatureActor({ id, creature: wolf, disposition: 'FRIENDLY' })
    )
    const enemy = srdCreatureActor({ id: WOLF_ID, creature: wolf })
    const room = await actionRoom({
      actors: [
        {
          ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
          snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
        },
        ...allies,
        enemy
      ],
      characterSpellcasting: { spells: [passWithoutTrace], prepared: [passWithoutTrace.id] },
      characterAction: (action) => action.label.startsWith(passWithoutTrace.label)
    })
    // "Each creature you choose" names no cap; no Scene measures the 30 feet.
    const cast = await room.startActorsAction(
      [CHARACTER_ACTOR_ID, FIRST_ALLY_ID, SECOND_ALLY_ID],
      RANGE,
      false
    )
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    // The Creatures hold theirs in the Run; the Character holds its own on the Character.
    const { activeEffects, characterEffects } = await readRoomHistory(room.room.base.stub)
    expect(activeEffects.map(({ targetActorId }) => targetActorId).sort()).toEqual(
      [FIRST_ALLY_ID, SECOND_ALLY_ID].sort()
    )
    expect(characterEffects).toHaveLength(1)

    const hide = SRD_BASIC_ACTION_DEFINITIONS.find(({ id }) => id === SRD_BASIC_ACTION_IDS.HIDE)
    if (hide?.document.kind !== 'BASIC_ACTION') throw new Error('Missing the Hide basic action.')
    const hideEffectId = hide.document.effects[0]!.id
    /** On the next creature's turn, the Stealth modifier its Hide rolls with; the Hide then settles. */
    const nextHideStealth = async (actorId: string) => {
      await room.advanceTurn()
      const started = await room.startAction(
        actorId,
        [],
        null,
        null,
        encounterBasicActionId(actorId, SRD_BASIC_ACTION_IDS.HIDE, hideEffectId),
        actorId
      )
      expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
      const context = await readPendingApplicationContext(room.room.base.stub)
      if (context.kind !== 'ENCOUNTER_CONCEALMENT_CHECK')
        throw new Error('Expected the Hide check.')
      await settlePendingAction(room)
      return context.d20.modifier
    }
    const [first, second] = [
      await nextHideStealth(FIRST_ALLY_ID),
      await nextHideStealth(SECOND_ALLY_ID)
    ]
    const unchosen = await nextHideStealth(WOLF_ID)
    expect([first, second]).toEqual([unchosen + 10, unchosen + 10])
  }, 120000)
})

describe('room Mind Blank (SPELLS-4.T2a3)', () => {
  /**
   * The Character (first in the order), a friendly Wolf and a hostile Wolf whose Bite deals 3
   * psychic damage on a failed Dexterity save; every die shows its minimum, so each save fails.
   */
  async function mindBlankRoom() {
    const ally = srdCreatureActor({
      id: FIRST_ALLY_ID,
      creature: biteWolf('ATTACK'),
      disposition: 'FRIENDLY'
    })
    const psychicWolf = biteWolf('SAVE', {
      damage: 3,
      save: { ability: 'DEXTERITY', damageTypeCode: 'PSYCHIC' }
    })
    const enemy = srdCreatureActor({ id: WOLF_ID, creature: psychicWolf })
    const room = await actionRoom({
      fallbackRoll: 0,
      actors: [
        {
          ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
          snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
        },
        ally,
        enemy
      ],
      characterSpellcasting: { spells: [mindBlank], prepared: [mindBlank.id] },
      characterAction: (action) => action.label.startsWith(mindBlank.label)
    })
    return {
      room,
      biteActionId: room.featureActionId(enemy, creatureFeature(psychicWolf, 'Bite').id)
    }
  }

  /** On the hostile Wolf's turn, the hit points its psychic Bite leaves the friendly Wolf. */
  async function allyHitPointsAfterBite({
    room,
    biteActionId
  }: Awaited<ReturnType<typeof mindBlankRoom>>) {
    await room.advanceTurn()
    await room.advanceTurn()
    const bite = await room.startAction(FIRST_ALLY_ID, [], null, null, biteActionId, WOLF_ID)
    expect(bite.answer.type, JSON.stringify(bite.answer)).toBe('COMMAND_COMMITTED')
    await settlePendingAction(room)
    return readActorHitPoints(await readRoomHistory(room.room.base.stub), FIRST_ALLY_ID)
  }

  it('makes the creature it touches immune to psychic damage', async () => {
    const unwarded = await mindBlankRoom()
    const full = readActorHitPoints(
      await readRoomHistory(unwarded.room.room.base.stub),
      FIRST_ALLY_ID
    )
    expect(await allyHitPointsAfterBite(unwarded)).toBe(full - 3)

    const warded = await mindBlankRoom()
    const cast = await warded.room.startAction(FIRST_ALLY_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    expect(await allyHitPointsAfterBite(warded)).toBe(full)
  }, 120000)

  it('lasts 24 hours of turns, and one more tick when the caster touches itself on its own turn', async () => {
    const { room } = await mindBlankRoom()
    const cast = await room.startAction(CHARACTER_ACTOR_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    const { characterEffects } = await readRoomHistory(room.room.base.stub)
    expect(characterEffects.map(({ lifecycle }) => lifecycle.remainingTicks)).toEqual([
      MAX_ACTIVE_EFFECT_STORED_TICKS
    ])
  }, 120000)
})

/** The Character's actor, whose frozen identity a turn change checks. */
const casterActor = () => ({
  ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
  snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
})

/** The damage the receipt of the command `commandId` applied, by amount and type. */
async function appliedDamage(room: ActionRoom, commandId: string) {
  const receipt = (await readRoomHistory(room.room.base.stub)).receipts.find(
    (row) => row.commandId === commandId && row.commandType === 'RESOLVE_ACTION'
  )
  if (!receipt) throw new Error('The action receipt is missing.')
  const result = parseReceiptExecution(receipt)
  if (result.status !== 'COMPLETE') throw new Error('Expected a settled action.')
  const outputs = result.applicationOutputs
  if (
    outputs.kind !== 'CHARACTER_MECHANICS_BATCH' &&
    outputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
  )
    throw new Error(`Expected a mechanics batch, not ${outputs.kind}.`)
  return outputs.applications.flatMap((application) =>
    application.kind === 'DAMAGE' ? [[application.requestedAmount, application.damageTypeId]] : []
  )
}

describe('room Shillelagh (SPELLS-4.T2e)', () => {
  /** The Character holding its Club, who prepares Shillelagh, then a Wolf. */
  const shillelaghRoom = () =>
    actionRoom({
      // The Club's d20 shows 19 and hits; its damage die shows 8.
      rolls: [18, 7],
      fallbackRoll: 0,
      actors: [casterActor(), srdCreatureActor({ id: WOLF_ID, creature: biteWolf('ATTACK') })],
      characterPlay: { equipped: true },
      characterSpellcasting: { spells: [shillelagh], prepared: [shillelagh.id] },
      characterAction: (action) => action.label.startsWith(shillelagh.label)
    })

  it('offers the held Club, and the Club then deals a d8 instead of its d4', async () => {
    const room = await shillelaghRoom()
    const items = await room.actionItemChoices(CHARACTER_ACTOR_ID)
    expect(items.map(({ label }) => label)).toEqual(['Club'])
    const cast = await room.startAction(
      CHARACTER_ACTOR_ID,
      RANGE,
      null,
      null,
      room.actionId,
      CHARACTER_ACTOR_ID,
      undefined,
      items[0]!.id
    )
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')

    const club = (await room.actionChoices()).actions.find(({ label }) => label.includes('Club'))
    if (!club) throw new Error('The Character offers no Club attack.')
    const attack = await room.startAction(WOLF_ID, RANGE, null, null, club.id)
    expect(attack.answer.type, JSON.stringify(attack.answer)).toBe('COMMAND_COMMITTED')
    await settlePendingAction(room)

    // 8 on the d8, plus Strength (+2), the higher of Strength and the spellcasting ability.
    expect(await appliedDamage(room, attack.command.commandId)).toEqual([
      [10, damageTypeId('BLUDGEONING')]
    ])
  }, 120000)

  it('refuses the cast without the item it is used on', async () => {
    const room = await shillelaghRoom()
    const cast = await room.startAction(CHARACTER_ACTOR_ID, RANGE, null, null, room.actionId)
    expect(cast.answer.type).not.toBe('COMMAND_COMMITTED')
    expect(JSON.stringify(cast.answer)).toContain('Choose the item this action is used on.')
  }, 120000)
})

describe('room Heat Metal (SPELLS-4.T2e)', () => {
  const OGRE_ID = testUuid(0xa35)

  /**
   * The Character, who prepares Heat Metal, then an Ogre holding a Longsword in its main hand, or
   * with `armor` wearing Chain Mail instead. The Ogre's Constitution save shows `saveFace`.
   */
  async function heatMetalRoom(saveFace: number, armor = false) {
    const seeded = seededSrdCreature('Ogre')
    const ogre = {
      ...seeded,
      equipmentLoadout: seeded.equipmentLoadout?.map((entry) =>
        entry.useState === 'MAIN_HAND'
          ? armor
            ? { ...entry, equipmentId: chainMail.id, useState: 'WORN' as const }
            : { ...entry, equipmentId: longsword.id }
          : entry
      )
    }
    const ogreActor = srdCreatureActor({ id: OGRE_ID, creature: ogre })
    const itemEntryId = snapshotCreatureEquipmentLoadout(ogreActor).find(
      (entry) => entry.equipmentId === (armor ? chainMail.id : longsword.id)
    )?.id
    if (!itemEntryId) throw new Error('The Ogre has no metal item.')
    const room = await actionRoom({
      rolls: [saveFace - 1],
      fallbackRoll: 0,
      actors: [casterActor(), ogreActor],
      characterSpellcasting: { spells: [heatMetal], prepared: [heatMetal.id] },
      characterAction: (action) => action.label.startsWith(heatMetal.label)
    })
    return { room, itemEntryId }
  }

  /** Casts Heat Metal on the Ogre's metal item and settles every roll. */
  async function castHeatMetal({ room, itemEntryId }: Awaited<ReturnType<typeof heatMetalRoom>>) {
    const items = await room.actionItemChoices(OGRE_ID)
    expect(items.map(({ id }) => id)).toEqual([itemEntryId])
    const cast = await room.startAction(
      OGRE_ID,
      RANGE,
      null,
      null,
      room.actionId,
      CHARACTER_ACTOR_ID,
      undefined,
      itemEntryId
    )
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    await settlePendingAction(room)
    return cast.command.commandId
  }

  async function ogreItemState(room: ActionRoom, itemEntryId: string) {
    const { stub } = room.room.base
    const row = (await readRoomHistory(stub)).actors.find(({ id }) => id === OGRE_ID)
    const ogre = row && readStoredRunActor(row)
    if (ogre?.kind !== 'CREATURE') throw new Error('The Ogre is not in the stored Run.')
    const snapshotRow = await runInDurableObject(stub, async (_instance, context) =>
      new RoomEncounterStore(context.storage)
        .documents('encounterActorSnapshots')
        .find(({ checksum }) => checksum === ogre.snapshotChecksum)
    )
    if (!snapshotRow) throw new Error('The Ogre’s snapshot is not stored.')
    return snapshotCreatureEquipmentLoadout({
      ...ogre,
      snapshot: readStoredActorSnapshot(snapshotRow)
    }).find((entry) => entry.id === itemEntryId)?.useState
  }

  const readCharacterPlayState = (room: ActionRoom) =>
    runInDurableObject(room.room.base.stub, (_instance, context) => {
      const row = new RoomEncounterStore(context.storage)
        .documents('characterPlayStates')
        .find((candidate) => candidate.characterId === CHARACTER_ID)
      if (!row) throw new Error('Missing room Character play state.')
      return readCharacterPlay(row)
    })

  const ogreGrants = async (room: ActionRoom) =>
    (await readRoomHistory(room.room.base.stub)).activeEffects.filter(
      ({ targetActorId }) => targetActorId === OGRE_ID
    )

  it('makes the Ogre drop the held Longsword on a failed save, with no disadvantage, and one undo puts it back', async () => {
    const fixture = await heatMetalRoom(1)
    const commandId = await castHeatMetal(fixture)
    // 2d8 fire, every die showing 1.
    expect(await appliedDamage(fixture.room, commandId)).toEqual([[2, damageTypeId('FIRE')]])
    expect(await ogreItemState(fixture.room, fixture.itemEntryId)).toBe('CARRIED')
    expect(await ogreGrants(fixture.room)).toEqual([])

    const undone = await fixture.room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: fixture.room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await fixture.room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await ogreItemState(fixture.room, fixture.itemEntryId)).toBe('MAIN_HAND')
  }, 120000)

  it('gives the Ogre disadvantage when it fails the save but cannot drop the worn Chain Mail', async () => {
    const fixture = await heatMetalRoom(1, true)
    await castHeatMetal(fixture)
    expect(await ogreItemState(fixture.room, fixture.itemEntryId)).toBe('WORN')
    // The disadvantage and the carrier of the repeat offer (D166).
    expect(await ogreGrants(fixture.room)).toHaveLength(2)
  }, 120000)

  it('gives the Ogre disadvantage when it keeps the Longsword on a successful save', async () => {
    const fixture = await heatMetalRoom(20)
    await castHeatMetal(fixture)
    expect(await ogreItemState(fixture.room, fixture.itemEntryId)).toBe('MAIN_HAND')
    expect(await ogreGrants(fixture.room)).toHaveLength(2)
  }, 120000)

  it('lets the Character repeat the damage and save as a bonus action, on the cast’s DC, with no slot or new Concentration (D166)', async () => {
    const fixture = await heatMetalRoom(20)
    await castHeatMetal(fixture)
    const slotsAfterCast = (await readCharacterPlayState(fixture.room)).spellSlots
    const maintained = (await readRoomHistory(fixture.room.room.base.stub)).maintainedStates
    const carrier = (await ogreGrants(fixture.room)).find(({ definitionJson }) =>
      definitionJson.includes('REPEAT_SOURCE_PATH')
    )
    if (!carrier) throw new Error('The cast left no repeat carrier on the Ogre.')
    const frozenDc = Number(/"baseDc":(\d+)/.exec(carrier.definitionJson)?.[1])
    expect(frozenDc).toBeGreaterThan(0)

    const [offer] = (await fixture.room.actionChoices()).effectOffers
    expect(offer).toMatchObject({
      kind: 'REPEAT_SOURCE_PATH',
      effectId: carrier.id,
      holderActorId: OGRE_ID,
      activation: 'BONUS_ACTION',
      label: 'Heat Metal (2nd level)',
      dc: frozenDc
    })
    if (offer?.kind !== 'REPEAT_SOURCE_PATH') throw new Error('Expected the repeat offer.')

    const repeat = await fixture.room.startAction(OGRE_ID, RANGE, null, null, offer.actionId)
    expect(repeat.answer.type, JSON.stringify(repeat.answer)).toBe('COMMAND_COMMITTED')
    // The same pending flow as any action: it asks for the Ogre's save against the frozen DC.
    const pending = await readPendingActionContext(fixture.room.room.base.stub)
    if (pending.kind !== 'ENCOUNTER_ACTION') throw new Error('Expected a pending action.')
    expect(JSON.stringify(pending)).toContain(`"dc":${frozenDc}`)
    await settlePendingAction(fixture.room)

    // Every die shows its minimum: 2d8 fire is 2 and the failed save drops the Longsword.
    expect(await appliedDamage(fixture.room, repeat.command.commandId)).toEqual([
      [2, damageTypeId('FIRE')]
    ])
    expect(await ogreItemState(fixture.room, fixture.itemEntryId)).toBe('CARRIED')
    expect((await readCharacterPlayState(fixture.room)).spellSlots).toEqual(slotsAfterCast)
    expect((await readRoomHistory(fixture.room.room.base.stub)).maintainedStates).toEqual(
      maintained
    )
    // The release ended the carrier, so the offer is gone.
    expect((await ogreGrants(fixture.room)).some(({ id }) => id === carrier.id)).toBe(false)
    expect((await fixture.room.actionChoices()).effectOffers).toEqual([])
  }, 120000)
})

describe('room Vampiric Touch (SPELLS-4.T2n2, D181)', () => {
  /** The wounded Character, who prepares Vampiric Touch, then a Wolf. The attack hits; each damage die shows 6. */
  const vampiricTouchRoom = () =>
    actionRoom({
      rolls: [18, 5, 5, 5],
      fallbackRoll: 0,
      actors: [casterActor(), srdCreatureActor({ id: WOLF_ID, creature: biteWolf('ATTACK') })],
      characterPlay: { currentHitPoints: 1, classLevel: 5 },
      characterSpellcasting: { spells: [vampiricTouch], prepared: [vampiricTouch.id] },
      characterAction: (action) => action.label.startsWith(vampiricTouch.label)
    })

  const characterHitPoints = (room: ActionRoom) =>
    runInDurableObject(room.room.base.stub, (_instance, context) => {
      const row = new RoomEncounterStore(context.storage)
        .documents('characterPlayStates')
        .find((candidate) => candidate.characterId === CHARACTER_ID)
      if (!row) throw new Error('Missing room Character play state.')
      return readCharacterPlay(row).hitpoints.current
    })

  async function castVampiricTouch(room: ActionRoom) {
    const cast = await room.startAction(WOLF_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    await settlePendingAction(room)
    return cast.command.commandId
  }

  it('deals 3d6 necrotic damage and heals the caster by half of it, rounded down', async () => {
    const room = await vampiricTouchRoom()
    const wolfBefore = readActorHitPoints(await readRoomHistory(room.room.base.stub), WOLF_ID)
    const commandId = await castVampiricTouch(room)

    expect(await appliedDamage(room, commandId)).toEqual([[18, damageTypeId('NECROTIC')]])
    expect(readActorHitPoints(await readRoomHistory(room.room.base.stub), WOLF_ID)).toBe(
      Math.max(0, wolfBefore - 18)
    )
    expect(await characterHitPoints(room)).toBe(1 + 9)
  }, 120000)

  it('restores the caster’s hit points when the cast is undone', async () => {
    const room = await vampiricTouchRoom()
    await castVampiricTouch(room)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await characterHitPoints(room)).toBe(1)
  }, 120000)

  it('offers the caster the attack again as an action while it concentrates', async () => {
    const room = await vampiricTouchRoom()
    await castVampiricTouch(room)

    const [offer] = (await room.actionChoices()).effectOffers
    expect(offer).toMatchObject({
      kind: 'REPEAT_SOURCE_PATH',
      holderActorId: WOLF_ID,
      activation: 'ACTION'
    })
  }, 120000)
})

/**
 * SPELLS-4.T2v: Flame Blade and Produce Flame leave a carrier on the caster that offers the caster
 * an Action attack on each later turn against any creature the attack can pick, not the holder.
 */
describe.each([
  { spell: flameBlade, slotDamage: 3, classLevel: 5 },
  { spell: produceFlame, slotDamage: 2, classLevel: 5 }
])('room $spell.label (SPELLS-4.T2v)', ({ spell, slotDamage, classLevel }) => {
  /** The Character, who prepares the spell, then a Wolf. The attack hits; every damage die shows 1. */
  const heldFlameRoom = () =>
    actionRoom({
      rolls: [18],
      fallbackRoll: 0,
      actors: [casterActor(), srdCreatureActor({ id: WOLF_ID, creature: biteWolf('ATTACK') })],
      characterPlay: { classLevel },
      characterSpellcasting: { spells: [spell], prepared: [spell.id] },
      characterAction: (action) => action.label.startsWith(spell.label)
    })

  it('offers the caster an Action attack on a creature of its choice, which deals the spell’s fire damage', async () => {
    const room = await heldFlameRoom()
    const cast = await room.startAction(CHARACTER_ACTOR_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    // The cast used this turn's action; the caster attacks on its next turn.
    await room.advanceTurn()
    await room.advanceTurn()

    const [offer] = (await room.actionChoices()).effectOffers
    expect(offer).toMatchObject({
      kind: 'REPEAT_SOURCE_PATH',
      holderActorId: CHARACTER_ACTOR_ID,
      activation: 'ACTION',
      target: 'INVOCATION'
    })
    if (offer?.kind !== 'REPEAT_SOURCE_PATH') throw new Error('Expected the repeat offer.')

    const attack = await room.startAction(WOLF_ID, RANGE, null, null, offer.actionId)
    expect(attack.answer.type, JSON.stringify(attack.answer)).toBe('COMMAND_COMMITTED')
    await settlePendingAction(room)
    expect(await appliedDamage(room, attack.command.commandId)).toEqual([
      [slotDamage, damageTypeId('FIRE')]
    ])
    // The attack is repeatable: the blade or flame is still held.
    expect((await room.actionChoices()).effectOffers).toHaveLength(1)
  }, 120000)
})

describe('room True Strike (SPELLS-4.T2k1)', () => {
  /**
   * The Character (first in the order) with True Strike prepared and a Club equipped, then an ally
   * Wolf and the Wolf the spell marks. Every die shows its minimum, so each attack misses.
   */
  async function trueStrikeRoom() {
    const wolf = biteWolf('ATTACK')
    const ally = srdCreatureActor({ id: FIRST_ALLY_ID, creature: wolf, disposition: 'FRIENDLY' })
    const room = await actionRoom({
      fallbackRoll: 0,
      actors: [
        {
          ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
          snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
        },
        ally,
        srdCreatureActor({ id: WOLF_ID, creature: wolf })
      ],
      characterPlay: { equipped: true },
      characterSpellcasting: { spells: [trueStrike], prepared: [trueStrike.id] },
      characterAction: (action) => action.label.startsWith(trueStrike.label)
    })
    const cast = await room.startAction(WOLF_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    return { room, biteActionId: room.featureActionId(ally, creatureFeature(wolf, 'Bite').id) }
  }
  type TrueStrikeRoom = Awaited<ReturnType<typeof trueStrikeRoom>>

  /** The mode an attack at the marked Wolf rolls in; the attack then settles. */
  async function attackRollMode(
    room: ActionRoom,
    actionId: string,
    actorId: string,
    warnings: EncounterRuleWarningCodeDto[] = RANGE
  ) {
    const attack = await room.startAction(WOLF_ID, warnings, null, null, actionId, actorId)
    expect(attack.answer.type, JSON.stringify(attack.answer)).toBe('COMMAND_COMMITTED')
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the attack d20.')
    const { rollMode } = decision.pending.request
    await settlePendingAction(room)
    return rollMode
  }
  async function clubActionId(room: ActionRoom) {
    const club = (await room.actionChoices(CHARACTER_ACTOR_ID)).actions.find(({ label }) =>
      label.includes('Club')
    )
    if (!club) throw new Error('The Character offers no Club attack.')
    return club.id
  }
  const markedWolfEffects = async ({ room }: TrueStrikeRoom) =>
    (await readRoomHistory(room.room.base.stub)).activeEffects.filter(
      ({ targetActorId }) => targetActorId === WOLF_ID
    )

  it('gives only the caster’s first attack on its next turn advantage, which that attack uses up', async () => {
    const fixture = await trueStrikeRoom()
    const { room, biteActionId } = fixture
    const clubId = await clubActionId(room)
    // An attack on the turn of the cast is not the caster's next turn.
    expect(
      await attackRollMode(room, clubId, CHARACTER_ACTOR_ID, [
        ...RANGE,
        'ACTION_ECONOMY_UNAVAILABLE'
      ])
    ).toBe('NORMAL')
    expect(await markedWolfEffects(fixture)).toHaveLength(1)
    // Another creature's attack neither gets the advantage nor uses the mark up.
    await room.advanceTurn()
    expect(await attackRollMode(room, biteActionId, FIRST_ALLY_ID)).toBe('NORMAL')
    expect(await markedWolfEffects(fixture)).toHaveLength(1)
    await room.advanceTurn()
    await room.advanceTurn()
    expect(await attackRollMode(room, clubId, CHARACTER_ACTOR_ID)).toBe('ADVANTAGE')
    expect(await markedWolfEffects(fixture)).toEqual([])
  }, 120000)

  it('ends unused at the end of the caster’s next turn', async () => {
    const fixture = await trueStrikeRoom()
    await fixture.room.advanceTurn()
    await fixture.room.advanceTurn()
    await fixture.room.advanceTurn()
    expect(await markedWolfEffects(fixture)).toHaveLength(1)
    await fixture.room.advanceTurn()
    expect(await markedWolfEffects(fixture)).toEqual([])
  }, 120000)

  it('ends when the caster’s Concentration ends', async () => {
    const fixture = await trueStrikeRoom()
    expect(await markedWolfEffects(fixture)).toHaveLength(1)
    const ended = await endConcentrationAtSheet(fixture.room, CHARACTER_ID)
    expect(ended.type, JSON.stringify(ended)).toBe('COMMAND_COMMITTED')
    expect(await markedWolfEffects(fixture)).toEqual([])
  }, 120000)
})
