import {
  DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_4_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID,
  dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema
} from '@artificer-toolkit/schema/shared/encounterLifecycle'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import {
  RULE_VALUE_KIND,
  checksumRuleDocument,
  type GameSystemRuleCapabilityContract,
  type RuleGraphDefinition,
  type RuleValue
} from '@artificer-toolkit/shared/rules'

import {
  DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY,
  RULE_RUNTIME_GRAPH_FAMILY_KEY
} from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import type {
  LegendaryActionEligibilityAdapter,
  LegendaryActionEligibilityFacts
} from '../../legendaryActionEligibilityService.js'
import type { D20TestDefinitionCapabilityAdapter } from '../../d20TestDefinitionCapability.js'
import { requireResolvedRuleCapabilityStateIntegrity } from '../../ruleCapabilityStateService.js'
import { DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID } from './reactionEligibilityPolicy.js'
import { DND5E_SYSTEM_ID } from './identity.js'
import { dnd5eAddedDiceFacts, dnd5eAddedDiceNode } from './d20AddedDiceGraph.js'

const DND5E_LEGENDARY_ACTION_ELIGIBILITY_GRAPH_DEFINITION_ID =
  '00000000-0000-4000-8000-0000000000e1'
const DND5E_DEATH_SAVE_GRAPH_DEFINITION_ID = '00000000-0000-4000-8000-0000000000ec'
const DND5E_BASIC_ACTION_CHECK_GRAPH_DEFINITION_ID = '00000000-0000-4000-8000-0000000000ed'
const DND5E_RECHARGE_4_GRAPH_DEFINITION_ID = '00000000-0000-4000-8000-0000000000e5'
const DND5E_RECHARGE_5_GRAPH_DEFINITION_ID = '00000000-0000-4000-8000-0000000000e7'
const DND5E_RECHARGE_6_GRAPH_DEFINITION_ID = '00000000-0000-4000-8000-0000000000e9'

/** Application-derived equality of the locked outgoing and owner actor identities; not D&D policy. */
const DND5E_LEGENDARY_OUTGOING_ACTOR_DIFFERS_FACT_KEY = 'dnd5e.legendary.outgoing-actor-differs'
const DND5E_LEGENDARY_OWNER_CAN_ACT_FACT_KEY = 'dnd5e.legendary.owner-can-act'
const DND5E_LEGENDARY_REMAINING_POOL_FACT_KEY = 'dnd5e.legendary.remaining-pool'
const DND5E_LEGENDARY_WINDOW_USED_FACT_KEY = 'dnd5e.legendary.window-used'

function requireBoolean(inputs: Readonly<Record<string, RuleValue>>, key: string): boolean {
  const value = inputs[key]
  if (typeof value !== 'boolean') throw new Error(`D&D legendary input "${key}" must be boolean.`)
  return value
}

function requireNonnegativeInteger(
  inputs: Readonly<Record<string, RuleValue>>,
  key: string
): number {
  const value = inputs[key]
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error(`D&D legendary input "${key}" must be a nonnegative safe integer.`)
  return value
}

export const dnd5eLegendaryActionEligibilityOperation = {
  key: 'dnd5e.legendary-action-eligibility',
  contractVersion: 1,
  executionKind: 'PURE',
  inputs: {
    outgoingActorDiffers: RULE_VALUE_KIND.BOOLEAN,
    ownerCanAct: RULE_VALUE_KIND.BOOLEAN,
    remainingPool: RULE_VALUE_KIND.NUMBER,
    windowUsed: RULE_VALUE_KIND.BOOLEAN
  },
  outputs: { eligible: RULE_VALUE_KIND.BOOLEAN },
  execute(inputs: Readonly<Record<string, RuleValue>>) {
    return {
      eligible:
        requireBoolean(inputs, 'outgoingActorDiffers') &&
        requireBoolean(inputs, 'ownerCanAct') &&
        requireNonnegativeInteger(inputs, 'remainingPool') > 0 &&
        !requireBoolean(inputs, 'windowUsed')
    }
  }
} as const

