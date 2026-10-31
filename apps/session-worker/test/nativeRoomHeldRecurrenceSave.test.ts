import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ActorRelationshipAuthored } from '@artificer-toolkit/shared/authored'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'
import { seededSrdCreature } from './seededSrdCreature.js'

const SOURCE_ID = testUuid(0x7a0)
const CHARACTER_ACTOR_ID = testUuid(0x7a1)
const CHARACTER_ID = testUuid(0x7a2)
const PIERCING_ID = SRD_DAMAGE_TYPES.find(({ code }) => code === 'PIERCING')!.id
const ACID_ID = SRD_DAMAGE_TYPES.find(({ code }) => code === 'ACID')!.id

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * The seeded Chain Devil, its Chain hold's start-of-turn piercing edited by `edit`: a fixture
 * Creature authored from the core options, not an SRD stat block.
 */
function chainDevilWith(
  edit: (recurrence: NonNullable<ActorRelationshipAuthored['recurrence']>) => void
): CreatureAuthored {
  const creature = structuredClone(seededSrdCreature('Chain Devil'))
  const outcome = creatureFeature(creature, 'Chain')
    .effects?.flatMap((effect) => effect.paths)
    .flatMap((path) => ('resultBlock' in path && path.resultBlock ? path.resultBlock.outcomes : []))
    .find((candidate) => candidate.effectKind === 'ACTOR_RELATIONSHIP')
  if (outcome?.effectKind !== 'ACTOR_RELATIONSHIP' || !outcome.recurrence)
    throw new Error('The Chain Devil’s Chain holds no recurring relationship.')
  edit(outcome.recurrence)
  return creature
}

/** A DC 14 Constitution save against the hold's piercing. */
function withHoldSave(recurrence: NonNullable<ActorRelationshipAuthored['recurrence']>) {
  recurrence.savingThrow = {
    id: testUuid(0x7a3),
    dcMethod: 'FIXED_DC',
    abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CONSTITUTION,
    baseDc: 14
  }
}

/** The hold's piercing recurs at the start of the Devil's turns instead of the held creature's. */
function onTheDevilsTurns(recurrence: NonNullable<ActorRelationshipAuthored['recurrence']>) {
  recurrence.turnAnchor = { actor: 'SOURCE', boundary: 'START_OF_TURN' }
}

/** The hold's 2d6 are hit points lost directly instead of piercing damage. */
function asHitPointLoss(recurrence: NonNullable<ActorRelationshipAuthored['recurrence']>) {
  recurrence.outcome = {
    id: recurrence.outcome.id,
    effectKind: 'HIT_POINT_LOSS',
    diceConfig: '2d6'
  }
}

/**
 * The Chain Devil's Chain hits and holds the Character; the GM's dice roll automatically, the
 * Character's do not.
 */
async function heldCharacterRoom(creature: CreatureAuthored) {
  const room = await actionRoom({
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature }),
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
    ],
    ownerFeatureId: creatureFeature(creature, 'Chain').id,
    autoRoll: 'GAME_MASTER',
    // A natural 19 hits; every later die rolls 1.
    rolls: [18],
    fallbackRoll: 0
  })
  // A printed reach can't be measured without a Scene context, so the GM acknowledges it (D11).
  const { answer } = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  expect((await readRoomHistory(room.room.base.stub)).characterEffects).toHaveLength(1)
  return room
}
type HeldCharacterRoom = Awaited<ReturnType<typeof heldCharacterRoom>>

type RoomAnswer = Awaited<ReturnType<HeldCharacterRoom['send']>>

/** The decision a committed answer leaves pending, if any. */
function pendingOf(answer: RoomAnswer) {
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return answer.type === 'COMMAND_COMMITTED' &&
    answer.delta?.scope === 'ENCOUNTER' &&
    'occurrence' in answer.delta.result
    ? (answer.delta.result.occurrence?.pending ?? null)
    : null
}

