import { runInDurableObject } from 'cloudflare:test'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { DND5E_TARGET_STATE_CHECKSUM_FACT_KEY } from '@artificer-toolkit/rules-runtime/systems/dnd5e/effectActionCompiler'
import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'

const SOURCE_ID = testUuid(0x600)
const TARGET_ID = testUuid(0x601)
const CHARGE_ID = '00000000-0000-4000-8000-000000000099'
const ATTACK_ROLL_ID = '00000000-0000-4000-8000-000000000095'

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

type Feature = NonNullable<CreatureAuthored['features']>[number]
type Path = NonNullable<Feature['effects']>[number]['paths'][number]

/** The Wolf with its Bite rewritten by `rewrite`; the rest of the stat block stays the SRD's. */
function wolfWithBite(rewrite: (bite: Feature) => Feature): CreatureAuthored {
  return {
    ...plainWolf,
    features: plainWolf.features?.map((feature) =>
      feature.label === 'Bite' ? rewrite(feature) : feature
    )
  }
}

/** The Bite's first path, dealing exactly one point of damage under `pathCode`. */
function oneDamagePath(path: Path, pathCode: 'ON_USE' | 'ON_HIT'): Path {
  if (!('resultBlock' in path)) return path
  return {
    ...path,
    pathCode,
    resultBlock: {
      ...path.resultBlock,
      outcomes: path.resultBlock.outcomes.map((outcome) => {
        if (outcome.effectKind !== 'DAMAGE' || outcome.damageTypeId === undefined)
          throw new Error('Expected Bite damage.')
        return {
          id: outcome.id,
          effectKind: 'DAMAGE' as const,
          damageTypeId: outcome.damageTypeId,
          valueKind: 'FIXED' as const,
          scalingKind: 'NONE' as const,
          amount: 1
        }
      })
    }
  }
}

const charges = {
  id: CHARGE_ID,
  limitKind: 'FIXED_AMOUNT' as const,
  scalingKind: 'NONE' as const,
  resetKind: 'MANUAL' as const,
  amount: 1
}

/** A Bite that spends its one charge to deal its wielder one damage: a self action. */
const selfChargedWolf = wolfWithBite((bite) => ({
  ...bite,
  charges,
  effects: bite.effects?.map((effect) => ({
    ...effect,
    invocation: {
      ...effect.invocation,
      triggerCode: 'ACTIVATED' as const,
      range: { id: effect.invocation.range.id, rangeKind: 'SELF' as const },
      targeting: { selectionKind: 'SELF' as const },
      resourceUse: { chargeId: CHARGE_ID, cost: 1 }
    },
    paths: effect.paths.slice(0, 1).map((path) => oneDamagePath(path, 'ON_USE'))
  }))
}))

/** A Bite that spends its one charge on an attack roll, then deals one damage on a hit. */
const phasedChargedWolf = wolfWithBite((bite) => ({
  ...bite,
  charges,
  rollDefinitions: [
    {
      id: ATTACK_ROLL_ID,
      label: 'Bite attack',
      kind: 'ATTACK' as const,
      expression: { count: 1, die: 20, modifier: 4 },
      rollMode: 'NORMAL' as const,
      chargeCost: null,
      order: 1
    }
  ],
  effects: bite.effects?.map((effect) => ({
    ...effect,
    invocation: {
      ...effect.invocation,
      triggerCode: 'MELEE_WEAPON_ATTACK' as const,
      range: { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' as const },
      targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const },
      resourceUse: { chargeId: CHARGE_ID, cost: 1 }
    },
    paths: effect.paths.slice(0, 1).map((path) => oneDamagePath(path, 'ON_HIT'))
  }))
}))

/** A self Bite that frightens its wielder for two rounds, re-checked at the start of each turn. */
const recurringConditionWolf = wolfWithBite((bite) => ({
  ...bite,
  effects: bite.effects?.map((effect) => ({
    ...effect,
    invocation: {
      ...effect.invocation,
      triggerCode: 'ACTIVATED' as const,
      range: { id: effect.invocation.range.id, rangeKind: 'SELF' as const },
      targeting: { selectionKind: 'SELF' as const }
    },
    paths: effect.paths.slice(0, 1).map((path) => {
      if (!('resultBlock' in path)) return path
      const frightened = srdSystemRecord.conditionTypes.find(({ code }) => code === 'FRIGHTENED')
      if (!frightened) throw new Error('Missing frightened condition fixture.')
      return {
        ...path,
        pathCode: 'ON_USE' as const,
        resultBlock: {
          ...path.resultBlock,
          id: '00000000-0000-4000-8000-000000000096',
          duration: {
            id: '00000000-0000-4000-8000-000000000098',
            durationKind: 'ROUND' as const,
            amount: 2
          },
          lifecycle: { recurringKind: 'START_OF_TURN' as const },
          outcomes: [
            {
              id: '00000000-0000-4000-8000-0000000000aa',
              effectKind: 'CONDITION' as const,
              conditionId: frightened.id
            }
          ]
        }
      }
    })
  }))
}))

