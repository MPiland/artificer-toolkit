import { z } from '../zod.js'

import { automationModeDtoSchema, manualReminderModeDtoSchema } from './campaignSettings.js'
import { featureReferenceDtoSchema } from '../features/reference.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { encounterInitiativePolicySummaryDtoSchema } from '../shared/initiativePolicySnapshot.js'
import { encounterOptionalCombatSummaryDtoSchema } from '../shared/optionalCombat.js'
import {
  encounterRuleOccurrenceSummaryDtoSchema,
  pendingEncounterRuleOccurrenceSummaryDtoSchema,
  type EncounterRuleOccurrenceSummaryDto,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '../shared/encounterRuleOccurrence.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import { jsonValueSchema } from '../projections/identity.js'
import { encounterBlueprintMetadataDtoSchema } from '../shared/encounterBlueprint.js'
import { rollRecordDtoSchema } from './rolls.js'
import { ruleOutcomeKindDtoSchema, ruleResolutionEvidenceDtoSchema } from './rules.js'

const uuidSchema = z.string().check(z.uuid())
const versionSchema = z.number().check(z.int()).check(z.nonnegative())
const timestampSchema = z.iso.datetime()
const jsonSchema = z.json()

export {
  automationModeDtoSchema as encounterAutomationModeDtoSchema,
  manualReminderModeDtoSchema as encounterManualReminderModeDtoSchema
}

export const encounterStatusDtoSchema = z.enum(['PREPARED', 'ACTIVE', 'COMPLETED'])
export const encounterActorKindDtoSchema = z.enum(['CHARACTER', 'CREATURE', 'CUSTOM'])
export { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
export const encounterHealthBandDtoSchema = z.enum([
  'HEALTHY',
  'WOUNDED',
  'BLOODIED',
  'CRITICAL',
  'DEFEATED'
])

const encounterActorBaseDtoSchema = z.strictObject({
  id: uuidSchema,
  encounterId: uuidSchema,
  kind: encounterActorKindDtoSchema,
  label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
  sourceId: z.nullable(postgresUuidSchema),
  sourceRevision: z.nullable(z.number().check(z.int()).check(z.positive())),
  public: z.boolean(),
  initiative: z.nullable(z.number().check(z.int())),
  manualOrder: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
  conditions: jsonSchema,
  healthBand: encounterHealthBandDtoSchema
})

export const encounterPlayerActorDtoSchema = encounterActorBaseDtoSchema

export const encounterFeatureReferenceDtoSchema = z.extend(
  z.pick(featureReferenceDtoSchema, {
    id: true,
    label: true,
    description: true,
    section: true,
    rollDefinitions: true
  }),
  {
    resource: z._default(
      z.nullable(
        z.strictObject({
          used: z.number().check(z.int()).check(z.nonnegative()),
          maximum: z.number().check(z.int()).check(z.nonnegative()),
          remaining: z.number().check(z.int()).check(z.nonnegative()),
          resetKind: z.enum(['DAILY', 'DAWN', 'DUSK', 'LONG_REST', 'SHORT_REST', 'MANUAL'])
        })
      ),
      null
    )
  }
)

export const encounterGmActorDtoSchema = z.extend(encounterActorBaseDtoSchema, {
  systemId: z.nullable(postgresUuidSchema),
  stableTieKey: z.string().check(z.minLength(1)),
  currentHitPoints: z.number().check(z.int()).check(z.nonnegative()),
  maxHitPoints: z.number().check(z.int()).check(z.nonnegative()),
  tempHitPoints: z.number().check(z.int()).check(z.nonnegative()),
  resources: jsonSchema,
  gmNotes: z.nullable(z.string().check(z.maxLength(4000))),
  statBlock: z.nullable(
    z.strictObject({
      armorClass: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
      abilityScores: z.nullable(z.record(z.string(), z.number())),
      speeds: z.array(z.unknown()),
      senses: z.array(z.string()),
      damageVulnerabilities: z.array(z.string()),
      damageResistances: z.array(z.string()),
      damageImmunities: z.array(z.string()),
      conditionImmunities: z.array(z.string())
    })
  ),
  features: z._default(z.array(encounterFeatureReferenceDtoSchema), [])
})

export const encounterPlayerProjectionDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  gameSystemId: postgresUuidSchema,
  blueprintId: postgresUuidSchema,
  blueprintVersion: z.number().check(z.int()).check(z.positive()),
  blueprintChecksum: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
  name: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
  status: encounterStatusDtoSchema,
  automationMode: automationModeDtoSchema,
  rulePackRevisionId: z._default(z.nullable(uuidSchema), null),
  initiativePolicy: z._default(z.nullable(encounterInitiativePolicySummaryDtoSchema), null),
  optionalCombatRules: z._default(
    z.array(encounterOptionalCombatSummaryDtoSchema).check(z.maxLength(14)),
    []
  ),
  version: z.number().check(z.int()).check(z.nonnegative()),
  round: z.number().check(z.int()).check(z.nonnegative()),
  currentActorId: z.nullable(uuidSchema),
  actors: z.array(encounterPlayerActorDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})

export const encounterGmProjectionDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  gameSystemId: postgresUuidSchema,
  blueprintId: postgresUuidSchema,
  blueprintVersion: z.number().check(z.int()).check(z.positive()),
  blueprintChecksum: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
  name: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
  status: encounterStatusDtoSchema,
  automationMode: automationModeDtoSchema,
  manualReminderMode: manualReminderModeDtoSchema,
  rulePackRevisionId: z._default(z.nullable(uuidSchema), null),
  initiativePolicy: z._default(z.nullable(encounterInitiativePolicySummaryDtoSchema), null),
  optionalCombatRules: z._default(
    z.array(encounterOptionalCombatSummaryDtoSchema).check(z.maxLength(14)),
    []
  ),
  version: z.number().check(z.int()).check(z.nonnegative()),
  round: z.number().check(z.int()).check(z.nonnegative()),
  currentActorId: z.nullable(uuidSchema),
  actors: z.array(encounterGmActorDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
  reminders: z._default(
    z.array(
      z.strictObject({
        id: uuidSchema,
        label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
        timing: z.enum(['ROUND_START', 'ROUND_END', 'ROUND_NUMBER', 'TURN_START', 'TURN_END']),
        round: z.nullable(z.number().check(z.int()).check(z.positive())),
        actorId: z.nullable(uuidSchema),
        public: z.boolean(),
        notes: z.nullable(z.string().check(z.maxLength(4000))),
        order: z.number().check(z.int()).check(z.nonnegative())
      })
    ),
    []
  ),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})

