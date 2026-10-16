import { runInDurableObject } from 'cloudflare:test'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID } from '@artificer-toolkit/schema/shared/encounterLifecycle'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { ancientRedDragon } from '@artificer-toolkit/source-data/srd/creatures/ancient-red-dragon.js'
import { unicorn as srdUnicorn } from '@artificer-toolkit/source-data/srd/creatures/unicorn.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_REACTION_ALLOWANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { endTriggerEffectSeed } from './endTriggerEffectSeed.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import {
  parseReceiptExecution,
  readActorConditionIds,
  readActorHitPoints,
  readRoomHistory,
  readRoomRollCards
} from './roomHistoryReads.js'

const INVISIBLE_ID = SRD_CONDITION_TYPES.find(({ code }) => code === 'INVISIBLE')!.id
const WOLF_ID = testUuid(0x730)
const CHARACTER_ACTOR_ID = testUuid(0x736)
const CHARACTER_ID = testUuid(0x737)
const FIRST_DRAGON_ID = testUuid(0x731)
const SECOND_DRAGON_ID = testUuid(0x732)
// Windows open in actor id order, so the unicorn shields before the dragon strikes.
const UNICORN_ID = testUuid(0x72f)

const allowanceIds = [
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_REACTION_ALLOWANCE_DEFINITION_ID
]

afterEach(() => {
  closeTrackedSockets()
})

const fire = SRD_DAMAGE_TYPES.find((entry) => entry.label === 'Fire')
if (!fire) throw new Error('SRD damage type "Fire" is missing.')

const sourceLegendary = creatureFeature(ancientRedDragon, 'Legendary Actions')
const sourceTail = creatureFeature(ancientRedDragon, 'Tail')
/**
 * The dragon's Tail as a self action dealing 1 fire damage, so the Legendary option that runs it
 * needs no target or die and the turn runs on its own. The pool of 3, the Tail Attack option, its
 * cost of 1 and every identity are the SRD's.
 */
const tail: typeof sourceTail = {
  ...sourceTail,
  effects: sourceTail.effects?.map((effect) => {
    if (effect.invocation.kind !== 'ACTION') throw new Error('Expected an action effect.')
    return {
      id: effect.id,
      order: effect.order,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: 'ACTIVATED' as const,
        activation: { code: 'ACTION' as const, amount: 1 },
        range: { id: effect.invocation.range.id, rangeKind: 'SELF' as const },
        targeting: { selectionKind: 'SELF' as const },
        ...(effect.invocation.resourceUse && { resourceUse: effect.invocation.resourceUse })
      },
      paths: [
        {
          id: `${effect.id}-use`,
          order: 1,
          pathCode: 'ON_USE' as const,
          groupType: 'SINGLE' as const,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: `${effect.id}-use__result`,
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: `${effect.id}-use`,
                effectKind: 'DAMAGE' as const,
                damageTypeId: fire.id,
                valueKind: 'FIXED' as const,
                scalingKind: 'NONE' as const,
                amount: 1
              }
            ]
          }
        }
      ]
    }
  })
}
const bludgeoning = SRD_DAMAGE_TYPES.find((entry) => entry.label === 'Bludgeoning')
if (!bludgeoning) throw new Error('SRD damage type "Bludgeoning" is missing.')

/** The Tail as a melee attack (+10) at any range that deals 10 bludgeoning damage on a hit. */
const attackTail: typeof sourceTail = {
  ...sourceTail,
  rollDefinitions: [
    {
      id: '00000000-0000-4000-8000-0000000007d0',
      label: 'Tail attack',
      kind: 'ATTACK' as const,
      expression: { count: 1, die: 20, modifier: 10 },
      rollMode: 'NORMAL' as const,
      chargeCost: null,
      order: 1
    }
  ],
  effects: tail.effects?.map((effect) => {
    if (effect.invocation.kind !== 'ACTION') throw new Error('Expected an action effect.')
    return {
      ...effect,
      invocation: {
        ...effect.invocation,
        triggerCode: 'MELEE_WEAPON_ATTACK' as const,
        range: { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' as const },
        targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const }
      },
      paths: [
        {
          id: `${effect.id}-hit`,
          order: 1,
          pathCode: 'ON_HIT' as const,
          groupType: 'SINGLE' as const,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: `${effect.id}-hit__result`,
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: `${effect.id}-hit`,
                effectKind: 'DAMAGE' as const,
                damageTypeId: bludgeoning.id,
                valueKind: 'FIXED' as const,
                scalingKind: 'NONE' as const,
                amount: 10
              }
            ]
          }
        }
      ]
    }
  })
}
const legendary: typeof sourceLegendary = {
  ...sourceLegendary,
  options: sourceLegendary.options?.filter((option) => option.actionReference)
}