/** Ends the turn: the ADVANCE_TURN's command id and the decision it leaves pending. */
async function advance(room: HeldCharacterRoom) {
  const commandId = crypto.randomUUID()
  const answer = await room.send({
    type: 'ADVANCE_TURN',
    encounterId: room.room.encounterId,
    commandId,
    expectedVersion: await room.version()
  })
  return { commandId, pending: pendingOf(answer) }
}

/** Answers the pending turn decision with `resolution`; the decision the answer leaves pending. */
async function answer(
  room: HeldCharacterRoom,
  pending: { occurrenceId: string; occurrenceVersion: number },
  resolution: Record<string, unknown>
) {
  return pendingOf(
    await room.send({
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      correlationId: null,
      resolution
    })
  )
}

/** The turn-effect executions the ADVANCE_TURN `commandId` journaled at its incoming turn start. */
async function incomingExecutions(room: HeldCharacterRoom, commandId: string) {
  const { receipts } = await readRoomHistory(room.room.base.stub)
  const receipt = receipts.find((row) => row.commandId === commandId)
  if (!receipt) return []
  const result = parseReceiptExecution(receipt)
  if (result.status !== 'TURN_LIFECYCLE_COMPLETE') return []
  return result.incomingTurn.kind === 'EXECUTED' ? result.incomingTurn.executions : []
}

/** The DAMAGE applications of one turn-effect execution, as [amount, damage type] pairs. */
function damageOf(execution: Awaited<ReturnType<typeof incomingExecutions>>[number] | undefined) {
  return execution?.applications.flatMap((application) =>
    application.kind === 'DAMAGE' ? [[application.requestedAmount, application.damageTypeId]] : []
  )
}

/** The HIT_POINT_LOSS applications of one execution, as [requested, applied] pairs. */
function hitPointLossOf(
  execution: Awaited<ReturnType<typeof incomingExecutions>>[number] | undefined
) {
  return execution?.applications.flatMap((application) =>
    application.kind === 'HIT_POINT_LOSS'
      ? [[application.requestedAmount, application.appliedAmount]]
      : []
  )
}

/** The Devil's own turn is off the anchor: nothing asks, nothing recurs, and the hold stands. */
async function expectNothingOnTheDevilsTurn(room: HeldCharacterRoom) {
  const devilsTurn = await advance(room)
  expect(devilsTurn.pending).toBeNull()
  expect(await incomingExecutions(room, devilsTurn.commandId)).toEqual([])
  expect((await readRoomHistory(room.room.base.stub)).characterEffects).toHaveLength(1)
}

describe('a held creature’s relationship recurrence in the room (SPELLS-33.T6n1)', () => {
  it('deals the Chain’s piercing at the held Character’s turn start, its dice rolled by the Devil’s GM', async () => {
    const room = await heldCharacterRoom(seededSrdCreature('Chain Devil'))

    const charactersTurn = await advance(room)
    // The 2d6 belong to the Devil, whose GM auto-rolls; the Character is never asked.
    expect(charactersTurn.pending).toBeNull()
    const [execution, ...others] = await incomingExecutions(room, charactersTurn.commandId)
    expect(others).toEqual([])
    expect(execution).toMatchObject({ targetActorId: CHARACTER_ACTOR_ID, stage: 'START_OF_TURN' })
    expect(damageOf(execution)).toEqual([[2, PIERCING_ID]])
    expect((await readRoomHistory(room.room.base.stub)).characterEffects).toHaveLength(1)

    await expectNothingOnTheDevilsTurn(room)
  })

  it.each([
    { label: 'fails', face: 1, damage: [[2, PIERCING_ID]] },
    { label: 'makes', face: 20, damage: [] }
  ])(
    'asks the held Character for the save at its turn start; when it $label it, the hold stands and nothing recurs on the Devil’s turn',
    async ({ face, damage }) => {
      const room = await heldCharacterRoom(chainDevilWith(withHoldSave))

      const charactersTurn = await advance(room)
      const save = charactersTurn.pending
      if (save?.kind !== 'D20_EVIDENCE') throw new Error('Expected the Character’s save prompt.')
      expect(save.rollerActorId).toBe(CHARACTER_ACTOR_ID)
      // A failed save's damage dice belong to the Devil, whose GM auto-rolls them.
      expect(
        await answer(room, save, {
          kind: 'ENTER_DICE',
          requestId: save.request.requestId,
          rawFaces: save.request.rollMode === 'NORMAL' ? [face] : [face, face],
          rollMode: save.request.rollMode
        })
      ).toBeNull()

      const [execution, ...others] = await incomingExecutions(room, charactersTurn.commandId)
      expect(others).toEqual([])
      expect(execution).toMatchObject({ targetActorId: CHARACTER_ACTOR_ID, stage: 'START_OF_TURN' })
      expect(damageOf(execution)).toEqual(damage)
      // Either way the hold stands.
      expect((await readRoomHistory(room.room.base.stub)).characterEffects).toHaveLength(1)

      await expectNothingOnTheDevilsTurn(room)
    }
  )
})

