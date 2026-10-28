import { runInDurableObject } from 'cloudflare:test'
import { encounterReactionEffectId } from '@artificer-toolkit/rules-runtime/encounterReactionChoice'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  absorbElementsSpell,
  srdDamageTypeId
} from '@artificer-toolkit/rules-runtime/testing/absorbElementsSpell'
import { joltingGauntlet } from '@artificer-toolkit/rules-runtime/testing/joltingGauntlet'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { encounterActionPendingContextDtoSchema } from '@artificer-toolkit/schema/shared/encounterActionPending'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { monk } from '@artificer-toolkit/source-data/srd/classes/monk.js'
import { rogue } from '@artificer-toolkit/source-data/srd/classes/rogue.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf, fireballWolf } from './actionRoomFixture.js'
import { areaReceipts } from './areaRoomReads.js'
import { seedModifierGrant } from './grantSeed.js'
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

function biteDamage(batch: ReturnType<typeof characterBatch>) {
  const damage = batch.applications.find((application) => application.kind === 'DAMAGE')
  if (damage?.kind !== 'DAMAGE') throw new Error('The Bite dealt no damage.')
  return damage
}

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
        owner: { kind: 'CHARACTER', characterId: CHARACTER_ID },
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

  it('ends the reacting Character’s own effect that ends on a cast, and its condition, when Shield is cast; one undo gives both back (SPELLS-27.1)', async () => {
    const deafened = conditionId('DEAFENED')
    const room = await shieldRoom({
      characterPlay: { conditions: [{ conditionTypeId: deafened, label: 'Deafened' }] },
      seed: seedModifierGrant({
        sourceActorId: CHARACTER_ACTOR_ID,
        holderActorId: CHARACTER_ACTOR_ID,
        lifecycle: {},
        endsOnCast: true,
        ownedConditionId: deafened
      })
    })
    const effectIds = async () =>
      (await readRoomHistory(room.room.base.stub)).characterEffects.map(({ id }) => id)
    const conditionIds = () =>
      runInDurableObject(room.room.base.stub, (_instance, context) => {
        const row = new RoomEncounterStore(context.storage)
          .documents('characterPlayStates')
          .find((candidate) => candidate.characterId === CHARACTER_ID)
        if (!row) throw new Error('Missing room Character play state.')
        return (readCharacterPlay(row).conditions ?? []).map(
          ({ conditionTypeId }) => conditionTypeId
        )
      })
    const [seeded] = await effectIds()
    expect(await effectIds()).toHaveLength(1)
    expect(await conditionIds()).toEqual([deafened])

    await strike(room, 0)
    const { decision, pending } = await offeredReaction(room)
    expect(await effectIds()).toEqual([seeded])
    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')

    const afterShield = await effectIds()
    expect(afterShield).toHaveLength(1)
    expect(afterShield).not.toContain(seeded)
    expect(await conditionIds()).toEqual([])

    await undoLastAction(room)
    expect(await effectIds()).toEqual([seeded])
    expect(await conditionIds()).toEqual([deafened])
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
      encounterReactionEffectId({ commandId, occurrenceId: decision.occurrence.id })
    ])
  })

  it('replays the answer without using the reaction again or minting a second effect', async () => {
    const room = await shieldRoom()
    await strike(room, 0)
    const { decision, pending } = await offeredReaction(room)
    const answer = room.resolveCommand(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect((await room.send(answer)).type).toBe('COMMAND_COMMITTED')
    const version = await room.version()
    const settled = await readRoomHistory(room.room.base.stub)

    const replayed = await room.send(answer)
    expect(replayed.type, JSON.stringify(replayed)).toBe('COMMAND_COMMITTED')
    expect(await room.version()).toBe(version)
    const afterReplay = await readRoomHistory(room.room.base.stub)
    expect(afterReplay.characterEffects.map(({ id }) => id)).toEqual(
      settled.characterEffects.map(({ id }) => id)
    )
    expect(afterReplay.characterEffects).toHaveLength(1)
    expect(await readSpellSlots(room)).toEqual([{ slotKey: 'STANDARD:1', used: 1 }])
  })

  it('refuses an option the pause never offered, leaving the hit held for the real answer', async () => {
    const room = await shieldRoom()
    await strike(room, 0)
    const { decision, pending } = await offeredReaction(room)
    const version = await room.version()
    const unissued = 'c'.repeat(64)

    const refused = await room.resolve(decision, { kind: 'OPTION', optionId: unissued })
    expect(refused.type, JSON.stringify(refused)).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(refused)).toContain('VERSION_STALE')
    expect(JSON.stringify(refused)).toContain(
      `The decision option ${unissued} is not offered by this pause.`
    )
    expect(await room.version()).toBe(version)
    expect(await readSpellSlots(room)).toEqual([])

    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
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

/** Shield's reaction authored as a Fighter Feature that spends one of its two charges. */
const chargedWard = (() => {
  const chargeId = testUuid(0x7d5)
  return {
    id: testUuid(0x7d6),
    label: 'Charged Ward',
    description: 'A reaction paid from a charge pool.',
    attributes: ['LIMITED_USE'],
    charges: {
      id: chargeId,
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      amount: 2
    },
    availableAtLevel: 1,
    order: 1,
    effects: shield.effects!.map((effect) => ({
      ...effect,
      invocation: { ...effect.invocation, resourceUse: { chargeId, cost: 1 } }
    }))
  } satisfies ClassFeature
})()

describe('room reaction paid from a pool', () => {
  const wardRoom = (feature: ClassFeature) =>
    actionRoom({
      actors: [
        srdCreatureActor({ id: WOLF_ID, creature: attackBite }),
        characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
      ],
      ownerFeatureId: creatureFeature(attackBite, 'Bite').id,
      characterClassFeatures: [feature]
    })

  it('is offered when it spends nothing', async () => {
    const room = await wardRoom({ ...chargedWard, effects: shield.effects })
    await strike(room, 0)
    await offeredReaction(room)
  })

  // A reaction's receipt carries no pool spend, so offering one would let it be used without limit.
  it('is not offered when it spends a charge, since the use could not be spent', async () => {
    const room = await wardRoom(chargedWard)
    await strike(room, 0)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
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

describe('room reaction authored over an area', () => {
  // The compiler admits an area only for an Action, so a reaction-triggered area never reaches the
  // shared window admission (`refuseActionOutsideItsWindow`): it is refused as an unavailable source.
  it('cannot be taken as an action', async () => {
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
    expect(JSON.stringify(answer)).toContain('SOURCE_REQUIREMENTS_NOT_MET')
  })
})

/**
 * REACTION-4.2: a user-authored reaction triggered by damage of chosen types (Absorb Elements) is
 * offered before that damage applies, grants resistance to it, and leaves its follow-up benefit.
 */
describe('room reaction to damage taken (REACTION-4.2)', () => {
  const absorbElements = absorbElementsSpell(['FIRE', 'COLD'])
  const fireBite = biteWolf('ATTACK', {
    damage: 10,
    save: { ability: 'DEXTERITY', damageTypeCode: 'FIRE' }
  })

  const absorbRoom = (bite = fireBite) =>
    actionRoom({
      actors: [
        srdCreatureActor({ id: WOLF_ID, creature: bite }),
        characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
      ],
      ownerFeatureId: creatureFeature(bite, 'Bite').id,
      characterSpellcasting: { spells: [absorbElements], prepared: [absorbElements.id] }
    })

  it('halves the damage when used, spends the reaction and the slot, and leaves the follow-up effect', async () => {
    const room = await absorbRoom()
    await strike(room, 0)
    const { decision, pending } = await offeredReaction(room)
    expect(await readSpellSlots(room)).toEqual([])

    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')

    const history = await readRoomHistory(room.room.base.stub)
    const batch = characterBatch(history)
    expect(hitPointsLost(batch)).toBe(5)
    expect(batch.reaction).toMatchObject({
      selection: 'USE',
      reaction: { trigger: 'DAMAGE_TAKEN' },
      spellCastConsumption: { spellId: absorbElements.id, afterUsed: 1 },
      actionEconomyTransition: { beforeUsed: 0, afterUsed: 1 }
    })
    expect(history.characterEffects).toHaveLength(1)
    expect(await readSpellSlots(room)).toEqual([{ slotKey: 'STANDARD:1', used: 1 }])
  })

  it('leaves the caster resistance to the type that hit and slot-scaled damage on melee attacks', async () => {
    const room = await absorbRoom()
    await strike(room, 0)
    const { decision, pending } = await offeredReaction(room)
    await room.resolve(decision, { kind: 'OPTION', optionId: pending.options[0].optionId })

    const [effect] = (await readRoomHistory(room.room.base.stub)).characterEffects
    const [grant] = JSON.parse(effect!.definitionJson).stateContributions
    expect(grant.kind).toBe('MODIFIER_GRANT')
    expect(grant.modifiers).toHaveLength(2)
    expect(grant.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          valueDomainCode: 'DAMAGE_RESISTANCE',
          payload: { damageTypeId: srdDamageTypeId('FIRE') }
        }),
        expect.objectContaining({
          valueDomainCode: 'DAMAGE',
          modifierKind: 'BONUS',
          domain: { attackDomain: 'MELEE' },
          payload: expect.objectContaining({ valueKind: 'FIXED', amount: 2 })
        })
      ])
    )
  })

  it('is offered when a later chosen type is the one the hit deals', async () => {
    const room = await absorbRoom(
      biteWolf('ATTACK', { damage: 10, save: { ability: 'DEXTERITY', damageTypeCode: 'COLD' } })
    )
    await strike(room, 0)
    const { decision, pending } = await offeredReaction(room)

    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    const history = await readRoomHistory(room.room.base.stub)
    expect(hitPointsLost(characterBatch(history))).toBe(5)
    const [effect] = history.characterEffects
    const [grant] = JSON.parse(effect!.definitionJson).stateContributions
    expect(
      grant.modifiers.filter(
        ({ valueDomainCode }: { valueDomainCode: string }) =>
          valueDomainCode === 'DAMAGE_RESISTANCE'
      )
    ).toEqual([
      expect.objectContaining({
        payload: { damageTypeId: srdDamageTypeId('COLD') }
      })
    ])
  })

  it('applies the whole damage when declined, spending nothing', async () => {
    const room = await absorbRoom()
    await strike(room, 0)
    const { decision } = await offeredReaction(room)

    const declined = await room.resolve(decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    const history = await readRoomHistory(room.room.base.stub)
    expect(hitPointsLost(characterBatch(history))).toBe(10)
    expect(history.characterEffects).toEqual([])
    expect(await readSpellSlots(room)).toEqual([])
  })

  it('undoes the reaction with the damage it halved', async () => {
    const room = await absorbRoom()
    const before = await readRoomHistory(room.room.base.stub)
    await strike(room, 0)
    const { decision, pending } = await offeredReaction(room)
    await room.resolve(decision, { kind: 'OPTION', optionId: pending.options[0].optionId })

    await undoLastAction(room)
    expect(await readSpellSlots(room)).toEqual([])
    const restored = await readRoomHistory(room.room.base.stub)
    expect(restored.characterEffects).toEqual([])
    expect(restored.actors).toEqual(before.actors)
  })

  it('offers nothing for damage of a type the spell was not authored for', async () => {
    const room = await absorbRoom(biteWolf('ATTACK', { damage: 10 }))
    await strike(room, 0)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const batch = characterBatch(await readRoomHistory(room.room.base.stub))
    expect(batch.reaction).toBeNull()
    expect(hitPointsLost(batch)).toBe(10)
  })

  it('offers nothing once the Character’s reaction is spent this round', async () => {
    const room = await absorbRoom()
    await strike(room, 0)
    const { decision, pending } = await offeredReaction(room)
    await room.resolve(decision, { kind: 'OPTION', optionId: pending.options[0].optionId })

    await strike(room, 0, ['ACTION_ECONOMY_UNAVAILABLE'])
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await readSpellSlots(room)).toEqual([{ slotKey: 'STANDARD:1', used: 1 }])
  })
})

/**
 * REACTION-4.2: a hit offers every reaction its target can use, as a menu (a Character has one
 * reaction a round), so Shield and Absorb Elements both appear on one elemental hit.
 */
describe('room reaction menu for one hit (REACTION-4.2)', () => {
  const absorbElements = absorbElementsSpell(['FIRE'])
  const fireBite = biteWolf('ATTACK', {
    damage: 10,
    save: { ability: 'DEXTERITY', damageTypeCode: 'FIRE' }
  })
  const menuRoom = () =>
    actionRoom({
      actors: [
        srdCreatureActor({ id: WOLF_ID, creature: fireBite }),
        characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
      ],
      ownerFeatureId: creatureFeature(fireBite, 'Bite').id,
      characterSpellcasting: {
        spells: [shield, absorbElements],
        prepared: [shield.id, absorbElements.id]
      }
    })

  /** The held offer, with the option that uses the reaction of each trigger. */
  async function offeredMenu(room: Awaited<ReturnType<typeof menuRoom>>) {
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'REACTION_CHOICE') throw new Error('Expected the reaction menu.')
    const context = await readPendingActionContext(room.room.base.stub)
    if (context.kind !== 'ENCOUNTER_ACTION' || context.pause?.kind !== 'REACTION')
      throw new Error('Expected a held reaction offer.')
    const reactionChoice = context.pause.payload
    const optionFor = (trigger: 'ATTACKED_SELF' | 'DAMAGE_TAKEN') => {
      const reaction = reactionChoice.reactions.find((pin) => pin.trigger === trigger)
      if (!reaction) throw new Error(`The menu offers no ${trigger} reaction.`)
      return { kind: 'OPTION' as const, optionId: reaction.useOptionId }
    }
    return { decision, pending: decision.pending, context, reactionChoice, optionFor }
  }

  it('offers Shield and Absorb Elements together for one fire hit', async () => {
    const room = await menuRoom()
    await strike(room, 0)
    const { pending, reactionChoice } = await offeredMenu(room)

    // Absorb Elements scales with its slot, so it is offered at each of the five levels the Character
    // owns, lowest first; Shield does not, so it is offered once.
    expect(pending.options).toHaveLength(6)
    expect(pending.options.map(({ optionId }) => optionId)).toEqual(
      reactionChoice.reactions.map(({ useOptionId }) => useOptionId)
    )
    expect(reactionChoice.reactions.map(({ trigger }) => trigger)).toEqual([
      'ATTACKED_SELF',
      ...Array(5).fill('DAMAGE_TAKEN')
    ])
    expect(await readSpellSlots(room)).toEqual([])
  })

  it('uses the reaction chosen and leaves the other unspent', async () => {
    const room = await menuRoom()
    await strike(room, 0)
    const { decision, optionFor } = await offeredMenu(room)

    const used = await room.resolve(decision, optionFor('DAMAGE_TAKEN'))
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    const history = await readRoomHistory(room.room.base.stub)
    const batch = characterBatch(history)
    expect(hitPointsLost(batch)).toBe(5)
    expect(batch.reaction).toMatchObject({
      selection: 'USE',
      reaction: { trigger: 'DAMAGE_TAKEN' },
      spellCastConsumption: { spellId: absorbElements.id }
    })
    expect(history.characterEffects).toHaveLength(1)
    expect(await readSpellSlots(room)).toEqual([{ slotKey: 'STANDARD:1', used: 1 }])
  })

  it('uses the other reaction when that is the one chosen', async () => {
    const room = await menuRoom()
    await strike(room, 0)
    const { decision, optionFor } = await offeredMenu(room)

    const used = await room.resolve(decision, optionFor('ATTACKED_SELF'))
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    const batch = characterBatch(await readRoomHistory(room.room.base.stub))
    expect(hitPointsLost(batch)).toBe(0)
    expect(batch.reaction).toMatchObject({
      selection: 'USE',
      reaction: { trigger: 'ATTACKED_SELF' },
      spellCastConsumption: { spellId: shield.id }
    })
  })

  it('declines every offered reaction at once, spending nothing', async () => {
    const room = await menuRoom()
    await strike(room, 0)
    const { decision } = await offeredMenu(room)

    const declined = await room.resolve(decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    const history = await readRoomHistory(room.room.base.stub)
    expect(hitPointsLost(characterBatch(history))).toBe(10)
    expect(history.characterEffects).toEqual([])
    expect(await readSpellSlots(room)).toEqual([])
  })

  it('seals only reactions that belong to the creature the hit lands on', async () => {
    const room = await menuRoom()
    await strike(room, 0)
    const { context, reactionChoice } = await offeredMenu(room)

    const parses = (value: unknown) =>
      encounterActionPendingContextDtoSchema.safeParse(value).success
    expect(parses(context)).toBe(true)
    const [first, second] = reactionChoice.reactions
    expect(
      parses({
        ...context,
        pause: {
          kind: 'REACTION',
          payload: { ...reactionChoice, reactions: [first, { ...second, reactorActorId: WOLF_ID }] }
        }
      })
    ).toBe(false)
  })
})

/**
 * SPELLS-31.T5a (D156): the Rogue's Uncanny Dodge, authored as an `ATTACKED_SELF` reaction that
 * needs sight and grants an `INCOMING_DAMAGE` HALVE adjustment, halves the hit that triggered it.
 */
describe('room Uncanny Dodge reaction to a hit (SPELLS-31.1)', () => {
  /** The SRD Uncanny Dodge feature, acquired by the fixture Character at its first level. */
  const uncannyDodge = (): ClassFeature => {
    const feature = rogue.features?.find((entry) => entry.label === 'Uncanny Dodge')
    if (!feature) throw new Error('The SRD Rogue must author Uncanny Dodge.')
    return { ...feature, availableAtLevel: 1 }
  }

  const dodgeRoom = (options: Pick<Parameters<typeof actionRoom>[0], 'characterPlay'> = {}) =>
    actionRoom({
      ...options,
      actors: [
        srdCreatureActor({ id: WOLF_ID, creature: attackBite }),
        characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
      ],
      ownerFeatureId: creatureFeature(attackBite, 'Bite').id,
      characterClassFeatures: [uncannyDodge()]
    })

  it('halves the hit when used, spends the reaction, and undoes with it', async () => {
    const room = await dodgeRoom()
    const before = await readRoomHistory(room.room.base.stub)
    await strike(room, 0)
    const { decision, pending } = await offeredReaction(room)
    expect(pending.targetActorId).toBe(CHARACTER_ACTOR_ID)

    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')

    const batch = characterBatch(await readRoomHistory(room.room.base.stub))
    const damage = biteDamage(batch)
    expect(damage.incomingHalved).toBe(true)
    expect(damage.resolvedAmount).toBe(Math.floor(damage.requestedAmount / 2))
    expect(hitPointsLost(batch)).toBe(damage.resolvedAmount)
    expect(batch.reaction).toMatchObject({
      selection: 'USE',
      reaction: { trigger: 'ATTACKED_SELF' },
      actionEconomyTransition: { beforeUsed: 0, afterUsed: 1 }
    })

    await undoLastAction(room)
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
    await strike(room, 0)
    await offeredReaction(room)
  })

  it('takes the whole hit when declined, spending nothing', async () => {
    const room = await dodgeRoom()
    await strike(room, 0)
    const { decision } = await offeredReaction(room)
    const declined = await room.resolve(decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')

    const batch = characterBatch(await readRoomHistory(room.room.base.stub))
    const damage = biteDamage(batch)
    expect(damage.incomingHalved).toBe(false)
    expect(damage.resolvedAmount).toBe(damage.requestedAmount)
    expect(batch.reaction).toMatchObject({ selection: 'DECLINE' })
  })

  it('is not offered to a Character who cannot see the attacker', async () => {
    const room = await dodgeRoom({
      characterPlay: {
        conditions: [{ conditionTypeId: conditionId('BLINDED'), label: 'Blinded' }]
      }
    })
    await strike(room, 0)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(
      biteDamage(characterBatch(await readRoomHistory(room.room.base.stub))).incomingHalved
    ).toBe(false)
  })
})

/**
 * SPELLS-31.T5b (D156): the Monk's Deflect Missiles, authored as an `ATTACKED_SELF` reaction to a
 * ranged weapon attack that grants an `INCOMING_DAMAGE` REDUCE of 1d10 + Dexterity modifier + monk
 * level, takes the reduction off the hit that triggered it.
 */
describe('room Deflect Missiles reaction to a ranged weapon hit (SPELLS-31.1)', () => {
  const BITE_DAMAGE = 10
  /** The SRD Deflect Missiles feature, acquired by the fixture Fighter at its first level. */
  const deflectMissiles = (): ClassFeature => {
    const feature = monk.features?.find((entry) => entry.label === 'Deflect Missiles')
    if (!feature) throw new Error('The SRD Monk must author Deflect Missiles.')
    return { ...feature, availableAtLevel: 1 }
  }

  const deflectRoom = (ranged: boolean) => {
    const bite = biteWolf('ATTACK', { damage: BITE_DAMAGE, ranged })
    return actionRoom({
      actors: [
        srdCreatureActor({ id: WOLF_ID, creature: bite }),
        characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
      ],
      ownerFeatureId: creatureFeature(bite, 'Bite').id,
      characterClassFeatures: [deflectMissiles()]
    })
  }

  it('reduces the ranged hit by 1d10 + Dexterity + monk level when used, and spends the reaction', async () => {
    const room = await deflectRoom(true)
    await strike(room, 0)
    const { decision, pending } = await offeredReaction(room)
    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    // The reduction's d10 waits on the attacker's roller, who enters a 5.
    const dice = await room.pendingDecision()
    if (dice.pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
      throw new Error(`Expected the reduction die, got ${dice.pending.kind}.`)
    expect(dice.pending.request).toMatchObject({ min: 1, max: 10 })
    const rolled = await room.resolve(dice, {
      kind: 'ENTER_INTEGER',
      requestId: dice.pending.request.requestId,
      value: 5
    })
    expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')

    const batch = characterBatch(await readRoomHistory(room.room.base.stub))
    const damage = biteDamage(batch)
    // A 5 on the d10, Dexterity +2, and no Monk levels on the fixture Fighter: 10 - 7.
    expect(damage.requestedAmount).toBe(BITE_DAMAGE - 7)
    expect(damage.incomingHalved).toBe(false)
    expect(hitPointsLost(batch)).toBe(damage.resolvedAmount)
    expect(batch.reaction).toMatchObject({
      selection: 'USE',
      reaction: { trigger: 'ATTACKED_SELF' },
      actionEconomyTransition: { beforeUsed: 0, afterUsed: 1 }
    })
  })

  it('takes the whole hit when declined', async () => {
    const room = await deflectRoom(true)
    await strike(room, 0)
    const { decision } = await offeredReaction(room)
    const declined = await room.resolve(decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    expect(
      biteDamage(characterBatch(await readRoomHistory(room.room.base.stub))).requestedAmount
    ).toBe(BITE_DAMAGE)
  })

  it('is not offered against a melee hit', async () => {
    const room = await deflectRoom(false)
    await strike(room, 0)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(
      biteDamage(characterBatch(await readRoomHistory(room.room.base.stub))).requestedAmount
    ).toBe(BITE_DAMAGE)
  })
})
