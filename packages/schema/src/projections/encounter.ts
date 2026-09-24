import { z } from '../zod.js'

import { postgresUuidSchema as serverUuidIdentityDtoSchema } from '../shared/postgresUuid.js'

import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema
} from '../api/encounterData.js'
import { automationModeDtoSchema, manualReminderModeDtoSchema } from '../api/campaignSettings.js'
import {
  encounterActorRuleInputSchema,
  encounterActorRuleOutputSchema
} from '../api/encounterActorRules.js'
import { projectionChecksumSchema, projectionIdentifierSchema } from './identity.js'
import { encounterCreatureEquipmentReplacementSchema } from './encounterCreatureEquipment.js'

const nonNegativeStreamVersionSchema = z.number().check(z.int()).check(z.gte(0))

export const ENCOUNTER_CURRENT_PROJECTION_SCHEMA_VERSION = 2

export const encounterActorRuleSnapshotProjectionSchema = z.strictObject({
  encounterVersion: nonNegativeStreamVersionSchema,
  facts: encounterActorRuleInputSchema,
  output: encounterActorRuleOutputSchema,
  revisionId: projectionIdentifierSchema
})

const encounterGmProjectionForPersistenceSchema = z.extend(encounterGmProjectionDtoSchema, {
  blueprintVersion: nonNegativeStreamVersionSchema,
  version: nonNegativeStreamVersionSchema
})

const encounterCommandResultForPersistenceSchema = z.extend(encounterCommandResultDtoSchema, {
  projection: encounterGmProjectionForPersistenceSchema
})

function validateEncounterProjectionEnvelope(
  value: {
    encounterId: string
    streamVersion: number
    projection: { id: string; version: number; rulePackRevisionId: string | null }
    ruleSnapshot: { encounterVersion: number; revisionId: string }
  },
  context: z.core.$RefinementCtx
) {
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
}

export const encounterCurrentProjectionSchema = z
  .strictObject({
    encounterId: projectionIdentifierSchema,
    streamVersion: nonNegativeStreamVersionSchema,
    projectionSchemaVersion: z.literal(ENCOUNTER_CURRENT_PROJECTION_SCHEMA_VERSION),
    projectionChecksum: projectionChecksumSchema,
    projection: encounterGmProjectionForPersistenceSchema,
    ruleSnapshot: encounterActorRuleSnapshotProjectionSchema
  })
  .check(z.superRefine(validateEncounterProjectionEnvelope))

export type EncounterCurrentProjection = z.infer<typeof encounterCurrentProjectionSchema>

/**
 * The only supported historical Encounter projection format. It is retained
 * solely to decode rows written before Blueprint identity was normalized.
 */
export const legacyEncounterGmProjectionV1Schema = z.extend(
  z.omit(encounterGmProjectionForPersistenceSchema, {
    blueprintChecksum: true,
    blueprintId: true,
    blueprintVersion: true,
    gameSystemId: true,
    automationMode: true,
    manualReminderMode: true
  }),
  {
    templateId: projectionIdentifierSchema,
    templateVersion: z.number().check(z.int()).check(z.nonnegative())
  }
)

export const legacyEncounterCurrentProjectionV1Schema = z
  .strictObject({
    encounterId: projectionIdentifierSchema,
    streamVersion: nonNegativeStreamVersionSchema,
    projectionSchemaVersion: z.literal(1),
    projectionChecksum: projectionChecksumSchema,
    projection: legacyEncounterGmProjectionV1Schema,
    ruleSnapshot: encounterActorRuleSnapshotProjectionSchema
  })
  .check(z.superRefine(validateEncounterProjectionEnvelope))

export type LegacyEncounterCurrentProjectionV1 = z.infer<
  typeof legacyEncounterCurrentProjectionV1Schema
>

const legacyEncounterCommandResultV1Schema = z.extend(encounterCommandResultForPersistenceSchema, {
  projection: legacyEncounterGmProjectionV1Schema
})

export const legacyEncounterProjectionEventV1Schema = z
  .strictObject({
    command: legacyEncounterCommandResultV1Schema,
    currentProjection: legacyEncounterCurrentProjectionV1Schema
  })
  .check(
    z.superRefine((value, context) => {
      if (
        value.command.projection.id !== value.currentProjection.encounterId ||
        value.command.projection.version !== value.currentProjection.streamVersion
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Historical Encounter event command must match its current projection identity and stream version.',
          path: ['command', 'projection']
        })
      }
    })
  )

export type LegacyEncounterProjectionEventV1 = z.infer<
  typeof legacyEncounterProjectionEventV1Schema
>