/** A Medium Creature carrying the dragon's Tail and Legendary Actions, so token facts stay simple. */
const dragon: CreatureAuthored = {
  ...plainWolf,
  id: testUuid(0x733),
  features: [...(plainWolf.features ?? []), tail, legendary]
}

/** The same Medium dragon whose Tail is a melee attack against a target. */
const attackDragon: CreatureAuthored = {
  ...plainWolf,
  id: testUuid(0x734),
  features: [...(plainWolf.features ?? []), attackTail, legendary]
}

/** The same Medium dragon whose Tail is a melee spell attack: a cast. */
const spellDragon: CreatureAuthored = {
  ...attackDragon,
  id: testUuid(0x73a),
  features: attackDragon.features?.map((feature) =>
    feature.id !== attackTail.id
      ? feature
      : {
          ...feature,
          effects: feature.effects?.map((effect) => {
            if (effect.invocation.kind !== 'ACTION') throw new Error('Expected an action effect.')
            return {
              ...effect,
              invocation: { ...effect.invocation, triggerCode: 'MELEE_SPELL_ATTACK' as const }
            }
          })
        }
  )
}

const sourceUnicornLegendary = creatureFeature(srdUnicorn, 'Legendary Actions')
/** The real SRD unicorn Legendary Actions, narrowed to Shimmering Shield (cost 2 of a pool of 3). */
const shimmeringShield: typeof sourceUnicornLegendary = {
  ...sourceUnicornLegendary,
  options: sourceUnicornLegendary.options?.filter((option) =>
    option.label.startsWith('Shimmering Shield')
  )
}
/** A Medium Creature holding the unicorn's Shimmering Shield, so token facts stay simple. */
const unicorn: CreatureAuthored = {
  ...plainWolf,
  id: testUuid(0x739),
  features: [...(plainWolf.features ?? []), shimmeringShield]
}

/** A dragon that already spent one Legendary Action and every action allowance. */
function spentDragon(id: string) {
  const actor = srdCreatureActor({
    id,
    creature: dragon,
    featureCharges: { [legendary.id]: 1 }
  })
  return encounterRunActorStateSchema.parse({
    ...actor,
    resources: allowanceIds.reduce<unknown>(
      (resources, definitionId) => withEncounterRuleUsageUsed({ resources }, definitionId, 1),
      actor.resources
    )
  })
}

/** The Legendary Action choice the room is holding: its occurrence, owner and options. */
function readLegendaryChoice(stub: DurableObjectStub) {
  return runInDurableObject(stub, async (_instance, context) => {
    const room = new RoomEncounterStore(context.storage)
    const occurrence = room
      .documents('encounterRuleOccurrences')
      .find((candidate) => candidate.state === 'PENDING')
    if (!occurrence) return null
    const snapshot = await readPendingSnapshot({ db: room.store }, occurrence)
    const choice = snapshot?.applicationContext
    if (choice?.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE')
      throw new Error('Expected a Legendary Action choice.')
    return {
      occurrence,
      encounterVersion: room.documents('encounterRuns')[0]!.version,
      ownerActorId: choice.choice.ownerActorId,
      options: choice.choice.options
    }
  })
}

/** Answers the room's pending Legendary Action choice with `resolution`. */
async function respond(
  room: Awaited<ReturnType<typeof movementRoom>>,
  resolution: Record<string, unknown>
) {
  const held = await readLegendaryChoice(room.base.stub)
  if (!held) throw new Error('No Legendary Action choice is pending.')
  const commandId = crypto.randomUUID()
  const answer = await room.send(commandId, {
    scope: 'ENCOUNTER',
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: room.encounterId,
      commandId,
      expectedVersion: held.encounterVersion,
      occurrenceId: held.occurrence.id,
      expectedOccurrenceVersion: held.occurrence.version,
      correlationId: null,
      resolution
    }
  })
  return { ...held, answer }
}