const allowanceDefinition = SRD_RULE_STATE_DEFINITIONS.find(
  (definition) => definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID
)
if (!allowanceDefinition) throw new Error('The SRD action allowance definition is missing.')

/** A room whose current actor is a Wolf of `creature`, next to a second, plain Wolf. */
async function actionRoom(creature: CreatureAuthored, rolls?: readonly number[]) {
  const source = srdCreatureActor({ id: SOURCE_ID, creature })
  const target = srdCreatureActor({ id: TARGET_ID, creature: plainWolf })
  const biteId = creatureFeature(creature, 'Bite').id
  const capability = discoverEncounterFeatureActionCapabilities({
    spells: new Map(),
    actor: source,
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
  }).find((candidate) => candidate.ownerFeatureId === biteId)
  if (!capability) throw new Error('The Bite has no discovered action.')
  const room = await movementRoom({
    actors: [source, target],
    moverActorId: SOURCE_ID,
    positions: { [SOURCE_ID]: { x: 150, y: 150 }, [TARGET_ID]: { x: 250, y: 150 } },
    autoRoll: 'GAME_MASTER',
    rolls
  })
  const [initial] = await runInDurableObject(room.base.stub, async (_instance, context) =>
    new RoomEncounterStore(context.storage).documents('encounterRuns').map(({ version }) => version)
  )
  if (initial === undefined) throw new Error('The room holds no Run.')

  /** Sends one encounter command on the GM's socket; the room must commit it. */
  async function commit(command: Record<string, unknown> & { commandId: string }) {
    const answer = await room.send(command.commandId, { scope: 'ENCOUNTER', command })
    if (answer.type !== 'COMMAND_COMMITTED')
      throw new Error(`The room rejected the command: ${JSON.stringify(answer)}`)
  }

  return {
    room,
    biteId,
    initial,
    act(input: {
      targetActorId: string
      expectedVersion: number
      acknowledgedWarnings?: ResolveEncounterActionInputDto['acknowledgedWarnings']
    }) {
      const command: ResolveEncounterActionInputDto = {
        type: 'RESOLVE_ACTION',
        acceptedWieldConflict: null,
        acknowledgedWarnings: input.acknowledgedWarnings ?? [],
        encounterId: room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: input.expectedVersion,
        actorId: SOURCE_ID,
        target: { kind: 'ACTOR', actorId: input.targetActorId },
        actionId: capability.actionId,
        optionalCombatIntent: null,
        sceneContext: null
      }
      return commit(command).then(() => command)
    },
    undo(expectedVersion: number) {
      const commandId = crypto.randomUUID()
      return commit({
        type: 'REVERT_LAST_ACTION',
        encounterId: room.encounterId,
        commandId,
        expectedVersion
      }).then(() => commandId)
    },
    /** The command rows and rule receipts the room holds for the Run, in commit order. */
    history() {
      return runInDurableObject(room.base.stub, async (_instance, context) => {
        const store = new RoomEncounterStore(context.storage)
        return {
          commands: store.documents('encounterRunCommands'),
          receipts: store.documents('encounterRuleReceipts'),
          activeEffects: store.documents('encounterActiveRuleEffects')
        }
      })
    }
  }
}

type Room = Awaited<ReturnType<typeof actionRoom>>
type History = Awaited<ReturnType<Room['history']>>

/** One committed action's receipt and command row, tied together and parsed. */
function settledAction(history: History, commandId: string) {
  const receipt = history.receipts.find((entry) => entry.commandId === commandId)
  const command = history.commands.find((entry) => entry.commandId === commandId)
  if (!receipt || command?.commandType !== 'RESOLVE_ACTION')
    throw new Error('The action left no receipt and command row.')
  const execution = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
  if (
    execution.status !== 'COMPLETE' ||
    execution.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
  )
    throw new Error('Expected a completed action receipt.')
  return { receipt, command, execution, outputs: execution.applicationOutputs }
}

