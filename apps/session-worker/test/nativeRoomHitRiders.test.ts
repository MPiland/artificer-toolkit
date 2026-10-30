import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { readEncounterEffect } from '@artificer-toolkit/encounter-persistence/effectStore'
import { effectiveHitPointMaximum } from '@artificer-toolkit/rules-runtime/character/activeEffectGrantTotals'
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

/** The Effect of the feature option labelled `option`: the exact normal or enhanced attack (D62). */
function optionEffectId(
  creature: Parameters<typeof creatureFeature>[0],
  feature: string,
  option: string
) {
  const effect = creatureFeature(creature, feature).options?.find(({ label }) => label === option)
    ?.effects?.[0]
  if (!effect) throw new Error(`The ${feature} option ${option} is missing.`)
  return effect.id
}

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
  /** The label of the feature option the GM picks (a Dryad's Shillelagh club, an enlarged Duergar pick). */
  option?: string
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
    ...(input.option && { effectId: optionEffectId(creature, input.feature, input.option) }),
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

  it('reduces the Character’s hit point maximum by the damage the Clay Golem’s Slam deals on a failed save (ATTACK-5.3)', async () => {
    // 2d10 + 5 bludgeoning with both dice rolling 1 is 7; the DC 15 Constitution save fails.
    const room = await hitRiderRoom({
      creature: 'Clay Golem',
      feature: 'Slam',
      playerAutoRoll: false,
      rolls: [18, 0, 0]
    })
    const batch = await settle(room, 1)
    expect(batch.nestedD20).toMatchObject({ defenseOrDc: 15, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.damage).toEqual([[7, damageTypeId('BLUDGEONING')]])
    expect(batch.targetTransition.after.maximumHitPoints).toBe(
      batch.targetTransition.before.maximumHitPoints - 7
    )
  })

  it('leaves the hit point maximum when the Character passes its save against the Clay Golem’s Slam (ATTACK-5.3)', async () => {
    const room = await hitRiderRoom({
      creature: 'Clay Golem',
      feature: 'Slam',
      playerAutoRoll: false,
      rolls: [18, 0, 0]
    })
    const batch = await settle(room, 19)
    expect(batch.nestedD20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
    expect(batch.targetTransition.after.maximumHitPoints).toBe(
      batch.targetTransition.before.maximumHitPoints
    )
  })

  it('attaches the Cloaker to a Large Creature its Bite hits (ATTACK-5.4)', async () => {
    // 2d6 + 3 piercing with both dice rolling 1 is 5; an Ogre is Large, so the Cloaker attaches.
    const cloaker = seededSrdCreature('Cloaker')
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: SOURCE_ID, creature: cloaker }),
        srdCreatureActor({ id: CREATURE_TARGET_ID, creature: seededSrdCreature('Ogre') })
      ],
      ownerFeatureId: creatureFeature(cloaker, 'Bite').id,
      autoRoll: 'GAME_MASTER',
      rolls: [18, 0, 0]
    })
    const { answer } = await room.startAction(CREATURE_TARGET_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await room.heldRelationships()) ?? []).toMatchObject([
      { heldActorId: CREATURE_TARGET_ID }
    ])
  })

  it.each([
    { creature: 'Dryad', feature: 'Club', option: 'Club', rolls: [18, 0], damage: 1 },
    { creature: 'Dryad', feature: 'Club', option: 'Club (Shillelagh)', rolls: [18, 0], damage: 5 },
    { creature: 'Duergar', feature: 'War Pick', option: 'War Pick', rolls: [18, 0], damage: 3 },
    {
      creature: 'Duergar',
      feature: 'War Pick',
      option: 'War Pick (Enlarged)',
      rolls: [18, 0, 0],
      damage: 4
    },
    {
      creature: 'Duergar',
      feature: 'Javelin',
      option: 'Javelin (Melee, Enlarged)',
      rolls: [18, 0, 0],
      damage: 4
    },
    {
      creature: 'Duergar',
      feature: 'Javelin',
      option: 'Javelin (Ranged, Enlarged)',
      rolls: [18, 0, 0],
      damage: 4
    }
  ])(
    'deals the $creature’s $option damage when the GM picks that option (ATTACK-5.5, 5.6, 5.7)',
    async ({ creature, feature, option, rolls, damage }) => {
      const room = await hitRiderRoom({ creature, feature, option, playerAutoRoll: true, rolls })
      const batch = await settle(room, null)
      expect(batch.damage.map(([amount]) => amount)).toEqual([damage])
    }
  )

  it('frightens the Character with the Quasit’s Scare when it fails its Wisdom save (ATTACK-5.11)', async () => {
    const room = await hitRiderRoom({
      creature: 'Quasit',
      feature: 'Scare (1/Day)',
      playerAutoRoll: false,
      rolls: []
    })
    const batch = await settle(room, 1)
    expect(batch.targetTransition.after.conditionIds).toContain(conditionId('FRIGHTENED'))
    // One active effect times the fear: 10 of the Character's turns, each ending in a repeated save.
    expect(batch.activeEffectTransitions).toMatchObject([
      { kind: 'CREATE', recurrenceStage: 'END_OF_TURN', remainingTicks: 10 }
    ])
  })

  it('poisons the Character and adds the Quasit’s poison damage when it fails its save against the Claws (ATTACK-5.10)', async () => {
    // Claws: 1d4 + 3 piercing, then DC 10 Constitution: 2d4 poison and poisoned for 1 hour on a failure.
    const room = await hitRiderRoom({
      creature: 'Quasit',
      feature: 'Claws (Bite in Beast Form)',
      playerAutoRoll: false,
      rolls: [18, 0, 0, 0]
    })
    const batch = await settle(room, 1)
    expect(batch.nestedD20).toMatchObject({ defenseOrDc: 10, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.damage).toEqual([
      [4, damageTypeId('PIERCING')],
      [2, damageTypeId('POISON')]
    ])
    expect(batch.targetTransition.after.conditionIds).toContain(conditionId('POISONED'))
  })

  it('deals only the Quasit’s piercing damage when the Character passes its save against the Claws (ATTACK-5.10)', async () => {
    const room = await hitRiderRoom({
      creature: 'Quasit',
      feature: 'Claws (Bite in Beast Form)',
      playerAutoRoll: false,
      rolls: [18, 0, 0, 0]
    })
    const batch = await settle(room, 19)
    expect(batch.nestedD20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
    expect(batch.damage).toEqual([[4, damageTypeId('PIERCING')]])
    expect(batch.targetTransition.after.conditionIds).not.toContain(conditionId('POISONED'))
  })

  it('adds the Spirit Naga’s 7d8 poison to its Bite when the Character fails its save (ATTACK-5.13)', async () => {
    const room = await hitRiderRoom({
      creature: 'Spirit Naga',
      feature: 'Bite',
      playerAutoRoll: false,
      rolls: [18, 0, 0, 0, 0, 0, 0, 0, 0]
    })
    const batch = await settle(room, 1)
    expect(batch.nestedD20).toMatchObject({ resultPath: 'ON_SAVE_FAIL' })
    expect(batch.damage).toEqual([
      [5, damageTypeId('PIERCING')],
      [7, damageTypeId('POISON')]
    ])
  })

  it('halves the Spirit Naga’s poison when the Character passes its save (ATTACK-5.13)', async () => {
    const room = await hitRiderRoom({
      creature: 'Spirit Naga',
      feature: 'Bite',
      playerAutoRoll: false,
      rolls: [18, 0, 0, 0, 0, 0, 0, 0, 0]
    })
    const batch = await settle(room, 19)
    expect(batch.nestedD20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
    expect(batch.damage).toEqual([
      [5, damageTypeId('PIERCING')],
      [3, damageTypeId('POISON')]
    ])
  })

  it('restrains the Character with the Cockatrice’s Bite when it fails its save (ATTACK-5.15)', async () => {
    const room = await hitRiderRoom({
      creature: 'Cockatrice',
      feature: 'Bite',
      playerAutoRoll: false,
      rolls: [18, 0]
    })
    const batch = await settle(room, 1)
    expect(batch.nestedD20).toMatchObject({ defenseOrDc: 11, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.targetTransition.after.conditionIds).toContain(conditionId('RESTRAINED'))
    expect(batch.activeEffectTransitions).toMatchObject([{ kind: 'CREATE' }])
  })

  it('leaves the Character free when it passes the Cockatrice’s save (ATTACK-5.15)', async () => {
    const room = await hitRiderRoom({
      creature: 'Cockatrice',
      feature: 'Bite',
      playerAutoRoll: false,
      rolls: [18, 0]
    })
    const batch = await settle(room, 19)
    expect(batch.nestedD20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
    expect(batch.targetTransition.after.conditionIds).not.toContain(conditionId('RESTRAINED'))
    expect(batch.activeEffectTransitions).toEqual([])
  })

  it('poisons the Character with the Guardian Naga’s Spit Poison, with no damage before the save (ATTACK-5.15)', async () => {
    const room = await hitRiderRoom({
      creature: 'Guardian Naga',
      feature: 'Spit Poison',
      playerAutoRoll: false,
      rolls: [18, ...Array<number>(10).fill(0)]
    })
    const batch = await settle(room, 1)
    expect(batch.nestedD20).toMatchObject({ defenseOrDc: 15, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.damage).toEqual([[10, damageTypeId('POISON')]])
  })

  it('halves the Guardian Naga’s poison when the Character passes its save (ATTACK-5.15)', async () => {
    const room = await hitRiderRoom({
      creature: 'Guardian Naga',
      feature: 'Spit Poison',
      playerAutoRoll: false,
      rolls: [18, ...Array<number>(10).fill(0)]
    })
    const batch = await settle(room, 19)
    expect(batch.nestedD20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
    expect(batch.damage).toEqual([[5, damageTypeId('POISON')]])
  })

  it('knocks the Character prone when it fails its save against the Dragon Turtle’s Tail (ATTACK-5.15)', async () => {
    const room = await hitRiderRoom({
      creature: 'Dragon Turtle',
      feature: 'Tail',
      playerAutoRoll: false,
      rolls: [18, 0, 0, 0]
    })
    const batch = await settle(room, 1)
    expect(batch.nestedD20).toMatchObject({ defenseOrDc: 20, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.targetTransition.after.conditionIds).toContain(conditionId('PRONE'))
  })

  it('leaves the Character standing when it passes the Dragon Turtle’s save (ATTACK-5.15)', async () => {
    const room = await hitRiderRoom({
      creature: 'Dragon Turtle',
      feature: 'Tail',
      playerAutoRoll: false,
      rolls: [18, 0, 0, 0]
    })
    const batch = await settle(room, 19)
    expect(batch.nestedD20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
    expect(batch.targetTransition.after.conditionIds).not.toContain(conditionId('PRONE'))
  })

  it('drains the Character’s Strength with the Shadow’s Strength Drain (ATTACK-5.12)', async () => {
    const room = await hitRiderRoom({
      creature: 'Shadow',
      feature: 'Strength Drain',
      playerAutoRoll: true,
      rolls: [18, 0, 0, 3]
    })
    const batch = await settle(room, null)
    expect(batch.damage).toEqual([[4, damageTypeId('NECROTIC')]])
    expect(batch.applications).toContainEqual(
      expect.objectContaining({ kind: 'SCALAR_REDUCTION', reductionAmount: 4 })
    )
  })

  it('grapples, restrains and blinds a Medium Character with the Rug of Smothering (ATTACK-5.14)', async () => {
    const room = await hitRiderRoom({
      creature: 'Rug of Smothering',
      feature: 'Smother',
      playerAutoRoll: true,
      rolls: [18]
    })
    const batch = await settle(room, null)
    expect(batch.targetTransition.after.conditionIds).toEqual(
      expect.arrayContaining([
        conditionId('GRAPPLED'),
        conditionId('RESTRAINED'),
        conditionId('BLINDED')
      ])
    )
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

  it('hits with the Ogre Zombie’s Morningstar for its printed bludgeoning damage (ATTACK-5.T4a)', async () => {
    // The first die is the Ogre Zombie's own Undead Fortitude save, rolled when it is prepared.
    const room = await hitRiderRoom({
      creature: 'Ogre Zombie',
      feature: 'Morningstar',
      playerAutoRoll: true,
      rolls: [0, 18, 0, 0]
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

  it('poisons the Character and knocks it unconscious when it fails its save against the Couatl’s Bite, beside the poison ruling (SPELLS-33.T6m2)', async () => {
    // 1d6 + 5 piercing with the die rolling 1; the Character's save fails.
    const room = await hitRiderRoom({
      creature: 'Couatl',
      feature: 'Bite',
      playerAutoRoll: false,
      rolls: [18, 0]
    })
    const batch = await settle(room, 1)
    expect(batch.nestedD20).toMatchObject({ defenseOrDc: 13, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.damage).toEqual([[6, damageTypeId('PIERCING')]])
    expect(batch.targetTransition.after.conditionIds).toEqual(
      expect.arrayContaining([conditionId('POISONED'), conditionId('UNCONSCIOUS')])
    )
  })

  it('deals the Horned Devil’s Tail damage and fails the Character’s save into the infernal wound ruling (ATTACK-5.T4)', async () => {
    // 1d8 + 6 piercing with the die rolling 1; the Character's DC 17 Constitution save fails.
    const room = await hitRiderRoom({
      creature: 'Horned Devil',
      feature: 'Tail',
      playerAutoRoll: false,
      rolls: [18, 0]
    })
    const batch = await settle(room, 1)
    expect(batch.nestedD20).toMatchObject({ defenseOrDc: 17, resultPath: 'ON_SAVE_FAIL' })
    expect(batch.damage).toEqual([[7, damageTypeId('PIERCING')]])
  })

  it('grapples and restrains the Character with the Roper’s Tendril beside the Strength ruling, dealing no damage (ATTACK-5.T4)', async () => {
    const room = await hitRiderRoom({
      creature: 'Roper',
      feature: 'Tendril',
      playerAutoRoll: true,
      rolls: [18]
    })
    const batch = await settle(room, null)
    expect(batch.damage).toEqual([])
    expect(batch.targetTransition.after.conditionIds).toEqual(
      expect.arrayContaining([conditionId('GRAPPLED'), conditionId('RESTRAINED')])
    )
  })

  it('deals the Wereboar’s Tusks damage beside the curse ruling ahead of its Charge save (ATTACK-5.T4w)', async () => {
    // 2d6 + 3 slashing with both dice rolling 1; with no charge measured, the Charge save is not owed.
    const room = await hitRiderRoom({
      creature: 'Wereboar',
      feature: 'Tusks (Boar or Hybrid Form Only)',
      playerAutoRoll: true,
      rolls: [18, 0, 0]
    })
    const batch = await settle(room, null)
    expect(batch.nestedD20).toBeNull()
    expect(batch.damage).toEqual([[5, damageTypeId('SLASHING')]])
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

  it('drains a Creature’s hit point maximum through the reduction effect it holds, not its stored maximum (SPELLS-8.T16)', async () => {
    // A natural 19 hits for 1d6 + 2 necrotic, the die rolling 4; the Ogre's save rolls a natural 1.
    const wight = seededSrdCreature('Wight')
    const ogre = seededSrdCreature('Ogre')
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: SOURCE_ID, creature: wight }),
        srdCreatureActor({ id: CREATURE_TARGET_ID, creature: ogre })
      ],
      ownerFeatureId: creatureFeature(wight, 'Life Drain').id,
      autoRoll: 'GAME_MASTER',
      rolls: [18, 3, 0]
    })
    const { answer } = await room.startAction(CREATURE_TARGET_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const { actors, activeEffects } = await readRoomHistory(room.room.base.stub)
    const row = actors.find(({ id }) => id === CREATURE_TARGET_ID)
    if (!row) throw new Error('The Ogre is missing from the Run.')
    const target = readStoredRunActor(row)
    if (target.kind !== 'CREATURE') throw new Error('Expected the Ogre Creature actor.')
    expect(target).toMatchObject({
      maxHitPoints: ogre.hitPoints,
      currentHitPoints: ogre.hitPoints - 6
    })
    const effects = activeEffects.map(readEncounterEffect)
    expect(effects.flatMap(({ definition }) => definition.stateContributions)).toEqual([
      expect.objectContaining({ kind: 'HIT_POINT_MAXIMUM_REDUCTION', amount: 6 })
    ])
    expect(effectiveHitPointMaximum(target.maxHitPoints, effects)).toBe(ogre.hitPoints - 6)
  })

  it('grapples and restrains the Character with the Chain Devil’s Chain, holding 2d6 piercing for each of its turns (SPELLS-33.T6a3)', async () => {
    // 2d6 + 4 slashing with both dice rolling 1; the hold recurs at the start of the target's turns.
    const room = await hitRiderRoom({
      creature: 'Chain Devil',
      feature: 'Chain',
      playerAutoRoll: true,
      rolls: [18, 0, 0]
    })
    const batch = await settle(room, null)
    expect(batch.damage).toEqual([[6, damageTypeId('SLASHING')]])
    expect(batch.targetTransition.after.conditionIds).toEqual(
      expect.arrayContaining([conditionId('GRAPPLED'), conditionId('RESTRAINED')])
    )
    expect(batch.activeEffectTransitions).toMatchObject([
      { kind: 'CREATE', recurrenceStage: 'START_OF_TURN' }
    ])
  })

  it('grapples and restrains a Medium Character with the Marilith’s Tail beside the auto-hit ruling (SPELLS-33.T6a3)', async () => {
    // 2d10 + 4 bludgeoning with both dice rolling 1.
    const room = await hitRiderRoom({
      creature: 'Marilith',
      feature: 'Tail',
      playerAutoRoll: true,
      rolls: [18, 0, 0]
    })
    const batch = await settle(room, null)
    expect(batch.damage).toEqual([[6, damageTypeId('BLUDGEONING')]])
    expect(batch.targetTransition.after.conditionIds).toEqual(
      expect.arrayContaining([conditionId('GRAPPLED'), conditionId('RESTRAINED')])
    )
  })

  it('attaches the Stirge to the Character its Blood Drain hits, beside the drain ruling (SPELLS-33.T6a3)', async () => {
    // 1d4 + 3 piercing with the die rolling 1.
    const room = await hitRiderRoom({
      creature: 'Stirge',
      feature: 'Blood Drain',
      playerAutoRoll: true,
      rolls: [18, 0]
    })
    const batch = await settle(room, null)
    expect(batch.damage).toEqual([[4, damageTypeId('PIERCING')]])
    expect(batch.activeEffectTransitions).toMatchObject([{ kind: 'CREATE' }])
  })

  it('poisons and paralyzes only a creature the Chuul holds with its Tentacles (SPELLS-33.T6a3)', async () => {
    // Pincer hits (2d6 + 4) and grapples the Large Ogre; it then fails the DC 13 Constitution save.
    const chuul = seededSrdCreature('Chuul')
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: SOURCE_ID, creature: chuul }),
        srdCreatureActor({ id: CREATURE_TARGET_ID, creature: seededSrdCreature('Ogre') })
      ],
      ownerFeatureId: creatureFeature(chuul, 'Pincer').id,
      autoRoll: 'GAME_MASTER',
      rolls: [18, 0, 0, 0]
    })
    const tentacles = (await room.actionChoices()).actions.find(
      ({ label }) => label === 'Tentacles'
    )
    if (!tentacles) throw new Error('The Chuul offers no Tentacles.')
    expect(tentacles.target).toMatchObject({ kind: 'ACTOR', heldBySource: true })
    const refused = await room.startAction(
      CREATURE_TARGET_ID,
      ['TARGET_RANGE_UNCHECKED'],
      null,
      null,
      tentacles.id
    )
    expect(refused.answer.type).not.toBe('COMMAND_COMMITTED')

    const pincer = await room.startAction(CREATURE_TARGET_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(pincer.answer.type, JSON.stringify(pincer.answer)).toBe('COMMAND_COMMITTED')
    const poisoned = await room.startAction(
      CREATURE_TARGET_ID,
      ['TARGET_RANGE_UNCHECKED'],
      null,
      null,
      tentacles.id
    )
    expect(poisoned.answer.type, JSON.stringify(poisoned.answer)).toBe('COMMAND_COMMITTED')
    const { actors } = await readRoomHistory(room.room.base.stub)
    const row = actors.find(({ id }) => id === CREATURE_TARGET_ID)
    if (!row) throw new Error('The Ogre is missing from the Run.')
    const target = readStoredRunActor(row)
    if (target.kind !== 'CREATURE') throw new Error('Expected the Ogre Creature actor.')
    expect(readEncounterActorConditionState(target.conditions).ids).toEqual(
      expect.arrayContaining([
        conditionId('GRAPPLED'),
        conditionId('POISONED'),
        conditionId('PARALYZED')
      ])
    )
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
