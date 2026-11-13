import { runInDurableObject } from 'cloudflare:test'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { DND5E_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import { heckleFeature } from '@artificer-toolkit/rules-runtime/testing/heckleFeature'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { resolveEncounterActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { bard } from '@artificer-toolkit/source-data/srd/classes/bard.js'
import { collegeOfLore } from '@artificer-toolkit/source-data/srd/classes/college-of-lore.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { expireReactionOffer } from './reactionTimeoutClock.js'
import {
  readActorHitPoints,
  readCharacterHitPoints,
  readPendingActionContext,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * SPELLS-31.T4c3b1 with QUALITY-9.T1e2: a Wolf's rolled Bite is held for a Character beside it who
 * holds an attack-roll reaction (D207). Used, the reaction runs as the Character's own action (D219),
 * which waits for its die and spends its reaction and the charge it costs; the Bite then resumes with
 * that die off its kept d20, and one undo restores everything. The engine knows no feature: the SRD
 * Cutting Words and a homebrew free reaction take the same path.
 *
 * Restated reason, for every assertion below that read a `ROLL_WINDOW` (QUALITY-9.T1e2, D219): on an
 * action the reaction die is no longer an option of the roller's d20 window answered with the die's
 * faces. The rolled d20 holds a reaction choice for the reactor, and the die is rolled by the reaction's
 * own action. Each assertion keeps its claim and reads it where the child path records it.
 */

const ATTACKER_ID = testUuid(0x7c0)
const TARGET_ID = testUuid(0x7c1)
const REACTOR_ACTOR_ID = testUuid(0x7c2)
const REACTOR_ID = testUuid(0x7c3)
const attackBite = biteWolf('ATTACK')

/** The Bite with its damage rolled (1d4), so a hit holds the Bite at its damage roll. */
const rolledDamageBite = creatureAuthoredDtoSchema.parse({
  ...attackBite,
  features: attackBite.features?.map((feature) =>
    feature.label !== 'Bite'
      ? feature
      : {
          ...feature,
          effects: feature.effects?.map((effect) => ({
            ...effect,
            paths: effect.paths.map((path) =>
              'resultBlock' in path
                ? {
                    ...path,
                    resultBlock: {
                      ...path.resultBlock,
                      outcomes: path.resultBlock.outcomes.map((outcome) => {
                        if (outcome.effectKind !== 'DAMAGE')
                          throw new Error('Expected Bite damage.')
                        return {
                          id: outcome.id,
                          effectKind: 'DAMAGE' as const,
                          damageTypeId: outcome.damageTypeId,
                          valueKind: 'DICE' as const,
                          scalingKind: 'NONE' as const,
                          diceConfig: '1d4'
                        }
                      })
                    }
                  }
                : path
            )
          }))
        }
  )
})

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * The College of Lore with only its SRD Cutting Words: its Bonus Proficiencies choice would leave the
 * captured Character awaiting Builder repair.
 */
const loreCuttingWords = {
  ...collegeOfLore,
  features: [srdByLabel(collegeOfLore.features ?? [], 'Cutting Words')]
}

/** The id of the grant a Character's reconciliation records for the Bard's Bardic Inspiration. */
const inspirationGrantId = `resource:${bard.id}:${bard.resources?.id}`

/**
 * A Wolf whose Bite (+4) attacks a Wolf (AC 13), with a Character 10 ft away: a level 3 Lore Bard
 * holding Cutting Words with `used` of its one Bardic Inspiration spent, or a Fighter holding Heckle.
 */
function reactorRoom(reactor: 'LORE_BARD' | 'HECKLER', used = 0, bite = attackBite) {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: bite }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf }),
      characterActor({ id: REACTOR_ACTOR_ID, characterId: REACTOR_ID })
    ],
    ownerFeatureId: creatureFeature(bite, 'Bite').id,
    ...(reactor === 'LORE_BARD'
      ? {
          characterPlay: {
            characterClass: bard,
            characterSubclass: loreCuttingWords,
            classLevel: 3,
            resourceUsage: [
              { owner: { kind: 'AUTHORED_GRANT', resourceGrantId: inspirationGrantId }, used }
            ]
          }
        }
      : { characterClassFeatures: [heckleFeature()] })
  })
}
type Room = Awaited<ReturnType<typeof reactorRoom>>

