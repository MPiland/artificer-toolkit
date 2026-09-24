import { z } from '../zod.js'

import { systemAuthoredDtoSchema } from '../vocabulary/system.js'
import {
  projectionChecksumSchema,
  projectionIdentifierSchema,
  projectionSchemaVersionSchema
} from './identity.js'

export const systemVocabularySnapshotSchema = z
  .strictObject({
    snapshotId: projectionIdentifierSchema,
    systemId: projectionIdentifierSchema,
    snapshotVersion: projectionSchemaVersionSchema,
    schemaVersion: projectionSchemaVersionSchema,
    checksum: projectionChecksumSchema,
    document: systemAuthoredDtoSchema
  })
  .check(
    z.superRefine((value, context) => {
      if (value.document.id !== value.systemId) {
        context.addIssue({
          code: 'custom',
          message: 'Vocabulary document identity must match its snapshot system identity.',
          path: ['document', 'id']
        })
      }
    })
  )

export type SystemVocabularySnapshot = z.infer<typeof systemVocabularySnapshotSchema>
