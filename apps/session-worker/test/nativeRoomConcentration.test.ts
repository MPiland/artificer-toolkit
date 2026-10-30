import {
  characterActor,
  creatureFeature,
  installedSrdCreature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { blackDragonWyrmling } from '@artificer-toolkit/source-data/srd/creatures/black-dragon-wyrmling.js'
import { giantApe } from '@artificer-toolkit/source-data/srd/creatures/giant-ape.js'
import { resistance } from '@artificer-toolkit/source-data/srd/spells/resistance.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { characterInForm } from './characterFormFixture.js'
import { closeTrackedSockets, connectPlayer } from './liveRoomFixture.js'
import { heldSaveDieEffect, seedModifierGrant } from './grantSeed.js'
import { dependentEffectDefinition } from './movementRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomChatBodies,
  readRoomHistory,
  readRoomPrivateRollHolders,
  type RoomHistory
} from './roomHistoryReads.js'

const ATTACKER_ID = testUuid(0x800)
const CHARACTER_ACTOR_ID = testUuid(0x801)
const CHARACTER_ID = testUuid(0x802)
const DEPENDENT_HOLDER_ID = testUuid(0x803)
const INDEPENDENT_EFFECT_ID = testUuid(0x5300)
const HOLDER_ID = testUuid(0x804)
const HELD_DIE_ID = testUuid(0x5301)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A Wolf hits the Character, who maintains Concentration (the maintained state, with one dependent
 * effect on another Wolf and one independent effect that outlives it). `autoRoll` BOTH makes the
 * Character's player roll its Constitution save on the server; GAME_MASTER leaves it a prompt. With
 * `form`, the Character wears that form, its holding effect seeded with the rest.
 */
function concentratingRoom(
  options: Pick<
    Parameters<typeof actionRoom>[0],
    'autoRoll' | 'automationMode' | 'rolls' | 'characterPlay'
  >,
  form?: ReturnType<typeof characterInForm>
) {
  const attacker = biteWolf('ATTACK')
  return actionRoom({
    ...options,
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
      form?.actor ?? characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
      srdCreatureActor({ id: DEPENDENT_HOLDER_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    concentration: true,
    concentrationOwnerActorId: CHARACTER_ACTOR_ID,
    concentrationDependentActorIds: [DEPENDENT_HOLDER_ID],
    seed: async (input) => {
      const { effects, encounterId, occurredAt } = input
      await form?.seed(input)
      await effects.create({
        id: INDEPENDENT_EFFECT_ID,
        owner: {
          kind: 'ENCOUNTER_ACTOR',
          encounterId,
          targetActorId: DEPENDENT_HOLDER_ID
        },
        lifecycle: { schemaVersion: 1, remainingTicks: 3 },
        definition: dependentEffectDefinition({
          encounterId,
          sourceActorId: DEPENDENT_HOLDER_ID
        }),
        occurredAt
      })
    }
  })
}

type ConcentratingRoom = Awaited<ReturnType<typeof concentratingRoom>>

const effectIds = (history: RoomHistory) => history.activeEffects.map((effect) => effect.id)

/** The room's Concentration check outputs, one per check the Run settled. */
function concentrationChecks(history: RoomHistory) {
  return history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK'
      ? [execution.applicationOutputs]
      : []
  })
}

/** The attacker's Bite on the Character: a settled parent action and its Character batch. */
async function startedBite(room: ConcentratingRoom) {
  const { command, answer } = await room.startAction(CHARACTER_ACTOR_ID)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const parent = (await readRoomHistory(room.room.base.stub)).receipts.find(
    (receipt) => receipt.commandId === command.commandId
  )
  if (!parent) throw new Error('The parent action receipt is missing.')
  const execution = parseReceiptExecution(parent)
  if (execution.status !== 'COMPLETE') throw new Error('The parent action did not complete.')
  expect(execution.applicationOutputs.kind).toBe('CHARACTER_MECHANICS_BATCH')
}