/** The attacker rolls a natural 10: 14 hits AC 13, and any die taken off it makes it miss. */
async function rollAttack(room: Room) {
  expect((await room.startAction(TARGET_ID, [], room.sceneContext())).answer.type).toBe(
    'COMMAND_COMMITTED'
  )
  const attack = await room.pendingDecision()
  if (attack.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the attack prompt.')
  const { request } = attack.pending
  const rolled = await room.resolve(attack, {
    kind: 'ENTER_DICE',
    requestId: request.requestId,
    rawFaces: [10],
    rollMode: request.rollMode
  })
  expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
}

type AnyRoom = Pick<Room, 'pendingDecision' | 'resolve'>

/** The reaction choice the rolled attack holds for the reactor. */
async function heldChoice(room: AnyRoom) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'REACTION_CHOICE')
    throw new Error(`Expected the reaction choice, got ${decision.pending.kind}.`)
  return { decision, pending: decision.pending }
}

async function offered(room: Room) {
  await rollAttack(room)
  return heldChoice(room)
}

/** The reactor uses its one offered reaction; its own action then waits for its die. */
async function useReaction(room: AnyRoom, choice: Awaited<ReturnType<typeof heldChoice>>) {
  const used = await room.resolve(choice.decision, {
    kind: 'OPTION',
    optionId: choice.pending.options[0]!.optionId
  })
  expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
  const die = await room.pendingDecision()
  if (die.pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
    throw new Error(`Expected the reaction's die, got ${die.pending.kind}.`)
  return { die, request: die.pending.request }
}

/** The reaction's die is entered by hand, as the window's was (user ruling). */
async function enterDie(
  room: AnyRoom,
  { die, request }: Awaited<ReturnType<typeof useReaction>>,
  value: number
) {
  const rolled = await room.resolve(die, {
    kind: 'ENTER_INTEGER',
    requestId: request.requestId,
    value
  })
  expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
}

/** The reactions that ran as their holder's own action, in commit order (D219). */
async function reactionChildren(room: Room) {
  const history = await readRoomHistory(room.room.base.stub)
  return history.commands.flatMap((row) => {
    if (row.commandType !== 'RESOLVE_ACTION') return []
    const command = resolveEncounterActionInputDtoSchema.parse(JSON.parse(row.commandJson))
    return command.systemTrigger?.trigger === 'REACTION' ? [command] : []
  })
}

const inspirationUsed = (room: Room) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const play = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((row) => row.characterId === REACTOR_ID)
    if (!play) throw new Error('Missing room Character play state.')
    return (
      readCharacterPlay(play).resourceUsage.find(
        ({ owner }) =>
          owner.kind === 'AUTHORED_GRANT' && owner.resourceGrantId === inspirationGrantId
      )?.used ?? 0
    )
  })

async function reactionUsed(room: Room) {
  const row = (await readRoomHistory(room.room.base.stub)).actors.find(
    ({ id }) => id === REACTOR_ACTOR_ID
  )
  if (!row) throw new Error('The room holds no reactor.')
  return encounterRuleUsageUsed(readStoredRunActor(row), DND5E_REACTION_ALLOWANCE_DEFINITION_ID)
}

const targetHitPoints = async (room: Room) =>
  readActorHitPoints(await readRoomHistory(room.room.base.stub), TARGET_ID)

async function undoLastAction(room: Room) {
  const undone = await room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
}

async function voidOccurrence(room: Room, occurrence: { id: string; version: number }) {
  const voided = await room.send({
    type: 'VOID_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: room.room.encounterId,
    expectedVersion: await room.version(),
    occurrenceId: occurrence.id,
    expectedOccurrenceVersion: occurrence.version
  })
  expect(voided.type, JSON.stringify(voided)).toBe('COMMAND_COMMITTED')
}

/**
 * A Wolf bites a Character holding Heckle and Shield, or a level 3 Lore Bard with its one Bardic
 * Inspiration, hitting by 1 so the Character's die could make it miss; returns the reaction choice
 * the rolled Bite holds for the Character.
 */
