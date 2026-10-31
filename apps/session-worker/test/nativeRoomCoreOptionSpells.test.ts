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
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { MAX_ACTIVE_EFFECT_STORED_TICKS } from '@artificer-toolkit/schema/shared/activeRuleEffectLifecycle'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { arcaneHand } from '@artificer-toolkit/source-data/srd/spells/arcane-hand.js'
import { chainMail } from '@artificer-toolkit/source-data/srd/equipment/chain-mail.js'
import { longsword } from '@artificer-toolkit/source-data/srd/equipment/longsword.js'
import { arcaneSword } from '@artificer-toolkit/source-data/srd/spells/arcane-sword.js'
import { faithfulHound } from '@artificer-toolkit/source-data/srd/spells/faithful-hound.js'
import { flameBlade } from '@artificer-toolkit/source-data/srd/spells/flame-blade.js'
import { goodberry } from '@artificer-toolkit/source-data/srd/spells/goodberry.js'
import { guidingBolt } from '@artificer-toolkit/source-data/srd/spells/guiding-bolt.js'
import { heroesFeast } from '@artificer-toolkit/source-data/srd/spells/heroes-feast.js'
import { heatMetal } from '@artificer-toolkit/source-data/srd/spells/heat-metal.js'
import { haste } from '@artificer-toolkit/source-data/srd/spells/haste.js'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { mageArmor } from '@artificer-toolkit/source-data/srd/spells/mage-armor.js'
import { mageHand } from '@artificer-toolkit/source-data/srd/spells/mage-hand.js'
import { mindBlank } from '@artificer-toolkit/source-data/srd/spells/mind-blank.js'
import { passWithoutTrace } from '@artificer-toolkit/source-data/srd/spells/pass-without-trace.js'
import { produceFlame } from '@artificer-toolkit/source-data/srd/spells/produce-flame.js'
import { creatureTypeId, damageTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { findFamiliar } from '@artificer-toolkit/source-data/srd/spells/find-familiar.js'
import { applyCreatureAttackRolls } from '@artificer-toolkit/source-data/srd/creatures/attack-rolls.js'
import { cat } from '@artificer-toolkit/source-data/srd/creatures/cat.js'
import { CREATURE_IDS } from '@artificer-toolkit/source-data/srd/ids.js'
import { shillelagh } from '@artificer-toolkit/source-data/srd/spells/shillelagh.js'
import { spiritualWeapon } from '@artificer-toolkit/source-data/srd/spells/spiritual-weapon.js'
import { trueStrike } from '@artificer-toolkit/source-data/srd/spells/true-strike.js'
import { vampiricTouch } from '@artificer-toolkit/source-data/srd/spells/vampiric-touch.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets, connectPlayer, ROOM_REPLY_WAIT } from './liveRoomFixture.js'
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

/**
 * SPELLS-4.T2v2a3a: a repeat its offer does not mark CONJURED measures its reach from the caster's
 * own token, so a held Flame Blade misses a Wolf beyond the caster's reach until the GM overrides.
 */
describe('room Flame Blade reach (SPELLS-4.T2v2a3a)', () => {
  it('measures the repeat attack from the caster and refuses a Wolf beyond its reach', async () => {
    const room = await actionRoom({
      rolls: [18],
      fallbackRoll: 0,
      actors: [casterActor(), srdCreatureActor({ id: WOLF_ID, creature: biteWolf('ATTACK') })],
      // Three cells from the caster: beyond the blade's 5-foot reach.
      positions: { [WOLF_ID]: { x: 450, y: 150 } },
      characterPlay: { classLevel: 5 },
      characterSpellcasting: { spells: [flameBlade], prepared: [flameBlade.id] },
      characterAction: (action) => action.label.startsWith(flameBlade.label)
    })
    const cast = await room.startAction(CHARACTER_ACTOR_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    await room.advanceTurn()
    await room.advanceTurn()
    const [offer] = (await room.actionChoices()).effectOffers
    if (offer?.kind !== 'REPEAT_SOURCE_PATH') throw new Error('Expected the repeat offer.')
    expect(offer.originActorId).toBeUndefined()

    const refused = await room.startAction(WOLF_ID, [], room.sceneContext(), null, offer.actionId)
    expect(refused.answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'RULE_WARNINGS' })
    expect(JSON.stringify(refused.answer)).toContain('TARGET_OUT_OF_RANGE')

    const overridden = await room.startAction(
      WOLF_ID,
      ['TARGET_OUT_OF_RANGE'],
      room.sceneContext(),
      null,
      offer.actionId
    )
    expect(overridden.answer.type, JSON.stringify(overridden.answer)).toBe('COMMAND_COMMITTED')
  }, 120000)
})

/**
 * SPELLS-4.T2v2a3b (D190a): a repeat offer authored FREE_ONCE costs nothing once, in the turn of the
 * cast; a second use that turn is charged as authored. Flame Blade authors no free use, so its offer
 * is given one here.
 */
describe('room free cast-turn repeat (SPELLS-4.T2v2a3b)', () => {
  function freeOnceFlameBlade() {
    const spell = structuredClone(flameBlade)
    const path = spell.effects?.[0]?.paths?.[0]
    const offer =
      path?.selectionKind === 'FIXED' ? path.resultBlock.lifecycle?.effectOffers?.[0] : undefined
    if (!offer) throw new Error('Flame Blade must offer a repeat.')
    offer.castTurnUse = 'FREE_ONCE'
    return spell
  }

  it('attacks once free on the cast turn, then charges the Action the cast spent, and never again later', async () => {
    const spell = freeOnceFlameBlade()
    const room = await actionRoom({
      rolls: [18],
      fallbackRoll: 0,
      actors: [casterActor(), srdCreatureActor({ id: WOLF_ID, creature: biteWolf('ATTACK') })],
      characterPlay: { classLevel: 5 },
      characterSpellcasting: { spells: [spell], prepared: [spell.id] },
      characterAction: (action) => action.label.startsWith(spell.label)
    })
    const cast = await room.startAction(CHARACTER_ACTOR_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')

    // The cast spent the Action, yet the first attack this turn is free.
    const [free] = (await room.actionChoices()).effectOffers
    expect(free).toMatchObject({ kind: 'REPEAT_SOURCE_PATH', activation: 'FREE' })
    if (free?.kind !== 'REPEAT_SOURCE_PATH') throw new Error('Expected the repeat offer.')
    const attack = await room.startAction(WOLF_ID, RANGE, null, null, free.actionId)
    expect(attack.answer.type, JSON.stringify(attack.answer)).toBe('COMMAND_COMMITTED')
    await settlePendingAction(room)
    expect(await appliedDamage(room, attack.command.commandId)).toEqual([[3, damageTypeId('FIRE')]])

    // The second attack this turn costs the Action, which the cast already spent.
    const [charged] = (await room.actionChoices()).effectOffers
    expect(charged).toMatchObject({ activation: 'ACTION' })
    expect(JSON.stringify(charged?.warnings)).toContain('ACTION_ECONOMY_UNAVAILABLE')
    const second = await room.startAction(WOLF_ID, RANGE, null, null, free.actionId)
    expect(second.answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'RULE_WARNINGS' })
    expect(JSON.stringify(second.answer)).toContain('ACTION_ECONOMY_UNAVAILABLE')

    // On the caster's next turn the attack costs its Action like any other.
    await room.advanceTurn()
    await room.advanceTurn()
    expect((await room.actionChoices()).effectOffers).toEqual([
      expect.objectContaining({ activation: 'ACTION' })
    ])
  }, 120000)
})

/** The Run's first side. */
async function sideIdOf(room: ActionRoom) {
  const [run] = (await readRoomHistory(room.room.base.stub)).runs
  if (!run) throw new Error('The room holds no Run.')
  const [side] = encounterRunStateSchema.parse(JSON.parse(run.stateJson)).sides
  if (!side) throw new Error('The Run holds no side.')
  return side.id
}

/** The Run actors the caster owns, with the Scene token bound to each. */
async function conjured(room: ActionRoom) {
  const { stub } = room.room.base
  const actors = (await readRoomHistory(stub)).actors
    .map((row) => readStoredRunActor(row))
    .filter((actor) => actor.owner?.ownerActorId === CHARACTER_ACTOR_ID)
  const bindings = await runInDurableObject(stub, async (_instance, context) =>
    new RoomEncounterStore(context.storage).documents('encounterActorTokenBindings')
  )
  return actors.map((actor) => ({
    actor,
    tokenId: bindings.find(({ actorId }) => actorId === actor.id)?.tokenId
  }))
}

/** The owner's socket, subscribed to the caster's Sheet, and the summons its latest push lists. */
async function ownerSheet(room: ActionRoom) {
  const player = await connectPlayer(room.room.base)
  player.socket.send(
    JSON.stringify({ type: 'SUBSCRIBE_CHARACTER_SHEET', characterId: CHARACTER_ID })
  )
  return () =>
    player.messages
      .flatMap((message) => (message.type === 'CHARACTER_SHEET' ? [message.sheet] : []))
      .at(-1)
      ?.extras.items.filter((item) => item.kind === 'SPELL_SUMMON')
}

/** The GM sets a summon's current hit points in the Encounter. */
async function setSummonHitPoints(room: ActionRoom, actorId: string, currentHitPoints: number) {
  const updated = await room.send({
    type: 'UPDATE_ACTOR',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId,
    currentHitPoints
  })
  expect(updated.type, JSON.stringify(updated)).toBe('COMMAND_COMMITTED')
}

/**
 * Casts the room's summon spell at `point`, with the form and creature type a summon that authors
 * forms takes, and returns the one creature it conjured.
 */
async function castSummon(
  room: ActionRoom,
  point: { x: number; y: number },
  picks: { formId?: string; creatureTypeId?: string } = {}
) {
  const cast = await room.startAreaCommand({ kind: 'POINT', point, ...picks })
  expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
  const [summon] = await conjured(room)
  if (!summon?.tokenId) throw new Error('The cast conjured nothing.')
  return { ...summon, tokenId: summon.tokenId }
}

/** The caster attacks the Wolf through the creature its spell conjured. */
async function attackThrough(room: ActionRoom, activation: 'FREE' | 'BONUS_ACTION') {
  const [offer] = (await room.actionChoices()).effectOffers
  expect(offer).toMatchObject({ kind: 'REPEAT_SOURCE_PATH', activation })
  if (offer?.kind !== 'REPEAT_SOURCE_PATH') throw new Error('Expected the repeat offer.')
  const attack = await room.startAction(WOLF_ID, RANGE, null, null, offer.actionId)
  expect(attack.answer.type, JSON.stringify(attack.answer)).toBe('COMMAND_COMMITTED')
  await settlePendingAction(room)
  return appliedDamage(room, attack.command.commandId)
}

/**
 * SPELLS-4.T2v2a3d (D187b, D190a): Spiritual Weapon conjures an owned weapon beside the Wolf; its
 * caster attacks through it once free on the cast turn and as a Bonus Action on later turns, and the
 * weapon goes when the spell ends or the cast is reverted. Moving it is an ordinary token move.
 */
describe('room Spiritual Weapon (SPELLS-4.T2v2a3d)', () => {
  /** The Character, who prepares the spell, then a Wolf. Each attack hits; every damage die shows 1. */
  const weaponRoom = () =>
    actionRoom({
      // Each attack's d20, then its d8.
      rolls: [18, 0, 18],
      fallbackRoll: 0,
      actors: [casterActor(), srdCreatureActor({ id: WOLF_ID, creature: biteWolf('ATTACK') })],
      characterPlay: { classLevel: 5 },
      characterSpellcasting: { spells: [spiritualWeapon], prepared: [spiritualWeapon.id] },
      characterAction: (action) => action.label.startsWith(spiritualWeapon.label)
    })
  /** Beside the Wolf, two squares from the caster. */
  const WEAPON_POINT = { x: 350, y: 150 }

  const castWeapon = (room: ActionRoom) => castSummon(room, WEAPON_POINT)

  it('conjures the weapon, attacks free on the cast turn, moves and attacks as a Bonus Action later, and goes at expiry', async () => {
    const room = await weaponRoom()
    const weapon = await castWeapon(room)
    expect(weapon.actor).toMatchObject({ label: 'Spiritual Weapon', kind: 'CUSTOM' })
    const [offer] = (await room.actionChoices()).effectOffers
    expect(offer).toMatchObject({ originActorId: weapon.actor.id })

    // 1 on the d8 plus the caster's +1 spellcasting modifier.
    expect(await attackThrough(room, 'FREE')).toEqual([[2, damageTypeId('FORCE')]])
    // The Bonus Action the cast spent pays for any second attack this turn.
    const [charged] = (await room.actionChoices()).effectOffers
    expect(charged).toMatchObject({ activation: 'BONUS_ACTION' })
    expect(JSON.stringify(charged?.warnings)).toContain('ACTION_ECONOMY_UNAVAILABLE')

    await room.advanceTurn()
    await room.advanceTurn()
    // The GM rules the move part of the Bonus Action: the weapon's token moves as any token does.
    const moved = await room.room.move(
      [WEAPON_POINT, { x: 350, y: 250 }],
      await room.version(),
      room.room.scene.version + 1,
      weapon.tokenId
    )
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
    expect(await attackThrough(room, 'BONUS_ACTION')).toEqual([[2, damageTypeId('FORCE')]])

    // One minute is 10 rounds of the caster and the Wolf; the second turn above is round 2.
    for (let turn = 0; turn < 18; turn++) await room.advanceTurn()
    expect(await conjured(room)).toHaveLength(1)
    await room.advanceTurn()
    await room.advanceTurn()
    expect(await conjured(room)).toEqual([])
    expect((await room.actionChoices()).effectOffers).toEqual([])
  }, 120000)

  it('takes the weapon away again when the cast is reverted', async () => {
    const room = await weaponRoom()
    await castWeapon(room)
    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await conjured(room)).toEqual([])
    expect((await room.actionChoices()).effectOffers).toEqual([])
  }, 120000)

  /** SPELLS-35.T3a: an owner-turn summon is a Run actor that is not in the initiative order. */
  it('lets the GM reinforce the Run while the weapon stands', async () => {
    const room = await actionRoom({
      rolls: [18, 0, 18],
      fallbackRoll: 0,
      actors: [
        { ...casterActor(), initiative: 15 },
        { ...srdCreatureActor({ id: WOLF_ID, creature: biteWolf('ATTACK') }), initiative: 10 }
      ],
      characterPlay: { classLevel: 5 },
      characterSpellcasting: { spells: [spiritualWeapon], prepared: [spiritualWeapon.id] },
      characterAction: (action) => action.label.startsWith(spiritualWeapon.label)
    })
    const weapon = await castWeapon(room)
    const reinforced = await room.send({
      type: 'REINFORCE',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      sideId: await sideIdOf(room),
      initiative: 5,
      public: true,
      enemy: { kind: 'CUSTOM', label: 'Reinforcement', maxHitPoints: 8 }
    })
    expect(reinforced.type, JSON.stringify(reinforced)).toBe('COMMAND_COMMITTED')
    expect((await conjured(room)).map(({ actor }) => actor.id)).toEqual([weapon.actor.id])
  }, 120000)

  it('settles a tied start while a creature acts on its owner’s turn', async () => {
    const wolf = (id: string) => srdCreatureActor({ id, creature: biteWolf('ATTACK') })
    const room = await actionRoom({
      // Two Wolves roll the same score, so the start asks the GM to order them.
      fallbackRoll: 0,
      actors: [
        wolf(WOLF_ID),
        wolf(FIRST_ALLY_ID),
        { ...wolf(SECOND_ALLY_ID), owner: { ownerActorId: WOLF_ID } }
      ],
      status: 'PREPARED',
      autoRoll: 'EVERYONE'
    })
    const started = await room.send({
      type: 'START',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    const pending =
      started.type === 'COMMAND_COMMITTED' && started.delta?.scope === 'ENCOUNTER'
        ? started.delta.result.occurrence?.pending
        : undefined
    if (pending?.kind !== 'INITIATIVE_ORDER') throw new Error('Expected a tie to settle.')
    const settled = await room.send({
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      correlationId: null,
      resolution: { kind: 'INITIATIVE_ENTITY', requestId: pending.requestId, entityId: WOLF_ID }
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
  }, 120000)
})

/**
 * SPELLS-35.T3b (D200): a summon with its own initiative leaves the order when its carrier ends. One
 * that is acting when it ends is left standing, and a keyed system ADVANCE_TURN ends its turn so the
 * sweep can remove it. No authored spell conjures one yet, so the Run starts with the summon and
 * without the carrier effect it names: the first Encounter command's sweep finds it ended.
 */
describe('room summon with its own initiative ends (SPELLS-35.T3b)', () => {
  const SUMMON_ID = testUuid(0xa35)
  const CARRIER_ID = testUuid(0xa36)

  /** The summon acts first, then the Wolf and the Character; `carrierRounds` gives the Character a carrier effect for that many of its turns. */
  const summonRoom = ({
    carrierRounds,
    turnTiming = 'OWN_INITIATIVE'
  }: { carrierRounds?: number; turnTiming?: 'OWN_INITIATIVE' | 'AFTER_OWNER' } = {}) => {
    const wolf = biteWolf('ATTACK')
    return actionRoom({
      fallbackRoll: 0,
      actors: [
        {
          ...srdCreatureActor({ id: SUMMON_ID, creature: wolf }),
          initiative: 20,
          owner: {
            ownerActorId: CHARACTER_ACTOR_ID,
            sourceEffectId: CARRIER_ID,
            turnTiming
          }
        },
        { ...srdCreatureActor({ id: WOLF_ID, creature: wolf }), initiative: 15 },
        { ...casterActor(), initiative: 10 }
      ],
      ownerFeatureId: creatureFeature(wolf, 'Bite').id,
      ...(carrierRounds !== undefined && {
        seed: async ({ effects, encounterId, occurredAt }) => {
          const [effect] = haste.effects ?? []
          const grant = plannedModifierGrant({
            encounterId,
            sourceActorId: CHARACTER_ACTOR_ID,
            holderActorId: CHARACTER_ACTOR_ID,
            lifecycle: {},
            effect,
            rounds: carrierRounds
          })
          await effects.create({
            id: CARRIER_ID,
            owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: CHARACTER_ACTOR_ID },
            definition: grant.definition,
            lifecycle: { schemaVersion: 1, remainingTicks: carrierRounds },
            occurredAt
          })
        }
      })
    })
  }

  const runOf = async (room: ActionRoom) => {
    const [run] = (await readRoomHistory(room.room.base.stub)).runs
    if (!run) throw new Error('The room holds no Run.')
    return { ...encounterRunStateSchema.parse(JSON.parse(run.stateJson)), version: run.version }
  }
  const updateWolf = async (room: ActionRoom) => {
    const answer = await room.send({
      type: 'UPDATE_ACTOR',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      actorId: WOLF_ID,
      currentHitPoints: 5
    })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  }
  const commandTypes = async (room: ActionRoom) =>
    (await readRoomHistory(room.room.base.stub)).commands.map(({ commandType }) => commandType)

  it('ends the turn of the summon acting when its carrier has ended, then removes it', async () => {
    const room = await summonRoom()
    expect((await runOf(room)).currentActorId).toBe(SUMMON_ID)
    await updateWolf(room)

    const run = await runOf(room)
    expect(run.actorIds).not.toContain(SUMMON_ID)
    expect(run.currentActorId).toBe(WOLF_ID)
    const types = await commandTypes(room)
    expect(types.filter((type) => type === 'ADVANCE_TURN')).toHaveLength(1)
    expect(types.filter((type) => type === 'SUMMONS_ENDED')).toHaveLength(1)
  }, 120000)

  it('is recovered by the GM’s own ADVANCE_TURN while the summon stands, advancing once', async () => {
    const room = await summonRoom()
    expect((await runOf(room)).currentActorId).toBe(SUMMON_ID)
    await room.advanceTurn()

    const run = await runOf(room)
    expect(run.actorIds).not.toContain(SUMMON_ID)
    expect(run.currentActorId).toBe(WOLF_ID)
    expect((await commandTypes(room)).filter((type) => type === 'ADVANCE_TURN')).toHaveLength(1)
  }, 120000)

  it('acts right after its owner, whatever initiative it was given, in every round (SPELLS-35.T4)', async () => {
    const room = await summonRoom({ carrierRounds: 5, turnTiming: 'AFTER_OWNER' })
    const acting = async () => {
      const { currentActorId, round } = await runOf(room)
      return [round, currentActorId]
    }
    // The summon's own initiative of 20 would put it first; it takes the place behind its owner instead.
    const turns = [await acting()]
    for (let turn = 0; turn < 5; turn += 1) {
      await room.advanceTurn()
      turns.push(await acting())
    }
    expect(turns).toEqual([
      [1, WOLF_ID],
      [1, CHARACTER_ACTOR_ID],
      [1, SUMMON_ID],
      [2, WOLF_ID],
      [2, CHARACTER_ACTOR_ID],
      [2, SUMMON_ID]
    ])
    expect((await runOf(room)).actorIds).toContain(SUMMON_ID)
  }, 120000)

  it('ends the turn of a summon that lands first after a wrap, once, and leaves a valid actor acting', async () => {
    const room = await summonRoom({ carrierRounds: 1 })
    // The carrier stands through the summon's and the Wolf's turns, then ends with the Character's.
    await room.advanceTurn()
    await room.advanceTurn()
    expect((await runOf(room)).currentActorId).toBe(CHARACTER_ACTOR_ID)
    expect((await runOf(room)).actorIds).toContain(SUMMON_ID)
    await room.advanceTurn()

    const run = await runOf(room)
    expect(run.round).toBe(2)
    expect(run.actorIds).not.toContain(SUMMON_ID)
    expect(run.currentActorId).toBe(WOLF_ID)
    const types = await commandTypes(room)
    // The three the table made, and the one the room made for the summon that landed first.
    expect(types.filter((type) => type === 'ADVANCE_TURN')).toHaveLength(4)
    expect(types.filter((type) => type === 'SUMMONS_ENDED')).toHaveLength(1)
  }, 120000)
})

/**
 * SPELLS-4.T2v2b (D187b, D190a): Arcane Hand conjures a Large owned hand with the caster's hit point
 * maximum; the caster strikes with its Clenched Fist once free on the cast turn and as a Bonus Action
 * later, and the hand goes when Concentration ends. Its other three hands are GM rulings.
 */
describe('room Arcane Hand (SPELLS-4.T2v2b)', () => {
  /** A 3rd-level Character (11 + 7 + 7 hit points) who prepares the spell, then a Wolf. Every die shows 1. */
  const handRoom = () =>
    actionRoom({
      rolls: [18, 0, 0, 0, 0, 18],
      fallbackRoll: 0,
      actors: [casterActor(), srdCreatureActor({ id: WOLF_ID, creature: biteWolf('ATTACK') })],
      characterPlay: { classLevel: 3 },
      characterSpellcasting: { spells: [arcaneHand], prepared: [arcaneHand.id] },
      characterAction: (action) => action.label.startsWith(arcaneHand.label)
    })
  /** Over the Wolf: the hand does not fill its space. */
  const HAND_POINT = { x: 300, y: 200 }

  it('conjures a hand with the caster’s hit point maximum that strikes free on the cast turn, as a Bonus Action later, and goes with Concentration', async () => {
    const room = await handRoom()
    const hand = await castSummon(room, HAND_POINT)
    expect(hand.actor).toMatchObject({
      label: 'Arcane Hand',
      kind: 'CUSTOM',
      maxHitPoints: 25,
      currentHitPoints: 25
    })
    const [offer] = (await room.actionChoices()).effectOffers
    expect(offer).toMatchObject({ originActorId: hand.actor.id })

    // The Clenched Fist's 4d8 force, each die a 1.
    expect(await attackThrough(room, 'FREE')).toEqual([[4, damageTypeId('FORCE')]])
    await room.advanceTurn()
    await room.advanceTurn()
    expect(await attackThrough(room, 'BONUS_ACTION')).toEqual([[4, damageTypeId('FORCE')]])

    const ended = await endConcentrationAtSheet(room, CHARACTER_ID)
    expect(ended.type, JSON.stringify(ended)).toBe('COMMAND_COMMITTED')
    expect(await conjured(room)).toEqual([])
    expect((await room.actionChoices()).effectOffers).toEqual([])
  }, 120000)

  it('lists the hand in its owner’s pushed Sheet Extras with live hit points until it falls (SPELLS-34.2, .3)', async () => {
    const room = await handRoom()
    const summons = await ownerSheet(room)
    await vi.waitFor(() => expect(summons()).toEqual([]), ROOM_REPLY_WAIT)

    const hand = await castSummon(room, HAND_POINT)
    await vi.waitFor(
      () =>
        expect(summons()).toEqual([
          expect.objectContaining({
            id: hand.actor.id,
            encounterActorId: hand.actor.id,
            spellId: arcaneHand.id,
            displayName: 'Arcane Hand',
            concentration: true,
            armorClass: 20,
            hitPoints: { current: 25, maximum: 25, temp: 0 },
            actions: [
              {
                id: arcaneHand.effects?.[1]?.id,
                label: 'Melee Spell Attack',
                description: 'Bonus Action'
              }
            ]
          })
        ]),
      ROOM_REPLY_WAIT
    )

    // The Run actor is the only record: the Encounter's change reaches the Sheet.
    await setSummonHitPoints(room, hand.actor.id, 10)
    await vi.waitFor(
      () => expect(summons()?.[0]?.hitPoints).toEqual({ current: 10, maximum: 25, temp: 0 }),
      ROOM_REPLY_WAIT
    )

    await setSummonHitPoints(room, hand.actor.id, 0)
    await vi.waitFor(() => expect(summons()).toEqual([]), ROOM_REPLY_WAIT)
  }, 120000)

  it('takes the hand out of its owner’s Sheet Extras when Concentration ends (SPELLS-34.3)', async () => {
    const room = await handRoom()
    const summons = await ownerSheet(room)
    const hand = await castSummon(room, HAND_POINT)
    await vi.waitFor(
      () => expect(summons()?.map(({ id }) => id)).toEqual([hand.actor.id]),
      ROOM_REPLY_WAIT
    )

    const ended = await endConcentrationAtSheet(room, CHARACTER_ID)
    expect(ended.type, JSON.stringify(ended)).toBe('COMMAND_COMMITTED')
    await vi.waitFor(() => expect(summons()).toEqual([]), ROOM_REPLY_WAIT)
  }, 120000)
})

/**
 * SPELLS-34.T3a (D190): Find Familiar conjures the System Creature form its caster picks, as the
 * creature type picked, owned by the caster with no duration; the owner's Sheet lists it with the Run
 * actor's live hit points until it falls.
 */
describe('room Find Familiar (SPELLS-34.T3a)', () => {
  const summonOutcome = findFamiliar.effects
    ?.flatMap((effect) => effect.paths)
    .flatMap((path) => (path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []))
    .find((outcome) => outcome.effectKind === 'MANIFEST' && outcome.manifestKind === 'SUMMON')
  const catForm =
    summonOutcome?.effectKind === 'MANIFEST'
      ? summonOutcome.forms?.find((form) => form.creatureId === CREATURE_IDS.CAT)
      : undefined
  if (!catForm) throw new Error('Find Familiar must offer the Cat form.')
  const FEY = creatureTypeId('FEY')
  const familiarRoom = () =>
    actionRoom({
      actors: [casterActor(), srdCreatureActor({ id: WOLF_ID, creature: biteWolf('ATTACK') })],
      characterSpellcasting: { spells: [findFamiliar], prepared: [findFamiliar.id] },
      characterAction: (action) => action.label.startsWith(findFamiliar.label),
      formCreatures: [applyCreatureAttackRolls(cat)]
    })
  /** One square below the caster, within the spell's 10 feet. */
  const FAMILIAR_POINT = { x: 150, y: 250 }

  it('conjures the picked form as the picked creature type and lists it in its owner’s Sheet Extras with live hit points (SPELLS-34.2)', async () => {
    const room = await familiarRoom()
    const summons = await ownerSheet(room)
    const familiar = await castSummon(room, FAMILIAR_POINT, {
      formId: catForm.id,
      creatureTypeId: FEY
    })
    expect(familiar.actor).toMatchObject({
      kind: 'CREATURE',
      sourceId: CREATURE_IDS.CAT,
      label: 'Cat',
      maxHitPoints: cat.hitPoints,
      currentHitPoints: cat.hitPoints,
      owner: { ownerActorId: CHARACTER_ACTOR_ID }
    })
    const snapshotRow = await runInDurableObject(room.room.base.stub, async (_instance, context) =>
      new RoomEncounterStore(context.storage)
        .documents('encounterActorSnapshots')
        .find(({ checksum }) => checksum === familiar.actor.snapshotChecksum)
    )
    if (!snapshotRow) throw new Error('The familiar’s snapshot is not stored.')
    expect(readStoredActorSnapshot(snapshotRow)).toMatchObject({ payload: { creatureTypeId: FEY } })
    await vi.waitFor(
      () =>
        expect(summons()).toEqual([
          expect.objectContaining({
            id: familiar.actor.id,
            encounterActorId: familiar.actor.id,
            spellId: findFamiliar.id,
            displayName: 'Cat',
            concentration: false,
            size: 'TINY',
            hitPoints: { current: cat.hitPoints, maximum: cat.hitPoints, temp: 0 }
          })
        ]),
      ROOM_REPLY_WAIT
    )

    // The Run actor is the only record: the Encounter's change reaches the Sheet.
    await setSummonHitPoints(room, familiar.actor.id, 1)
    await vi.waitFor(
      () =>
        expect(summons()?.[0]?.hitPoints).toEqual({
          current: 1,
          maximum: cat.hitPoints,
          temp: 0
        }),
      ROOM_REPLY_WAIT
    )
    // It has no duration: it stays a round later, and goes when it drops to 0 hit points.
    await room.advanceTurn()
    await room.advanceTurn()
    expect(await conjured(room)).toHaveLength(1)
    await setSummonHitPoints(room, familiar.actor.id, 0)
    await vi.waitFor(() => expect(summons()).toEqual([]), ROOM_REPLY_WAIT)
  }, 120000)

  it('refuses a cast with no form, a type it does not offer, or a form a stat block summon never takes', async () => {
    const room = await familiarRoom()
    const refusedWith = async (picks: { formId?: string; creatureTypeId?: string }) => {
      const { answer } = await room.startAreaCommand({
        kind: 'POINT',
        point: FAMILIAR_POINT,
        ...picks
      })
      expect(answer.type).toBe('COMMAND_REJECTED')
      return JSON.stringify(answer)
    }

    expect(await refusedWith({ creatureTypeId: FEY })).toContain('needs one of its creature forms')
    expect(await refusedWith({ formId: catForm.id })).toContain('Pick one of the creature types')
    expect(
      await refusedWith({ formId: catForm.id, creatureTypeId: creatureTypeId('BEAST') })
    ).toContain('Pick one of the creature types')
    expect(await conjured(room)).toEqual([])

    const handRoom = await actionRoom({
      actors: [casterActor(), srdCreatureActor({ id: WOLF_ID, creature: biteWolf('ATTACK') })],
      characterPlay: { classLevel: 3 },
      characterSpellcasting: { spells: [arcaneHand], prepared: [arcaneHand.id] },
      characterAction: (action) => action.label.startsWith(arcaneHand.label)
    })
    const { answer } = await handRoom.startAreaCommand({
      kind: 'POINT',
      point: { x: 300, y: 200 },
      formId: catForm.id
    })
    expect(answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(answer)).toContain('takes no creature form')
  }, 120000)
})

/**
 * SPELLS-8.T7 (D187a): Arcane Sword is cast like Spiritual Weapon: an owned sword is conjured, and
 * the caster attacks through it once free on the cast turn. Moving it is a GM ruling.
 */
describe('room Arcane Sword (SPELLS-8.T7)', () => {
  const swordRoom = () =>
    actionRoom({
      // The attack's d20, then its three d10.
      rolls: [18, 0, 0, 0],
      fallbackRoll: 0,
      actors: [casterActor(), srdCreatureActor({ id: WOLF_ID, creature: biteWolf('ATTACK') })],
      characterPlay: { classLevel: 15 },
      characterSpellcasting: { spells: [arcaneSword], prepared: [arcaneSword.id] },
      characterAction: (action) => action.label.startsWith(arcaneSword.label)
    })

  it('conjures the sword, attacks free on the cast turn for 3d10 force, and goes when the cast is reverted', async () => {
    const room = await swordRoom()
    const cast = await room.startAreaAction({ x: 350, y: 150 })
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    const owned = async () =>
      (await readRoomHistory(room.room.base.stub)).actors
        .map((row) => readStoredRunActor(row))
        .filter((actor) => actor.owner?.ownerActorId === CHARACTER_ACTOR_ID)
    expect(await owned()).toMatchObject([{ label: 'Arcane Sword', kind: 'CUSTOM' }])

    const [offer] = (await room.actionChoices()).effectOffers
    expect(offer).toMatchObject({ kind: 'REPEAT_SOURCE_PATH', activation: 'FREE' })
    if (offer?.kind !== 'REPEAT_SOURCE_PATH') throw new Error('Expected the repeat offer.')
    const attack = await room.startAction(WOLF_ID, RANGE, null, null, offer.actionId)
    expect(attack.answer.type, JSON.stringify(attack.answer)).toBe('COMMAND_COMMITTED')
    await settlePendingAction(room)
    expect(await appliedDamage(room, attack.command.commandId)).toEqual([
      [3, damageTypeId('FORCE')]
    ])

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
  }, 120000)
})

/**
 * SPELLS-4.T2v2b (D187b): Mage Hand conjures an owned, invulnerable hand that takes no space and
 * moves as any token does; it offers no attack, and goes when its minute ends. Using it is a GM ruling.
 */
describe('room Mage Hand (SPELLS-4.T2v2b)', () => {
  const HAND_POINT = { x: 350, y: 150 }

  it('conjures the hand, moves it as a token, and takes it away at expiry', async () => {
    const room = await actionRoom({
      actors: [casterActor(), srdCreatureActor({ id: WOLF_ID, creature: biteWolf('ATTACK') })],
      characterSpellcasting: { spells: [mageHand], prepared: [mageHand.id] },
      characterAction: (action) => action.label.startsWith(mageHand.label)
    })
    const hand = await castSummon(room, HAND_POINT)
    expect(hand.actor).toMatchObject({ label: 'Mage Hand', kind: 'CUSTOM' })
    const snapshotRow = await runInDurableObject(room.room.base.stub, async (_instance, context) =>
      new RoomEncounterStore(context.storage)
        .documents('encounterActorSnapshots')
        .find(({ checksum }) => checksum === hand.actor.snapshotChecksum)
    )
    if (!snapshotRow) throw new Error('The hand’s snapshot is not stored.')
    expect(readStoredActorSnapshot(snapshotRow)).toMatchObject({
      body: { damageabilityKind: 'INVULNERABLE', occupiesSpace: false }
    })
    expect((await room.actionChoices()).effectOffers).toEqual([])

    const moved = await room.room.move(
      [HAND_POINT, { x: 350, y: 250 }],
      await room.version(),
      room.room.scene.version + 1,
      hand.tokenId
    )
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')

    // One minute is 10 rounds of the caster and the Wolf, as Spiritual Weapon's is.
    for (let turn = 0; turn < 20; turn++) await room.advanceTurn()
    expect(await conjured(room)).toHaveLength(1)
    await room.advanceTurn()
    await room.advanceTurn()
    expect(await conjured(room)).toEqual([])
  }, 120000)
})

/**
 * SPELLS-4.T2w (D187a): Faithful Hound conjures an owned, invulnerable watchdog; its barking and
 * its bite at the start of the caster's turns are a GM ruling beside the summon.
 */
describe('room Faithful Hound (SPELLS-4.T2w)', () => {
  const houndRoom = () =>
    actionRoom({
      fallbackRoll: 0,
      actors: [casterActor(), srdCreatureActor({ id: WOLF_ID, creature: biteWolf('ATTACK') })],
      characterPlay: { classLevel: 9 },
      characterSpellcasting: { spells: [faithfulHound], prepared: [faithfulHound.id] },
      characterAction: (action) => action.label.startsWith(faithfulHound.label)
    })

  async function conjured(room: ActionRoom) {
    return (await readRoomHistory(room.room.base.stub)).actors
      .map((row) => readStoredRunActor(row))
      .filter((actor) => actor.owner?.ownerActorId === CHARACTER_ACTOR_ID)
  }

  it('conjures the hound as an actor the caster owns, and takes it away when the cast is reverted', async () => {
    const room = await houndRoom()
    const cast = await room.startAreaAction({ x: 350, y: 150 })
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    expect(await conjured(room)).toMatchObject([{ label: 'Faithful Hound', kind: 'CUSTOM' }])

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await conjured(room)).toEqual([])
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

/**
 * SPELLS-4.T2n3: Goodberry leaves a carrier on the caster that holds ten berries. On a later turn
 * the caster's Action feeds one to a creature it touches, which regains 1 hit point; the last berry
 * ends the carrier.
 */
describe('room Goodberry (SPELLS-4.T2n3)', () => {
  /** The Character, who prepares `spell`, then a friendly Wolf down to 1 hit point. */
  const goodberryRoom = (spell = goodberry) =>
    actionRoom({
      actors: [
        casterActor(),
        srdCreatureActor({
          id: FIRST_ALLY_ID,
          creature: biteWolf('ATTACK'),
          currentHitPoints: 1,
          disposition: 'FRIENDLY'
        })
      ],
      characterSpellcasting: { spells: [spell], prepared: [spell.id] },
      characterAction: (action) => action.label.startsWith(spell.label)
    })

  const berriesLeft = async (room: ActionRoom) =>
    (await readRoomHistory(room.room.base.stub)).characterEffects.map(
      ({ lifecycle }) => lifecycle.remainingUses
    )

  const allyHitPoints = async (room: ActionRoom) =>
    readActorHitPoints(await readRoomHistory(room.room.base.stub), FIRST_ALLY_ID)

  /** Casts the spell, then on the caster's next turn feeds the Wolf one berry. */
  async function castAndFeed(room: ActionRoom) {
    const cast = await room.startAction(CHARACTER_ACTOR_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
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
    const feed = await room.startAction(FIRST_ALLY_ID, RANGE, null, null, offer.actionId)
    expect(feed.answer.type, JSON.stringify(feed.answer)).toBe('COMMAND_COMMITTED')
    await settlePendingAction(room)
  }

  it('holds ten berries; each one fed heals the creature 1 hit point', async () => {
    const room = await goodberryRoom()
    const cast = await room.startAction(CHARACTER_ACTOR_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    expect(await berriesLeft(room)).toEqual([10])

    const fed = await goodberryRoom()
    await castAndFeed(fed)
    expect(await allyHitPoints(fed)).toBe(2)
    expect(await berriesLeft(fed)).toEqual([9])
  }, 120000)

  it('gives the berry back when the feeding is undone', async () => {
    const room = await goodberryRoom()
    await castAndFeed(room)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await allyHitPoints(room)).toBe(1)
    expect(await berriesLeft(room)).toEqual([10])
  }, 120000)

  it('ends when its last berry is fed', async () => {
    const oneBerry = structuredClone(goodberry)
    const path = oneBerry.effects?.[0]?.paths?.[0]
    const lifecycle = path?.selectionKind === 'FIXED' ? path.resultBlock.lifecycle : undefined
    if (!lifecycle) throw new Error('Goodberry must count its berries.')
    lifecycle.uses = 1
    const room = await goodberryRoom(oneBerry)
    await castAndFeed(room)

    expect(await allyHitPoints(room)).toBe(2)
    expect(await berriesLeft(room)).toEqual([])
    expect((await room.actionChoices()).effectOffers).toEqual([])
  }, 120000)
})

/**
 * SPELLS-4.T2n3: Heroes' Feast grants each creature that partakes immunity to poison damage and to
 * being poisoned or frightened, and advantage on Wisdom saves, for 24 hours. The cure and the hit
 * point increase are a GM ruling (D181).
 */
describe("room Heroes' Feast (SPELLS-4.T2n3)", () => {
  /**
   * The Character, a friendly Wolf and a hostile Wolf whose Bite deals 3 poison damage on a failed
   * Dexterity save; every die shows its minimum, so each save fails.
   */
  async function feastRoom() {
    const poisonWolf = biteWolf('SAVE', {
      damage: 3,
      save: { ability: 'DEXTERITY', damageTypeCode: 'POISON' }
    })
    const enemy = srdCreatureActor({ id: WOLF_ID, creature: poisonWolf })
    const room = await actionRoom({
      fallbackRoll: 0,
      actors: [
        casterActor(),
        srdCreatureActor({
          id: FIRST_ALLY_ID,
          creature: biteWolf('ATTACK'),
          disposition: 'FRIENDLY'
        }),
        enemy
      ],
      // A 6th-level spell needs an 11th-level caster.
      characterPlay: { classLevel: 11 },
      characterSpellcasting: { spells: [heroesFeast], prepared: [heroesFeast.id] },
      characterAction: (action) => action.label.startsWith(heroesFeast.label)
    })
    return {
      room,
      biteActionId: room.featureActionId(enemy, creatureFeature(poisonWolf, 'Bite').id)
    }
  }

  /** On the hostile Wolf's turn, the hit points its poison Bite leaves the friendly Wolf. */
  async function allyHitPointsAfterBite({
    room,
    biteActionId
  }: Awaited<ReturnType<typeof feastRoom>>) {
    await room.advanceTurn()
    await room.advanceTurn()
    const bite = await room.startAction(FIRST_ALLY_ID, [], null, null, biteActionId, WOLF_ID)
    expect(bite.answer.type, JSON.stringify(bite.answer)).toBe('COMMAND_COMMITTED')
    await settlePendingAction(room)
    return readActorHitPoints(await readRoomHistory(room.room.base.stub), FIRST_ALLY_ID)
  }

  it('makes a creature that partakes immune to poison damage', async () => {
    const unfed = await feastRoom()
    const full = readActorHitPoints(await readRoomHistory(unfed.room.room.base.stub), FIRST_ALLY_ID)
    expect(await allyHitPointsAfterBite(unfed)).toBe(full - 3)

    const fed = await feastRoom()
    const cast = await fed.room.startActorsAction([FIRST_ALLY_ID])
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    await settlePendingAction(fed.room)
    expect(await allyHitPointsAfterBite(fed)).toBe(full)
  }, 120000)
})
