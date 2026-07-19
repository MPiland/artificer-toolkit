import {
  CLASS_ATTRIBUTE,
  FEATURE_ATTRIBUTE,
  SIZE_CODE,
  SPELLCASTING_ATTRIBUTE,
  SPELL_ATTRIBUTE,
  SUBCLASS_ATTRIBUTE
} from '@artificer-toolkit/shared'
import {
  classAttributeSchema,
  featureAttributeSchema,
  sizeCodeSchema,
  spellcastingAttributeSchema,
  spellAttributeSchema,
  subclassAttributeSchema
} from '@artificer-toolkit/schema/shared/enums'
import { describe, expect, it } from 'vitest'

describe('shared and transport authored vocabularies', () => {
  it.each([
    [SIZE_CODE, sizeCodeSchema.options],
    [CLASS_ATTRIBUTE, classAttributeSchema.options],
    [SUBCLASS_ATTRIBUTE, subclassAttributeSchema.options],
    [SPELLCASTING_ATTRIBUTE, spellcastingAttributeSchema.options],
    [FEATURE_ATTRIBUTE, featureAttributeSchema.options],
    [SPELL_ATTRIBUTE, spellAttributeSchema.options]
  ])('keeps the schema vocabulary aligned with its owning shared model', (sharedValues, schemaValues) => {
    expect([...schemaValues].sort()).toEqual(Object.values(sharedValues).sort())
  })
})
