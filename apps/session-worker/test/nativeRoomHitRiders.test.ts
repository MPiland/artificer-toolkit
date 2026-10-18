import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { readEncounterActorConditionState } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomHistory,
  readRoomRollCards
} from './roomHistoryReads.js'
import { seededSrdCreature } from './seededSrdCreature.js'

const SOURCE_ID = testUuid(0x700)
const CHARACTER_ACTOR_ID = testUuid(0x701)
const CHARACTER_ID = testUuid(0x702)
const CREATURE_TARGET_ID = testUuid(0x703)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

function srdId(entries: readonly { id: string; code: string }[], code: string) {
  const entry = entries.find((candidate) => candidate.code === code)
  if (!entry) throw new Error(`The SRD ${code} is missing.`)
  return entry.id
}
const conditionId = (code: string) => srdId(SRD_CONDITION_TYPES, code)
const damageTypeId = (code: string) => srdId(SRD_DAMAGE_TYPES, code)

/**
 * The seeded SRD Creature `creature` attacking the player's Character with `feature`. The GM
 * rolls the Creature's dice automatically; `playerAutoRoll` also auto-rolls the Character's saves,
 * which otherwise wait on its player. `rolls` are the room's dice, zero-based, in request order.
 */
function hitRiderRoom(input: {
  creature: string
  feature: string
  playerAutoRoll: boolean
  rolls: readonly number[]
  /** The grip of a versatile weapon attack, which is its own action. */
  grip?: 'ONE_HANDED' | 'TWO_HANDED'
  /** The Creature's current hit points, when not its maximum. */
  creatureHitPoints?: number
}) {
  const creature = seededSrdCreature(input.creature)
  return actionRoom({
    actors: [
      srdCreatureActor({
        id: SOURCE_ID,
        creature,
        currentHitPoints: input.creatureHitPoints
      }),
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
    ],
    ownerFeatureId: creatureFeature(creature, input.feature).id,
    grip: input.grip,
    autoRoll: input.playerAutoRoll ? 'BOTH' : 'GAME_MASTER',
    rolls: input.rolls
  })
}

type HitRiderRoom = Awaited<ReturnType<typeof hitRiderRoom>>

/** The settled action's Character mechanics receipt, as the room alone holds it (D85). */
async function settledBatch(room: HitRiderRoom, commandId: string) {
  const { receipts } = await readRoomHistory(room.room.base.stub)
  const receipt = receipts.find((row) => row.commandId === commandId)
  if (!receipt) throw new Error('The SRD attack receipt is missing.')
  const result = parseReceiptExecution(receipt)
  if (
    result.status !== 'COMPLETE' ||
    result.applicationOutputs.kind !== 'CHARACTER_MECHANICS_BATCH'
  )
    throw new Error('Expected a Character mechanics receipt.')
  const batch = result.applicationOutputs
  return {
    ...batch,
    damage: batch.applications.flatMap((application) =>
      application.kind === 'DAMAGE' ? [[application.requestedAmount, application.damageTypeId]] : []
    )
  }
}

/** Starts the attack; with a waiting save, answers it with a natural `saveFace`. */
async function settle(room: HitRiderRoom, saveFace: number | null) {
  // A printed reach can't be measured without a Scene context, so the GM acknowledges it (D11).
  const { command, answer } = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  if (saveFace !== null) {
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE')
      throw new Error('Expected the Character’s save prompt.')
    expect(decision.pending.rollerActorId).toBe(CHARACTER_ACTOR_ID)
    const { request } = decision.pending
    const resolved = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: request.rollMode === 'NORMAL' ? [saveFace] : [saveFace, saveFace],
      rollMode: request.rollMode
    })
    expect(resolved.type).toBe('COMMAND_COMMITTED')
  }
  await expect(readPendingActionDecision(room.room.base.stub)).resolves.toBeNull()
  return settledBatch(room, command.commandId)
}

