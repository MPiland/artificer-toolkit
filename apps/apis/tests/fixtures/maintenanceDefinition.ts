import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { ruleMaintenanceReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleMaintenance'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

export function maintenanceDefinitionFixture(input: {
  id: string
  emptyDependentPolicy?: 'TERMINATE_WHEN_EMPTY' | 'RETAIN_UNTIL_TERMINAL'
}) {
  const document = ruleMaintenanceReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'RULE_MAINTENANCE',
    id: input.id,
    gameSystemId: srdSystemRecord.id,
    replacementPolicy: 'REPLACE_SAME_DEFINITION',
    emptyDependentPolicy: input.emptyDependentPolicy ?? 'TERMINATE_WHEN_EMPTY',
    damageCheckDefinitionId: null
  })
  return {
    id: document.id,
    definitionFamilyKey: 'rule-maintenance' as const,
    label: 'Native maintained effect fixture',
    description: 'Reusable maintenance policy for native test actions.',
    document: jsonValueSchema.parse(document),
    checksum: checksumRuleDocument(document)
  }
}
