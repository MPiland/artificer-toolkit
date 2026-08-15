import { z } from 'zod'

import { characterSheetCommandInputDtoSchema } from './characters.js'
import { featureDtoSchema } from '../features/feature.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { AUTHORED_LIMITS } from '../shared/authoredLimits.js'
import { rollRecordDtoSchema } from './rolls.js'
import {
  ruleModelKeyDtoSchema,
  ruleOutcomeKindDtoSchema,
  ruleOutcomeOverrideDtoSchema,
  ruleResolutionEvidenceDtoSchema
} from './rules.js'

const uuidSchema = z.string().uuid()
const versionSchema = z.number().int().nonnegative()
const timestampSchema = z.string().datetime()
const jsonSchema = z.json()

export const encounterStatusDtoSchema = z.enum(['PREPARED', 'ACTIVE', 'COMPLETED'])
export const encounterActorKindDtoSchema = z.enum(['CHARACTER', 'CREATURE', 'CUSTOM'])
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
  label: z.string().trim().min(1).max(160),
  sourceId: postgresUuidSchema.nullable(),
  sourceRevision: z.number().int().positive().nullable(),
  public: z.boolean(),
  initiative: z.number().int().nullable(),
  manualOrder: z.number().int().nonnegative().nullable(),
  conditions: jsonSchema,
  healthBand: encounterHealthBandDtoSchema
})

export const encounterPlayerActorDtoSchema = encounterActorBaseDtoSchema

export const encounterFeatureReferenceDtoSchema = featureDtoSchema
  .pick({
    id: true,
    label: true,
    description: true,
    section: true,
    rollDefinitions: true
  })
  .extend({
    resource: z
      .strictObject({
        used: z.number().int().nonnegative(),
        maximum: z.number().int().positive(),
        remaining: z.number().int().nonnegative(),
        resetKind: z.enum(['DAILY', 'DAWN', 'DUSK', 'LONG_REST', 'SHORT_REST', 'MANUAL'])
      })
      .nullable()
      .default(null)
  })

export const encounterGmActorDtoSchema = encounterActorBaseDtoSchema.extend({
  systemId: postgresUuidSchema.nullable(),
  stableTieKey: z.string().min(1),
  currentHitPoints: z.number().int().nonnegative(),
  maxHitPoints: z.number().int().nonnegative(),
  tempHitPoints: z.number().int().nonnegative(),
  resources: jsonSchema,
  gmNotes: z.string().max(4000).nullable(),
  statBlock: z
    .strictObject({
      armorClass: z.number().int().nonnegative().nullable(),
      abilityScores: z.record(z.string(), z.number()).nullable(),
      speeds: z.array(z.unknown()),
      senses: z.array(z.string()),
      damageVulnerabilities: z.array(z.string()),
      damageResistances: z.array(z.string()),
      damageImmunities: z.array(z.string()),
      conditionImmunities: z.array(z.string())
    })
    .nullable(),
  features: z.array(encounterFeatureReferenceDtoSchema).default([])
})

export const encounterPlayerProjectionDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  templateId: uuidSchema,
  templateVersion: versionSchema,
  name: z.string().trim().min(1).max(160),
  status: encounterStatusDtoSchema,
  rulePackRevisionId: uuidSchema.nullable().default(null),
  version: versionSchema,
  round: z.number().int().nonnegative(),
  currentActorId: uuidSchema.nullable(),
  actors: z.array(encounterPlayerActorDtoSchema),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})

export const encounterGmProjectionDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  templateId: uuidSchema,
  templateVersion: versionSchema,
  name: z.string().trim().min(1).max(160),
  status: encounterStatusDtoSchema,
  rulePackRevisionId: uuidSchema.nullable().default(null),
  version: versionSchema,
  round: z.number().int().nonnegative(),
  currentActorId: uuidSchema.nullable(),
  actors: z.array(encounterGmActorDtoSchema),
  reminders: z
    .array(
      z.strictObject({
        id: uuidSchema,
        label: z.string().trim().min(1).max(160),
        timing: z.enum(['ROUND_START', 'ROUND_END', 'ROUND_NUMBER', 'TURN_START', 'TURN_END']),
        round: z.number().int().positive().nullable(),
        actorId: uuidSchema.nullable(),
        public: z.boolean(),
        notes: z.string().max(4000).nullable(),
        order: z.number().int().nonnegative()
      })
    )
    .default([]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})

export const encounterCommandResultDtoSchema = z.strictObject({
  projection: encounterGmProjectionDtoSchema,
  roll: rollRecordDtoSchema.nullable(),
  resolution: ruleResolutionEvidenceDtoSchema.nullable().default(null)
})

export const encounterTimelineResolutionSummaryDtoSchema = z.strictObject({
  rolls: z.array(rollRecordDtoSchema).max(50),
  outcomes: z
    .array(
      z.strictObject({
        kind: ruleOutcomeKindDtoSchema,
        status: z.enum(['APPLIED', 'MANUAL', 'OVERRIDDEN'])
      })
    )
    .max(50),
  overridden: z.boolean()
})