describe('room Concentration checks', () => {
  it('pauses on the Character’s player and keeps the Concentration on a successful save', async () => {
    // The Wolf's attack die shows 19 and hits for 1 damage.
    const room = await concentratingRoom({
      autoRoll: 'GAME_MASTER',
      rolls: [18]
    })
    const before = await readRoomHistory(room.room.base.stub)
    expect(before.maintainedStates).toHaveLength(1)
    await startedBite(room)

    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a concentration save.')
    expect(decision.pending).toMatchObject({
      rollerActorId: CHARACTER_ACTOR_ID,
      request: { min: 1, max: 20, rollMode: 'NORMAL' }
    })
    expect(concentrationChecks(await readRoomHistory(room.room.base.stub))).toEqual([])

    const { request } = decision.pending
    const answer = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [20],
      rollMode: request.rollMode
    })
    expect(answer.type).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationChecks(after)).toMatchObject([{ outcome: 'SAVE_SUCCESS' }])
    expect(after.maintainedStates.map((state) => state.id)).toEqual(
      before.maintainedStates.map((state) => state.id)
    )
    expect(effectIds(after)).toEqual(expect.arrayContaining(effectIds(before)))
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('ends the exact Concentration and its dependent effect on a failed save, keeping an independent one', async () => {
    const room = await concentratingRoom({
      autoRoll: 'GAME_MASTER',
      rolls: [18]
    })
    const before = await readRoomHistory(room.room.base.stub)
    const [dependentId] = room.room.dependentEffectIds
    expect(effectIds(before)).toEqual(expect.arrayContaining([dependentId, INDEPENDENT_EFFECT_ID]))
    await startedBite(room)

    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a concentration save.')
    const { request } = decision.pending
    const answer = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [1],
      rollMode: request.rollMode
    })
    expect(answer.type).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationChecks(after)).toMatchObject([{ outcome: 'SAVE_FAILURE' }])
    expect(after.maintainedStates).toEqual([])
    expect(effectIds(after)).toEqual([INDEPENDENT_EFFECT_ID])
    expect(after.runs[0]!.version).toBeGreaterThan(before.runs[0]!.version)
  })

  it.each([
    { face: 20, outcome: 'SAVE_SUCCESS' as const, kept: true },
    { face: 1, outcome: 'SAVE_FAILURE' as const, kept: false }
  ])(
    'settles an auto-rolled Concentration save atomically for $outcome',
    async ({ face, outcome, kept }) => {
      // The attack die shows 19; the Character's player auto-rolls the save die.
      const room = await concentratingRoom({
        autoRoll: 'BOTH',
        rolls: [18, face - 1]
      })
      const [dependentId] = room.room.dependentEffectIds
      await startedBite(room)
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      const after = await readRoomHistory(room.room.base.stub)
      expect(concentrationChecks(after)).toMatchObject([{ outcome }])
      expect(after.maintainedStates).toHaveLength(kept ? 1 : 0)
      expect(effectIds(after).includes(dependentId!)).toBe(kept)
      expect(effectIds(after)).toContain(INDEPENDENT_EFFECT_ID)
    }
  )

  it('raises no Concentration check when the finalized applied damage is zero', async () => {
    // The Character is already at 0 hit points, so the Wolf's hit applies no damage.
    const room = await concentratingRoom({
      autoRoll: 'GAME_MASTER',
      rolls: [18],
      characterPlay: { currentHitPoints: 0 }
    })
    const before = await readRoomHistory(room.room.base.stub)
    await startedBite(room)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationChecks(after)).toEqual([])
    expect(after.maintainedStates.map((state) => state.id)).toEqual(
      before.maintainedStates.map((state) => state.id)
    )
  })

  it('raises no Concentration prompt in a Manual Run, where the damaging action is refused whole', async () => {
    const room = await concentratingRoom({ automationMode: 'MANUAL' })
    const before = await readRoomHistory(room.room.base.stub)
    const { answer } = await room.startAction(CHARACTER_ACTOR_ID)
    expect(answer.type).toBe('COMMAND_REJECTED')
    expect(await readRoomHistory(room.room.base.stub)).toEqual(before)
    expect(before.maintainedStates).toHaveLength(1)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })
})

const conditionId = (code: string) => {
  const condition = srdSystemRecord.conditionTypes.find((candidate) => candidate.code === code)
  if (!condition) throw new Error(`The SRD ${code} condition is missing.`)
  return condition.id
}

