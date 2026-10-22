import { checksumRuleDocument, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'

/** The published DTO of a graph this compiler built: its identity, checksum and definition. */
export function publishedGraph(definition: RuleGraphDefinition) {
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: definition.id,
    gameSystemId: definition.gameSystemId,
    definitionFamilyKey: definition.definitionFamilyKey,
    checksum: checksumRuleDocument(definition),
    definition
  })
}
