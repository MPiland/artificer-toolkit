import {
  INITIATIVE_POLICY_DEFINITION_FAMILY_KEY,
  RULE_RUNTIME_GRAPH_FAMILY_KEY
} from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import { RULE_VALUE_KIND } from '@artificer-toolkit/shared/rules'

import type { GameSystemRuntimeTier } from '../../platformRulesRuntime.js'
import { TRACER_INITIATIVE_FACT_KEYS } from './encounterTier.js'
import { TRACER_SYSTEM_ID } from './system.js'

/** The tracer's published-graph contract: its own initiative facts over core operations only. */
export const tracerRuntimeTier: GameSystemRuntimeTier = {
  gameSystemId: TRACER_SYSTEM_ID,
  capabilities: [
    {
      gameSystemId: TRACER_SYSTEM_ID,
      contractVersion: 1,
      authoredRootKinds: [],
      contentKinds: [],
      definitionFamilyKeys: [
        RULE_RUNTIME_GRAPH_FAMILY_KEY,
        INITIATIVE_POLICY_DEFINITION_FAMILY_KEY
      ],
      factContracts: Object.values(TRACER_INITIATIVE_FACT_KEYS).map((key) => ({
        key,
        valueKind: RULE_VALUE_KIND.NUMBER
      })),
      operationContracts: [
        { key: 'evidence.integer-range', contractVersion: 1 },
        { key: 'number.add', contractVersion: 1 }
      ]
    }
  ],
  operations: [],
  isMeleeAttackTrigger: (triggerCode) => triggerCode === 'ATTACK',
  isSpellAttackTrigger: () => false
}