export const encounterProjectionBlueprintHeaderSchema = z.strictObject({
  encounterId: projectionIdentifierSchema,
  gameSystemId: projectionIdentifierSchema,
  blueprintId: projectionIdentifierSchema,
  blueprintVersion: z.number().check(z.int()).check(z.nonnegative()),
  blueprintChecksum: projectionChecksumSchema,
  automationMode: automationModeDtoSchema,
  manualReminderMode: manualReminderModeDtoSchema
})

export type EncounterProjectionBlueprintHeader = z.infer<
  typeof encounterProjectionBlueprintHeaderSchema
>

export function assertEncounterProjectionBlueprintHeader(input: {
  header: EncounterProjectionBlueprintHeader
  projection: EncounterCurrentProjection
}): EncounterCurrentProjection {
  const header = encounterProjectionBlueprintHeaderSchema.parse(input.header)
  const projection = encounterCurrentProjectionSchema.parse(input.projection)
  if (
    projection.encounterId !== header.encounterId ||
    projection.projection.gameSystemId !== header.gameSystemId ||
    projection.projection.blueprintId !== header.blueprintId ||
    projection.projection.blueprintVersion !== header.blueprintVersion ||
    projection.projection.blueprintChecksum !== header.blueprintChecksum
  ) {
    throw new Error('Encounter projection does not match its normalized Blueprint identity.')
  }
  return projection
}

export function upgradeLegacyEncounterCurrentProjectionV1(input: {
  header: EncounterProjectionBlueprintHeader
  projection: LegacyEncounterCurrentProjectionV1
}): EncounterCurrentProjection {
  const header = encounterProjectionBlueprintHeaderSchema.parse(input.header)
  const legacy = legacyEncounterCurrentProjectionV1Schema.parse(input.projection)
  if (legacy.encounterId !== header.encounterId) {
    throw new Error(
      'Historical Encounter projection does not match its normalized Encounter identity.'
    )
  }
  if (
    legacy.projection.templateId !== header.blueprintId ||
    legacy.projection.templateVersion !== header.blueprintVersion
  ) {
    throw new Error(
      'Historical Encounter projection does not match its normalized Blueprint identity.'
    )
  }
  return assertEncounterProjectionBlueprintHeader({
    header,
    projection: encounterCurrentProjectionSchema.parse({
      ...legacy,
      projectionSchemaVersion: ENCOUNTER_CURRENT_PROJECTION_SCHEMA_VERSION,
      projectionChecksum: '0'.repeat(64),
      projection: {
        ...(() => {
          const {
            templateId: _templateId,
            templateVersion: _templateVersion,
            ...projection
          } = legacy.projection
          return projection
        })(),
        gameSystemId: header.gameSystemId,
        blueprintId: header.blueprintId,
        blueprintVersion: header.blueprintVersion,
        blueprintChecksum: header.blueprintChecksum,
        automationMode: header.automationMode,
        manualReminderMode: header.manualReminderMode
      }
    })
  })
}

export function upgradeLegacyEncounterProjectionEventV1(input: {
  header: EncounterProjectionBlueprintHeader
  event: LegacyEncounterProjectionEventV1
}): EncounterProjectionEvent {
  const event = legacyEncounterProjectionEventV1Schema.parse(input.event)
  const currentProjection = upgradeLegacyEncounterCurrentProjectionV1({
    header: input.header,
    projection: event.currentProjection
  })
  return encounterProjectionEventSchema.parse({
    command: {
      ...event.command,
      projection: currentProjection.projection
    },
    currentProjection,
    ruleReceipt: null
  })
}

export const encounterProjectionEventSchema = z
  .strictObject({
    command: encounterCommandResultForPersistenceSchema,
    currentProjection: encounterCurrentProjectionSchema,
    /**
     * New events explicitly declare whether their Encounter command owns a
     * rule receipt. Omission is reserved for historical event decoding.
     */
    ruleReceipt: z.nullable(
      z.strictObject({
        occurrenceId: serverUuidIdentityDtoSchema,
        resultChecksum: projectionChecksumSchema
      })
    ),
    /** Server-only provenance for an Encounter-owned Creature equipment overlay. */
    creatureEquipmentReplacement: z.optional(encounterCreatureEquipmentReplacementSchema),
    /** Optional for historical events; new mechanics-bearing events pin the effective combat policy. */
    optionalCombatSnapshotChecksum: z.optional(z.nullable(projectionChecksumSchema))
  })
  .check(
    z.superRefine((value, context) => {
      if (
        value.command.projection.id !== value.currentProjection.encounterId ||
        value.command.projection.version !== value.currentProjection.streamVersion
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Encounter event command must match its current projection identity and stream version.',
          path: ['command', 'projection']
        })
      }
    })
  )

export type EncounterProjectionEvent = z.infer<typeof encounterProjectionEventSchema>
