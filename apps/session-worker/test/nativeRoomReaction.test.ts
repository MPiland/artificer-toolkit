import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { joltingGauntlet } from '@artificer-toolkit/rules-runtime/testing/joltingGauntlet'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { nativeReactionEffectId } from '../src/nativeEncounterAttackReaction.js'
import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf, fireballWolf } from './actionRoomFixture.js'
import { areaReceipts } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  readPendingActionContext,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * REACTION-4.4: an attack that hits a creature holding a reaction such as Shield offers its
 * controller Use or Decline before the outcome applies. Use spends the reaction and the spell slot
 * and grants the AC bonus, which counts against the triggering attack.
 */

const WOLF_ID = testUuid(0x7d0)
const CHARACTER_ACTOR_ID = testUuid(0x7d1)
const CHARACTER_ID = testUuid(0x7d2)
const SHIELD_BONUS = 5
const attackBite = biteWolf('ATTACK')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Wolf whose Bite attacks first, next to a Character who knows and prepares Shield. */
function shieldRoom(
  options: Omit<
    Parameters<typeof actionRoom>[0],
    'actors' | 'ownerFeatureId' | 'characterSpellcasting' | 'characterAction'
  > = {}
) {
  return actionRoom({
    ...options,
    actors: [
      srdCreatureActor({ id: WOLF_ID, creature: attackBite }),
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
    ],
    ownerFeatureId: creatureFeature(attackBite, 'Bite').id,
    characterSpellcasting: { spells: [shield], prepared: [shield.id] }
  })
}
type Room = Awaited<ReturnType<typeof shieldRoom>>

/**
 * Starts the Bite at the Character and answers its attack d20 so the total beats the Character's
 * armor class by `margin` (0 hits it exactly). Returns the armor class the attack was bound to.
 */
async function strike(room: Room, margin: number, acknowledgedWarnings: string[] = []) {
  const started = await room.startAction(
    CHARACTER_ACTOR_ID,
    acknowledgedWarnings as Parameters<Room['startAction']>[1]
  )
  expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the attack d20.')
  const context = await readPendingActionContext(room.room.base.stub)
  if (context.kind !== 'ENCOUNTER_ACTION' || !context.d20Policy)
    throw new Error('Expected a pending attack d20.')
  const { dc, modifier } = context.d20Policy
  const face = dc + margin - modifier
  expect(face, 'the face must be neither a natural 1 nor a natural 20').toBeGreaterThan(1)
  expect(face).toBeLessThan(20)
  const { request } = decision.pending
  const answer = await room.resolve(decision, {
    kind: 'ENTER_DICE',
    requestId: request.requestId,
    rawFaces: request.rollMode === 'NORMAL' ? [face] : [face, face],
    rollMode: request.rollMode
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return { armorClass: dc, commandId: started.command.commandId }
}

/** The reaction choice the room asks of the hit Character. */
async function offeredReaction(room: Room) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'REACTION_CHOICE')
    throw new Error(`Expected the reaction choice, got ${decision.pending.kind}.`)
  return { decision, pending: decision.pending }
}

/** The Bite's settled batch on the Character. */
function characterBatch(history: Awaited<ReturnType<typeof readRoomHistory>>) {
  const batch = areaReceipts(history).children.find(
    ({ outputs }) =>
      outputs.kind === 'CHARACTER_MECHANICS_BATCH' && outputs.targetActorId === CHARACTER_ACTOR_ID
  )?.outputs
  if (batch?.kind !== 'CHARACTER_MECHANICS_BATCH') throw new Error('The Bite left no batch.')
  return batch
}

const hitPointsLost = (batch: ReturnType<typeof characterBatch>) =>
  batch.targetTransition.before.currentHitPoints - batch.targetTransition.after.currentHitPoints

/** The Character's spent spell slots as the Sheet's play state records them. */
const readSpellSlots = (room: Room) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row).spellSlots ?? []
  })

async function undoLastAction(room: Room) {
  const undone = await room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
}

const conditionId = (code: string) => {
  const found = srdSystemRecord.conditionTypes.find((condition) => condition.code === code)
  if (!found) throw new Error(`Missing ${code} condition fixture.`)
  return found.id
}