/** A Creature holds the Concentration the Wolf's Bite then hits (with a dependent effect on a second Wolf). */
function creatureHolderRoom(
  holder: Pick<Parameters<typeof srdCreatureActor>[0], 'conditionIds' | 'currentHitPoints'> & {
    hidden?: boolean
    rolls?: number[]
    creature?: Parameters<typeof srdCreatureActor>[0]['creature']
    seed?: Parameters<typeof actionRoom>[0]['seed']
    /** The Bite's damage, and whether massive damage is on: a second save in the same chain. */
    biteDamage?: number
    massiveDamage?: true
    autoRoll?: 'GAME_MASTER' | 'BOTH'
  }
) {
  const {
    hidden,
    rolls = [18],
    creature = plainWolf,
    seed,
    biteDamage,
    massiveDamage,
    autoRoll = 'GAME_MASTER',
    ...holderOptions
  } = holder
  const attacker = biteWolf('ATTACK', biteDamage === undefined ? {} : { damage: biteDamage })
  return actionRoom({
    autoRoll,
    rolls,
    seed,
    optionalCombatKinds: massiveDamage ? ['MASSIVE_DAMAGE'] : [],
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
      {
        ...srdCreatureActor({ id: HOLDER_ID, creature, ...holderOptions }),
        public: !hidden
      },
      srdCreatureActor({ id: DEPENDENT_HOLDER_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    concentration: true,
    concentrationOwnerActorId: HOLDER_ID,
    concentrationDependentActorIds: [DEPENDENT_HOLDER_ID]
  })
}

/** The Concentration end children (D95) the room recorded, one receipt each. */
function concentrationEnds(history: RoomHistory) {
  return history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return receipt.commandType === 'CONCENTRATION_END' &&
      execution.status === 'AGGREGATE_CHOICE_COMPLETE' &&
      execution.applicationOutputs.kind === 'CONCENTRATION_END'
      ? [{ receipt, output: execution.applicationOutputs }]
      : []
  })
}

