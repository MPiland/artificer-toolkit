import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import { ruleMaintenanceReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleMaintenance'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { SRD_SYSTEM_ID } from './vocabulary.js'

export const SRD_DND5E_CONCENTRATION_CHECK_DEFINITION_ID = '00000000-0000-4000-8000-0000000000c2'
export const SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID =
  '00000000-0000-4000-8000-0000000000c3'

const damageCheckDocument = ruleGraphDefinitionDtoSchema.parse({
  schemaVersion: 1,
  id: SRD_DND5E_CONCENTRATION_CHECK_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  definitionFamilyKey: 'rules-runtime-graph',
  vocabularyBindings: [{ kind: 'ABILITY', definitionId: '00000000-0000-0000-0011-000300000000' }],
  nodes: [
    {
      id: 'damage_dc',
      operation: { key: 'dnd5e.concentration-damage-dc', contractVersion: 1 },
      inputs: {
        appliedDamage: {
          kind: 'FACT',
          factKey: 'dnd5e.concentration-applied-damage'
        }
      }
    },
    {
      id: 'd20',
      operation: { key: 'evidence.integer-range', contractVersion: 1 },
      inputs: {
        min: { kind: 'LITERAL', value: 1 },
        max: { kind: 'LITERAL', value: 20 }
      }
    },
    {
      id: 'd20-added-dice',
      operation: { key: 'evidence.added-dice-total', contractVersion: 1 },
      inputs: {
        min: { kind: 'FACT', factKey: 'dnd5e.added-dice-min' },
        max: { kind: 'FACT', factKey: 'dnd5e.added-dice-max' },
        enabled: { kind: 'FACT', factKey: 'dnd5e.added-dice-enabled' }
      }
    },
    {
      id: 'save',
      operation: { key: 'dnd5e.save-test-resolution', contractVersion: 3 },
      inputs: {
        targetActorId: {
          kind: 'FACT',
          factKey: 'dnd5e.concentration-target-actor-id'
        },
        naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
        addedTotal: { kind: 'NODE_OUTPUT', nodeId: 'd20-added-dice', port: 'value' },
        modifier: {
          kind: 'FACT',
          factKey: 'dnd5e.concentration-save-modifier'
        },
        threshold: { kind: 'NODE_OUTPUT', nodeId: 'damage_dc', port: 'dc' },
        contributorChecksum: {
          kind: 'FACT',
          factKey: 'dnd5e.concentration-contributor-checksum'
        },
        outcomeRule: { kind: 'FACT', factKey: 'dnd5e.test-outcome-rule' }
      }
    }
  ],
  outputs: {
    targetActorId: { kind: 'NODE_OUTPUT', nodeId: 'save', port: 'targetActorId' },
    appliedDamage: {
      kind: 'FACT',
      factKey: 'dnd5e.concentration-applied-damage'
    },
    dc: { kind: 'NODE_OUTPUT', nodeId: 'damage_dc', port: 'dc' },
    naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'save', port: 'naturalD20' },
    total: { kind: 'NODE_OUTPUT', nodeId: 'save', port: 'total' },
    resultPath: { kind: 'NODE_OUTPUT', nodeId: 'save', port: 'resultPath' },
    contributorChecksum: {
      kind: 'NODE_OUTPUT',
      nodeId: 'save',
      port: 'contributorChecksum'
    }
  }
})

const maintenanceDocument = ruleMaintenanceReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'RULE_MAINTENANCE',
  id: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  replacementPolicy: 'REPLACE_SAME_DEFINITION',
  emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY',
  damageCheckDefinitionId: SRD_DND5E_CONCENTRATION_CHECK_DEFINITION_ID
})

export const SRD_CONCENTRATION_DEFINITIONS = [
  {
    id: SRD_DND5E_CONCENTRATION_CHECK_DEFINITION_ID,
    definitionFamilyKey: 'rules-runtime-graph',
    label: 'Concentration damage check',
    description: 'D&D concentration saving throw required after finalized positive damage.',
    document: damageCheckDocument,
    checksum: checksumRuleDocument(damageCheckDocument)
  },
  {
    id: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
    definitionFamilyKey: 'rule-maintenance',
    label: 'Concentration',
    description: 'D&D concentration maintenance and replacement policy.',
    document: maintenanceDocument,
    checksum: checksumRuleDocument(maintenanceDocument)
  }
] as const