describe('a room ADVANCE_TURN with Legendary Action windows', () => {
  it('holds the declined and executed windows in one ADVANCE_TURN receipt, with the pool spend, the entering refresh and the allowance refresh', async () => {
    const wolf = srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    const room = await movementRoom({
      actors: [wolf, spentDragon(FIRST_DRAGON_ID), spentDragon(SECOND_DRAGON_ID)],
      moverActorId: WOLF_ID,
      positions: {
        [WOLF_ID]: { x: 150, y: 150 },
        [FIRST_DRAGON_ID]: { x: 250, y: 150 },
        [SECOND_DRAGON_ID]: { x: 350, y: 150 }
      },
      autoRoll: 'GAME_MASTER'
    })
    const before = await readRoomHistory(room.base.stub)
    const advanceId = crypto.randomUUID()
    const advanced = await room.send(advanceId, {
      scope: 'ENCOUNTER',
      command: {
        type: 'ADVANCE_TURN',
        encounterId: room.encounterId,
        commandId: advanceId,
        expectedVersion: before.runs[0]!.version
      }
    })
    expect(advanced.type).toBe('COMMAND_COMMITTED')

    const first = await readLegendaryChoice(room.base.stub)
    expect(first?.ownerActorId).toBe(FIRST_DRAGON_ID)
    await respond(room, { kind: 'DECLINE' })
    const second = await readLegendaryChoice(room.base.stub)
    expect(second?.ownerActorId).toBe(SECOND_DRAGON_ID)
    const option = second?.options[0]
    if (!option) throw new Error('Expected a Legendary option.')
    await respond(room, {
      kind: 'LEGENDARY_OPTION',
      optionId: option.optionId,
      targetActorId: SECOND_DRAGON_ID
    })

    const held = await readRoomHistory(room.base.stub)
    expect(await readLegendaryChoice(room.base.stub)).toBeNull()
    const receipt = held.receipts.find((candidate) => candidate.commandId === advanceId)
    if (!receipt) throw new Error('The room holds no ADVANCE_TURN receipt.')
    const result = parseReceiptExecution(receipt)
    if (result.status !== 'INITIATIVE_COMPLETE')
      throw new Error(`Expected an initiative receipt, got ${result.status}.`)
    // The turn passes from the Wolf to the first dragon, whose own turn start refreshes its pool.
    const incomingActorId = FIRST_DRAGON_ID
    expect(result.legendaryActions).toMatchObject([
      { choice: { ownerActorId: FIRST_DRAGON_ID }, resolution: { kind: 'DECLINED' } },
      {
        choice: { ownerActorId: SECOND_DRAGON_ID },
        resolution: {
          kind: 'EXECUTED',
          application: { featureResourceConsumption: { beforeUsed: 1, afterUsed: 2, cost: 1 } }
        }
      }
    ])
    expect(result.legendaryActionRefreshes).toEqual([
      expect.objectContaining({ actorId: incomingActorId })
    ])
    expect(result.actionEconomyRefreshes).toEqual(
      [...allowanceIds].sort().map((capabilityDefinitionId) =>
        expect.objectContaining({
          actorId: incomingActorId,
          capabilityDefinitionId,
          beforeUsed: 1,
          afterUsed: 0
        })
      )
    )
  })

  it('holds the Legendary Action a dragon executes against a Character with its Sheet transition', async () => {
    const room = await movementRoom({
      actors: [
        {
          ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
          // Initiative reads the Character's frozen identity, which a turn change checks.
          snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
        },
        srdCreatureActor({ id: FIRST_DRAGON_ID, creature: attackDragon })
      ],
      moverActorId: CHARACTER_ACTOR_ID,
      positions: {
        [CHARACTER_ACTOR_ID]: { x: 150, y: 150 },
        [FIRST_DRAGON_ID]: { x: 250, y: 150 }
      },
      autoRoll: 'GAME_MASTER',
      // A natural 19 and +10 hit the Character.
      rolls: [18]
    })
    const advanceId = crypto.randomUUID()
    const { runs } = await readRoomHistory(room.base.stub)
    await room.send(advanceId, {
      scope: 'ENCOUNTER',
      command: {
        type: 'ADVANCE_TURN',
        encounterId: room.encounterId,
        commandId: advanceId,
        expectedVersion: runs[0]!.version
      }
    })
    const choice = await readLegendaryChoice(room.base.stub)
    const option = choice?.options[0]
    if (choice?.ownerActorId !== FIRST_DRAGON_ID || !option)
      throw new Error('Expected the dragon’s Legendary option.')
    await respond(room, {
      kind: 'LEGENDARY_OPTION',
      optionId: option.optionId,
      targetActorId: CHARACTER_ACTOR_ID
    })

    const { receipts } = await readRoomHistory(room.base.stub)
    const receipt = receipts.find((candidate) => candidate.commandId === advanceId)
    if (!receipt) throw new Error('The room holds no ADVANCE_TURN receipt.')
    const result = parseReceiptExecution(receipt)
    if (result.status !== 'INITIATIVE_COMPLETE')
      throw new Error(`Expected an initiative receipt, got ${result.status}.`)
    const [action] = result.legendaryActions ?? []
    if (action?.resolution.kind !== 'EXECUTED') throw new Error('Expected an executed action.')
    expect(action.resolution).toMatchObject({
      targetActorId: CHARACTER_ACTOR_ID,
      application: {
        kind: 'CHARACTER_MECHANICS_BATCH',
        sourceApplications: [],
        sourceActorId: FIRST_DRAGON_ID,
        targetActorId: CHARACTER_ACTOR_ID,
        d20: { selectedNatural: 19, resultPath: 'ON_HIT' },
        featureResourceConsumption: { cost: 1, beforeUsed: 0, afterUsed: 1 },
        applications: [{ kind: 'DAMAGE', requestedAmount: 10, damageTypeId: bludgeoning.id }]
      }
    })
    // The Character's Sheet advances once for the damage.
    expect(action.resolution.characterTransitions).toHaveLength(1)
  })
})