describe('room Concentration ends without a check (D95)', () => {
  it('ends a Character’s Concentration when the hit drops it to 0 hit points, rolling and prompting nothing', async () => {
    // The Wolf's hit deals 1 damage to a Character on 1 hit point, who falls Unconscious.
    const room = await concentratingRoom({
      autoRoll: 'GAME_MASTER',
      rolls: [18],
      characterPlay: { currentHitPoints: 1 }
    })
    const [dependentId] = room.room.dependentEffectIds
    const before = await readRoomHistory(room.room.base.stub)
    await startedBite(room)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationChecks(after)).toEqual([])
    expect(after.maintainedStates).toEqual([])
    expect(effectIds(after)).not.toContain(dependentId)
    expect(effectIds(after)).toContain(INDEPENDENT_EFFECT_ID)
    const [end, ...others] = concentrationEnds(after)
    expect(others).toEqual([])
    expect(end!.output).toMatchObject({
      kind: 'CONCENTRATION_END',
      ownerActorId: CHARACTER_ACTOR_ID,
      maintainedStateId: before.maintainedStates[0]!.id,
      reason: 'INCAPACITATED',
      cleanup: { maintainedStateId: before.maintainedStates[0]!.id }
    })
    expect(end!.output.cleanup.removedDependentEffectIds).toContain(dependentId)
    const parent = after.receipts.find((receipt) => receipt.commandType !== 'CONCENTRATION_END')
    expect(end!.output.parentOccurrenceId).toBe(parent!.occurrenceId)
  })

  it('refuses to undo an action whose damage ended a Concentration, naming what it cannot restore', async () => {
    const room = await concentratingRoom({
      autoRoll: 'GAME_MASTER',
      rolls: [18],
      characterPlay: { currentHitPoints: 1 }
    })
    await startedBite(room)
    const answer = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'REVERT_UNAVAILABLE',
      message: expect.stringContaining('lost Concentration')
    })
  })

  it.each([
    {
      name: 'defeated',
      holder: { currentHitPoints: 1 },
      reason: 'DEFEATED' as const
    },
    {
      name: 'Paralyzed',
      holder: { conditionIds: [conditionId('PARALYZED')] },
      reason: 'INCAPACITATED' as const
    },
    {
      name: 'Stunned',
      holder: { conditionIds: [conditionId('STUNNED')] },
      reason: 'INCAPACITATED' as const
    },
    {
      name: 'Incapacitated',
      holder: { conditionIds: [conditionId('INCAPACITATED')] },
      reason: 'INCAPACITATED' as const
    }
  ])(
    'ends a Creature’s Concentration when it is $name, with no check and a table notice',
    async (scenario) => {
      const room = await creatureHolderRoom(scenario.holder)
      const before = await readRoomHistory(room.room.base.stub)
      expect(before.maintainedStates).toHaveLength(1)
      const { answer } = await room.startAction(HOLDER_ID)
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      const after = await readRoomHistory(room.room.base.stub)
      expect(concentrationChecks(after)).toEqual([])
      expect(after.maintainedStates).toEqual([])
      expect(after.activeEffects).toEqual([])
      expect(concentrationEnds(after).map(({ output }) => output.reason)).toEqual([scenario.reason])
      expect(await readRoomChatBodies(room.room.base.stub)).toEqual([
        expect.stringMatching(
          scenario.reason === 'DEFEATED'
            ? /is defeated and loses Concentration\.$/
            : /can't act and loses Concentration\.$/
        )
      ])
    }
  )

  it('posts no notice for a hidden Creature’s end, which is private like its check card', async () => {
    const room = await creatureHolderRoom({
      conditionIds: [conditionId('STUNNED')],
      hidden: true
    })
    const { answer } = await room.startAction(HOLDER_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationEnds(after)).toHaveLength(1)
    expect(after.maintainedStates).toEqual([])
    expect(await readRoomChatBodies(room.room.base.stub)).toEqual([])
  })

  it('ends a Character’s Concentration while a Sheet condition stops it acting, posting the table notice', async () => {
    const stunned = {
      conditionTypeId: conditionId('STUNNED'),
      label: 'Stunned'
    }
    const room = await concentratingRoom({
      autoRoll: 'GAME_MASTER',
      rolls: [18],
      characterPlay: { conditions: [stunned] }
    })
    await startedBite(room)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationChecks(after)).toEqual([])
    expect(after.maintainedStates).toEqual([])
    expect(concentrationEnds(after).map(({ output }) => output.reason)).toEqual(['INCAPACITATED'])
    expect(await readRoomChatBodies(room.room.base.stub)).toEqual([
      expect.stringMatching(/can't act and loses Concentration\.$/)
    ])
  })

  describe('grants that end on incapacitation (Rage)', () => {
    const ENDING_GRANT_ID = testUuid(0x805)
    const KEPT_GRANT_ID = testUuid(0x806)
    /** A Paralyzed holder with one grant that ends on incapacitation and one that does not, hit by a Bite. */
    function grantHolderRoom() {
      const attacker = biteWolf('ATTACK')
      return actionRoom({
        autoRoll: 'GAME_MASTER',
        rolls: [18],
        actors: [
          srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
          srdCreatureActor({
            id: HOLDER_ID,
            creature: plainWolf,
            conditionIds: [conditionId('PARALYZED')]
          })
        ],
        ownerFeatureId: creatureFeature(attacker, 'Bite').id,
        seed: async ({ effects, encounterId, occurredAt }) => {
          for (const [id, endEvents] of [
            [ENDING_GRANT_ID, ['ON_INCAPACITATED']],
            [KEPT_GRANT_ID, []]
          ] as const)
            await effects.create({
              id,
              owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: HOLDER_ID },
              lifecycle: { schemaVersion: 1, remainingTicks: 10 },
              definition: plannedModifierGrant({
                encounterId,
                sourceActorId: HOLDER_ID,
                holderActorId: HOLDER_ID,
                lifecycle: {
                  endTriggers: endEvents.map((code) => ({
                    event: 'LIFECYCLE' as const,
                    timing: 'END' as const,
                    code
                  }))
                },
                rounds: 10
              }).definition,
              occurredAt
            })
        }
      })
    }

    it('ends only the grants that end on it, in the commit where the holder is found incapacitated', async () => {
      const room = await grantHolderRoom()
      expect(effectIds(await readRoomHistory(room.room.base.stub))).toEqual(
        expect.arrayContaining([ENDING_GRANT_ID, KEPT_GRANT_ID])
      )
      const { answer } = await room.startAction(HOLDER_ID)
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
      expect(effectIds(await readRoomHistory(room.room.base.stub))).toEqual([KEPT_GRANT_ID])
    })

    it('restores the ended grant when the GM undoes the action', async () => {
      const room = await grantHolderRoom()
      const { answer } = await room.startAction(HOLDER_ID)
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
      const undone = await room.send({
        type: 'REVERT_LAST_ACTION',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await room.version()
      })
      expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
      expect(effectIds(await readRoomHistory(room.room.base.stub))).toEqual(
        expect.arrayContaining([ENDING_GRANT_ID, KEPT_GRANT_ID])
      )
    })
  })

  it('keeps a Character’s Concentration while it is only Grappled and Restrained (speed 0), asking for the check', async () => {
    const room = await concentratingRoom({
      autoRoll: 'GAME_MASTER',
      rolls: [18],
      characterPlay: {
        conditions: [
          { conditionTypeId: conditionId('GRAPPLED'), label: 'Grappled' },
          { conditionTypeId: conditionId('RESTRAINED'), label: 'Restrained' }
        ]
      }
    })
    await startedBite(room)
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationEnds(after)).toEqual([])
    expect(after.maintainedStates).toHaveLength(1)
    expect((await room.pendingDecision()).pending.kind).toBe('D20_EVIDENCE')
  })
})