export const encounterTimelineEntryDtoSchema = z.strictObject({
  id: uuidSchema,
  version: versionSchema,
  commandType: z.string().min(1).max(80),
  visibility: z.enum(['PRIVATE', 'TABLE']),
  actorUserId: uuidSchema,
  createdAt: timestampSchema,
  roll: rollRecordDtoSchema.nullable(),
  resolution: encounterTimelineResolutionSummaryDtoSchema.nullable().default(null)
})
export const encounterTimelineDtoSchema = z.strictObject({
  entries: z.array(encounterTimelineEntryDtoSchema),
  nextCursor: z.string().nullable()
})

const commandBaseDtoSchema = z.strictObject({
  encounterId: uuidSchema,
  commandId: uuidSchema,
  expectedVersion: versionSchema
})

const encounterEnemySnapshotDtoSchema = z.strictObject({
  kind: z.enum(['CREATURE', 'CUSTOM']),
  sourceId: postgresUuidSchema.nullable(),
  sourceRevision: z.number().int().positive().nullable(),
  label: z.string().trim().min(1).max(160),
  systemId: postgresUuidSchema.nullable(),
  maxHitPoints: z.number().int().nonnegative(),
  snapshot: jsonSchema
})

const encounterTemplateEnemyInputDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('CREATURE'),
    sourceId: postgresUuidSchema
  }),
  z.strictObject({
    kind: z.literal('CUSTOM'),
    label: z.string().trim().min(1).max(160),
    maxHitPoints: z.number().int().nonnegative()
  })
])

export const encounterTemplateDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  name: z.string().trim().min(1).max(160),
  version: versionSchema,
  enemies: z.array(encounterEnemySnapshotDtoSchema),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export const encounterTemplateListDtoSchema = z.array(encounterTemplateDtoSchema)
export const createEncounterTemplateInputDtoSchema = z.strictObject({
  campaignId: uuidSchema,
  name: z.string().trim().min(1).max(160),
  enemies: z
    .array(encounterTemplateEnemyInputDtoSchema)
    .min(1)
    .max(AUTHORED_LIMITS.nestedCollectionItems),
  commandId: uuidSchema
})
export const addEncounterTemplateInputDtoSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  templateId: uuidSchema,
  commandId: uuidSchema
})

export const updateEncounterActorInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('UPDATE_ACTOR'),
  actorId: uuidSchema,
  currentHitPoints: z.number().int().nonnegative().optional(),
  tempHitPoints: z.number().int().nonnegative().optional(),
  conditions: jsonSchema.optional(),
  gmNotes: z.string().max(4000).nullable().optional(),
  public: z.boolean().optional(),
  characterCommand: characterSheetCommandInputDtoSchema.optional()
})

export const removeEncounterActorInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('REMOVE_ACTOR'),
  actorId: uuidSchema
})

export const setEncounterInitiativeInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('SET_INITIATIVE'),
  actorId: uuidSchema,
  initiative: z.number().int(),
  manualOrder: z.number().int().nonnegative().nullable().optional()
})

export const rollEncounterActorInitiativeInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('ROLL_ACTOR_INITIATIVE'),
  actorId: uuidSchema
})

export const reorderEncounterInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('REORDER'),
  actorIds: z.array(uuidSchema).min(1)
})

export const startEncounterInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('START'),
  systemId: postgresUuidSchema.optional()
})
export const advanceEncounterTurnInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('ADVANCE_TURN')
})
export const previousEncounterTurnInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('PREVIOUS_TURN')
})
export const setEncounterCurrentActorInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('SET_CURRENT_ACTOR'),
  actorId: uuidSchema.nullable()
})
export const setEncounterRoundInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('SET_ROUND'),
  round: z.number().int().positive()
})
export const adjustEncounterFeatureResourceInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('ADJUST_FEATURE_RESOURCE'),
  actorId: uuidSchema,
  featureId: z.string().trim().min(1),
  direction: z.enum(['USE', 'RESTORE']),
  amount: z.number().int().positive().default(1)
})
export const upsertEncounterReminderInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('UPSERT_REMINDER'),
  reminder: z
    .strictObject({
      id: uuidSchema.optional(),
      label: z.string().trim().min(1).max(160),
      timing: z.enum(['ROUND_START', 'ROUND_END', 'ROUND_NUMBER', 'TURN_START', 'TURN_END']),
      round: z.number().int().positive().nullable().default(null),
      actorId: uuidSchema.nullable().default(null),
      public: z.boolean().default(false),
      notes: z.string().max(4000).nullable().default(null),
      order: z.number().int().nonnegative().default(0)
    })
    .superRefine((value, context) => {
      if (value.timing === 'ROUND_NUMBER' && value.round === null)
        context.addIssue({
          code: 'custom',
          path: ['round'],
          message: 'Round number reminders require a round.'
        })
      if ((value.timing === 'TURN_START' || value.timing === 'TURN_END') && value.actorId === null)
        context.addIssue({
          code: 'custom',
          path: ['actorId'],
          message: 'Turn reminders require an actor.'
        })
    })
})
export const removeEncounterReminderInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('REMOVE_REMINDER'),
  reminderId: uuidSchema
})
export const rollEncounterEnemyActionInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('ROLL_ENEMY_ACTION'),
  actorId: uuidSchema,
  featureId: z.string().trim().min(1),
  rollDefinitionId: z.string().trim().min(1),
  visibility: z.enum(['PRIVATE', 'TABLE'])
})
export const completeEncounterInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('COMPLETE')
})
export const upgradeEncounterRulePackInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('UPGRADE_RULE_PACK'),
  revisionId: uuidSchema
})
export const resolveEncounterActionInputDtoSchema = commandBaseDtoSchema
  .extend({
    type: z.literal('RESOLVE_ACTION'),
    actorId: uuidSchema,
    modelKey: ruleModelKeyDtoSchema,
    targetActorIds: z.array(uuidSchema).max(50),
    selections: jsonSchema,
    visibility: z.enum(['PRIVATE', 'TABLE']),
    override: ruleOutcomeOverrideDtoSchema.optional()
  })
  .superRefine(({ targetActorIds }, context) => {
    if (new Set(targetActorIds).size !== targetActorIds.length)
      context.addIssue({
        code: 'custom',
        path: ['targetActorIds'],
        message: 'Target actor IDs must be unique.'
      })
  })

