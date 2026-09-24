import { z } from '../zod.js'

import {
  backgroundAuthoredDtoSchema,
  classAuthoredDtoSchema,
  creatureAuthoredDtoSchema,
  equipmentAuthoredDtoSchema,
  featAuthoredDtoSchema,
  raceAuthoredDtoSchema,
  spellAuthoredDtoSchema,
  vehicleAuthoredDtoSchema
} from '../subjects/index.js'
import {
  authoredSubjectKindSchema,
  authoredVersionVectorSchema,
  jsonValueSchema,
  projectionChecksumSchema,
  projectionIdentifierSchema,
  projectionSchemaVersionSchema
} from './identity.js'

const authoredVersionMetadataSchema = {
  versionId: projectionIdentifierSchema,
  version: projectionSchemaVersionSchema,
  documentSchemaVersion: projectionSchemaVersionSchema,
  checksum: projectionChecksumSchema
}

const backgroundAuthoredDocumentVersionSchema = z.strictObject({
  subjectKind: z.literal('BACKGROUND'),
  subjectId: projectionIdentifierSchema,
  ...authoredVersionMetadataSchema,
  document: z.strictObject(backgroundAuthoredDtoSchema.shape)
})
const classAuthoredDocumentVersionSchema = z.strictObject({
  subjectKind: z.literal('CLASS'),
  subjectId: projectionIdentifierSchema,
  ...authoredVersionMetadataSchema,
  document: classAuthoredDtoSchema
})
const creatureAuthoredDocumentVersionSchema = z.strictObject({
  subjectKind: z.literal('CREATURE'),
  subjectId: projectionIdentifierSchema,
  ...authoredVersionMetadataSchema,
  document: z.strictObject(creatureAuthoredDtoSchema.shape)
})
const equipmentAuthoredDocumentVersionSchema = z.strictObject({
  subjectKind: z.literal('EQUIPMENT'),
  subjectId: projectionIdentifierSchema,
  ...authoredVersionMetadataSchema,
  document: equipmentAuthoredDtoSchema
})
const featAuthoredDocumentVersionSchema = z.strictObject({
  subjectKind: z.literal('FEAT'),
  subjectId: projectionIdentifierSchema,
  ...authoredVersionMetadataSchema,
  document: z.strictObject(featAuthoredDtoSchema.shape)
})
const raceAuthoredDocumentVersionSchema = z.strictObject({
  subjectKind: z.literal('RACE'),
  subjectId: projectionIdentifierSchema,
  ...authoredVersionMetadataSchema,
  document: raceAuthoredDtoSchema
})
const spellAuthoredDocumentVersionSchema = z.strictObject({
  subjectKind: z.literal('SPELL'),
  subjectId: projectionIdentifierSchema,
  ...authoredVersionMetadataSchema,
  document: z.strictObject(spellAuthoredDtoSchema.shape)
})
const vehicleAuthoredDocumentVersionSchema = z.strictObject({
  subjectKind: z.literal('VEHICLE'),
  subjectId: projectionIdentifierSchema,
  ...authoredVersionMetadataSchema,
  document: z.strictObject(vehicleAuthoredDtoSchema.shape)
})

export type AuthoredDocumentVersion =
  | z.infer<typeof backgroundAuthoredDocumentVersionSchema>
  | z.infer<typeof classAuthoredDocumentVersionSchema>
  | z.infer<typeof creatureAuthoredDocumentVersionSchema>
  | z.infer<typeof equipmentAuthoredDocumentVersionSchema>
  | z.infer<typeof featAuthoredDocumentVersionSchema>
  | z.infer<typeof raceAuthoredDocumentVersionSchema>
  | z.infer<typeof spellAuthoredDocumentVersionSchema>
  | z.infer<typeof vehicleAuthoredDocumentVersionSchema>

export const authoredDocumentVersionSchema: z.ZodMiniType<AuthoredDocumentVersion> = z
  .discriminatedUnion('subjectKind', [
    backgroundAuthoredDocumentVersionSchema,
    classAuthoredDocumentVersionSchema,
    creatureAuthoredDocumentVersionSchema,
    equipmentAuthoredDocumentVersionSchema,
    featAuthoredDocumentVersionSchema,
    raceAuthoredDocumentVersionSchema,
    spellAuthoredDocumentVersionSchema,
    vehicleAuthoredDocumentVersionSchema
  ])
  .check(
    z.superRefine((value, context) => {
      if (value.document.id !== value.subjectId) {
        context.addIssue({
          code: 'custom',
          message: 'Document identity must match its version subject identity.',
          path: ['document', 'id']
        })
      }
    })
  )

export const compiledAuthoredProjectionSchema = z.strictObject({
  subjectKind: authoredSubjectKindSchema,
  subjectId: projectionIdentifierSchema,
  authoredVersionId: projectionIdentifierSchema,
  authoredVersion: projectionSchemaVersionSchema,
  authoredChecksum: projectionChecksumSchema,
  projectionSchemaVersion: projectionSchemaVersionSchema,
  compilerVersion: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
  vocabularySnapshotId: projectionIdentifierSchema,
  vocabularySnapshotVersion: projectionSchemaVersionSchema,
  vocabularySnapshotChecksum: projectionChecksumSchema,
  authoredDependencies: authoredVersionVectorSchema,
  projectionChecksum: projectionChecksumSchema,
  projection: z.record(z.string(), jsonValueSchema)
})

export type CompiledAuthoredProjection = z.infer<typeof compiledAuthoredProjectionSchema>
