import { runInDurableObject } from 'cloudflare:test'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { ancientRedDragon } from '@artificer-toolkit/source-data/srd/creatures/ancient-red-dragon.js'
import { unicorn as srdUnicorn } from '@artificer-toolkit/source-data/srd/creatures/unicorn.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_REACTION_ALLOWANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { SRD_DAMAGE_TYPES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

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
  await room.send(commandId, {
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
  return held
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
    return strike.resolution.application.d20?.resultPath
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
  async function legendaryTurnEnd(creature: CreatureAuthored) {
    const room = await movementRoom({
      actors: [
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf }),
        srdCreatureActor({ id: FIRST_DRAGON_ID, creature })
      ],
      moverActorId: WOLF_ID,
      positions: { [WOLF_ID]: { x: 150, y: 150 }, [FIRST_DRAGON_ID]: { x: 250, y: 150 } },
      autoRoll: 'GAME_MASTER',
      rolls: [2],
      seed: seedModifierGrant({
        sourceActorId: WOLF_ID,
        holderActorId: FIRST_DRAGON_ID,
        lifecycle: { consumeOnFirstEvent: 'ON_ATTACK_ROLL' }
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
    return (await readRoomHistory(room.base.stub)).activeEffects
  }

  it('deletes the grant its attack rolled against', async () => {
    expect(await legendaryTurnEnd(attackDragon)).toEqual([])
  })

  it('keeps the grant through an action that rolls no attack', async () => {
    expect(await legendaryTurnEnd(dragon)).toHaveLength(1)
  })
})