export const dnd5eEncounterLifecycleCapabilityContribution = {
  definitionFamilyKeys: [
    RULE_RUNTIME_GRAPH_FAMILY_KEY,
    DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY
  ],
  factContracts: [
    { key: DND5E_LEGENDARY_OUTGOING_ACTOR_DIFFERS_FACT_KEY, valueKind: RULE_VALUE_KIND.BOOLEAN },
    { key: DND5E_LEGENDARY_OWNER_CAN_ACT_FACT_KEY, valueKind: RULE_VALUE_KIND.BOOLEAN },
    { key: DND5E_LEGENDARY_REMAINING_POOL_FACT_KEY, valueKind: RULE_VALUE_KIND.NUMBER },
    { key: DND5E_LEGENDARY_WINDOW_USED_FACT_KEY, valueKind: RULE_VALUE_KIND.BOOLEAN }
  ],
  operationContracts: [
    { key: dnd5eLegendaryActionEligibilityOperation.key, contractVersion: 1 },
    { key: 'number.compare-threshold', contractVersion: 1 },
    { key: 'evidence.integer-range', contractVersion: 1 },
    { key: 'evidence.bounded-choice-index', contractVersion: 1 }
  ]
} as const satisfies Pick<
  GameSystemRuleCapabilityContract,
  'definitionFamilyKeys' | 'factContracts' | 'operationContracts'
>

function requireDnd5eActorActionAvailability(facts: LegendaryActionEligibilityFacts): boolean {
  const state = requireResolvedRuleCapabilityStateIntegrity(facts.capabilityState)
  if (state.gameSystemId !== DND5E_SYSTEM_ID) {
    throw new Error('D&D Legendary Action capability state integrity is invalid.')
  }
  const capability = state.capabilities.find(
    (candidate) =>
      candidate.capability.capabilityDefinitionId === DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID
  )
  if (
    !capability ||
    capability.capability.document.gameSystemId !== DND5E_SYSTEM_ID ||
    checksumRuleDocument(capability.capability.document) !==
      capability.capability.definitionChecksum
  ) {
    throw new Error('D&D actor-action capability definition is unavailable or invalid.')
  }
  return capability.available
}

/**
 * D&D maps generic completed-turn and Feature-pool facts through the exact
 * lifecycle graph. It owns the actor-action capability UUID; orchestration
 * does not branch on a condition or Feature name.
 */
export const dnd5eLegendaryActionEligibilityAdapter: LegendaryActionEligibilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  requiredCapabilityDefinitionIds: [DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID],
  async evaluate(input) {
    if (
      input.source.lifecycle.eligibilityGraphDefinitionId.length === 0 ||
      input.source.ownerActorId.length === 0 ||
      input.source.actionId.length === 0
    ) {
      throw new Error('D&D Legendary Action source is incomplete.')
    }
    if (!Number.isSafeInteger(input.facts.poolRemaining) || input.facts.poolRemaining < 0) {
      throw new Error('D&D Legendary Action pool is invalid.')
    }
    const result = await input.runtime.executeResolved({
      command: {
        definitionId: input.source.lifecycle.eligibilityGraphDefinitionId,
        occurrenceId: input.occurrenceId,
        facts: {
          [DND5E_LEGENDARY_OUTGOING_ACTOR_DIFFERS_FACT_KEY]:
            input.facts.outgoingActorId !== input.source.ownerActorId,
          [DND5E_LEGENDARY_OWNER_CAN_ACT_FACT_KEY]: requireDnd5eActorActionAvailability(
            input.facts
          ),
          [DND5E_LEGENDARY_REMAINING_POOL_FACT_KEY]: input.facts.poolRemaining,
          [DND5E_LEGENDARY_WINDOW_USED_FACT_KEY]: input.facts.windowUsed
        }
      },
      published: input.graph
    })
    if (result.status !== 'COMPLETE') {
      throw new Error('Legendary Action eligibility policy may not request evidence.')
    }
    const eligible = result.outputs[input.source.lifecycle.eligibleOutput]
    if (typeof eligible !== 'boolean') {
      throw new Error('Legendary Action graph did not produce its pinned BOOLEAN output.')
    }
    return { policy: { eligible }, evidence: result.evidence }
  }
}

function published(definition: RuleGraphDefinition) {
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: definition.id,
    gameSystemId: definition.gameSystemId,
    definitionFamilyKey: definition.definitionFamilyKey,
    checksum: checksumRuleDocument(definition),
    definition
  })
}

function exactGraphPin(definition: ReturnType<typeof published>) {
  return {
    definitionId: definition.id,
    definitionVersion: 1,
    definitionChecksum: definition.checksum
  }
}

export function createDnd5eLegendaryActionEligibilityDefinition() {
  return published({
    schemaVersion: 1,
    id: DND5E_LEGENDARY_ACTION_ELIGIBILITY_GRAPH_DEFINITION_ID,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    nodes: [
      {
        id: 'eligibility',
        operation: { key: dnd5eLegendaryActionEligibilityOperation.key, contractVersion: 1 },
        inputs: {
          outgoingActorDiffers: {
            kind: 'FACT',
            factKey: DND5E_LEGENDARY_OUTGOING_ACTOR_DIFFERS_FACT_KEY
          },
          ownerCanAct: { kind: 'FACT', factKey: DND5E_LEGENDARY_OWNER_CAN_ACT_FACT_KEY },
          remainingPool: { kind: 'FACT', factKey: DND5E_LEGENDARY_REMAINING_POOL_FACT_KEY },
          windowUsed: { kind: 'FACT', factKey: DND5E_LEGENDARY_WINDOW_USED_FACT_KEY }
        }
      }
    ],
    outputs: { eligible: { kind: 'NODE_OUTPUT', nodeId: 'eligibility', port: 'eligible' } }
  })
}

