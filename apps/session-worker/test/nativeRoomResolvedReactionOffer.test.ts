import {
  reactionOfferCommandId,
  reactionOfferOccurrenceId,
  systemTriggerCommandId
} from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import { DND5E_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { hunterConclave } from '@artificer-toolkit/source-data/srd/classes/hunter.js'
import { dagger } from '@artificer-toolkit/source-data/srd/equipment/dagger.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { runInDurableObject } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { actionRoom, biteWolf, type ActionRoomConfig } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readActorHitPoints,
  readCharacterHitPoints,
  readPendingApplicationContext,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * QUALITY-8.T1c2b1 (D219): an attack that has hit or missed a Character holding a reaction to that
 * outcome plans the Character's offer with the attack, its commit queues it, and the room raises it
 * as the Run's next decision. The trigger is the authored one, checked by the event table when the
 * attack is planned: the SRD Giant Killer (a Large or larger attacker within 5 feet that the
 * Character sees) and a homebrew reaction with other terms take the same path.
 */

const ATTACKER_ID = testUuid(0x8f0)
const REACTOR_ACTOR_ID = testUuid(0x8f1)
const REACTOR_ID = testUuid(0x8f2)
const attackBite = biteWolf('ATTACK', { reachFeet: 5 })
/** The same Wolf, Large. */
const largeWolf = creatureAuthoredDtoSchema.parse({ ...attackBite, size: 'LARGE' })

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const giantKillerOption = hunterConclave.features
  ?.find(({ label }) => label === "Hunter's Prey")
  ?.options?.find(({ label }) => label === 'Giant Killer')
if (!giantKillerOption?.effects) throw new Error('The SRD Hunter has no Giant Killer.')

/** The SRD option as the Character's Feature, exactly as authored. */
const giantKiller: ClassFeature = {
  id: giantKillerOption.id,
  label: giantKillerOption.label,
  description: giantKillerOption.description,
  availableAtLevel: 1,
  order: 1,
  effects: giantKillerOption.effects
}

/** A homebrew reaction authored as Giant Killer is, but answering only a hit, by an attacker of any size. */
const riposte = ((): ClassFeature => {
  const [effect] = giantKillerOption.effects
  if (!effect || !('reactionTrigger' in effect.invocation) || !effect.invocation.reactionTrigger)
    throw new Error('Giant Killer is not a reaction.')
  return {
    id: testUuid(0x8f7),
    label: 'Riposte',
    description: 'Attack a creature within 5 feet of you that hits you.',
    availableAtLevel: 1,
    order: 1,
    effects: [
      {
        ...effect,
        id: testUuid(0x8f8),
        invocation: {
          ...effect.invocation,
          range: { ...effect.invocation.range, id: testUuid(0x8f9) },
          reactionTrigger: {
            kind: 'ATTACK_RESOLVED_ON_SELF',
            outcome: 'HIT',
            requiresSight: false,
            attackerWithinFeet: 5
          }
        }
      }
    ]
  }
})()

/** A Wolf whose Bite (+4, reach 5 feet) attacks a Character 5 feet away, or at `reactorX` along the row. */
function attackedRoom(
  input: {
    creature?: typeof attackBite
    feature?: ClassFeature
    reactorX?: number
    sceneOverrides?: ActionRoomConfig['sceneOverrides']
    /** Seats a second player, who controls no actor. */
    seatsOtherPlayer?: boolean
  } = {}
) {
  const { creature = largeWolf } = input
  return actionRoom({
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature }),
      characterActor({ id: REACTOR_ACTOR_ID, characterId: REACTOR_ID })
    ],
    positions: { [REACTOR_ACTOR_ID]: { x: input.reactorX ?? 250, y: 150 } },
    ownerFeatureId: creatureFeature(creature, 'Bite').id,
    characterClassFeatures: [input.feature ?? giantKiller],
    characterEquipment: [dagger],
    sceneOverrides: input.sceneOverrides,
    ...(input.seatsOtherPlayer && { otherPlayerControlledActorIds: [] })
  })
}
type Room = Awaited<ReturnType<typeof attackedRoom>>

/**
 * The Bite at the Character, its d20 showing `face`. Off the Scene when `onScene` is false, where the
 * GM accepts that its range is not checked.
 */
