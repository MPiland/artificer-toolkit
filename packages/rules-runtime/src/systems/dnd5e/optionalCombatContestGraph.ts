import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import {
  RULE_VALUE_KIND,
  checksumRuleDocument,
  type GameSystemRuleCapabilityContract,
  type RuleGraphDefinition
} from '@artificer-toolkit/shared/rules'

import { RULE_RUNTIME_GRAPH_FAMILY_KEY } from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import type {
  ContestCheckCapabilityAdapter,
  OptionalCombatContestGraph
} from '../../contestCheckCapability.js'
import type { OptionalCombatPolicyPin } from '../../optionalCombatPolicyCapability.js'

export const DND5E_OPTIONAL_COMBAT_CONTEST_INITIATOR_MODIFIER_FACT_KEY =
  'dnd5e.optional-combat.contest.initiator-modifier'
export const DND5E_OPTIONAL_COMBAT_CONTEST_TARGET_MODIFIER_FACT_KEY =
  'dnd5e.optional-combat.contest.target-modifier'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/
const CAPABILITY_KEY_PATTERN = /^[a-z][a-z0-9.-]{0,79}$/

export const dnd5eOptionalCombatContestCapabilityContribution = {
  definitionFamilyKeys: [RULE_RUNTIME_GRAPH_FAMILY_KEY],
  factContracts: [
    {
      key: DND5E_OPTIONAL_COMBAT_CONTEST_INITIATOR_MODIFIER_FACT_KEY,
      valueKind: RULE_VALUE_KIND.NUMBER
    },
    {
      key: DND5E_OPTIONAL_COMBAT_CONTEST_TARGET_MODIFIER_FACT_KEY,
      valueKind: RULE_VALUE_KIND.NUMBER
    }
  ],
  operationContracts: [
    { key: 'evidence.integer-range', contractVersion: 1 },
    { key: 'number.add', contractVersion: 1 }
  ]
} as const satisfies Pick<
  GameSystemRuleCapabilityContract,
  'definitionFamilyKeys' | 'factContracts' | 'operationContracts'
>

function requirePin(pin: OptionalCombatPolicyPin): void {
  if (!UUID_PATTERN.test(pin.definitionId)) {
    throw new Error('Optional combat contest definition identity must be a lowercase UUID.')
  }
  if (!CHECKSUM_PATTERN.test(pin.definitionChecksum)) {
    throw new Error('Optional combat contest definition checksum must be lowercase SHA-256.')
  }
  if (!Number.isInteger(pin.definitionVersion) || pin.definitionVersion < 1) {
    throw new Error('Optional combat contest definition version must be positive.')
  }
  if (!CAPABILITY_KEY_PATTERN.test(pin.moduleKey)) {
    throw new Error('Optional combat contest policy module key is invalid.')
  }
  if (!Number.isInteger(pin.moduleContractVersion) || pin.moduleContractVersion < 1) {
    throw new Error('Optional combat contest policy module contract version must be positive.')
  }
}

/**
 * The bounded, one-stage graph for a two-participant contested check, identified by the
 * definition that starts the contest: an optional-combat policy or an authored contest action.
 * The application owns authority and tie outcomes.
 */
export function createDnd5eContestGraph(
  definitionId: string
): ReturnType<typeof serverPublishedRuleDefinitionDtoSchema.parse> {
  if (!UUID_PATTERN.test(definitionId)) {
    throw new Error('Contest definition identity must be a lowercase UUID.')
  }
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: definitionId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    sourceEntryBindings: [{ sourceEntryId: definitionId, nodeId: 'initiator_d20' }],
    nodes: [
      {
        id: 'initiator_d20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 }
        }
      },
      {
        id: 'initiator_total',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: { kind: 'NODE_OUTPUT', nodeId: 'initiator_d20', port: 'value' },
          right: {
            kind: 'FACT',
            factKey: DND5E_OPTIONAL_COMBAT_CONTEST_INITIATOR_MODIFIER_FACT_KEY
          }
        }
      },
      {
        id: 'target_d20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 }
        }
      },
      {
        id: 'target_total',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: { kind: 'NODE_OUTPUT', nodeId: 'target_d20', port: 'value' },
          right: { kind: 'FACT', factKey: DND5E_OPTIONAL_COMBAT_CONTEST_TARGET_MODIFIER_FACT_KEY }
        }
      }
    ],
    outputs: {
      initiatorNaturalD20: { kind: 'NODE_OUTPUT', nodeId: 'initiator_d20', port: 'value' },
      initiatorTotal: { kind: 'NODE_OUTPUT', nodeId: 'initiator_total', port: 'value' },
      targetNaturalD20: { kind: 'NODE_OUTPUT', nodeId: 'target_d20', port: 'value' },
      targetTotal: { kind: 'NODE_OUTPUT', nodeId: 'target_total', port: 'value' }
    }
  }
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: definition.id,
    gameSystemId: definition.gameSystemId,
    definitionFamilyKey: definition.definitionFamilyKey,
    checksum: checksumRuleDocument(definition),
    definition
  })
}

/** The contest graph an optional-combat policy starts, retained beside its exact policy pin. */
export function createDnd5eOptionalCombatContestGraph(
  pin: OptionalCombatPolicyPin
): OptionalCombatContestGraph {
  requirePin(pin)
  const published = createDnd5eContestGraph(pin.definitionId)
  return {
    pin: { ...pin },
    published,
    identityChecksum: checksumRuleDocument({ pin, graphChecksum: published.checksum })
  }
}

export const dnd5eContestCheckCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  initiatorModifierFactKey: DND5E_OPTIONAL_COMBAT_CONTEST_INITIATOR_MODIFIER_FACT_KEY,
  targetModifierFactKey: DND5E_OPTIONAL_COMBAT_CONTEST_TARGET_MODIFIER_FACT_KEY,
  contestGraph: createDnd5eContestGraph,
  optionalCombatContestGraph: createDnd5eOptionalCombatContestGraph
} as const satisfies ContestCheckCapabilityAdapter
