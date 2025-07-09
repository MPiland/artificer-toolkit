// This file is auto-generated. Do not edit manually.
import { z } from 'zod/v4'
import * as schemas from './schemas'

/**
 * Mapping of GraphQL input type names to their corresponding Zod schema function names.
 */
export const inputTypeToSchemaMap = {
  "SystemInput": "SystemInputSchema",
  "SpellInput": "SpellInputSchema",
  "RaceInput": "RaceInputSchema",
  "FeatureSpellInput": "FeatureSpellInputSchema",
  "FeatureSenseInput": "FeatureSenseInputSchema",
  "FeatureProficiencyInput": "FeatureProficiencyInputSchema",
  "FeatureOptionInput": "FeatureOptionInputSchema",
  "FeatureModifierInput": "FeatureModifierInputSchema",
  "FeatureFeatInput": "FeatureFeatInputSchema",
  "FeatureExpertiseInput": "FeatureExpertiseInputSchema",
  "FeatureInput": "FeatureInputSchema",
  "FeatInput": "FeatInputSchema",
  "EquipmentInput": "EquipmentInputSchema",
  "ClassInput": "ClassInputSchema",
  "CharacterInput": "CharacterInputSchema",
  "BackgroundInput": "BackgroundInputSchema",
  "AncestryOptionInput": "AncestryOptionInputSchema"
} as const

/**
 * Union type of all GraphQL input type names.
 */
export type InputTypeName = keyof typeof inputTypeToSchemaMap

/**
 * Get a Zod schema for a given GraphQL input type name.
 */
export function getInputSchema<T extends InputTypeName>(
  typeName: T
): z.ZodTypeAny {
  const schemaName = inputTypeToSchemaMap[typeName]
  return schemas[schemaName]
}

/**
 * Mapped type of inferred TypeScript types from each Zod schema.
 */
export type DomainInputTypeToInferredType = {
  [K in InputTypeName]: z.infer<typeof schemas[typeof inputTypeToSchemaMap[K]]>
}

export const DomainInputTypeToInferredType = {
    "SpellInput": schemas.SpellInputSchema,
  "RaceInput": schemas.RaceInputSchema,
  "FeatInput": schemas.FeatInputSchema,
  "EquipmentInput": schemas.EquipmentInputSchema,
  "ClassInput": schemas.ClassInputSchema,
  "CharacterInput": schemas.CharacterInputSchema,
  "BackgroundInput": schemas.BackgroundInputSchema,
  "AncestryOptionInput": schemas.AncestryOptionInputSchema
} as const

export type FeatureInputTypeToInferredType = {
  [K in InputTypeName]: z.infer<typeof schemas[typeof inputTypeToSchemaMap[K]]>
}

export const FeatureInputTypeToInferredType = {
    "FeatureSpellInput": schemas.FeatureSpellInputSchema,
  "FeatureSenseInput": schemas.FeatureSenseInputSchema,
  "FeatureProficiencyInput": schemas.FeatureProficiencyInputSchema,
  "FeatureOptionInput": schemas.FeatureOptionInputSchema,
  "FeatureModifierInput": schemas.FeatureModifierInputSchema,
  "FeatureFeatInput": schemas.FeatureFeatInputSchema,
  "FeatureExpertiseInput": schemas.FeatureExpertiseInputSchema,
  "FeatureInput": schemas.FeatureInputSchema
} as const

/**
 * Discriminated union Zod schema for GraphQL input objects.
 */
export const discriminatedDomainInputSchema = z.discriminatedUnion('__kind', [
  schemas.SpellInputSchema,
  schemas.RaceInputSchema,
  schemas.FeatInputSchema,
  schemas.EquipmentInputSchema,
  schemas.ClassInputSchema,
  schemas.CharacterInputSchema,
  schemas.BackgroundInputSchema
])

export const discriminatedFeatureInputSchema = z.discriminatedUnion('__kind', [
  schemas.FeatureSpellInputSchema,
  schemas.FeatureSenseInputSchema,
  schemas.FeatureProficiencyInputSchema,
  schemas.FeatureOptionInputSchema,
  schemas.FeatureModifierInputSchema,
  schemas.FeatureFeatInputSchema,
  schemas.FeatureExpertiseInputSchema,
  schemas.FeatureInputSchema,
  schemas.AncestryOptionInputSchema
])