describe('a unicorn using Shimmering Shield at another creature’s turn end', () => {
  /**
   * The Wolf ends its turn; the unicorn either shields itself or declines, then the dragon's Tail
   * (+10, natural 3) strikes the unicorn (AC 12). The shield makes the 13 miss.
   */
  async function wolfEndsTurn(shield: boolean) {
    const room = await movementRoom({
      actors: [
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf }),
        srdCreatureActor({ id: UNICORN_ID, creature: unicorn }),
        srdCreatureActor({ id: FIRST_DRAGON_ID, creature: attackDragon })
      ],
      moverActorId: WOLF_ID,
      positions: {
        [WOLF_ID]: { x: 150, y: 150 },
        [UNICORN_ID]: { x: 250, y: 150 },
        [FIRST_DRAGON_ID]: { x: 350, y: 150 }
      },
      autoRoll: 'GAME_MASTER',
      rolls: [2]
    })
    const advance = async () => {
      const commandId = crypto.randomUUID()
      const { runs } = await readRoomHistory(room.base.stub)
      await room.send(commandId, {
        scope: 'ENCOUNTER',
        command: {
          type: 'ADVANCE_TURN',
          encounterId: room.encounterId,
          commandId,
          expectedVersion: runs[0]!.version
        }
      })
      return commandId
    }
    const advanceId = await advance()
    for (let held = await readLegendaryChoice(room.base.stub); held;) {
      const option = held.options[0]
      if (!option) throw new Error('Expected a Legendary option.')
      await respond(
        room,
        held.ownerActorId === UNICORN_ID && shield
          ? { kind: 'LEGENDARY_OPTION', optionId: option.optionId, targetActorId: UNICORN_ID }
          : held.ownerActorId === FIRST_DRAGON_ID
            ? { kind: 'LEGENDARY_OPTION', optionId: option.optionId, targetActorId: UNICORN_ID }
            : { kind: 'DECLINE' }
      )
      held = await readLegendaryChoice(room.base.stub)
    }
    return { room, advance, advanceId }
  }

  async function dragonResultPath(room: Awaited<ReturnType<typeof movementRoom>>, id: string) {
    const { receipts } = await readRoomHistory(room.base.stub)
    const receipt = receipts.find((candidate) => candidate.commandId === id)
    if (!receipt) throw new Error('The room holds no ADVANCE_TURN receipt.')
    const result = parseReceiptExecution(receipt)
    if (result.status !== 'INITIATIVE_COMPLETE')
      throw new Error(`Expected an initiative receipt, got ${result.status}.`)
    const strike = result.legendaryActions?.find(
      (action) => action.choice.ownerActorId === FIRST_DRAGON_ID
    )
    if (strike?.resolution.kind !== 'EXECUTED') throw new Error('Expected the dragon’s strike.')
    const { application } = strike.resolution
    if (application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
      throw new Error(`Expected an attack application, got ${application.kind}.`)
    return application.d20?.resultPath
  }

  it('hits a unicorn that declined its shield, as the control', async () => {
    const { room, advanceId } = await wolfEndsTurn(false)
    expect(await dragonResultPath(room, advanceId)).toBe('ON_HIT')
    expect((await readRoomHistory(room.base.stub)).activeEffects).toEqual([])
  })

  it('raises the holder’s AC by 2 so the same attack misses, and lasts to the end of the unicorn’s next turn', async () => {
    const { room, advance, advanceId } = await wolfEndsTurn(true)
    expect(await dragonResultPath(room, advanceId)).toBe('ON_MISS')
    const held = await readRoomHistory(room.base.stub)
    expect(held.activeEffects).toHaveLength(1)
    expect(held.activeEffects[0]).toMatchObject({ targetActorId: UNICORN_ID })

    // The unicorn's own turn is under way: the shield holds until that turn ends.
    expect((await readRoomHistory(room.base.stub)).activeEffects).toHaveLength(1)
    await advance()
    for (let window = await readLegendaryChoice(room.base.stub); window;) {
      await respond(room, { kind: 'DECLINE' })
      window = await readLegendaryChoice(room.base.stub)
    }
    expect((await readRoomHistory(room.base.stub)).activeEffects).toEqual([])
  })
})