export { encounterRuleOccurrenceSummaryDtoSchema, pendingEncounterRuleOccurrenceSummaryDtoSchema }

export const encounterCommandResultDtoSchema = z.strictObject({
  projection: z.union([encounterGmProjectionDtoSchema, encounterPlayerProjectionDtoSchema]),
  roll: z.nullable(rollRecordDtoSchema),
  resolution: z._default(z.nullable(ruleResolutionEvidenceDtoSchema), null),
  occurrence: z._default(z.nullable(encounterRuleOccurrenceSummaryDtoSchema), null)
})

export const encounterTimelineResolutionSummaryDtoSchema = z.strictObject({
  rolls: z.array(rollRecordDtoSchema).check(z.maxLength(50)),
  outcomes: z
    .array(
      z.strictObject({
        kind: ruleOutcomeKindDtoSchema,
        status: z.enum(['APPLIED', 'MANUAL', 'OVERRIDDEN'])
      })
    )
    .check(z.maxLength(50)),
  overridden: z.boolean()
})

export const encounterTimelineEntryDtoSchema = z.strictObject({
  id: uuidSchema,
  version: versionSchema,
  commandType: z.string().check(z.minLength(1)).check(z.maxLength(80)),
  visibility: z.enum(['PRIVATE', 'TABLE']),
  actorUserId: uuidSchema,
  createdAt: timestampSchema,
  roll: z.nullable(rollRecordDtoSchema),
  resolution: z._default(z.nullable(encounterTimelineResolutionSummaryDtoSchema), null)
})
export const encounterTimelineDtoSchema = z.strictObject({
  entries: z.array(encounterTimelineEntryDtoSchema),
  nextCursor: z.nullable(z.string())
})

const encounterEnemySnapshotDtoSchema = z.strictObject({
  kind: z.enum(['CREATURE', 'CUSTOM']),
  sourceId: z.nullable(postgresUuidSchema),
  sourceRevision: z.nullable(z.number().check(z.int()).check(z.positive())),
  label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
  systemId: z.nullable(postgresUuidSchema),
  maxHitPoints: z.number().check(z.int()).check(z.nonnegative()),
  snapshot: jsonValueSchema
})

export const encounterBlueprintEnemyInputDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('CREATURE'),
    sourceId: postgresUuidSchema
  }),
  z.strictObject({
    kind: z.literal('CUSTOM'),
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
    maxHitPoints: z.number().check(z.int()).check(z.nonnegative())
  })
])

export const encounterBlueprintDtoSchema = z.extend(encounterBlueprintMetadataDtoSchema, {
  enemies: z.array(encounterEnemySnapshotDtoSchema)
})
export const encounterBlueprintListDtoSchema = z.array(encounterBlueprintDtoSchema)
export const createEncounterBlueprintInputDtoSchema = z.strictObject({
  gameSystemId: postgresUuidSchema,
  name: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
  enemies: z
    .array(encounterBlueprintEnemyInputDtoSchema)
    .check(z.minLength(1))
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
  commandId: postgresUuidSchema
})
export const updateEncounterBlueprintInputDtoSchema = z.strictObject({
  blueprintId: postgresUuidSchema,
  expectedVersion: z.number().check(z.int()).check(z.positive()),
  name: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
  enemies: z
    .array(encounterBlueprintEnemyInputDtoSchema)
    .check(z.minLength(1))
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
  commandId: postgresUuidSchema
})

export const getEncounterInputDtoSchema = z.strictObject({
  encounterId: uuidSchema
})
/** Current GM-only side bindings; historical Run projections keep their existing shape. */
export const getEncounterActorSidesInputDtoSchema = z.extend(getEncounterInputDtoSchema, {
  expectedVersion: versionSchema
})
export const encounterActorSidesDtoSchema = z.strictObject({
  encounterId: uuidSchema,
  version: versionSchema,
  sides: z
    .array(
      z.strictObject({
        id: uuidSchema,
        label: z.string(),
        sortOrder: z.number().check(z.int()).check(z.nonnegative())
      })
    )
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
  actors: z
    .array(z.strictObject({ id: uuidSchema, sideId: uuidSchema }))
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
})
export type EncounterActorSidesDto = z.infer<typeof encounterActorSidesDtoSchema>

export const getPendingEncounterRuleOccurrenceInputDtoSchema = z.strictObject({
  encounterId: uuidSchema
})
export const getCampaignEncounterInputDtoSchema = z.strictObject({
  campaignId: uuidSchema
})
export const getSessionEncounterInputDtoSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema
})
export const createEncounterInputDtoSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  blueprintId: postgresUuidSchema,
  commandId: uuidSchema
})
export const getEncounterBlueprintsInputDtoSchema = z.strictObject({
  gameSystemId: postgresUuidSchema
})
export const getEncounterTimelineInputDtoSchema = z.strictObject({
  encounterId: uuidSchema,
  cursor: z.optional(z.string().check(z.uuid())),
  limit: z._default(z.number().check(z.int()).check(z.positive()).check(z.lte(100)), 50)
})
export const encounterProjectionDtoSchema = z.union([
  encounterGmProjectionDtoSchema,
  encounterPlayerProjectionDtoSchema
])
export const encounterProjectionListDtoSchema = z.array(encounterProjectionDtoSchema)
export const encounterSessionStateDtoSchema = z.strictObject({
  encounter: z.nullable(encounterProjectionDtoSchema),
  pending: z.nullable(pendingEncounterRuleOccurrenceSummaryDtoSchema)
})
export type EncounterSessionStateDto = z.infer<typeof encounterSessionStateDtoSchema>

export type EncounterPlayerProjectionDto = z.infer<typeof encounterPlayerProjectionDtoSchema>
export type EncounterGmProjectionDto = z.infer<typeof encounterGmProjectionDtoSchema>
export type EncounterGmActorDto = z.infer<typeof encounterGmActorDtoSchema>
export type EncounterCommandResultDto = z.infer<typeof encounterCommandResultDtoSchema>
export type { EncounterRuleOccurrenceSummaryDto, PendingEncounterRuleOccurrenceSummaryDto }
export type EncounterTimelineDto = z.infer<typeof encounterTimelineDtoSchema>
export type CreateEncounterInputDto = z.infer<typeof createEncounterInputDtoSchema>
export type EncounterBlueprintDto = z.infer<typeof encounterBlueprintDtoSchema>
export type CreateEncounterBlueprintInputDto = z.infer<
  typeof createEncounterBlueprintInputDtoSchema
>
export type UpdateEncounterBlueprintInputDto = z.infer<
  typeof updateEncounterBlueprintInputDtoSchema
>
