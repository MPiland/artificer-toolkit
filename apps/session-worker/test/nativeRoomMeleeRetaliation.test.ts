import { readSpatialEffect } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import {
  carryingFireShield,
  placedFireShieldZone,
  shields
} from '@artificer-toolkit/rules-runtime/testing/fireShieldZoneFixture'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { fireShield } from '@artificer-toolkit/source-data/srd/spells/fire-shield.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf, reactionWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import {
  choiceOptionIdOf,
  hitPointsOf,
  readZones,
  revertLastAction
} from './placedZoneRoomReads.js'
import { parseReceiptExecution, readActorHitPoints, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-20 T6d2a/T6d2b (D153): a melee hit on a creature holding a retaliating zone burns the
 * attacker, through the public RESOLVE_ACTION command and the movement reaction response of the real
 * local room. The zones come from real SRD content: the Balor's Fire Aura and Fire Shield.
 */

/** Every die the room rolls shows this face (zero-based): each d20 a 19, each d6 a 1, each d8 a 3. */
const DIE = 18
const D6 = (DIE % 6) + 1
const D8 = (DIE % 8) + 1

const BALOR_ID = testUuid(0x2250)
const WOLF_ID = testUuid(0x2251)
const CASTER_ACTOR_ID = testUuid(0x2252)
const CASTER_ID = testUuid(0x2253)
const GOBLIN_ID = testUuid(0x2254)
const REACTOR_ID = testUuid(0x2255)
const SHIELD_SEED = 0x2260

const balor = srdByLabel(SRD.creatures, 'Balor')
const goblin = srdByLabel(SRD.creatures, 'Goblin')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

type Room = Awaited<ReturnType<typeof actionRoom>>

/** The settled action receipt of `commandId`'s retaliation evidence, parsed by the shared contract. */
async function retaliationOf(room: Room, commandId: string) {
  const { receipts } = await readRoomHistory(room.room.base.stub)
  const receipt = receipts.find(
    (candidate) => candidate.commandId === commandId && candidate.commandType === 'RESOLVE_ACTION'
  )
  if (!receipt) throw new Error('The attack left no receipt.')
  const execution = parseReceiptExecution(receipt)
  if (
    execution.status !== 'COMPLETE' ||
    (execution.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH' &&
      execution.applicationOutputs.kind !== 'CHARACTER_MECHANICS_BATCH')
  )
    throw new Error('Expected a settled attack.')
  return execution.applicationOutputs.meleeRetaliation
}

describe('the SRD Balor’s Fire Aura answers a melee hit (SPELLS-20 T6d2a, D153)', () => {
  it('burns the Wolf that bites the Balor for 3d6 fire', async () => {
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf }),
        srdCreatureActor({ id: BALOR_ID, creature: balor })
      ],
      ownerFeatureId: creatureFeature(plainWolf, 'Bite').id,
      status: 'PREPARED',
      autoRoll: 'EVERYONE',
      fallbackRoll: DIE
    })
    const start = await room.send({
      type: 'START',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(start.type, JSON.stringify(start)).toBe('COMMAND_COMMITTED')
    // Both have Dexterity 15 and roll the same die, so the GM settles the tie with the Wolf first.
    const tie =
      start.type === 'COMMAND_COMMITTED' && start.delta?.scope === 'ENCOUNTER'
        ? start.delta.result.occurrence?.pending
        : undefined
    if (tie?.kind !== 'INITIATIVE_ORDER') throw new Error('Expected the initiative tie.')
    await room.commit({
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: tie.encounterVersion,
      occurrenceId: tie.occurrenceId,
      expectedOccurrenceVersion: tie.occurrenceVersion,
      correlationId: null,
      resolution: { kind: 'INITIATIVE_ENTITY', requestId: tie.requestId, entityId: WOLF_ID }
    })
    const [aura] = (await readZones(room)).map(readSpatialEffect)
    const wolfBefore = (await hitPointsOf(room, WOLF_ID)) ?? 0

    const { command, answer } = await room.startAction(BALOR_ID, [], room.sceneContext(1))
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    expect(await retaliationOf(room, command.commandId)).toMatchObject({
      executions: [
        {
          ordinal: 0,
          candidate: {
            candidate: { effectId: aura!.id, sourceActorId: BALOR_ID, targetActorId: WOLF_ID }
          },
          applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: 3 * D6 })]
        }
      ]
    })
    expect(await hitPointsOf(room, WOLF_ID)).toBe(wolfBefore - 3 * D6)
  })
})