describe('a Legendary Action uses up the owner’s one-roll grants (SPELLS-5.4)', () => {
  async function legendaryTurnEnd(
    creature: CreatureAuthored,
    ownedConditionId?: string,
    endsOn: 'ATTACK_ROLL' | 'CAST' = 'ATTACK_ROLL'
  ) {
    const room = await movementRoom({
      actors: [
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf }),
        srdCreatureActor({
          id: FIRST_DRAGON_ID,
          creature,
          conditionIds: ownedConditionId ? [ownedConditionId] : []
        })
      ],
      moverActorId: WOLF_ID,
      positions: { [WOLF_ID]: { x: 150, y: 150 }, [FIRST_DRAGON_ID]: { x: 250, y: 150 } },
      autoRoll: 'GAME_MASTER',
      rolls: [2],
      seed: seedModifierGrant({
        sourceActorId: WOLF_ID,
        holderActorId: FIRST_DRAGON_ID,
        lifecycle: endsOn === 'CAST' ? {} : { consumeOnFirstEvents: ['ON_ATTACK_ROLL'] },
        ownedConditionId,
        ...(endsOn === 'CAST' && { endsOnCast: true as const })
      })
    })
    expect((await readRoomHistory(room.base.stub)).activeEffects).toHaveLength(1)
    const commandId = crypto.randomUUID()
    const { runs } = await readRoomHistory(room.base.stub)
    await room.send(commandId, {
      scope: 'ENCOUNTER',
      command: {
        type: 'ADVANCE_TURN',
        encounterId: room.encounterId,
        commandId,
        expectedVersion: runs[0]!.version
      }
    })
    const held = await readLegendaryChoice(room.base.stub)
    const option = held?.options[0]
    if (!option) throw new Error('Expected a Legendary option.')
    await respond(room, {
      kind: 'LEGENDARY_OPTION',
      optionId: option.optionId,
      // The self Tail targets its owner; the attack Tail strikes the Wolf.
      targetActorId: creature === dragon ? FIRST_DRAGON_ID : WOLF_ID
    })
    return readRoomHistory(room.base.stub)
  }

  it('deletes the grant its attack rolled against', async () => {
    expect((await legendaryTurnEnd(attackDragon)).activeEffects).toEqual([])
  })

  it('keeps the grant through an action that rolls no attack', async () => {
    expect((await legendaryTurnEnd(dragon)).activeEffects).toHaveLength(1)
  })

  it('releases the condition the ended grant owned, with the grant', async () => {
    const settled = await legendaryTurnEnd(attackDragon, INVISIBLE_ID)
    expect(settled.activeEffects).toEqual([])
    expect(readActorConditionIds(settled, FIRST_DRAGON_ID)).not.toContain(INVISIBLE_ID)
  })

  it('keeps the condition when the action rolls no attack', async () => {
    const settled = await legendaryTurnEnd(dragon, INVISIBLE_ID)
    expect(settled.activeEffects).toHaveLength(1)
    expect(readActorConditionIds(settled, FIRST_DRAGON_ID)).toContain(INVISIBLE_ID)
  })

  it('ends the grant that ends on a cast, and releases its condition, when the option is a spell attack (SPELLS-27.T3b)', async () => {
    const settled = await legendaryTurnEnd(spellDragon, INVISIBLE_ID, 'CAST')
    expect(settled.activeEffects).toEqual([])
    expect(readActorConditionIds(settled, FIRST_DRAGON_ID)).not.toContain(INVISIBLE_ID)
  })

  it('keeps the grant that ends on a cast through a weapon attack', async () => {
    const settled = await legendaryTurnEnd(attackDragon, INVISIBLE_ID, 'CAST')
    expect(settled.activeEffects).toHaveLength(1)
    expect(readActorConditionIds(settled, FIRST_DRAGON_ID)).toContain(INVISIBLE_ID)
  })
})