describe('room Concentration check of a hidden Creature a player controls (ATTACK-17.6)', () => {
  /** The room's second player controls the hidden holder; the room's first player controls nothing of it. */
  function hiddenControlledHolderRoom(rolls: number[]) {
    const attacker = biteWolf('ATTACK')
    return actionRoom({
      autoRoll: 'BOTH',
      rolls,
      otherPlayerControlledActorIds: [HOLDER_ID],
      actors: [
        srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
        {
          ...srdCreatureActor({ id: HOLDER_ID, creature: plainWolf }),
          public: false
        },
        srdCreatureActor({ id: DEPENDENT_HOLDER_ID, creature: plainWolf })
      ],
      ownerFeatureId: creatureFeature(attacker, 'Bite').id,
      concentration: true,
      concentrationOwnerActorId: HOLDER_ID,
      concentrationDependentActorIds: [DEPENDENT_HOLDER_ID]
    })
  }

  const privateRollsIn = (messages: Awaited<ReturnType<typeof connectPlayer>>['messages']) =>
    messages.flatMap((message) =>
      message.type === 'COMMAND_COMMITTED' &&
      message.delta?.scope === 'CAMPAIGN_CHAT' &&
      message.delta.privateRoll
        ? [message.delta.privateRoll]
        : []
    )

  it('delivers the check card to the controlling player alone and keeps the GM’s card bound to the creature', async () => {
    const room = await hiddenControlledHolderRoom([18])
    const { base } = room.room
    const controller = await connectPlayer(base, 'OTHER_PLAYER')
    const bystander = await connectPlayer(base)

    const { answer } = await room.startAction(HOLDER_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    // The player controls the hidden holder, so its save is theirs to roll; the table sees no prompt card.
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a concentration save.')
    const { request } = decision.pending
    const settled = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [20],
      rollMode: request.rollMode
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')

    await vi.waitFor(() => expect(privateRollsIn(controller.messages)).toHaveLength(1))
    const [own] = privateRollsIn(controller.messages)
    expect(own).toMatchObject({ gmCampaignRoll: null })
    expect(privateRollsIn(base.messages)).toEqual([
      expect.objectContaining({
        id: own!.id,
        gmCampaignRoll: expect.objectContaining({
          creature: expect.objectContaining({ actorId: HOLDER_ID }),
          revealedAt: null,
          noticedAt: null
        })
      })
    ])
    // The other player's socket and the table learn nothing of the card.
    expect(privateRollsIn(bystander.messages)).toEqual([])
    expect(JSON.stringify(bystander.messages)).not.toContain(own!.id)
    expect(await readRoomChatBodies(base.stub)).toEqual([])

    // The room retains the card for the GM and the controller only; this is what a checkpoint replays.
    const holders = await readRoomPrivateRollHolders(base.stub)
    expect(
      holders.map(({ userId, rollId, gmCampaignRoll }) => [userId, rollId, gmCampaignRoll !== null])
    ).toEqual(
      expect.arrayContaining([
        [base.userId, own!.id, true],
        [base.otherPlayerId, own!.id, false]
      ])
    )
    expect(holders).toHaveLength(2)
    expect(concentrationChecks(await readRoomHistory(base.stub))).toHaveLength(1)
  })
})

// SPELLS-4.T2s2 (D191): Polymorph replaces the Character's saves with the form's stat block.
describe('a Concentrating Character in a form that replaces its proficiencies', () => {
  it("rolls its Concentration save with the form's Constitution, keeping the Concentration on the Sheet", async () => {
    // The Giant Ape's Constitution 18 is +4 with no save proficiency; the Fighter's own save differs.
    const room = await concentratingRoom(
      { autoRoll: 'GAME_MASTER', rolls: [18] },
      characterInForm({
        actorId: CHARACTER_ACTOR_ID,
        characterId: CHARACTER_ID,
        effectId: testUuid(0x5301),
        creature: giantApe,
        retainsProficiencies: false
      })
    )
    await startedBite(room)

    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a concentration save.')
    expect(decision.pending.rollerActorId).toBe(CHARACTER_ACTOR_ID)
    const { request } = decision.pending
    const answer = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [6],
      rollMode: request.rollMode
    })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationChecks(after)).toMatchObject([
      { outcome: 'SAVE_SUCCESS', d20: { selectedNatural: 6, modifier: 4, total: 10, dc: 10 } }
    ])
    expect(after.maintainedStates).toHaveLength(1)
  })
})

