import { expect, it } from 'vitest'
import { classAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import { srdClasses } from '@artificer-toolkit/source-data/srd/classes/index.js'
import { parsePublicationDocument } from './publicationDocument'

function expectSameParse(input: unknown) {
  const expected = classAuthoredDtoSchema.safeParse(input)
  if (expected.success) {
    expect(parsePublicationDocument('CLASS', input).document).toEqual(expected.data)
    return
  }
  expect(() => parsePublicationDocument('CLASS', input)).toThrowError(
    expect.objectContaining({ issues: expected.error.issues })
  )
}

it('preserves normalized SRD base and subclass class documents', () => {
  for (const source of srdClasses) {
    expectSameParse({ ...source, unknownProperty: 'discard me' })
  }
})

it('preserves exact class validation errors for malformed documents', () => {
  const subclass = srdClasses.find((source) => source.category === 'SUBCLASS')!
  const malformedNestedFeature = {
    ...subclass,
    features: [{ ...subclass.features?.[0], label: 7 }]
  }
  const malformedDiscriminant = { ...srdClasses[0], category: 'INVALID' }
  const missingSubclassParent = { ...subclass, parentClassId: undefined }
  const disallowedSubclassSelectionLevel = { ...subclass, subclassSelectionLevel: 3 }

  for (const input of [
    malformedDiscriminant,
    missingSubclassParent,
    malformedNestedFeature,
    disallowedSubclassSelectionLevel
  ]) {
    expect(classAuthoredDtoSchema.safeParse(input).success).toBe(false)
    expectSameParse(input)
  }
})