async function bite(room: Room, face: number, onScene = true) {
  const started = onScene
    ? await room.startAction(REACTOR_ACTOR_ID, [], room.sceneContext())
    : await room.startAction(REACTOR_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
  const attack = await room.pendingDecision()
  if (attack.pending.kind !== 'D20_EVIDENCE')
    throw new Error(`Expected the attack prompt, got ${attack.pending.kind}.`)
  const { requestId, rollMode } = attack.pending.request
  const rolled = await room.resolve(attack, {
    kind: 'ENTER_DICE',
    requestId,
    rawFaces: rollMode === 'NORMAL' ? [face] : [face, face],
    rollMode
  })
  expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
  return started.command
}

/** The reaction offers the room holds, whatever their state. */
async function offers(room: Room, attackCommandId: string) {
  const offerId = reactionOfferOccurrenceId(attackCommandId, REACTOR_ACTOR_ID)
  return (await readRoomHistory(room.room.base.stub)).occurrences.filter(
    ({ id, rootCommandId }) => id === offerId || rootCommandId === reactionOfferCommandId(offerId)
  )
}

/** The room holds no reaction offer and waits on nothing. */
async function expectNoOffer(room: Room, attackCommandId: string) {
  expect(await offers(room, attackCommandId)).toEqual([])
  expect(
    (await readRoomHistory(room.room.base.stub)).occurrences.filter(
      ({ state }) => state === 'PENDING' || state === 'QUEUED'
    )
  ).toEqual([])
}

describe('the reaction offer of an attack that hit or missed its holder (QUALITY-8.T1c2b1)', () => {
  it.each([
    ['hits', 19],
    ['misses', 1]
  ])(
    'is raised for the Character once a Large Wolf’s Bite %s, as the Run’s pending decision',
    async (_outcome, face) => {
      const room = await attackedRoom()
      const command = await bite(room, face)
      const [offer, ...others] = await offers(room, command.commandId)
      expect(others).toEqual([])
      expect(offer).toMatchObject({
        id: reactionOfferOccurrenceId(command.commandId, REACTOR_ACTOR_ID),
        state: 'PENDING',
        version: 0,
        expectedEncounterVersion: await room.version()
      })
      const context = await readPendingApplicationContext(room.room.base.stub)
      if (context.kind !== 'ENCOUNTER_REACTION_OFFER')
        throw new Error(`Expected the reaction offer, got ${context.kind}.`)
      expect(context).toMatchObject({
        parentCommandId: command.commandId,
        reactorActorId: REACTOR_ACTOR_ID,
        attackerActorId: ATTACKER_ID,
        reactionAllowance: { definitionId: DND5E_REACTION_ALLOWANCE_DEFINITION_ID, beforeUsed: 0 }
      })
      // The menu is the Character's own reaction with each weapon it wields, labelled to tell them apart.
      expect(context.options.map(({ label }) => label)).toEqual([
        'Giant Killer (Club)',
        'Giant Killer (Dagger)'
      ])
      // The attack itself is settled: the offer answers a committed attack.
      const history = await readRoomHistory(room.room.base.stub)
      expect(history.occurrences.find(({ id }) => id === context.parentOccurrenceId)).toMatchObject(
        { rootCommandId: command.commandId, state: 'COMPLETED' }
      )
    }
  )

  it('offers nothing against a Wolf smaller than the reaction names', async () => {
    const room = await attackedRoom({ creature: attackBite })
    await expectNoOffer(room, (await bite(room, 19)).commandId)
  })

  it('offers nothing when the Wolf is farther than the reaction names', async () => {
    const room = await attackedRoom({
      creature: creatureAuthoredDtoSchema.parse({
        ...biteWolf('ATTACK', { reachFeet: 10 }),
        size: 'LARGE'
      }),
      reactorX: 350
    })
    await expectNoOffer(room, (await bite(room, 19)).commandId)
  })

  it('offers nothing to a Character that cannot see the Wolf', async () => {
    const room = await attackedRoom({
      sceneOverrides: { ambientIllumination: 'ORDINARY_DARKNESS' }
    })
    await expectNoOffer(room, (await bite(room, 19)).commandId)
  })

  it('offers nothing for an attack made off the Scene', async () => {
    const room = await attackedRoom()
    await expectNoOffer(room, (await bite(room, 19, false)).commandId)
  })

  it('offers a homebrew reaction by its own terms: a hit by a Wolf of any size, seen or not', async () => {
    const hit = await attackedRoom({
      creature: attackBite,
      feature: riposte,
      sceneOverrides: { ambientIllumination: 'ORDINARY_DARKNESS' }
    })
    const [offer] = await offers(hit, (await bite(hit, 19)).commandId)
    expect(offer).toMatchObject({ state: 'PENDING' })
    const context = await readPendingApplicationContext(hit.room.base.stub)
    if (context.kind !== 'ENCOUNTER_REACTION_OFFER')
      throw new Error(`Expected the reaction offer, got ${context.kind}.`)
    expect(context.options.map(({ label }) => label)).toEqual([
      'Riposte (Club)',
      'Riposte (Dagger)'
    ])

    const missed = await attackedRoom({ creature: attackBite, feature: riposte })
    await expectNoOffer(missed, (await bite(missed, 1)).commandId)
  })
})

/** The command that answers the room's pending reaction offer with `resolution`. */
async function answerCommand(room: Room, resolution: Record<string, unknown>) {
  const offer = (await readRoomHistory(room.room.base.stub)).occurrences.find(
    ({ state }) => state === 'PENDING'
  )
  if (!offer) throw new Error('No reaction offer is pending.')
  return {
    type: 'RESOLVE_RULE_OCCURRENCE',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    correlationId: null,
    occurrenceId: offer.id,
    expectedOccurrenceVersion: offer.version,
    resolution
  }
}

/** The pending offer's Dagger option: its answer, and the command id of the reaction it runs. */
async function daggerReaction(room: Room, attackCommandId: string) {
  const context = await readPendingApplicationContext(room.room.base.stub)
  if (context.kind !== 'ENCOUNTER_REACTION_OFFER')
    throw new Error(`Expected the reaction offer, got ${context.kind}.`)
  const option = context.options.find(({ label }) => label === 'Giant Killer (Dagger)')
  if (!option) throw new Error('The offer has no Dagger option.')
  return {
    resolution: { kind: 'OPTION', optionId: option.optionId },
    commandId: systemTriggerCommandId(attackCommandId, REACTOR_ACTOR_ID, option.actionId)
  }
}

/** The reaction's own rolls: its d20 showing 19, a hit that is not a critical one, then its damage die. */
async function rollReactionAttack(room: Room, reactionCommandId: string) {
  const attack = await room.pendingDecision()
  expect(attack.occurrence.rootCommandId).toBe(reactionCommandId)
  if (attack.pending.kind !== 'D20_EVIDENCE')
    throw new Error(`Expected the reaction's attack prompt, got ${attack.pending.kind}.`)
  const { requestId, rollMode } = attack.pending.request
  const rolled = await room.resolve(attack, {
    kind: 'ENTER_DICE',
    requestId,
    rawFaces: rollMode === 'NORMAL' ? [19] : [19, 19],
    rollMode
  })
  expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
  const damage = await room.pendingDecision()
  expect(damage.occurrence.rootCommandId).toBe(reactionCommandId)
  if (damage.pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
    throw new Error(`Expected the reaction's damage die, got ${damage.pending.kind}.`)
  const entered = await room.resolve(damage, {
    kind: 'ENTER_INTEGER',
    requestId: damage.pending.request.requestId,
    value: damage.pending.request.max
  })
  expect(entered.type, JSON.stringify(entered)).toBe('COMMAND_COMMITTED')
}

/** The Wolf's and the Character's current hit points. */
async function hitPoints(room: Room) {
  const { stub } = room.room.base
  return {
    wolf: readActorHitPoints(await readRoomHistory(stub), ATTACKER_ID),
    character: await readCharacterHitPoints(stub, REACTOR_ID)
  }
}

/** The answers the room holds to reaction offers, as their receipts record them. */
async function offerAnswers(room: Room) {
  return (await readRoomHistory(room.room.base.stub)).receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return 'applicationOutputs' in execution &&
      execution.applicationOutputs.kind === 'REACTION_OFFER_ANSWER'
      ? [execution.applicationOutputs]
      : []
  })
}