export function createDnd5eLegendaryActionLifecycleDefinition() {
  const graph = createDnd5eLegendaryActionEligibilityDefinition()
  return dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'LEGENDARY_ACTION',
    id: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
    gameSystemId: DND5E_SYSTEM_ID,
    eligibilityGraph: { ...exactGraphPin(graph), eligibleOutput: 'eligible' },
    windowStage: 'END_OF_OTHER_ACTOR_TURN',
    refreshStage: 'START_OF_TURN',
    resourceRecovery: 'FULL',
    maximumActionsPerWindow: 1
  })
}

const rechargeIdentity = {
  4: {
    graphDefinitionId: DND5E_RECHARGE_4_GRAPH_DEFINITION_ID,
    lifecycleDefinitionId: DND5E_RECHARGE_4_LIFECYCLE_DEFINITION_ID
  },
  5: {
    graphDefinitionId: DND5E_RECHARGE_5_GRAPH_DEFINITION_ID,
    lifecycleDefinitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID
  },
  6: {
    graphDefinitionId: DND5E_RECHARGE_6_GRAPH_DEFINITION_ID,
    lifecycleDefinitionId: DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID
  }
} as const

export function createDnd5eRechargeDefinition(threshold: 4 | 5 | 6) {
  return published({
    schemaVersion: 1,
    id: rechargeIdentity[threshold].graphDefinitionId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    nodes: [
      {
        id: 'd6',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 6 } }
      },
      {
        id: 'recharge',
        operation: { key: 'number.compare-threshold', contractVersion: 1 },
        inputs: {
          value: { kind: 'NODE_OUTPUT', nodeId: 'd6', port: 'value' },
          threshold: { kind: 'LITERAL', value: threshold }
        }
      }
    ],
    outputs: { recharged: { kind: 'NODE_OUTPUT', nodeId: 'recharge', port: 'passed' } }
  })
}

/**
 * A death save is a d20 with no modifier (SRD 5.1), plus the dice a Character's effects add to its
 * saves (D156): the d20 request, then the added-dice request when the save rolls any.
 */
export function createDnd5eDeathSaveDefinition() {
  return published({
    schemaVersion: 1,
    id: DND5E_DEATH_SAVE_GRAPH_DEFINITION_ID,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    nodes: [
      {
        id: 'd20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
      },
      dnd5eAddedDiceNode('d20')
    ],
    outputs: {
      rawDie: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
      addedTotal: { kind: 'NODE_OUTPUT', nodeId: 'd20-added-dice', port: 'value' }
    }
  })
}

/**
 * A basic action's check is one d20 request, then the dice the roller's effects add to its ability
 * checks (D156); its modifier and DC come from the action's catalogue entry and the actor's check
 * facts, so the graph carries only the dice.
 */
export function createDnd5eBasicActionCheckDefinition() {
  return createDnd5eCheckDefinition(DND5E_BASIC_ACTION_CHECK_GRAPH_DEFINITION_ID)
}

/** The same one-d20 check under `definitionId`: an authored check action's test (D173). */
export function createDnd5eCheckDefinition(definitionId: string) {
  return published({
    schemaVersion: 1,
    id: definitionId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    nodes: [
      {
        id: 'd20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
      },
      dnd5eAddedDiceNode('d20')
    ],
    outputs: {
      rawDie: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
      addedTotal: { kind: 'NODE_OUTPUT', nodeId: 'd20-added-dice', port: 'value' }
    }
  })
}

export const dnd5eD20TestDefinitionCapabilityAdapter: D20TestDefinitionCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  basicActionCheckDefinition: createDnd5eBasicActionCheckDefinition,
  deathSaveDefinition: createDnd5eDeathSaveDefinition,
  addedDiceFacts: dnd5eAddedDiceFacts
}

export function createDnd5eRechargeLifecycleDefinition(threshold: 4 | 5 | 6) {
  const graph = createDnd5eRechargeDefinition(threshold)
  return dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'RECHARGE',
    id: rechargeIdentity[threshold].lifecycleDefinitionId,
    gameSystemId: DND5E_SYSTEM_ID,
    rechargeGraph: { ...exactGraphPin(graph), rechargedOutput: 'recharged' },
    boundary: 'START_OF_TURN',
    recovery: 'FULL'
  })
}
