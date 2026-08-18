import { z } from 'zod'

import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema
} from '../api/encounters.js'
import {
  encounterActorRuleInputSchema,
  encounterActorRuleOutputSchema
} from '../api/encounterActorRules.js'
import {
  projectionChecksumSchema,
  projectionIdentifierSchema,
  projectionSchemaVersionSchema
} from './identity.js'

const nonNegativeStreamVersionSchema = z.number().int().min(0)

export const ENCOUNTER_CURRENT_PROJECTION_SCHEMA_VERSION = 1

export const encounterActorRuleSnapshotProjectionSchema = z.strictObject({
  encounterVersion: nonNegativeStreamVersionSchema,
  facts: encounterActorRuleInputSchema,
  output: encounterActorRuleOutputSchema,
  revisionId: projectionIdentifierSchema
})

export const encounterCurrentProjectionSchema = z
  .strictObject({
    encounterId: projectionIdentifierSchema,
    streamVersion: nonNegativeStreamVersionSchema,
    projectionSchemaVersion: projectionSchemaVersionSchema,
    projectionChecksum: projectionChecksumSchema,
    projection: encounterGmProjectionDtoSchema,
    ruleSnapshot: encounterActorRuleSnapshotProjectionSchema
  })
  .superRefine((value, context) => {
    if (value.projection.id !== value.encounterId) {
      context.addIssue({
        code: 'custom',
        message: 'Encounter projection identity must match its aggregate identity.',
        path: ['projection', 'id']
      })
    }
    if (value.projection.version !== value.streamVersion) {
      context.addIssue({
        code: 'custom',
        message: 'Encounter projection version must match its aggregate stream version.',
        path: ['projection', 'version']
      })
    }
    if (value.ruleSnapshot.encounterVersion !== value.streamVersion) {
      context.addIssue({
        code: 'custom',
        message: 'Encounter rule snapshot version must match its projection stream version.',
        path: ['ruleSnapshot', 'encounterVersion']
      })
    }
    if (value.projection.rulePackRevisionId !== value.ruleSnapshot.revisionId) {
      context.addIssue({
        code: 'custom',
        message: 'Encounter rule snapshot revision must match its projection rule revision.',
        path: ['ruleSnapshot', 'revisionId']
      })
    }
  })

export type EncounterCurrentProjection = z.infer<typeof encounterCurrentProjectionSchema>

export const encounterProjectionEventSchema = z
  .strictObject({
    command: encounterCommandResultDtoSchema,
    currentProjection: encounterCurrentProjectionSchema
  })
  .superRefine((value, context) => {
    if (
      value.command.projection.id !== value.currentProjection.encounterId ||
      value.command.projection.version !== value.currentProjection.streamVersion
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Encounter event command must match its current projection identity and stream version.',
        path: ['command', 'projection']
      })
    }
  })

export type EncounterProjectionEvent = z.infer<typeof encounterProjectionEventSchema>