describe('a Legendary Action that damages the holder of a damage-triggered effect (SPELLS-27.T4b)', () => {
  const EFFECT_ID = testUuid(0x5642)

  /** The invisible Wolf ends its turn and the attacking dragon strikes it with `attackRoll`. */
  async function strikeInvisibleWolf(attackRoll: number) {
    const room = await movementRoom({
      actors: [
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf, conditionIds: [INVISIBLE_ID] }),
        srdCreatureActor({ id: FIRST_DRAGON_ID, creature: attackDragon })
      ],
      moverActorId: WOLF_ID,
      positions: { [WOLF_ID]: { x: 150, y: 150 }, [FIRST_DRAGON_ID]: { x: 250, y: 150 } },
      autoRoll: 'GAME_MASTER',
      // The room's dice are zero-based: 18 is a natural 19, 1 a natural 2 (+10 against AC 13).
      rolls: [attackRoll],
      seed: endTriggerEffectSeed({
        effectId: EFFECT_ID,
        holderActorId: WOLF_ID,
        sourceActorId: WOLF_ID,
        triggers: [{ event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null }]
      })
    })
    const commandId = crypto.randomUUID()
    const { runs } = await readRoomHistory(room.base.stub)
    await room.send(commandId, {
      scope: 'ENCOUNTER',
      command: {
        type: 'ADVANCE_TURN',
        encounterId: room.encounterId,
        commandId,
        expectedVersion: runs[0]!.version
      }
    })
    const option = (await readLegendaryChoice(room.base.stub))?.options[0]
    if (!option) throw new Error('Expected a Legendary option.')
    const { answer } = await respond(room, {
      kind: 'LEGENDARY_OPTION',
      optionId: option.optionId,
      targetActorId: WOLF_ID
    })
    expect(answer.type).toBe('COMMAND_COMMITTED')
    const history = await readRoomHistory(room.base.stub)
    const receipt = history.receipts.find((candidate) => candidate.commandId === commandId)
    const settled = receipt ? parseReceiptExecution(receipt) : null
    const strike =
      settled && 'legendaryActions' in settled ? settled.legendaryActions?.at(0) : undefined
    return {
      window:
        strike?.resolution.kind === 'EXECUTED' &&
        strike.resolution.application.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
          ? strike.resolution.application.d20?.resultPath
          : (strike?.resolution.kind ?? settled?.status),
      effectIds: history.activeEffects.map(({ id }) => id),
      invisible: readActorConditionIds(history, WOLF_ID).includes(INVISIBLE_ID),
      hitPoints: readActorHitPoints(history, WOLF_ID)
    }
  }

  it('ends the effect, and releases its condition, when the attack damages its holder', async () => {
    expect(await strikeInvisibleWolf(18)).toEqual({
      window: 'ON_HIT',
      effectIds: [],
      invisible: false,
      hitPoints: plainWolf.hitPoints - 10
    })
  })

  it('keeps the effect when the attack misses', async () => {
    expect(await strikeInvisibleWolf(1)).toEqual({
      window: 'ON_MISS',
      effectIds: [EFFECT_ID],
      invisible: true,
      hitPoints: plainWolf.hitPoints
    })
  })
})