async function pendingOccurrences(room: Room) {
  return (await readRoomHistory(room.room.base.stub)).occurrences.filter(
    ({ state }) => state === 'PENDING' || state === 'QUEUED'
  )
}

function undo(room: Room, expectedVersion: number) {
  return room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion
  })
}

describe('the answer to a reaction offer (QUALITY-8.T1c2b2)', () => {
  it('runs the reaction the Character’s player picks as the Character’s own attack, in the same command', async () => {
    const room = await attackedRoom()
    const before = await hitPoints(room)
    const attack = await bite(room, 19)
    const reaction = await daggerReaction(room, attack.commandId)
    const answered = await room.sendAsPlayer(await answerCommand(room, reaction.resolution))
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')

    // One command settled the offer and started the reaction, which waits on its own attack roll.
    const [offer] = await offers(room, attack.commandId)
    expect(offer).toMatchObject({ state: 'COMPLETED', version: 1 })
    expect(await offerAnswers(room)).toMatchObject([
      {
        reactorActorId: REACTOR_ACTOR_ID,
        attackerActorId: ATTACKER_ID,
        child: { commandId: reaction.commandId }
      }
    ])
    await rollReactionAttack(room, reaction.commandId)

    // The reaction committed with no pending action behind it, and its damage is the Wolf's.
    expect(await pendingOccurrences(room)).toEqual([])
    const history = await readRoomHistory(room.room.base.stub)
    expect(
      history.commands.find(({ commandId }) => commandId === reaction.commandId)
    ).toMatchObject({ commandType: 'RESOLVE_ACTION', version: await room.version() })
    expect((await hitPoints(room)).wolf).toBeLessThan(before.wolf)
  })

  it('settles a declined offer with no reaction', async () => {
    const room = await attackedRoom()
    const attack = await bite(room, 19)
    const reaction = await daggerReaction(room, attack.commandId)
    const afterBite = await hitPoints(room)
    const declined = await room.sendAsPlayer(await answerCommand(room, { kind: 'DECLINE' }))
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')

    const [offer] = await offers(room, attack.commandId)
    expect(offer).toMatchObject({ state: 'COMPLETED', version: 1 })
    expect(await offerAnswers(room)).toMatchObject([{ selectedOptionId: null, child: null }])
    expect(await pendingOccurrences(room)).toEqual([])
    const history = await readRoomHistory(room.room.base.stub)
    expect(history.commands.filter(({ commandId }) => commandId === reaction.commandId)).toEqual([])
    expect(await hitPoints(room)).toEqual(afterBite)
  })

  it('refuses the answer of a player who does not control the Character', async () => {
    const room = await attackedRoom({ seatsOtherPlayer: true })
    const attack = await bite(room, 19)
    const version = await room.version()
    const refused = await room.sendAsPlayer(
      await answerCommand(room, { kind: 'DECLINE' }),
      'OTHER_PLAYER'
    )
    expect(refused.type, JSON.stringify(refused)).toBe('COMMAND_REJECTED')
    const [offer] = await offers(room, attack.commandId)
    expect(offer).toMatchObject({ state: 'PENDING', version: 0 })
    expect(await room.version()).toBe(version)
    expect(await offerAnswers(room)).toEqual([])
  })

  it('settles an offer the GM voids as declined', async () => {
    const room = await attackedRoom()
    const attack = await bite(room, 19)
    const reaction = await daggerReaction(room, attack.commandId)
    const [pending] = await offers(room, attack.commandId)
    if (!pending) throw new Error('Expected the reaction offer.')
    const voided = await room.send({
      type: 'VOID_RULE_OCCURRENCE',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      occurrenceId: pending.id,
      expectedOccurrenceVersion: pending.version
    })
    expect(voided.type, JSON.stringify(voided)).toBe('COMMAND_COMMITTED')

    expect(await offerAnswers(room)).toMatchObject([{ selectedOptionId: null, child: null }])
    expect(await pendingOccurrences(room)).toEqual([])
    const history = await readRoomHistory(room.room.base.stub)
    expect(history.commands.filter(({ commandId }) => commandId === reaction.commandId)).toEqual([])
  })

  it('takes the answer back when the reaction it picks is refused, leaving the offer open', async () => {
    const room = await attackedRoom()
    const attack = await bite(room, 19)
    const reaction = await daggerReaction(room, attack.commandId)
    // A Sheet edit leaves the Character Incapacitated while the offer waits.
    const streamVersion = await runInDurableObject(
      room.room.base.stub,
      (_instance, context) =>
        new RoomEncounterStore(context.storage)
          .documents('characterPlayStates')
          .find((row) => row.characterId === REACTOR_ID)!.streamVersion
    )
    const editId = crypto.randomUUID()
    const edited = await room.room.send(editId, {
      scope: 'CHARACTER_SHEET',
      characterId: REACTOR_ID,
      encounterId: room.room.encounterId,
      command: {
        type: 'ADD_CONDITION',
        conditionTypeId: srdSystemRecord.conditionTypes.find(
          ({ code }) => code === 'INCAPACITATED'
        )!.id,
        commandId: editId,
        expectedVersion: streamVersion
      }
    })
    expect(edited.type, JSON.stringify(edited)).toBe('COMMAND_COMMITTED')
    const version = await room.version()

    const refused = await room.sendAsPlayer(await answerCommand(room, reaction.resolution))
    expect(refused.type, JSON.stringify(refused)).toBe('COMMAND_REJECTED')
    const [offer] = await offers(room, attack.commandId)
    expect(offer).toMatchObject({ state: 'PENDING', version: 0 })
    expect(await room.version()).toBe(version)
    expect(await offerAnswers(room)).toEqual([])
    const history = await readRoomHistory(room.room.base.stub)
    expect(history.commands.filter(({ commandId }) => commandId === reaction.commandId)).toEqual([])

    // The offer is still the Character's to answer.
    const declined = await room.sendAsPlayer(await answerCommand(room, { kind: 'DECLINE' }))
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    expect(await pendingOccurrences(room)).toEqual([])
  })

  it('replays a stored answer without running the reaction again', async () => {
    const room = await attackedRoom()
    const attack = await bite(room, 19)
    const reaction = await daggerReaction(room, attack.commandId)
    const command = await answerCommand(room, reaction.resolution)
    expect((await room.sendAsPlayer(command)).type).toBe('COMMAND_COMMITTED')
    const version = await room.version()

    const replayed = await room.sendAsPlayer(command)
    expect(replayed.type, JSON.stringify(replayed)).toBe('COMMAND_COMMITTED')
    expect(await room.version()).toBe(version)
    expect(await offerAnswers(room)).toHaveLength(1)
    const history = await readRoomHistory(room.room.base.stub)
    expect(
      history.occurrences.filter(({ rootCommandId }) => rootCommandId === reaction.commandId)
    ).toHaveLength(1)
    await rollReactionAttack(room, reaction.commandId)
  })

  it('undoes the reaction, its answer and the attack that raised them as one action', async () => {
    const room = await attackedRoom()
    const before = await hitPoints(room)
    const attack = await bite(room, 19)
    expect((await hitPoints(room)).character).toBeLessThan(before.character)
    const reaction = await daggerReaction(room, attack.commandId)
    const answered = await room.sendAsPlayer(await answerCommand(room, reaction.resolution))
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
    await rollReactionAttack(room, reaction.commandId)
    expect((await hitPoints(room)).wolf).toBeLessThan(before.wolf)

    const undone = await undo(room, await room.version())
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await hitPoints(room)).toEqual(before)
    expect(await pendingOccurrences(room)).toEqual([])

    // The reaction is given back with the attack: the same Bite raises the offer again.
    const again = await bite(room, 19)
    expect(await offers(room, again.commandId)).toMatchObject([{ state: 'PENDING' }])
  })

  it('undoes an attack whose offer was declined', async () => {
    const room = await attackedRoom()
    const before = await hitPoints(room)
    await bite(room, 19)
    expect((await hitPoints(room)).character).toBeLessThan(before.character)
    const declined = await room.sendAsPlayer(await answerCommand(room, { kind: 'DECLINE' }))
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')

    const undone = await undo(room, await room.version())
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await hitPoints(room)).toEqual(before)
  })
})