describe('a Character’s Fire Shield answers a melee hit (SPELLS-20 T6d2a, D153)', () => {
  const casterActor = {
    ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
    snapshot: { kind: 'CHARACTER' as const, id: CASTER_ID, systemId: srdSystemRecord.id }
  }

  /** The Character casts the warm shield, then (unless `endTurn` is false) the Goblin beside it takes its turn. */
  async function shieldedRoom(endTurn = true) {
    const room = await actionRoom({
      actors: [casterActor, srdCreatureActor({ id: GOBLIN_ID, creature: goblin })],
      characterSpellcasting: { spells: [fireShield], prepared: [fireShield.id] },
      characterAction: (action) => action.label === 'Fire Shield (4th level)',
      autoRoll: 'EVERYONE',
      fallbackRoll: DIE
    })
    const { answer } = await room.startCasterCenteredAreaAction([], 'GM', {
      choiceOptionId: choiceOptionIdOf(fireShield, 'Warm shield')
    })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    if (endTurn) await room.advanceTurn()
    return room
  }

  /** The Goblin's attack with its feature `label` at the caster, from the Goblin's token. */
  async function goblinAttacks(room: Room, label: string) {
    const [casterToken, goblinToken] = room.room.scene.tokens
    if (!casterToken || !goblinToken) throw new Error('The Scene holds no tokens.')
    const goblinActor = srdCreatureActor({ id: GOBLIN_ID, creature: goblin })
    return room.startAction(
      CASTER_ACTOR_ID,
      [],
      {
        sceneId: room.room.scene.id,
        expectedSceneVersion: room.room.scene.version,
        sourceTokenId: goblinToken.id,
        targetTokenId: casterToken.id
      },
      null,
      room.featureActionId(goblinActor, creatureFeature(goblin, label).id),
      GOBLIN_ID
    )
  }

  it('grants its caster the shield’s resistance for as long as the shield lasts, undone with the cast', async () => {
    const room = await shieldedRoom(false)
    const [shield, ...others] = (await readZones(room)).map(readSpatialEffect)
    expect(others).toEqual([])
    expect(shield).toMatchObject({
      definition: { origin: { kind: 'ENCOUNTER', sourceActorId: CASTER_ACTOR_ID } },
      placement: { anchorKind: 'TOKEN', retaliatesMeleeHits: true }
    })
    const grant = shields(carryingFireShield())[0]!.zone.sourceGrant
    const { characterEffects } = await readRoomHistory(room.room.base.stub)
    expect(
      characterEffects.map((effect) => ({
        modifiers: JSON.parse(effect.definitionJson).stateContributions.find(
          (contribution: { kind: string }) => contribution.kind === 'MODIFIER_GRANT'
        )?.modifiers,
        remainingTicks: effect.lifecycle.remainingTicks
      }))
    ).toEqual([
      {
        modifiers: grant?.modifierGrantContribution?.modifiers,
        // Cast on the caster's own turn, the duration counts one more turn end (as every grant does).
        remainingTicks: (grant?.initialRemaining ?? 0) + 1
      }
    ])

    await revertLastAction(room)
    expect(await readZones(room)).toEqual([])
    expect((await readRoomHistory(room.room.base.stub)).characterEffects).toEqual([])
  })

  it('burns the Goblin that hits the caster with its Scimitar for 2d8 fire', async () => {
    const room = await shieldedRoom()
    const [shield] = (await readZones(room)).map(readSpatialEffect)
    const goblinBefore = (await hitPointsOf(room, GOBLIN_ID)) ?? 0

    const { command, answer } = await goblinAttacks(room, 'Scimitar')
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    expect(await retaliationOf(room, command.commandId)).toMatchObject({
      executions: [
        {
          candidate: {
            candidate: {
              effectId: shield!.id,
              sourceActorId: CASTER_ACTOR_ID,
              targetActorId: GOBLIN_ID
            }
          },
          applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: 2 * D8 })]
        }
      ]
    })
    expect(await hitPointsOf(room, GOBLIN_ID)).toBe(goblinBefore - 2 * D8)

    await revertLastAction(room)
    expect(await hitPointsOf(room, GOBLIN_ID)).toBe(goblinBefore)
  })

  it('leaves the Goblin that hits the caster with its Shortbow unburned', async () => {
    const room = await shieldedRoom()
    const goblinBefore = await hitPointsOf(room, GOBLIN_ID)

    const { command, answer } = await goblinAttacks(room, 'Shortbow')
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    expect(await retaliationOf(room, command.commandId)).toBeUndefined()
    expect(await hitPointsOf(room, GOBLIN_ID)).toBe(goblinBefore)
  })
})