async function biteTheReactor(reactor: 'HECKLER' | 'LORE_BARD') {
  const room = await actionRoom({
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attackBite }),
      characterActor({ id: REACTOR_ACTOR_ID, characterId: REACTOR_ID })
    ],
    ownerFeatureId: creatureFeature(attackBite, 'Bite').id,
    ...(reactor === 'HECKLER'
      ? {
          characterClassFeatures: [heckleFeature()],
          characterSpellcasting: { spells: [shield], prepared: [shield.id] }
        }
      : {
          characterPlay: {
            characterClass: bard,
            characterSubclass: loreCuttingWords,
            classLevel: 3
          }
        })
  })
  const started = await room.startAction(REACTOR_ACTOR_ID, [], room.sceneContext())
  expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
  const attack = await room.pendingDecision()
  if (attack.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the attack prompt.')
  const { request } = attack.pending
  const context = await readPendingActionContext(room.room.base.stub)
  if (context.kind !== 'ENCOUNTER_ACTION' || !context.d20Policy)
    throw new Error('Expected a pending attack d20.')
  const face = context.d20Policy.dc + 1 - context.d20Policy.modifier
  expect(
    (
      await room.resolve(attack, {
        kind: 'ENTER_DICE',
        requestId: request.requestId,
        rawFaces: [face],
        rollMode: request.rollMode
      })
    ).type
  ).toBe('COMMAND_COMMITTED')
  return { room, choice: await heldChoice(room) }
}