describe('room Concentration checks held by a Creature', () => {
  it.each([
    { face: 20, outcome: 'SAVE_SUCCESS' as const, kept: true },
    { face: 1, outcome: 'SAVE_FAILURE' as const, kept: false }
  ])(
    'auto-rolls the Creature’s Constitution save for the GM and settles $outcome in the same commit',
    async ({ face, outcome, kept }) => {
      // The attack die shows 19 and hits for 1 damage; the GM's auto-rolled save die follows.
      const room = await creatureHolderRoom({ rolls: [18, face - 1] })
      const [dependentId] = room.room.dependentEffectIds
      const { answer } = await room.startAction(HOLDER_ID)
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      const after = await readRoomHistory(room.room.base.stub)
      expect(concentrationChecks(after)).toMatchObject([{ outcome }])
      expect(after.maintainedStates).toHaveLength(kept ? 1 : 0)
      expect(effectIds(after).includes(dependentId!)).toBe(kept)
    }
  )

  it('adds a proficient Creature’s proficiency bonus to the auto-rolled Concentration save', async () => {
    // The installed SRD Black Dragon Wyrmling (CR 2, +2) is proficient in Constitution saves: +1 and
    // +2 is +3. A natural 7 totals 10 against the DC 10, which a plain +1 would fail.
    const room = await creatureHolderRoom({
      creature: installedSrdCreature(blackDragonWyrmling),
      rolls: [18, 6]
    })
    const { answer } = await room.startAction(HOLDER_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationChecks(after)).toMatchObject([
      {
        outcome: 'SAVE_SUCCESS',
        d20: { selectedNatural: 7, modifier: 3, total: 10, dc: 10 }
      }
    ])
    expect(after.maintainedStates).toHaveLength(1)
  })

  it('pauses a GM-prompted Creature check for the GM and keeps the Concentration on a successful answer', async () => {
    const attacker = biteWolf('ATTACK')
    const room = await actionRoom({
      rolls: [18],
      actors: [
        srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
        srdCreatureActor({ id: HOLDER_ID, creature: plainWolf }),
        srdCreatureActor({ id: DEPENDENT_HOLDER_ID, creature: plainWolf })
      ],
      ownerFeatureId: creatureFeature(attacker, 'Bite').id,
      concentration: true,
      concentrationOwnerActorId: HOLDER_ID,
      concentrationDependentActorIds: [DEPENDENT_HOLDER_ID]
    })
    const { answer } = await room.startAction(HOLDER_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    // Nobody auto-rolls, so the GM enters the Wolf's attack die first, then the holder's save die.
    const attack = await room.pendingDecision()
    if (attack.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected an attack roll.')
    await room.resolve(attack, {
      kind: 'ENTER_DICE',
      requestId: attack.pending.request.requestId,
      rawFaces: [19],
      rollMode: attack.pending.request.rollMode
    })
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a concentration save.')
    expect(decision.pending).toMatchObject({ rollerActorId: HOLDER_ID })
    const { request } = decision.pending
    const resolved = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [20],
      rollMode: request.rollMode
    })
    expect(resolved.type, JSON.stringify(resolved)).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationChecks(after)).toMatchObject([{ outcome: 'SAVE_SUCCESS' }])
    expect(after.maintainedStates).toHaveLength(1)
  })
})

