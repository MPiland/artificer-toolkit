import {
  INITIATIVE_POLICY_DEFINITION_FAMILY_KEY,
  RULE_RUNTIME_GRAPH_FAMILY_KEY
} from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import {
  RULE_VALUE_KIND,
  addedDiceTotalEvidenceRuleOperation
} from '@artificer-toolkit/shared/rules'

import type { GameSystemRuntimeTier } from '../../platformRulesRuntime.js'
import { TRACER_ADDED_DICE_FACT_KEYS, TRACER_INITIATIVE_FACT_KEYS } from './encounterTier.js'
import { TRACER_SYSTEM_ID } from './system.js'

/** The tracer's published-graph contract: its own initiative and added-dice facts. */
export const capabilities: GameSystemRuntimeTier['capabilities'] = [
  {
    gameSystemId: TRACER_SYSTEM_ID,
    contractVersion: 1,
    authoredRootKinds: [],
    contentKinds: [],
    definitionFamilyKeys: [RULE_RUNTIME_GRAPH_FAMILY_KEY, INITIATIVE_POLICY_DEFINITION_FAMILY_KEY],
    factContracts: [
      ...[
        ...Object.values(TRACER_INITIATIVE_FACT_KEYS),
        TRACER_ADDED_DICE_FACT_KEYS.min,
        TRACER_ADDED_DICE_FACT_KEYS.max
      ].map((key) => ({ key, valueKind: RULE_VALUE_KIND.NUMBER })),
      { key: TRACER_ADDED_DICE_FACT_KEYS.enabled, valueKind: RULE_VALUE_KIND.BOOLEAN }
    ],
    operationContracts: [
      { key: 'evidence.integer-range', contractVersion: 1 },
      { key: 'number.add', contractVersion: 1 },
      {
        key: addedDiceTotalEvidenceRuleOperation.key,
        contractVersion: addedDiceTotalEvidenceRuleOperation.contractVersion
      }
    ]
  }
]
export const operations: GameSystemRuntimeTier['operations'] = []
export const isMeleeAttackTrigger: GameSystemRuntimeTier['isMeleeAttackTrigger'] = (triggerCode) =>
  triggerCode === 'ATTACK'
export const isSpellAttackTrigger: GameSystemRuntimeTier['isSpellAttackTrigger'] = () => false
export { TRACER_SYSTEM_ID as gameSystemId }