describe('a warm Fire Shield answers an opportunity attack’s melee hit (SPELLS-20 T6d2b, D153)', () => {
  it('burns the reacting Wolf that bites the shielded mover for 2d8 fire', async () => {
    const room = await movementRoom({
      actors: [
        srdCreatureActor({ id: REACTOR_ID, creature: reactionWolf, disposition: 'FRIENDLY' }),
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
      ],
      moverActorId: WOLF_ID,
      positions: { [REACTOR_ID]: { x: 50, y: 150 }, [WOLF_ID]: { x: 150, y: 150 } },
      autoRoll: 'GAME_MASTER',
      fallbackRoll: DIE,
      seed: async ({ spatial, encounterId, tokenIdOf }) => {
        const { id, maintainedEffectStateId, definition, lifecycle, placement, spatialState } =
          placedFireShieldZone({
            seed: SHIELD_SEED,
            sourceActorId: WOLF_ID,
            sourceTokenId: tokenIdOf(WOLF_ID),
            encounterId
          })
        await spatial.create({
          id,
          maintainedEffectStateId,
          definition,
          lifecycle,
          placement,
          spatialState
        })
      }
    })
    const before = await readRoomHistory(room.base.stub)

    const moved = await room.move([
      { x: 150, y: 150 },
      { x: 450, y: 150 }
    ])
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
    const pending = await room.pending()
    if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
      throw new Error(`Expected a reaction decision, got ${pending?.context.kind}.`)
    const option = pending.context.reactionTimeline[0]?.group.options[0]
    if (!option) throw new Error('The reaction decision offers no option.')
    const used = await room.respond({ kind: 'OPTION', optionId: option.optionId })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')

    const receipt = (await room.receipts()).find(
      (entry) => entry.commandType === 'RESOLVE_RULE_OCCURRENCE'
    )
    if (!receipt) throw new Error('The reaction left no receipt.')
    const result = storedRuleExecutionResultDtoSchema.parse(receipt.result)
    const reaction =
      result.status === 'MOVEMENT_COMPLETE' ||
      (result.status === 'BATCH_COMPLETE' && result.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT')
        ? result.reactionExecutions[0]
        : undefined
    if (reaction?.application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
      throw new Error('Expected a Creature movement reaction.')
    expect(reaction.application.meleeRetaliation).toMatchObject({
      executions: [
        {
          candidate: {
            candidate: {
              effectId: testUuid(SHIELD_SEED),
              sourceActorId: WOLF_ID,
              targetActorId: REACTOR_ID
            }
          },
          applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: 2 * D8 })]
        }
      ]
    })
    const after = await readRoomHistory(room.base.stub)
    expect(readActorHitPoints(after, REACTOR_ID)).toBe(
      readActorHitPoints(before, REACTOR_ID) - 2 * D8
    )
    expect(readActorHitPoints(after, WOLF_ID)).toBeLessThan(readActorHitPoints(before, WOLF_ID))
  })
})
