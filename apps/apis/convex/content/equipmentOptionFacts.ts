import {
  authoredEquipmentOptionFactsSchema,
  type AuthoredEquipmentOptionFacts
} from '@artificer-toolkit/schema/api/authoredOptions'
import type { EquipmentAuthoredDto } from '@artificer-toolkit/schema/subjects/equipment'
import { toCharacterBuilderEquipmentCatalogRecord } from '@artificer-toolkit/rules-runtime/character/builderCatalog'
import type { ResolvedEquipment } from '@artificer-toolkit/shared/subjects/compilers'

export function equipmentOptionFacts(
  document: EquipmentAuthoredDto,
  checksum: string,
  effective?: ResolvedEquipment
): AuthoredEquipmentOptionFacts {
  const builder = effective && toCharacterBuilderEquipmentCatalogRecord(effective)
  return authoredEquipmentOptionFactsSchema.parse({
    checksum,
    category: document.category,
    properties: document.properties ?? [],
    ...(builder
      ? {
          builder: {
            version: 1,
            parentEquipmentId: document.category === 'VARIANT' ? document.parentEquipmentId : null,
            category: builder.category,
            properties: builder.properties,
            isContainer: builder.isContainer,
            ...(builder.maxStack !== undefined ? { maxStack: builder.maxStack } : {}),
            requiresAttunement: builder.requiresAttunement
          }
        }
      : {})
  })
}