describe('room action receipts', () => {
  it('records a charged self action, its soft override and its undo in the room history', async () => {
    const room = await actionRoom(selfChargedWolf)
    const first = await room.act({ targetActorId: SOURCE_ID, expectedVersion: room.initial })
    const history = await room.history()
    expect(history.receipts).toHaveLength(1)
    expect(history.commands).toHaveLength(1)

    const { receipt, command, execution, outputs } = settledAction(history, first.commandId)
    expect(receipt).toMatchObject({
      commandType: 'RESOLVE_ACTION',
      encounterVersion: room.initial + 1,
      actorUserId: room.room.base.userId
    })
    // The run command row and the receipt name one occurrence and one stored result.
    expect(receipt.resultChecksum).toBe(checksumRuleDocument(execution))
    expect(command.root).toMatchObject({
      kind: 'RULE_OCCURRENCE',
      ruleOccurrenceId: receipt.occurrenceId,
      ruleResultChecksum: receipt.resultChecksum
    })
    expect(command.ruleOverrides).toEqual([])
    expect(outputs).toMatchObject({
      occurrenceId: receipt.occurrenceId,
      sourceActorId: SOURCE_ID,
      targetActorId: SOURCE_ID
    })
    expect(outputs.featureResourceConsumption).toEqual({
      ownerActorId: SOURCE_ID,
      ownerFeatureId: room.biteId,
      chargeId: CHARGE_ID,
      cost: 1,
      beforeUsed: 0,
      afterUsed: 1,
      beforeRemaining: 1,
      afterRemaining: 0
    })
    expect(outputs.actionEconomyTransition).toEqual({
      definitionId: SRD_ACTION_ALLOWANCE_DEFINITION_ID,
      definitionVersion: 1,
      definitionChecksum: allowanceDefinition.checksum,
      maximum: 1,
      beforeUsed: 0,
      afterUsed: 1
    })
    const { targetTransition } = outputs
    expect(targetTransition.before.currentHitPoints).toBe(plainWolf.hitPoints)
    expect(targetTransition.after.currentHitPoints).toBe(plainWolf.hitPoints - 1)
    expect(
      checksumRuleDocument({
        targetActorId: SOURCE_ID,
        currentHitPoints: targetTransition.before.currentHitPoints,
        temporaryHitPoints: targetTransition.before.temporaryHitPoints,
        maximumHitPoints: targetTransition.before.maximumHitPoints,
        scalarValues: targetTransition.before.scalarValues,
        conditionIds: targetTransition.before.conditionIds
      })
    ).toBe(execution.evidence.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY])

    // Acting again with both the allowance and the charge spent warns; acknowledging both overrides.
    const override = await room.act({
      targetActorId: SOURCE_ID,
      expectedVersion: room.initial + 1,
      acknowledgedWarnings: ['ACTION_ECONOMY_UNAVAILABLE', 'RESOURCE_UNAVAILABLE']
    })
    const overridden = settledAction(await room.history(), override.commandId)
    expect(overridden.command.ruleOverrides.map((warning) => warning.code)).toEqual([
      'ACTION_ECONOMY_UNAVAILABLE',
      'RESOURCE_UNAVAILABLE'
    ])
    expect(overridden.outputs.featureResourceConsumption).toBeNull()
    expect(overridden.outputs.actionEconomyTransition).toMatchObject({
      maximum: 1,
      beforeUsed: 1,
      afterUsed: 2
    })

    const undoCommandId = await room.undo(room.initial + 2)
    const reverted = (await room.history()).commands.find(
      (entry) => entry.commandId === undoCommandId
    )
    expect(reverted).toMatchObject({
      commandType: 'REVERT_LAST_ACTION',
      version: room.initial + 3,
      revertedCommandId: override.commandId
    })
  })

  it('records the TEST and OUTCOME phases of a charged attack in the room history', async () => {
    // The attack d20 shows 15, a hit against the plain wolf.
    const room = await actionRoom(phasedChargedWolf, [14])
    const action = await room.act({ targetActorId: TARGET_ID, expectedVersion: room.initial })
    const history = await room.history()
    expect(history.receipts).toHaveLength(1)

    const { receipt, command, execution, outputs } = settledAction(history, action.commandId)
    expect(receipt.resultChecksum).toBe(checksumRuleDocument(execution))
    expect(command.root).toMatchObject({
      kind: 'RULE_OCCURRENCE',
      ruleOccurrenceId: receipt.occurrenceId,
      ruleResultChecksum: receipt.resultChecksum
    })
    expect(execution.phaseReceipts?.map((phase) => phase.phase)).toEqual(['TEST', 'OUTCOME'])
    expect(execution.phaseReceipts?.[0]?.execution.outputs.resultPath).toBe('ON_HIT')
    expect(outputs).toMatchObject({
      occurrenceId: receipt.occurrenceId,
      sourceActorId: SOURCE_ID,
      targetActorId: TARGET_ID
    })
    expect(outputs.featureResourceConsumption).toMatchObject({
      ownerActorId: SOURCE_ID,
      ownerFeatureId: room.biteId,
      chargeId: CHARGE_ID,
      beforeUsed: 0,
      afterUsed: 1
    })
    expect(outputs.targetTransition.after.currentHitPoints).toBe(plainWolf.hitPoints - 1)
  })

  it('records the recurring condition effect an action creates against its typed receipt', async () => {
    const room = await actionRoom(recurringConditionWolf)
    const action = await room.act({ targetActorId: SOURCE_ID, expectedVersion: room.initial })
    const history = await room.history()
    const { outputs } = settledAction(history, action.commandId)
    const [effect] = history.activeEffects.filter(
      ({ targetActorId }) => targetActorId === SOURCE_ID
    )
    expect(history.activeEffects).toHaveLength(1)
    expect(outputs.activeEffectTransitions).toHaveLength(1)
    expect(outputs.activeEffectTransitions[0]?.activeEffectId).toBe(effect?.id)
  })
})