describe('room reaction to a hit (REACTION-4.4)', () => {
  it('holds the hit for the Character’s choice, applying and spending nothing', async () => {
    const room = await shieldRoom()
    await strike(room, 0)

    const { pending } = await offeredReaction(room)
    expect(pending.targetActorId).toBe(CHARACTER_ACTOR_ID)
    expect(pending.allowedResponses).toEqual(['DECLINE', 'OPTION'])
    const history = await readRoomHistory(room.room.base.stub)
    expect(areaReceipts(history).children).toEqual([])
    expect(await readSpellSlots(room)).toEqual([])
  })

  it('turns the hit into a miss when used: spends the reaction and the slot, and undoes with them', async () => {
    const room = await shieldRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const { armorClass } = await strike(room, 0)
    const { decision, pending } = await offeredReaction(room)

    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()

    const history = await readRoomHistory(room.room.base.stub)
    const batch = characterBatch(history)
    expect(hitPointsLost(batch)).toBe(0)
    expect(batch.reaction).toMatchObject({
      selection: 'USE',
      adjustment: { defenseBefore: armorClass, defenseAfter: armorClass + SHIELD_BONUS },
      spellCastConsumption: {
        characterId: CHARACTER_ID,
        spellId: shield.id,
        slotKey: 'STANDARD:1',
        beforeUsed: 0,
        afterUsed: 1
      },
      actionEconomyTransition: { beforeUsed: 0, afterUsed: 1 }
    })
    expect(batch.reaction?.activeEffectTransitions).toHaveLength(1)
    expect(await readSpellSlots(room)).toEqual([{ slotKey: 'STANDARD:1', used: 1 }])
    expect(history.characterEffects).toHaveLength(1)

    await undoLastAction(room)
    expect(await readSpellSlots(room)).toEqual([])
    const restored = await readRoomHistory(room.room.base.stub)
    expect(restored.characterEffects).toEqual([])
    expect(restored.actors).toEqual(before.actors)

    // The reaction is back: the same hit offers it again.
    await strike(room, 0)
    await offeredReaction(room)
  })

  it('gives the reaction effect an id derived from the command and occurrence, so a replay mints the same one', async () => {
    const room = await shieldRoom()
    const { commandId } = await strike(room, 0)
    const { decision, pending } = await offeredReaction(room)
    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')

    const { characterEffects } = await readRoomHistory(room.room.base.stub)
    expect(characterEffects.map(({ id }) => id)).toEqual([
      nativeReactionEffectId({ commandId, occurrenceId: decision.occurrence.id })
    ])
  })

  it('keeps the hit when declined, applying the outcome and spending nothing', async () => {
    const room = await shieldRoom()
    await strike(room, 0)
    const { decision } = await offeredReaction(room)

    const declined = await room.resolve(decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    const history = await readRoomHistory(room.room.base.stub)
    const batch = characterBatch(history)
    expect(hitPointsLost(batch)).toBe(1)
    expect(batch.reaction).toMatchObject({
      selection: 'DECLINE',
      adjustment: null,
      spellCastConsumption: null,
      actionEconomyTransition: null,
      activeEffectTransitions: []
    })
    expect(await readSpellSlots(room)).toEqual([])
    expect(history.characterEffects).toEqual([])
  })

  it('keeps the hit when the roll still beats the armor class the reaction raised', async () => {
    const room = await shieldRoom()
    await strike(room, SHIELD_BONUS)
    const { decision, pending } = await offeredReaction(room)

    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    const batch = characterBatch(await readRoomHistory(room.room.base.stub))
    expect(hitPointsLost(batch)).toBe(1)
    expect(batch.reaction).toMatchObject({ selection: 'USE' })
    expect(await readSpellSlots(room)).toEqual([{ slotKey: 'STANDARD:1', used: 1 }])
  })

  it('offers a roll that misses the armor class no reaction', async () => {
    const room = await shieldRoom()
    await strike(room, -1)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(characterBatch(await readRoomHistory(room.room.base.stub)).reaction).toBeNull()
  })

  it('lets the player who controls the Character answer, and refuses the attacker’s player', async () => {
    const targetPlayer = await shieldRoom({ playerControlledActorIds: [CHARACTER_ACTOR_ID] })
    await strike(targetPlayer, 0)
    const owned = await offeredReaction(targetPlayer)
    const answered = await targetPlayer.sendAsPlayer(
      targetPlayer.resolveCommand(owned.decision, { kind: 'DECLINE' })
    )
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(targetPlayer.room.base.stub)).toBeNull()

    const wolfPlayer = await shieldRoom({ otherPlayerControlledActorIds: [WOLF_ID] })
    await strike(wolfPlayer, 0)
    const foreign = await offeredReaction(wolfPlayer)
    const refused = await wolfPlayer.sendAsPlayer(
      wolfPlayer.resolveCommand(foreign.decision, { kind: 'DECLINE' }),
      'OTHER_PLAYER'
    )
    expect(refused.type).toBe('COMMAND_REJECTED')
    expect(await readPendingActionDecision(wolfPlayer.room.base.stub)).not.toBeNull()
  })

  it('refuses dice for the held choice and a stale option', async () => {
    const room = await shieldRoom()
    await strike(room, 0)
    const { decision, pending } = await offeredReaction(room)

    const dice = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: 'any-request',
      rawFaces: [20],
      rollMode: 'NORMAL'
    })
    expect(dice.type).toBe('COMMAND_REJECTED')
    const stale = await room.resolve(decision, { kind: 'OPTION', optionId: 'f'.repeat(64) })
    expect(stale.type).toBe('COMMAND_REJECTED')
    expect((await room.pendingDecision()).pending.kind).toBe(pending.kind)
  })

  it('holds the Scene while the choice is pending (D26)', async () => {
    const room = await shieldRoom()
    await strike(room, 0)
    await offeredReaction(room)

    const { base, scene } = room.room
    const token = scene.tokens[1]
    if (!token) throw new Error('Missing Character token.')
    const commandId = crypto.randomUUID()
    base.messages.length = 0
    base.socket.send(
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: 0,
        command: {
          scope: 'SCENE',
          command: {
            commandId,
            correlationId: null,
            expectedEncounterVersion: null,
            expectedSceneVersion: scene.version,
            movementKind: 'VOLUNTARY',
            path: [token.position, { x: token.position.x, y: token.position.y + 50 }],
            sceneId: scene.id,
            tokenId: token.id,
            type: 'MOVE_SCENE_TOKEN'
          }
        }
      })
    )
    await vi.waitFor(() =>
      expect(base.messages).toContainEqual(
        expect.objectContaining({
          type: 'COMMAND_REJECTED',
          commandId,
          code: 'UNAVAILABLE',
          message: 'Waiting on a reaction decision.'
        })
      )
    )
  })

  describe('offers no reaction', () => {
    it('once the Character’s reaction is spent this round', async () => {
      const room = await shieldRoom()
      await strike(room, 0)
      const { decision, pending } = await offeredReaction(room)
      await room.resolve(decision, { kind: 'OPTION', optionId: pending.options[0].optionId })

      // The Shield bonus is still up: the second hit beats the raised armor class outright.
      await strike(room, SHIELD_BONUS, ['ACTION_ECONOMY_UNAVAILABLE'])
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      expect(await readSpellSlots(room)).toEqual([{ slotKey: 'STANDARD:1', used: 1 }])
    })

    it('to a Character that can’t take reactions (D99)', async () => {
      // The Bite's hit, like the Jolting Gauntlet's, sets the target's REACTION_COUNT to 0.
      const [gauntletEffect] = joltingGauntlet().effects ?? []
      const grantPath = gauntletEffect?.paths[1]
      if (!grantPath) throw new Error('The gauntlet has no grant path.')
      const jarringBite = creatureAuthoredDtoSchema.parse({
        ...attackBite,
        features: attackBite.features?.map((feature) =>
          feature.label !== 'Bite'
            ? feature
            : {
                ...feature,
                effects: feature.effects?.map((effect) => ({
                  ...effect,
                  paths: [...effect.paths, grantPath]
                }))
              }
        )
      })
      const room = await actionRoom({
        actors: [
          srdCreatureActor({ id: WOLF_ID, creature: jarringBite }),
          characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
        ],
        ownerFeatureId: creatureFeature(jarringBite, 'Bite').id,
        characterSpellcasting: { spells: [shield], prepared: [shield.id] }
      })
      await strike(room, 0)
      const { decision } = await offeredReaction(room)
      await room.resolve(decision, { kind: 'DECLINE' })
      expect((await readRoomHistory(room.room.base.stub)).characterEffects).toHaveLength(1)

      await strike(room, 0, ['ACTION_ECONOMY_UNAVAILABLE'])
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    })

    it('to a dead Character (D63, D96)', async () => {
      const room = await shieldRoom({
        characterPlay: {
          currentHitPoints: 0,
          deathSaves: { successes: 0, failures: 3, stable: false }
        }
      })
      await strike(room, 0, ['TARGET_DEFEATED'])
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    })

    it('to an Unconscious Character', async () => {
      const room = await shieldRoom({
        characterPlay: {
          conditions: [{ conditionTypeId: conditionId('UNCONSCIOUS'), label: 'Unconscious' }]
        }
      })
      await strike(room, 0)
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    })
  })
})