export const encounterCommandInputDtoSchema = z.discriminatedUnion('type', [
  updateEncounterActorInputDtoSchema,
  removeEncounterActorInputDtoSchema,
  setEncounterInitiativeInputDtoSchema,
  rollEncounterActorInitiativeInputDtoSchema,
  reorderEncounterInputDtoSchema,
  startEncounterInputDtoSchema,
  advanceEncounterTurnInputDtoSchema,
  previousEncounterTurnInputDtoSchema,
  setEncounterCurrentActorInputDtoSchema,
  setEncounterRoundInputDtoSchema,
  adjustEncounterFeatureResourceInputDtoSchema,
  upsertEncounterReminderInputDtoSchema,
  removeEncounterReminderInputDtoSchema,
  rollEncounterEnemyActionInputDtoSchema,
  completeEncounterInputDtoSchema,
  upgradeEncounterRulePackInputDtoSchema,
  resolveEncounterActionInputDtoSchema
])
export const getEncounterInputDtoSchema = z.strictObject({ encounterId: uuidSchema })
export const getCampaignEncounterInputDtoSchema = z.strictObject({ campaignId: uuidSchema })
export const createEncounterInputDtoSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  templateId: uuidSchema,
  systemId: postgresUuidSchema.optional(),
  commandId: uuidSchema
})
export const getCampaignEncounterTemplatesInputDtoSchema = z.strictObject({
  campaignId: uuidSchema
})
export const getEncounterTimelineInputDtoSchema = z.strictObject({
  encounterId: uuidSchema,
  cursor: z.string().uuid().optional(),
  limit: z.number().int().positive().max(100).default(50)
})
export const encounterProjectionDtoSchema = z.union([
  encounterGmProjectionDtoSchema,
  encounterPlayerProjectionDtoSchema
])
export const encounterProjectionListDtoSchema = z.array(encounterProjectionDtoSchema)

export type EncounterPlayerProjectionDto = z.infer<typeof encounterPlayerProjectionDtoSchema>
export type EncounterGmProjectionDto = z.infer<typeof encounterGmProjectionDtoSchema>
export type EncounterGmActorDto = z.infer<typeof encounterGmActorDtoSchema>
export type EncounterCommandResultDto = z.infer<typeof encounterCommandResultDtoSchema>
export type EncounterTimelineDto = z.infer<typeof encounterTimelineDtoSchema>
export type CreateEncounterInputDto = z.infer<typeof createEncounterInputDtoSchema>
export type EncounterTemplateDto = z.infer<typeof encounterTemplateDtoSchema>
export type CreateEncounterTemplateInputDto = z.infer<typeof createEncounterTemplateInputDtoSchema>
export type AddEncounterTemplateInputDto = z.infer<typeof addEncounterTemplateInputDtoSchema>
export type UpdateEncounterActorInputDto = z.infer<typeof updateEncounterActorInputDtoSchema>
export type RemoveEncounterActorInputDto = z.infer<typeof removeEncounterActorInputDtoSchema>
export type SetEncounterInitiativeInputDto = z.infer<typeof setEncounterInitiativeInputDtoSchema>
export type SetEncounterRoundInputDto = z.infer<typeof setEncounterRoundInputDtoSchema>
export type ReorderEncounterInputDto = z.infer<typeof reorderEncounterInputDtoSchema>
export type UpgradeEncounterRulePackInputDto = z.infer<
  typeof upgradeEncounterRulePackInputDtoSchema
>
export type ResolveEncounterActionInputDto = z.infer<typeof resolveEncounterActionInputDtoSchema>
export type EncounterCommandInputDto = z.infer<typeof encounterCommandInputDtoSchema>