describe('a Legendary Action d20 posts exactly one roll card (ENCOUNTER-7.1)', () => {
  /** The Wolf ends its turn and the attacking dragon strikes it; the d20 card kinds that result. */
  async function strike(options: { autoRoll?: 'GAME_MASTER'; rolls: number[] }) {
    const room = await movementRoom({
      actors: [
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf }),
        srdCreatureActor({ id: FIRST_DRAGON_ID, creature: attackDragon })
      ],
      moverActorId: WOLF_ID,
      positions: { [WOLF_ID]: { x: 150, y: 150 }, [FIRST_DRAGON_ID]: { x: 250, y: 150 } },
      ...options
    })
    const commandId = crypto.randomUUID()
    const { runs } = await readRoomHistory(room.base.stub)
    await room.send(commandId, {
      scope: 'ENCOUNTER',
      command: {
        type: 'ADVANCE_TURN',
        encounterId: room.encounterId,
        commandId,
        expectedVersion: runs[0]!.version
      }
    })
    const choice = await readLegendaryChoice(room.base.stub)
    const option = choice?.options[0]
    if (!option) throw new Error('Expected a Legendary option.')
    const { answer } = await respond(room, {
      kind: 'LEGENDARY_OPTION',
      optionId: option.optionId,
      targetActorId: WOLF_ID
    })
    return { room, answer }
  }

  async function d20Cards(room: Awaited<ReturnType<typeof movementRoom>>) {
    return (await readRoomRollCards(room.base.stub))
      .filter(({ roll }) => roll.source.kind !== 'DAMAGE')
      .map(({ audience, roll }) => ({ audience, kind: roll.source.kind }))
  }

  /** The d20 prompt the dragon's strike raised, from the answer that raised it. */
  function pendingD20(answer: Awaited<ReturnType<typeof strike>>['answer']) {
    if (
      answer.type !== 'COMMAND_COMMITTED' ||
      answer.delta?.scope !== 'ENCOUNTER' ||
      !('occurrence' in answer.delta.result)
    )
      throw new Error('Expected the pending occurrence in the answer.')
    const decision = answer.delta.result.occurrence?.pending
    if (!decision || !('request' in decision)) throw new Error('Expected a d20 prompt.')
    return decision
  }

  function answerD20(
    room: Awaited<ReturnType<typeof movementRoom>>,
    decision: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number },
    command: Record<string, unknown>
  ) {
    const commandId = crypto.randomUUID()
    return room.send(commandId, {
      scope: 'ENCOUNTER',
      command: {
        encounterId: room.encounterId,
        commandId,
        expectedVersion: decision.encounterVersion,
        occurrenceId: decision.occurrenceId,
        expectedOccurrenceVersion: decision.occurrenceVersion,
        ...command
      }
    })
  }

  it('cards an auto-rolled d20 once', async () => {
    const { room } = await strike({ autoRoll: 'GAME_MASTER', rolls: [18] })
    expect(await d20Cards(room)).toEqual([{ audience: 'TABLE', kind: 'ATTACK' }])
  })

  it('cards an entered d20 once', async () => {
    const { room, answer } = await strike({ rolls: [] })
    const decision = pendingD20(answer)
    const resolved = await answerD20(room, decision, {
      type: 'RESOLVE_RULE_OCCURRENCE',
      correlationId: null,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: decision.request.requestId,
        rawFaces: [15],
        rollMode: 'NORMAL'
      }
    })
    expect(resolved.type).toBe('COMMAND_COMMITTED')
    expect(await d20Cards(room)).toEqual([{ audience: 'TABLE', kind: 'ATTACK' }])
  })

  it('cards an app-rolled d20 once, as its attempt', async () => {
    const { room, answer } = await strike({ rolls: [13] })
    const decision = pendingD20(answer)
    const rolled = await answerD20(room, decision, {
      type: 'ROLL_RULE_EVIDENCE',
      requestId: decision.request.requestId,
      rollMode: null
    })
    expect(rolled.type).toBe('COMMAND_COMMITTED')
    const [held] = (await readRoomHistory(room.base.stub)).evidenceRolls
    const resolved = await answerD20(room, decision, {
      type: 'RESOLVE_RULE_OCCURRENCE',
      correlationId: null,
      resolution: {
        kind: 'SYSTEM_ROLL',
        requestId: decision.request.requestId,
        rollId: held!.id
      }
    })
    expect(resolved.type).toBe('COMMAND_COMMITTED')
    expect(await d20Cards(room)).toEqual([{ audience: 'TABLE', kind: 'MANUAL' }])
  })

  it('cards each die of one turn once: an app-rolled attack, an entered Legendary d20 and an entered Recharge d6', async () => {
    const attackWolf = biteWolf('ATTACK')
    const rechargeDragon: CreatureAuthored = {
      ...attackDragon,
      id: testUuid(0x73b),
      features: attackDragon.features?.map((feature) =>
        feature.label !== 'Bite'
          ? feature
          : {
              ...feature,
              ruleDefinitionIds: [DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID],
              charges: {
                id: testUuid(0x73a),
                limitKind: 'FIXED_AMOUNT' as const,
                scalingKind: 'NONE' as const,
                resetKind: 'MANUAL' as const,
                amount: 1
              }
            }
      )
    }
    const acting = await actionRoom({
      actors: [
        srdCreatureActor({ id: WOLF_ID, creature: attackWolf }),
        srdCreatureActor({
          id: FIRST_DRAGON_ID,
          creature: rechargeDragon,
          featureCharges: { [creatureFeature(rechargeDragon, 'Bite').id]: 1 }
        })
      ],
      ownerFeatureId: creatureFeature(attackWolf, 'Bite').id,
      // The app's one die shows 9; every other die is entered.
      rolls: [8]
    })
    // The Wolf's attack: the app rolls its d20 and that roll settles it.
    expect((await acting.startAction(FIRST_DRAGON_ID)).answer.type).toBe('COMMAND_COMMITTED')
    const attack = await acting.pendingDecision()
    if (attack.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a d20 roll prompt.')
    expect((await acting.rollDice(attack)).type).toBe('COMMAND_COMMITTED')
    const [held] = (await readRoomHistory(acting.room.base.stub)).evidenceRolls
    expect(
      (
        await acting.resolve(attack, {
          kind: 'SYSTEM_ROLL',
          requestId: attack.pending.request.requestId,
          rollId: held!.id
        })
      ).type
    ).toBe('COMMAND_COMMITTED')

    // Ending the Wolf's turn: the dragon strikes (entered d20), then its Bite recharges (entered d6).
    await acting.advanceTurn()
    const { room } = acting
    const choice = await readLegendaryChoice(room.base.stub)
    const option = choice?.options[0]
    if (!option) throw new Error('Expected a Legendary option.')
    const struck = await respond(room, {
      kind: 'LEGENDARY_OPTION',
      optionId: option.optionId,
      targetActorId: WOLF_ID
    })
    const strikeDecision = pendingD20(struck.answer)
    const entered = await answerD20(room, strikeDecision, {
      type: 'RESOLVE_RULE_OCCURRENCE',
      correlationId: null,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: strikeDecision.request.requestId,
        rawFaces: [15],
        rollMode: 'NORMAL'
      }
    })
    if (
      entered.type !== 'COMMAND_COMMITTED' ||
      entered.delta?.scope !== 'ENCOUNTER' ||
      !('occurrence' in entered.delta.result)
    )
      throw new Error('Expected the Recharge prompt in the answer.')
    const rechargeDecision = entered.delta.result.occurrence?.pending
    if (rechargeDecision?.kind !== 'RECHARGE_EVIDENCE')
      throw new Error('Expected a Recharge decision.')
    const recharged = await answerD20(room, rechargeDecision, {
      type: 'RESOLVE_RULE_OCCURRENCE',
      correlationId: null,
      resolution: {
        kind: 'ENTER_INTEGER',
        requestId: rechargeDecision.request.requestId,
        value: 5
      }
    })
    expect(recharged.type).toBe('COMMAND_COMMITTED')

    expect(
      (await readRoomRollCards(room.base.stub))
        .filter(({ roll }) => roll.source.kind !== 'DAMAGE')
        .map(({ audience, roll }) => ({ audience, kind: roll.source.kind }))
    ).toEqual([
      { audience: 'TABLE', kind: 'MANUAL' },
      { audience: 'TABLE', kind: 'ATTACK' },
      { audience: 'TABLE', kind: 'RECHARGE' }
    ])
  })
})
