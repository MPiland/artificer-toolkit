import { describe, expect, it } from 'vitest'

import {
  DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
  DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_4_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID,
  dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema
} from '@artificer-toolkit/schema/shared/encounterLifecycle'
import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS } from '../source-data/srd/encounterLifecycle.js'

describe('SRD encounter lifecycle reusable definitions', () => {
  it('publishes the exact graph and lifecycle documents referenced by Creature Features', () => {
    const byId = new Map(
      SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS.map((definition) => [definition.id, definition])
    )
    const lifecycleIds = [
      DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
      DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
      DND5E_RECHARGE_4_LIFECYCLE_DEFINITION_ID,
      DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
      DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID
    ]

    expect(byId.size).toBe(10)
    for (const lifecycleId of lifecycleIds) {
      const lifecycle = byId.get(lifecycleId)
      expect(lifecycle).toBeDefined()
      if (!lifecycle) continue
      expect(lifecycle.definitionFamilyKey).toBe('dnd5e-encounter-lifecycle')
      expect(lifecycle.checksum).toBe(checksumRuleDocument(lifecycle.document))
      const document = dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.parse(
        lifecycle.document
      )
      const pin =
        document.kind === 'LEGENDARY_ACTION'
          ? document.eligibilityGraph
          : document.kind === 'LEGENDARY_RESISTANCE'
            ? document.choiceGraph
            : document.rechargeGraph
      const graph = byId.get(pin.definitionId)
      expect(graph).toBeDefined()
      if (!graph) continue
      expect(graph.definitionFamilyKey).toBe('rules-runtime-graph')
      expect(graph.checksum).toBe(pin.definitionChecksum)
      expect(ruleGraphDefinitionDtoSchema.safeParse(graph.document).success).toBe(true)
    }
  })
})