describe('a held creature’s relationship recurrence on its holder’s turns (SPELLS-33.T6n2)', () => {
  /** The held Character's own turn is off the anchor: nothing asks, nothing recurs. */
  async function expectNothingOnTheCharactersTurn(room: HeldCharacterRoom) {
    const charactersTurn = await advance(room)
    expect(charactersTurn.pending).toBeNull()
    expect(await incomingExecutions(room, charactersTurn.commandId)).toEqual([])
  }

  it('deals the Chain’s piercing to the held Character at the Devil’s turn start, rolled by the Devil’s GM', async () => {
    const room = await heldCharacterRoom(chainDevilWith(onTheDevilsTurns))
    await expectNothingOnTheCharactersTurn(room)

    const devilsTurn = await advance(room)
    expect(devilsTurn.pending).toBeNull()
    const [execution, ...others] = await incomingExecutions(room, devilsTurn.commandId)
    expect(others).toEqual([])
    expect(execution).toMatchObject({ targetActorId: CHARACTER_ACTOR_ID, stage: 'START_OF_TURN' })
    expect(damageOf(execution)).toEqual([[2, PIERCING_ID]])
    expect((await readRoomHistory(room.room.base.stub)).characterEffects).toHaveLength(1)
  })

  it.each([
    { label: 'fails', face: 1, damage: [[2, PIERCING_ID]] },
    { label: 'makes', face: 20, damage: [] }
  ])(
    'asks the held Character for the save at the Devil’s turn start; when it $label it, the hold stands',
    async ({ face, damage }) => {
      const room = await heldCharacterRoom(
        chainDevilWith((recurrence) => {
          withHoldSave(recurrence)
          onTheDevilsTurns(recurrence)
        })
      )
      await expectNothingOnTheCharactersTurn(room)

      const devilsTurn = await advance(room)
      const save = devilsTurn.pending
      if (save?.kind !== 'D20_EVIDENCE') throw new Error('Expected the Character’s save prompt.')
      // The save belongs to the held Character; a failed save's damage dice to the Devil's GM.
      expect(save.rollerActorId).toBe(CHARACTER_ACTOR_ID)
      expect(
        await answer(room, save, {
          kind: 'ENTER_DICE',
          requestId: save.request.requestId,
          rawFaces: save.request.rollMode === 'NORMAL' ? [face] : [face, face],
          rollMode: save.request.rollMode
        })
      ).toBeNull()

      const [execution, ...others] = await incomingExecutions(room, devilsTurn.commandId)
      expect(others).toEqual([])
      expect(execution).toMatchObject({ targetActorId: CHARACTER_ACTOR_ID, stage: 'START_OF_TURN' })
      expect(damageOf(execution)).toEqual(damage)
      expect((await readRoomHistory(room.room.base.stub)).characterEffects).toHaveLength(1)
    }
  )
})