/**
 * ADR 0038: the reaction is authored from core options alone. A homebrew spell with its own id,
 * label and a +3 bonus behaves as Shield does, with nothing in the engine naming either.
 */
const wardingFlash = (() => {
  const spell = structuredClone(shield)
  const result = spell.effects![0]!.paths![0]! as {
    resultBlock: {
      outcomes: { grants: { modifiers: { payload: { amount: number } }[] } }[]
    }
  }
  result.resultBlock.outcomes[0]!.grants.modifiers[0]!.payload.amount = 3
  return { ...spell, id: testUuid(0x7d3), label: 'Warding Flash' }
})()

describe('room homebrew reaction authored from core options (ADR 0038)', () => {
  it('grants its own bonus against the triggering hit', async () => {
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: WOLF_ID, creature: attackBite }),
        characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
      ],
      ownerFeatureId: creatureFeature(attackBite, 'Bite').id,
      characterSpellcasting: { spells: [wardingFlash], prepared: [wardingFlash.id] }
    })
    const { armorClass } = await strike(room, 2)
    const { decision, pending } = await offeredReaction(room)
    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')

    const batch = characterBatch(await readRoomHistory(room.room.base.stub))
    expect(batch.reaction).toMatchObject({
      selection: 'USE',
      adjustment: { defenseBefore: armorClass, defenseAfter: armorClass + 3 },
      spellCastConsumption: { spellId: wardingFlash.id }
    })
    // The roll beat the old armor class by 2, so +3 turns the hit into a miss.
    expect(hitPointsLost(batch)).toBe(0)
  })
})