describe('a die the holder keeps for after its Concentration save d20 (SPELLS-31.T4c1b)', () => {
  /** The Wolf holder keeps the Resistance die, authored to be offered once the d20 is seen. */
  const heldDieRoom = (die = heldSaveDieEffect()) =>
    creatureHolderRoom({
      seed: seedModifierGrant({
        sourceActorId: HOLDER_ID,
        holderActorId: HOLDER_ID,
        lifecycle: {},
        effect: die,
        sourceLabel: resistance.label
      })
    })

  /** The GM answers the holder's save with a natural 8: 8 + 1 is 9, one short of the DC 10. */
  async function openWindow(room: Awaited<ReturnType<typeof heldDieRoom>>) {
    const { answer } = await room.startAction(HOLDER_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const save = await room.pendingDecision()
    if (save.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a concentration save.')
    const { request } = save.pending
    const rolled = await room.resolve(save, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [8],
      rollMode: request.rollMode
    })
    expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_WINDOW') throw new Error('Expected the d20 window.')
    return { decision, pending: decision.pending }
  }

  it('offers the die once the d20 is seen, and spending it saves the Concentration and ends the effect', async () => {
    const room = await heldDieRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const { decision, pending } = await openWindow(room)
    expect(pending).toMatchObject({
      rollerActorId: HOLDER_ID,
      d20: { selectedNatural: 8, total: 9 },
      options: [{ label: 'Resistance', count: 1, faces: 4, sign: 'ADD' }]
    })
    // Nothing settled while the window pends: the Concentration and the held die both remain.
    const paused = await readRoomHistory(room.room.base.stub)
    expect(concentrationChecks(paused)).toEqual([])
    expect(paused.maintainedStates).toHaveLength(1)

    const settled = await room.resolve(decision, {
      kind: 'D20_WINDOW_USE',
      requestId: pending.requestId,
      optionId: pending.options[0]!.optionId,
      faces: [3]
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')

    // 8 + 1 + the d4 of 3 is 12: above the DC 10.
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationChecks(after)).toMatchObject([
      {
        outcome: 'SAVE_SUCCESS',
        d20: {
          selectedNatural: 8,
          total: 12,
          addedDice: [{ label: 'Resistance', rolledFaces: [3] }]
        }
      }
    ])
    expect(after.maintainedStates).toHaveLength(1)
    expect(after.occurrences.map((occurrence) => occurrence.state)).not.toContain('PENDING')
    // The held die is spent; the Concentration's dependent effect remains.
    expect(after.activeEffects).toHaveLength(before.activeEffects.length - 1)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('keeps the roll and the die when the holder declines, so the 9 fails the save', async () => {
    const room = await heldDieRoom()
    const { decision, pending } = await openWindow(room)
    const settled = await room.resolve(decision, {
      kind: 'D20_WINDOW_DECLINE',
      requestId: pending.requestId
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(room.room.base.stub)
    expect(concentrationChecks(after)).toMatchObject([
      { outcome: 'SAVE_FAILURE', d20: { selectedNatural: 8, total: 9 } }
    ])
    expect(after.maintainedStates).toEqual([])
  })

  it('offers a homebrew die authored differently (two dice) through the same path', async () => {
    const room = await heldDieRoom(heldSaveDieEffect({ count: 2 }))
    const { decision, pending } = await openWindow(room)
    expect(pending.options).toMatchObject([{ count: 2, faces: 4 }])
    const settled = await room.resolve(decision, {
      kind: 'D20_WINDOW_USE',
      requestId: pending.requestId,
      optionId: pending.options[0]!.optionId,
      faces: [1, 1]
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    // 8 + 1 + 2 is 11: above the DC 10.
    expect(concentrationChecks(await readRoomHistory(room.room.base.stub))).toMatchObject([
      { outcome: 'SAVE_SUCCESS', d20: { total: 11 } }
    ])
  })
  it('prompts a holder with a held die even when its save is auto-rolled, then opens the window on the app roll', async () => {
    // The attack die shows 19; the holder's "Roll dice" makes the server roll its natural 8.
    const room = await creatureHolderRoom({
      autoRoll: 'BOTH',
      rolls: [18, 7],
      seed: seedModifierGrant({
        sourceActorId: HOLDER_ID,
        holderActorId: HOLDER_ID,
        lifecycle: {},
        effect: heldSaveDieEffect(),
        sourceLabel: resistance.label
      })
    })
    const { answer } = await room.startAction(HOLDER_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const save = await room.pendingDecision()
    if (save.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a concentration save.')
    const rolled = await room.rollDice(save)
    expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_WINDOW')
      throw new Error(`Expected the d20 window: ${JSON.stringify(decision.pending)}`)
    expect(decision.pending).toMatchObject({ d20: { selectedNatural: 8, total: 9 } })
    expect(concentrationChecks(await readRoomHistory(room.room.base.stub))).toEqual([])
    const settled = await room.resolve(decision, {
      kind: 'D20_WINDOW_DECLINE',
      requestId: decision.pending.requestId
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    expect(concentrationChecks(await readRoomHistory(room.room.base.stub))).toMatchObject([
      { outcome: 'SAVE_FAILURE' }
    ])
  })

  describe('with a second save in the same chain (Concentration, then massive damage)', () => {
    /** A Bite of 6 owes the 11-hit-point holder a Concentration save and a massive-damage save. */
    const chainRoom = () =>
      creatureHolderRoom({
        biteDamage: 6,
        massiveDamage: true,
        seed: seedModifierGrant({
          sourceActorId: HOLDER_ID,
          holderActorId: HOLDER_ID,
          lifecycle: {},
          effect: heldSaveDieEffect(),
          sourceLabel: resistance.label,
          id: HELD_DIE_ID
        })
      })

    /** The GM enters a natural 8 for the next save: the window it opens, or null once none opens. */
    async function nextSave(room: Awaited<ReturnType<typeof chainRoom>>) {
      const save = await room.pendingDecision()
      if (save.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a save.')
      const { request } = save.pending
      const rolled = await room.resolve(save, {
        kind: 'ENTER_DICE',
        requestId: request.requestId,
        rawFaces: [8],
        rollMode: request.rollMode
      })
      expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
      const next = await readPendingActionDecision(room.room.base.stub)
      return next?.pending.kind === 'D20_WINDOW' ? await room.pendingDecision() : null
    }

    const holdsDie = async (room: Awaited<ReturnType<typeof chainRoom>>) =>
      (await readRoomHistory(room.room.base.stub)).activeEffects.some(
        (effect) => effect.id === HELD_DIE_ID
      )

    it('filters out a die spent in the first window, so the second save opens none', async () => {
      const room = await chainRoom()
      expect(await holdsDie(room)).toBe(true)
      await room.startAction(HOLDER_ID)
      const window = await nextSave(room)
      if (window?.pending.kind !== 'D20_WINDOW') throw new Error('Expected the first window.')
      const used = await room.resolve(window, {
        kind: 'D20_WINDOW_USE',
        requestId: window.pending.requestId,
        optionId: window.pending.options[0]!.optionId,
        faces: [4]
      })
      expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
      expect(await holdsDie(room)).toBe(false)
      // The second save no longer holds a die, so it is rolled at once: nothing prompts a d20.
      const next = await readPendingActionDecision(room.room.base.stub)
      expect(['D20_EVIDENCE', 'D20_WINDOW']).not.toContain(next?.pending.kind)
    })

    it('offers a declined die again at the second save', async () => {
      const room = await chainRoom()
      expect(await holdsDie(room)).toBe(true)
      await room.startAction(HOLDER_ID)
      const first = await nextSave(room)
      if (first?.pending.kind !== 'D20_WINDOW') throw new Error('Expected the first window.')
      const declined = await room.resolve(first, {
        kind: 'D20_WINDOW_DECLINE',
        requestId: first.pending.requestId
      })
      expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
      expect(await holdsDie(room)).toBe(true)

      const second = await nextSave(room)
      if (second?.pending.kind !== 'D20_WINDOW') throw new Error('Expected the second window.')
      expect(second.pending.options).toMatchObject([{ label: 'Resistance', count: 1, faces: 4 }])
      expect(second.pending.requestId).not.toBe(first.pending.requestId)
      const used = await room.resolve(second, {
        kind: 'D20_WINDOW_USE',
        requestId: second.pending.requestId,
        optionId: second.pending.options[0]!.optionId,
        faces: [4]
      })
      expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
      expect(await holdsDie(room)).toBe(false)
    })
  })
})
