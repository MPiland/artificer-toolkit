import { z } from 'zod'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '../api/characterRules.js'
import { characterAuthoredDtoSchema } from '../subjects/character.js'
import { characterProvenanceDtoSchema } from '../subjects/characterIntent.js'
import {
  authoredVersionVectorSchema,
  jsonValueSchema,
  projectionChecksumSchema,
  projectionIdentifierSchema,
  projectionSchemaVersionSchema
} from './identity.js'

const nonNegativeStreamVersionSchema = z.number().int().min(0)

const characterMechanicsContentRefSchema = z.strictObject({
  definitionId: projectionIdentifierSchema,
  binding: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('ACTIVE') }),
    z.strictObject({ kind: z.literal('REVISION'), revisionId: projectionIdentifierSchema })
  ]),
  systemId: projectionIdentifierSchema
})

export const characterMechanicsRuleSnapshotSchema = z.strictObject({
  characterId: projectionIdentifierSchema,
  systemId: projectionIdentifierSchema,
  classes: z.array(
    z.strictObject({
      classId: projectionIdentifierSchema,
      subclassId: projectionIdentifierSchema.optional()
    })
  ),
  features: z.array(
    z.strictObject({
      featureId: projectionIdentifierSchema,
      source: characterProvenanceDtoSchema
    })
  ),
  equipmentItems: z.array(
    z.strictObject({
      instanceId: projectionIdentifierSchema,
      contentRef: characterMechanicsContentRefSchema,
      compiledItem: z.strictObject({ category: z.string().trim().min(1).max(80) })
    })
  )
})

export type CharacterMechanicsRuleSnapshot = z.infer<typeof characterMechanicsRuleSnapshotSchema>

export const characterMechanicsProjectionSchema = z.strictObject({
  characterId: projectionIdentifierSchema,
  commandState: characterAuthoredDtoSchema,
  commandStateChecksum: projectionChecksumSchema,
  commandLaneChecksum: projectionChecksumSchema,
  projectionSchemaVersion: projectionSchemaVersionSchema,
  projectionChecksum: projectionChecksumSchema,
  characterStreamVersion: nonNegativeStreamVersionSchema,
  authoredVersionVector: authoredVersionVectorSchema,
  systemVocabularySnapshotId: projectionIdentifierSchema,
  systemVocabularySnapshotVersion: projectionSchemaVersionSchema,
  systemVocabularySnapshotChecksum: projectionChecksumSchema,
  ruleRevisionId: projectionIdentifierSchema,
  ruleRevisionChecksum: projectionChecksumSchema,
  evaluatorVersion: z.string().trim().min(1).max(80),
  modelContractVersion: z.number().int().min(1).max(10_000),
  ruleSnapshot: characterMechanicsRuleSnapshotSchema,
  rulePolicyInput: characterRulePolicyInputSchema,
  rulePolicyOutput: characterRulePolicyOutputSchema,
  ruleRegistry: z.record(z.string(), jsonValueSchema)
})

export type CharacterMechanicsProjection = z.infer<typeof characterMechanicsProjectionSchema>

/**
 * The bounded durable identity required to reuse a room's already-validated
 * mechanics snapshot without reading its large rule payload on every command.
 */
export const characterMechanicsProjectionMetadataSchema = characterMechanicsProjectionSchema.pick({
  characterId: true,
  commandState: true,
  commandStateChecksum: true,
  commandLaneChecksum: true,
  projectionSchemaVersion: true,
  projectionChecksum: true,
  characterStreamVersion: true,
  authoredVersionVector: true,
  systemVocabularySnapshotId: true,
  systemVocabularySnapshotVersion: true,
  systemVocabularySnapshotChecksum: true,
  ruleRevisionId: true,
  ruleRevisionChecksum: true,
  evaluatorVersion: true,
  modelContractVersion: true
})

export type CharacterMechanicsProjectionMetadata = z.infer<
  typeof characterMechanicsProjectionMetadataSchema
>