describe('seeded SRD Creature hit riders in the room', () => {
  it('deals both damage parts of the Hell Hound’s Bite on one hit', async () => {
    // A natural 19 hits; every damage die rolls 1: 1 + 3 piercing and 1 + 1 fire.
    const room = await hitRiderRoom({
      creature: 'Hell Hound',
      feature: 'Bite',
      playerAutoRoll: true,
      rolls: [18, 0, 0, 0]
    })
    const batch = await settle(room, null)
    expect(batch.d20).toMatchObject({ selectedNatural: 19, resultPath: 'ON_HIT' })
    expect(batch.damage).toEqual([
      [4, damageTypeId('PIERCING')],
      [2, damageTypeId('FIRE')]
    ])
  })

  it('labels the roll cards of a Creature feature action by the action the Worker planned (D150)', async () => {
    // The action id is compound (`<actor>:FEATURE:<feature>:EFFECT:<effect>`); no content label
    // lookup can read it, so the card names the planned action, never a generic "Action".
    const room = await hitRiderRoom({
      creature: 'Hell Hound',
      feature: 'Bite',
      playerAutoRoll: true,
      rolls: [18, 0, 0, 0]
    })
    expect(room.actionId).toMatch(/:FEATURE:.+:EFFECT:/)
    await settle(room, null)
    const labels = (await readRoomRollCards(room.room.base.stub)).map(
      ({ roll }) => roll.source.label
    )
    expect(labels[0]).toBe('Bite')
    expect(labels.slice(1).every((label) => label.startsWith('Bite: '))).toBe(true)
    expect(labels).toHaveLength(3)
  })

  it('rolls every damage die of the Hell Hound’s Bite twice on a critical hit', async () => {
    // A natural 20: 2d8 + 3 piercing and 4d6 fire, every die rolling 1.
    const room = await hitRiderRoom({
      creature: 'Hell Hound',
      feature: 'Bite',
      playerAutoRoll: true,
      rolls: [19, 0, 0, 0, 0, 0, 0]
    })
    const batch = await settle(room, null)
    expect(batch.d20).toMatchObject({ selectedNatural: 20, resultPath: 'ON_CRIT' })
    expect(batch.damage).toEqual([
      [2 + 3, damageTypeId('PIERCING')],
      [4, damageTypeId('FIRE')]
    ])
  })

  it('routes the Giant Spider’s poison save to the Character’s player, then halves on a success', async () => {
    // The GM auto-rolls the hit and its piercing damage; a natural 20 saves against DC 11 and the
    // poison dice roll 2 and 2, halved to 2.
    const room = await hitRiderRoom({
      creature: 'Giant Spider',
      feature: 'Bite',
      playerAutoRoll: false,
      rolls: [18, 0, 1, 1]
    })
    const batch = await settle(room, 20)
    expect(batch.nestedD20).toMatchObject({
      selectedNatural: 20,
      defenseOrDc: 11,
      resultPath: 'ON_SAVE_SUCCESS'
    })
    expect(batch.damage).toEqual([
      [4, damageTypeId('PIERCING')],
      [2, damageTypeId('POISON')]
    ])
  })

  it('auto-rolls the Character’s save when its player auto-rolls, taking full poison on a failure', async () => {
    // Hit, 1 + 3 piercing, then a natural 1 fails the save: 1 + 1 poison.
    const room = await hitRiderRoom({
      creature: 'Giant Spider',
      feature: 'Bite',
      playerAutoRoll: true,
      rolls: [18, 0, 0, 0, 0]
    })
    const batch = await settle(room, null)
    expect(batch.nestedD20).toMatchObject({ selectedNatural: 1, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.damage).toEqual([
      [4, damageTypeId('PIERCING')],
      [2, damageTypeId('POISON')]
    ])
  })

  it('knocks the Character prone when it fails its save against the Mastiff’s Bite', async () => {
    const room = await hitRiderRoom({
      creature: 'Mastiff',
      feature: 'Bite',
      playerAutoRoll: false,
      rolls: [18, 0]
    })
    const batch = await settle(room, 1)
    expect(batch.nestedD20).toMatchObject({ defenseOrDc: 11, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.targetTransition.after.conditionIds).toContain(conditionId('PRONE'))
  })

  it('deals the Spider’s poison only when the Character fails its save', async () => {
    // A natural 19 hits for a fixed 1 piercing; the failed save's poison die rolls 3.
    const room = await hitRiderRoom({
      creature: 'Spider',
      feature: 'Bite',
      playerAutoRoll: false,
      rolls: [18, 2]
    })
    const batch = await settle(room, 1)
    expect(batch.nestedD20).toMatchObject({ defenseOrDc: 9, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.damage).toEqual([
      [1, damageTypeId('PIERCING')],
      [3, damageTypeId('POISON')]
    ])
  })

  it('paralyzes the Character with a repeating save when it fails against the Ghoul’s Claws', async () => {
    const room = await hitRiderRoom({
      creature: 'Ghoul',
      feature: 'Claws',
      playerAutoRoll: false,
      rolls: [18, 0, 0]
    })
    const batch = await settle(room, 1)
    expect(batch.nestedD20).toMatchObject({ defenseOrDc: 10, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.targetTransition.after.conditionIds).toContain(conditionId('PARALYZED'))
    expect(batch.activeEffectTransitions).toMatchObject([{ kind: 'CREATE' }])
  })

  it('drains the Character’s hit point maximum with the Wight’s Life Drain until a long rest (D62)', async () => {
    // A natural 19 hits for 1d6 + 2 necrotic, the die rolling 4; the Character's save fails.
    const room = await hitRiderRoom({
      creature: 'Wight',
      feature: 'Life Drain',
      playerAutoRoll: false,
      rolls: [18, 3]
    })
    const batch = await settle(room, 1)
    expect(batch.nestedD20).toMatchObject({ defenseOrDc: 13, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.damage).toEqual([[6, damageTypeId('NECROTIC')]])
    expect(batch.targetTransition.after.maximumHitPoints).toBe(
      batch.targetTransition.before.maximumHitPoints - 6
    )
    expect(batch.applications).toContainEqual(
      expect.objectContaining({
        kind: 'HIT_POINT_MAXIMUM_REDUCTION',
        reductionAmount: 6,
        recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM', 'LONG_REST']
      })
    )
    // The attack's Feature label is frozen onto the Character's reduction, held in the room.
    const { characterEffects } = await readRoomHistory(room.room.base.stub)
    expect(characterEffects).toHaveLength(1)
    expect(JSON.parse(characterEffects[0]!.definitionJson)).toMatchObject({
      stateContributions: [
        expect.objectContaining({
          kind: 'HIT_POINT_MAXIMUM_REDUCTION',
          sourceLabel: 'Life Drain',
          sourceHidden: false
        })
      ]
    })
  })

  it('hits with the Aboleth’s Tentacle', async () => {
    // A natural 19 hits; 2d6 + 5 bludgeoning with both dice rolling 1.
    const room = await hitRiderRoom({
      creature: 'Aboleth',
      feature: 'Tentacle',
      playerAutoRoll: true,
      rolls: [18, 0, 0]
    })
    const batch = await settle(room, null)
    expect(batch.d20).toMatchObject({ selectedNatural: 19, resultPath: 'ON_HIT' })
    expect(batch.damage).toEqual([[7, damageTypeId('BLUDGEONING')]])
  })

  it('hits with the Swarm of Ravens’ Beaks, which add no ability modifier', async () => {
    const room = await hitRiderRoom({
      creature: 'Swarm of Ravens',
      feature: 'Beaks',
      playerAutoRoll: true,
      rolls: [18, 0, 0]
    })
    expect((await settle(room, null)).damage).toEqual([[2, damageTypeId('PIERCING')]])
  })

  it.each([
    { label: 'full dice above half its hit points', hitPoints: 13, rolls: [18, 2, 3], damage: 7 },
    { label: 'half dice at half its hit points or fewer', hitPoints: 12, rolls: [18, 2], damage: 3 }
  ])('bites with the Swarm of Rats for $label', async ({ hitPoints, rolls, damage }) => {
    const room = await hitRiderRoom({
      creature: 'Swarm of Rats',
      feature: 'Bites',
      playerAutoRoll: true,
      rolls,
      creatureHitPoints: hitPoints
    })
    expect((await settle(room, null)).damage).toEqual([[damage, damageTypeId('PIERCING')]])
  })

  it('hits with the Ogre’s Greatclub for its printed damage through its held Equipment', async () => {
    // 2d8 + 4 bludgeoning (the Equipment alone deals 1d8) with both dice rolling 1.
    const room = await hitRiderRoom({
      creature: 'Ogre',
      feature: 'Greatclub',
      playerAutoRoll: true,
      rolls: [18, 0, 0]
    })
    expect((await settle(room, null)).damage).toEqual([[6, damageTypeId('BLUDGEONING')]])
  })

  it('grapples and restrains the Character with one hit of the Giant Toad’s Bite', async () => {
    const room = await hitRiderRoom({
      creature: 'Giant Toad',
      feature: 'Bite',
      playerAutoRoll: true,
      rolls: [18, 0, 0]
    })
    const batch = await settle(room, null)
    expect(batch.damage).toEqual([
      [3, damageTypeId('PIERCING')],
      [1, damageTypeId('POISON')]
    ])
    expect(batch.targetTransition.after.conditionIds).toEqual(
      expect.arrayContaining([conditionId('GRAPPLED'), conditionId('RESTRAINED')])
    )
  })

  it('grapples and restrains a Creature with one hit of the Giant Toad’s Bite, held by one relationship effect', async () => {
    const toad = seededSrdCreature('Giant Toad')
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: SOURCE_ID, creature: toad }),
        srdCreatureActor({ id: CREATURE_TARGET_ID, creature: seededSrdCreature('Ogre') })
      ],
      ownerFeatureId: creatureFeature(toad, 'Bite').id,
      autoRoll: 'GAME_MASTER',
      rolls: [18, 0, 0]
    })
    const { answer } = await room.startAction(CREATURE_TARGET_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const { actors, activeEffects } = await readRoomHistory(room.room.base.stub)
    const row = actors.find(({ id }) => id === CREATURE_TARGET_ID)
    if (!row) throw new Error('The Ogre is missing from the Run.')
    const target = readStoredRunActor(row)
    if (target.kind !== 'CREATURE') throw new Error('Expected the Ogre Creature actor.')
    expect(readEncounterActorConditionState(target.conditions).ids.sort()).toEqual(
      [conditionId('GRAPPLED'), conditionId('RESTRAINED')].sort()
    )
    expect(activeEffects).toHaveLength(1)
  })

  it('poisons the Character for 1 minute when it fails its save against the Homunculus’s Bite', async () => {
    const room = await hitRiderRoom({
      creature: 'Homunculus',
      feature: 'Bite',
      playerAutoRoll: false,
      rolls: [18]
    })
    const batch = await settle(room, 1)
    expect(batch.nestedD20).toMatchObject({ defenseOrDc: 10, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.targetTransition.after.conditionIds).toContain(conditionId('POISONED'))
    // One active effect times the poison: 10 of the Character's turns, with no repeated save.
    expect(batch.activeEffectTransitions).toMatchObject([
      { kind: 'CREATE', recurrenceStage: 'END_OF_TURN', remainingTicks: 10 }
    ])
  })

  it('resolves the Erinyes’ two-handed Longsword with the d10 grip', async () => {
    // The two-handed d10 rolls 10 (a d8 could not): 10 + 4 slashing, then 3d8 poison rolling 1s.
    // The one- and two-handed choice list itself is the Convex action-choices query's (apis test).
    const room = await hitRiderRoom({
      creature: 'Erinyes',
      feature: 'Longsword',
      grip: 'TWO_HANDED',
      playerAutoRoll: true,
      rolls: [18, 9, 0, 0, 0]
    })
    expect((await settle(room, null)).damage).toEqual([
      [14, damageTypeId('SLASHING')],
      [3, damageTypeId('POISON')]
    ])
  })
})