describe('room Shield cast as an action', () => {
  it('is refused: a reaction is used when its trigger happens', async () => {
    const room = await actionRoom({
      actors: [characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })],
      characterSpellcasting: { spells: [shield], prepared: [shield.id] },
      characterAction: (action) => action.label.includes('Shield')
    })
    const { answer } = await room.startAction(CHARACTER_ACTOR_ID)
    expect(answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(answer)).toContain('REACTION_TRIGGER_ONLY')
  })
})

describe('room reaction-only action over an area', () => {
  it('is refused as a single-target action is: a reaction is used when its trigger happens', async () => {
    const bite = fireballWolf()
    const creature = creatureAuthoredDtoSchema.parse({
      ...bite,
      features: bite.features?.map((feature) =>
        feature.label !== 'Bite'
          ? feature
          : {
              ...feature,
              effects: feature.effects?.map((effect) => ({
                ...effect,
                invocation: {
                  ...effect.invocation,
                  activation: { code: 'REACTION' as const, amount: 1 },
                  reactionTrigger: {
                    kind: 'MOVEMENT' as const,
                    stage: 'ENTER_REACH' as const,
                    perceptionRequirement: null,
                    eligibilityDefinitionId: testUuid(0x7d4)
                  }
                }
              }))
            }
      )
    })
    const room = await actionRoom({
      actors: [srdCreatureActor({ id: WOLF_ID, creature })],
      ownerFeatureId: creatureFeature(creature, 'Bite').id
    })
    const { answer } = await room.startAreaAction({ x: 50, y: 150 })
    expect(answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(answer)).toContain('REACTION_TRIGGER_ONLY')
  })
})
