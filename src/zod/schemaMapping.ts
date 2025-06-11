// This file is auto-generated. Do not edit manually.
import { z } from 'zod/v4'
import * as schemas from './schemas'

/**
 * Mapping of GraphQL input type names to their corresponding Zod schema function names.
 */
export const inputTypeToSchemaMap = {
  "CharacterInput": "CharacterInputSchema",
  "SpellInput": "SpellInputSchema",
  "FeatureSpellInput": "FeatureSpellInputSchema",
  "FeatureSenseInput": "FeatureSenseInputSchema",
  "FeatureProficiencyInput": "FeatureProficiencyInputSchema",
  "FeatureOptionInput": "FeatureOptionInputSchema",
  "FeatureModifierInput": "FeatureModifierInputSchema",
  "FeatureInput": "FeatureInputSchema",
  "ClassInput": "ClassInputSchema",
  "BackgroundInput": "BackgroundInputSchema",
  "FeatureFeatInput": "FeatureFeatInputSchema",
  "FeatureExpertiseInput": "FeatureExpertiseInputSchema",
  "FeatInput": "FeatInputSchema",
  "EquipmentInput": "EquipmentInputSchema",
  "AncestryFeatureInput": "AncestryFeatureInputSchema",
  "RaceInput": "RaceInputSchema",
  "SystemInput": "SystemInputSchema"
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
    "CharacterInput": schemas.CharacterInputSchema,
  "SpellInput": schemas.SpellInputSchema,
  "ClassInput": schemas.ClassInputSchema,
  "BackgroundInput": schemas.BackgroundInputSchema,
  "FeatInput": schemas.FeatInputSchema,
  "EquipmentInput": schemas.EquipmentInputSchema,
  "RaceInput": schemas.RaceInputSchema
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
  "FeatureInput": schemas.FeatureInputSchema,
  "FeatureFeatInput": schemas.FeatureFeatInputSchema,
  "FeatureExpertiseInput": schemas.FeatureExpertiseInputSchema,
  "AncestryFeatureInput": schemas.AncestryFeatureInputSchema
} as const

/**
 * Discriminated union Zod schema for GraphQL input objects.
 */
export const discriminatedDomainInputSchema = z.discriminatedUnion('__kind', [
  schemas.CharacterInputSchema,
  schemas.SpellInputSchema,
  schemas.ClassInputSchema,
  schemas.BackgroundInputSchema,
  schemas.FeatInputSchema,
  schemas.EquipmentInputSchema,
  schemas.RaceInputSchema
])

export const discriminatedFeatureInputSchema = z.discriminatedUnion('__kind', [
  schemas.FeatureSpellInputSchema,
  schemas.FeatureSenseInputSchema,
  schemas.FeatureProficiencyInputSchema,
  schemas.FeatureOptionInputSchema,
  schemas.FeatureModifierInputSchema,
  schemas.FeatureInputSchema,
  schemas.FeatureFeatInputSchema,
  schemas.FeatureExpertiseInputSchema,
  schemas.AncestryFeatureInputSchema
])