describe('Cutting Words against an attack roll in the room (SPELLS-31.T4c3b1)', () => {
  it('asks the Lore Bard, not the attacker, once the attack is rolled, spending nothing yet', async () => {
    const room = await reactorRoom('LORE_BARD')
    const { pending } = await offered(room)
    // Restated (header): the window's `rollerActorId` is the choice's `targetActorId` and the stored
    // roller, its `d20` is the choice's `attackRoll`, and its one die option is the one reaction
    // offered; that reaction's label, count, faces and sign are asserted on the die the held Bite
    // records ("gives the reaction and the inspiration back" and "records the die" below).
    expect(pending.targetActorId).toBe(REACTOR_ACTOR_ID)
    expect(pending.attackRoll).toEqual({
      attackerActorId: ATTACKER_ID,
      selectedNatural: 10,
      total: 14
    })
    expect(pending.options).toHaveLength(1)
    const context = await readPendingActionContext(room.room.base.stub)
    if (context.kind !== 'ENCOUNTER_ACTION' || context.pause?.kind !== 'CAST_REACTION')
      throw new Error('Expected the shared reaction pause.')
    expect(context.rollerActorId).toBe(REACTOR_ACTOR_ID)
    expect(context.pause.payload.kind).toBe('ATTACK_ROLL_BY_OTHER')
    expect(context.pause.payload.reactions).toMatchObject([
      { trigger: 'ATTACK_ROLL_BY_OTHER', reactorActorId: REACTOR_ACTOR_ID }
    ])
    expect(await inspirationUsed(room)).toBe(0)
    expect(await reactionUsed(room)).toBe(0)
  })

  it('takes the die off the roll, so the Bite misses; the reaction and inspiration are spent, and one undo restores them', async () => {
    const room = await reactorRoom('LORE_BARD')
    const before = await readRoomHistory(room.room.base.stub)
    const hitPoints = await targetHitPoints(room)
    // Restated (header): the window's use with faces [3] is the choice, then the 3 entered for the
    // d6 the reaction's own action waits on.
    const die = await useReaction(room, await offered(room))
    expect(die.request).toMatchObject({ min: 1, max: 6 })
    await enterDie(room, die, 3)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await targetHitPoints(room)).toBe(hitPoints)
    expect(await inspirationUsed(room)).toBe(1)
    expect(await reactionUsed(room)).toBe(1)

    await undoLastAction(room)
    expect(await inspirationUsed(room)).toBe(0)
    expect(await reactionUsed(room)).toBe(0)
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  })

  it('lets the Bite hit when the Bard declines, spending neither', async () => {
    const room = await reactorRoom('LORE_BARD')
    const hitPoints = await targetHitPoints(room)
    // Restated (header): the window's decline is the choice's decline.
    const { decision } = await offered(room)
    const declined = await room.resolve(decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await targetHitPoints(room)).toBeLessThan(hitPoints)
    expect(await inspirationUsed(room)).toBe(0)
    expect(await reactionUsed(room)).toBe(0)
    expect(await reactionChildren(room)).toEqual([])
  })

  it('declines the choice once the offer’s time runs out, so the Bite hits (D207)', async () => {
    const room = await reactorRoom('LORE_BARD')
    const hitPoints = await targetHitPoints(room)
    await offered(room)

    await expireReactionOffer(room.room.base.stub)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await targetHitPoints(room)).toBeLessThan(hitPoints)
    expect(await inspirationUsed(room)).toBe(0)
    expect(await reactionUsed(room)).toBe(0)
  })

  it('never pauses for a Bard with no Bardic Inspiration left', async () => {
    const room = await reactorRoom('LORE_BARD', 1)
    await rollAttack(room)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await reactionUsed(room)).toBe(0)
  })

  it('takes a homebrew free reaction’s d4 the same way, spending only the reaction', async () => {
    const room = await reactorRoom('HECKLER')
    const hitPoints = await targetHitPoints(room)
    const choice = await offered(room)
    // Restated (header): the window's roller is the choice's reactor and its one option the one
    // reaction; the option's d4 is the range its own action asks for, and its label and sign are
    // what the held Bite records of the die ("records the die" below).
    expect(choice.pending.targetActorId).toBe(REACTOR_ACTOR_ID)
    expect(choice.pending.options).toHaveLength(1)
    const die = await useReaction(room, choice)
    expect(die.request).toMatchObject({ min: 1, max: 4 })
    await enterDie(room, die, 2)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await targetHitPoints(room)).toBe(hitPoints)
    expect(await reactionUsed(room)).toBe(1)
  })

  it('runs the used reaction as the Bard’s own action at the attacker, committed before the Bite it answers (D219)', async () => {
    const room = await reactorRoom('LORE_BARD')
    const die = await useReaction(room, await offered(room))
    // Nothing is spent while the reaction's action waits for its die.
    expect(await reactionChildren(room)).toEqual([])
    expect(await inspirationUsed(room)).toBe(0)
    await enterDie(room, die, 3)

    const history = await readRoomHistory(room.room.base.stub)
    const actions = history.commands.flatMap((row) =>
      row.commandType === 'RESOLVE_ACTION'
        ? [
            {
              version: row.version,
              command: resolveEncounterActionInputDtoSchema.parse(JSON.parse(row.commandJson))
            }
          ]
        : []
    )
    const child = actions.find(({ command }) => command.systemTrigger?.trigger === 'REACTION')
    const parent = actions.find(({ command }) => !command.systemTrigger)
    if (!child || !parent) throw new Error('Expected the Bite and the reaction it was answered by.')
    expect(child.command).toMatchObject({
      actorId: REACTOR_ACTOR_ID,
      target: { kind: 'ACTOR', actorId: ATTACKER_ID },
      systemTrigger: { parentCommandId: parent.command.commandId, trigger: 'REACTION' }
    })
    expect(parent.version).toBeGreaterThan(child.version)
  })

  it('records the die on the held Bite, which resumes with it off the kept d20 (D219)', async () => {
    const room = await reactorRoom('HECKLER', 0, rolledDamageBite)
    const hitPoints = await targetHitPoints(room)
    const die = await useReaction(room, await offered(room))
    // A 1 off the 14 still meets armor class 13, so the Bite goes on to its damage roll.
    await enterDie(room, die, 1)
    const damage = await room.pendingDecision()
    expect(damage.pending.kind).toBe('ACTION_OUTCOME_EVIDENCE')
    const [child] = await reactionChildren(room)
    const context = await readPendingActionContext(room.room.base.stub)
    expect(context.reactionChildren).toEqual([
      {
        commandId: child?.commandId,
        resumeOutcome: null,
        rolledDie: { label: 'Heckle', count: 1, faces: 4, sign: 'SUBTRACT', rolledFaces: [1] }
      }
    ])
    expect(await targetHitPoints(room)).toBe(hitPoints)
    expect(await reactionUsed(room)).toBe(1)
  })

  it('gives the reaction and the inspiration back when the GM voids the Bite the die was rolled against (D219)', async () => {
    const room = await reactorRoom('LORE_BARD', 0, rolledDamageBite)
    const before = await readRoomHistory(room.room.base.stub)
    const die = await useReaction(room, await offered(room))
    await enterDie(room, die, 1)
    expect(await inspirationUsed(room)).toBe(1)
    expect(await reactionUsed(room)).toBe(1)
    const damage = await room.pendingDecision()
    expect(damage.pending.kind).toBe('ACTION_OUTCOME_EVIDENCE')
    // Restated (header): the window option's label, count, faces and sign are the die the held Bite
    // records from the reaction's own action.
    const context = await readPendingActionContext(room.room.base.stub)
    expect(context.reactionChildren).toMatchObject([
      {
        rolledDie: {
          label: 'Cutting Words',
          count: 1,
          faces: 6,
          sign: 'SUBTRACT',
          rolledFaces: [1]
        }
      }
    ])

    await voidOccurrence(room, damage.occurrence)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await inspirationUsed(room)).toBe(0)
    expect(await reactionUsed(room)).toBe(0)
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  })

  it('asks the Bard again when the GM voids its reaction at the die, having spent nothing (D219)', async () => {
    const room = await reactorRoom('LORE_BARD')
    const hitPoints = await targetHitPoints(room)
    const first = await offered(room)
    const die = await useReaction(room, first)
    await voidOccurrence(room, die.die.occurrence)
    expect(await reactionChildren(room)).toEqual([])
    expect(await inspirationUsed(room)).toBe(0)
    expect(await reactionUsed(room)).toBe(0)

    // The Bite is held on its rolled d20 again, for the same reactor.
    const again = await heldChoice(room)
    expect(again.pending.attackRoll).toEqual(first.pending.attackRoll)
    expect(again.pending.targetActorId).toBe(REACTOR_ACTOR_ID)
    const declined = await room.resolve(again.decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await targetHitPoints(room)).toBeLessThan(hitPoints)
    expect(await reactionUsed(room)).toBe(0)
  })

  it('rebuilds the declined roll when the bitten Heckler then casts Shield', async () => {
    const { room, choice } = await biteTheReactor('HECKLER')
    // Restated (header): the window's decline is the choice's decline.
    const declined = await room.resolve(choice.decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    const shieldChoice = await heldChoice(room)
    // The hit's own offer follows the roll's, and carries no roll to react to.
    expect(shieldChoice.pending.attackRoll).toBeUndefined()
    const shielded = await room.resolve(shieldChoice.decision, {
      kind: 'OPTION',
      optionId: shieldChoice.pending.options[0]!.optionId
    })
    expect(shielded.type, JSON.stringify(shielded)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    // Shield, not the declined Heckle, spent the reaction.
    expect(await reactionUsed(room)).toBe(1)
  })

  it('offers no Shield once Heckle spent the reaction on the same roll', async () => {
    const { room, choice } = await biteTheReactor('HECKLER')
    const hitPoints = await readCharacterHitPoints(room.room.base.stub, REACTOR_ID)
    // Restated (header): the window's use with faces [1] is the choice, then the 1 entered for the die.
    await enterDie(room, await useReaction(room, choice), 1)
    // A 1 off a hit by 1 still meets the armor class, so the Bite hits with no reaction left for Shield.
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await reactionUsed(room)).toBe(1)
    expect(await readCharacterHitPoints(room.room.base.stub, REACTOR_ID)).toBeLessThan(hitPoints)
  })

  it('lets the bitten Lore Bard spend inspiration on the roll against itself, with the Bite', async () => {
    const { room, choice } = await biteTheReactor('LORE_BARD')
    const hitPoints = await readCharacterHitPoints(room.room.base.stub, REACTOR_ID)
    // Restated (header): the window's use with faces [3] is the choice, then the 3 entered for the
    // die. The Bard's charge is spent by its own action, and the Bite is rebuilt against the Bard as
    // that action left it.
    await enterDie(room, await useReaction(room, choice), 3)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await inspirationUsed(room)).toBe(1)
    expect(await reactionUsed(room)).toBe(1)
    // A 3 off a hit by 1 misses the Bard.
    expect(await readCharacterHitPoints(room.room.base.stub, REACTOR_ID)).toBe(hitPoints)
  })
})