describe('a held creature’s recurrence as hit points lost directly (SPELLS-33.T6n2b)', () => {
  it('takes the hold’s 2d6 from the held Character’s hit points, with no damage, at its turn start', async () => {
    const room = await heldCharacterRoom(chainDevilWith(asHitPointLoss))

    const charactersTurn = await advance(room)
    expect(charactersTurn.pending).toBeNull()
    const [execution, ...others] = await incomingExecutions(room, charactersTurn.commandId)
    expect(others).toEqual([])
    expect(execution).toMatchObject({ targetActorId: CHARACTER_ACTOR_ID, stage: 'START_OF_TURN' })
    expect(damageOf(execution)).toEqual([])
    expect(hitPointLossOf(execution)).toEqual([[2, 2]])
    expect((await readRoomHistory(room.room.base.stub)).characterEffects).toHaveLength(1)

    await expectNothingOnTheDevilsTurn(room)
  })

  it.each([
    { label: 'fails', face: 1, loss: [[2, 2]] },
    { label: 'makes', face: 20, loss: [] }
  ])(
    'loses the hit points only when the held Character  its save, and the hold stands',
    async ({ face, loss }) => {
      const room = await heldCharacterRoom(
        chainDevilWith((recurrence) => {
          withHoldSave(recurrence)
          asHitPointLoss(recurrence)
        })
      )

      const charactersTurn = await advance(room)
      const save = charactersTurn.pending
      if (save?.kind !== 'D20_EVIDENCE') throw new Error('Expected the Character’s save prompt.')
      expect(save.rollerActorId).toBe(CHARACTER_ACTOR_ID)
      expect(
        await answer(room, save, {
          kind: 'ENTER_DICE',
          requestId: save.request.requestId,
          rawFaces: save.request.rollMode === 'NORMAL' ? [face] : [face, face],
          rollMode: save.request.rollMode
        })
      ).toBeNull()

      const [execution, ...others] = await incomingExecutions(room, charactersTurn.commandId)
      expect(others).toEqual([])
      expect(damageOf(execution)).toEqual([])
      expect(hitPointLossOf(execution)).toEqual(loss)
      expect((await readRoomHistory(room.room.base.stub)).characterEffects).toHaveLength(1)
    }
  )
})

describe('a swallowed creature’s acid on its swallower’s turns (SPELLS-33.T6n3)', () => {
  it('holds the Character by the Toad’s bite, swallows it, and burns it at the Toad’s turn start only', async () => {
    const toad = seededSrdCreature('Giant Toad')
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: SOURCE_ID, creature: toad }),
        characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
      ],
      ownerFeatureId: creatureFeature(toad, 'Bite').id,
      autoRoll: 'GAME_MASTER',
      // A natural 19 hits; every later die rolls 1.
      rolls: [18],
      fallbackRoll: 0
    })
    const bite = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(bite.answer.type, JSON.stringify(bite.answer)).toBe('COMMAND_COMMITTED')

    const swallow = (await room.actionChoices()).actions.find(({ label }) => label === 'Swallow')
    if (!swallow) throw new Error('The Toad offers no Swallow.')
    expect(swallow.target).toMatchObject({ kind: 'ACTOR', heldBySource: true })
    const swallowed = await room.startAction(
      CHARACTER_ACTOR_ID,
      ['ACTION_ECONOMY_UNAVAILABLE', 'TARGET_RANGE_UNCHECKED'],
      null,
      null,
      swallow.id
    )
    expect(swallowed.answer.type, JSON.stringify(swallowed.answer)).toBe('COMMAND_COMMITTED')

    const charactersTurn = await advance(room)
    expect(charactersTurn.pending).toBeNull()
    expect(await incomingExecutions(room, charactersTurn.commandId)).toEqual([])

    const toadsTurn = await advance(room)
    expect(toadsTurn.pending).toBeNull()
    const executions = await incomingExecutions(room, toadsTurn.commandId)
    expect(executions.map(damageOf)).toContainEqual([[3, ACID_ID]])
  })
})
