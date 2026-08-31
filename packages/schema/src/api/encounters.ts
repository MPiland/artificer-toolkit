import { z } from 'zod'

import { automationModeDtoSchema, manualReminderModeDtoSchema } from './campaignSettings.js'
import { characterSheetCommandInputDtoSchema } from './characters.js'
import { featureDtoSchema } from '../features/feature.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { movementReactionChoiceSelectionDtoSchema } from '../shared/reaction.js'
import { encounterInitiativePolicySummaryDtoSchema } from '../shared/initiativePolicySnapshot.js'
import { encounterOptionalCombatSummaryDtoSchema } from '../shared/optionalCombat.js'
import { serverRuleExecutionCorrelationIdDtoSchema } from '../shared/rulesExecution.js'
import { sizeCodeSchema } from '../shared/enums.js'
import {
  encounterRuleOccurrenceSummaryDtoSchema,
  pendingEncounterRuleOccurrenceSummaryDtoSchema,
  type EncounterRuleOccurrenceSummaryDto,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '../shared/encounterRuleOccurrence.js'
import { AUTHORED_LIMITS } from '../shared/authoredLimits.js'
import { rollRecordDtoSchema } from './rolls.js'
import { ruleOutcomeKindDtoSchema, ruleResolutionEvidenceDtoSchema } from './rules.js'

const uuidSchema = z.string().uuid()
const versionSchema = z.number().int().nonnegative()
const timestampSchema = z.string().datetime()
const jsonSchema = z.json()
const speedFactorActionFactorDtoSchema = z.enum([
  'MELEE_HEAVY',
  'MELEE_LIGHT_OR_FINESSE',
  'MELEE_TWO_HANDED',
  'RANGED_LOADING'
])
const initiativeDeclarationSelectionDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.enum(['CHARACTER_ACTION', 'CHARACTER_SPELL_CAST', 'CREATURE_FEATURE_ACTION']),
    optionId: z.string().trim().min(1).max(1_000)
  }),
  z
    .strictObject({
      kind: z.literal('GM_ADJUDICATED'),
      optionId: z.literal('GM_ADJUDICATED'),
      actorSize: sizeCodeSchema,
      actionFactors: z.array(speedFactorActionFactorDtoSchema).max(4),
      spellLevel: z.number().int().min(0).max(99).nullable()
    })
    .superRefine((value, context) => {
      if (new Set(value.actionFactors).size !== value.actionFactors.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['actionFactors'],
          message: 'GM-adjudicated action factors must be unique.'
        })
      }
    })
])
export {
  automationModeDtoSchema as encounterAutomationModeDtoSchema,
  manualReminderModeDtoSchema as encounterManualReminderModeDtoSchema
}

export const encounterStatusDtoSchema = z.enum(['PREPARED', 'ACTIVE', 'COMPLETED'])
export const encounterActorKindDtoSchema = z.enum(['CHARACTER', 'CREATURE', 'CUSTOM'])
export const MAX_ENCOUNTER_ACTORS = AUTHORED_LIMITS.nestedCollectionItems
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
        maximum: z.number().int().nonnegative(),
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
  gameSystemId: postgresUuidSchema,
  blueprintId: postgresUuidSchema,
  blueprintVersion: z.number().int().positive(),
  blueprintChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  name: z.string().trim().min(1).max(160),
  status: encounterStatusDtoSchema,
  automationMode: automationModeDtoSchema,
  rulePackRevisionId: uuidSchema.nullable().default(null),
  initiativePolicy: encounterInitiativePolicySummaryDtoSchema.nullable().default(null),
  optionalCombatRules: z.array(encounterOptionalCombatSummaryDtoSchema).max(14).default([]),
  version: z.number().int().nonnegative(),
  round: z.number().int().nonnegative(),
  currentActorId: uuidSchema.nullable(),
  actors: z.array(encounterPlayerActorDtoSchema).max(MAX_ENCOUNTER_ACTORS),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})

export const encounterGmProjectionDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  gameSystemId: postgresUuidSchema,
  blueprintId: postgresUuidSchema,
  blueprintVersion: z.number().int().positive(),
  blueprintChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  name: z.string().trim().min(1).max(160),
  status: encounterStatusDtoSchema,
  automationMode: automationModeDtoSchema,
  manualReminderMode: manualReminderModeDtoSchema,
  rulePackRevisionId: uuidSchema.nullable().default(null),
  initiativePolicy: encounterInitiativePolicySummaryDtoSchema.nullable().default(null),
  optionalCombatRules: z.array(encounterOptionalCombatSummaryDtoSchema).max(14).default([]),
  version: z.number().int().nonnegative(),
  round: z.number().int().nonnegative(),
  currentActorId: uuidSchema.nullable(),
  actors: z.array(encounterGmActorDtoSchema).max(MAX_ENCOUNTER_ACTORS),
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

export { encounterRuleOccurrenceSummaryDtoSchema, pendingEncounterRuleOccurrenceSummaryDtoSchema }

export const encounterCommandResultDtoSchema = z.strictObject({
  projection: z.union([encounterGmProjectionDtoSchema, encounterPlayerProjectionDtoSchema]),
  roll: rollRecordDtoSchema.nullable(),
  resolution: ruleResolutionEvidenceDtoSchema.nullable().default(null),
  occurrence: encounterRuleOccurrenceSummaryDtoSchema.nullable().default(null)
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

const encounterBlueprintEnemyInputDtoSchema = z.discriminatedUnion('kind', [
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

export const encounterBlueprintDtoSchema = z.strictObject({
  id: postgresUuidSchema,
  gameSystemId: postgresUuidSchema,
  name: z.string().trim().min(1).max(160),
  version: versionSchema,
  enemies: z.array(encounterEnemySnapshotDtoSchema),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  setupChecksum: z.string().regex(/^[a-f0-9]{64}$/)
})
export const encounterBlueprintListDtoSchema = z.array(encounterBlueprintDtoSchema)
export const createEncounterBlueprintInputDtoSchema = z.strictObject({
  gameSystemId: postgresUuidSchema,
  name: z.string().trim().min(1).max(160),
  enemies: z.array(encounterBlueprintEnemyInputDtoSchema).min(1).max(MAX_ENCOUNTER_ACTORS),
  commandId: postgresUuidSchema
})
export const updateEncounterBlueprintInputDtoSchema = z.strictObject({
  blueprintId: postgresUuidSchema,
  expectedVersion: z.number().int().positive(),
  name: z.string().trim().min(1).max(160),
  enemies: z.array(encounterBlueprintEnemyInputDtoSchema).min(1).max(MAX_ENCOUNTER_ACTORS),
  commandId: postgresUuidSchema
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
export const replaceEncounterOptionalCombatRulesInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('REPLACE_OPTIONAL_COMBAT_RULES'),
  definitionIds: z.array(uuidSchema).max(14)
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
export const resolveEncounterActionInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('RESOLVE_ACTION'),
  actorId: uuidSchema,
  actionId: z.string().trim().min(1).max(240),
  targetActorId: uuidSchema,
  /**
   * Required only by action policies that consume exact Scene position. The
   * server locks and validates this dependency before it constructs facts.
   */
  sceneContext: z
    .strictObject({
      sceneId: uuidSchema,
      expectedSceneVersion: versionSchema,
      sourceTokenId: uuidSchema,
      targetTokenId: uuidSchema
    })
    .nullable()
    .optional()
    .default(null)
})

export const resolveRuleOccurrenceInputDtoSchema = commandBaseDtoSchema.extend({
  type: z.literal('RESOLVE_RULE_OCCURRENCE'),
  correlationId: serverRuleExecutionCorrelationIdDtoSchema.optional().default(null),
  occurrenceId: uuidSchema,
  expectedOccurrenceVersion: versionSchema,
  resolution: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('ENTER_DICE'),
      requestId: z.string().trim().min(1).max(256),
      rawFaces: z.array(z.number().int().min(1).max(20)).min(1).max(2)
    }),
    z.strictObject({
      kind: z.literal('SYSTEM_ROLL'),
      requestId: z.string().trim().min(1).max(256)
    }),
    z.strictObject({
      kind: z.literal('ENTER_INTEGER'),
      requestId: z.string().trim().min(1).max(256),
      value: z.number().int()
    }),
    z.strictObject({
      kind: z.literal('INITIATIVE_ENTITY'),
      requestId: z.string().trim().min(1).max(256),
      entityId: uuidSchema
    }),
    z.strictObject({
      kind: z.literal('INITIATIVE_DECLARATION'),
      requestId: z.string().trim().min(1).max(256),
      primary: initiativeDeclarationSelectionDtoSchema,
      bonus: initiativeDeclarationSelectionDtoSchema.nullable()
    }),
    ...movementReactionChoiceSelectionDtoSchema.options
  ])
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
  replaceEncounterOptionalCombatRulesInputDtoSchema,
  adjustEncounterFeatureResourceInputDtoSchema,
  upsertEncounterReminderInputDtoSchema,
  removeEncounterReminderInputDtoSchema,
  rollEncounterEnemyActionInputDtoSchema,
  completeEncounterInputDtoSchema,
  upgradeEncounterRulePackInputDtoSchema,
  resolveEncounterActionInputDtoSchema,
  resolveRuleOccurrenceInputDtoSchema
])
export const getEncounterInputDtoSchema = z.strictObject({
  encounterId: uuidSchema
})
export const getPendingEncounterRuleOccurrenceInputDtoSchema = z.strictObject({
  encounterId: uuidSchema
})
export const getCampaignEncounterInputDtoSchema = z.strictObject({
  campaignId: uuidSchema
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
export type UpdateEncounterActorInputDto = z.infer<typeof updateEncounterActorInputDtoSchema>
export type RemoveEncounterActorInputDto = z.infer<typeof removeEncounterActorInputDtoSchema>
export type SetEncounterInitiativeInputDto = z.infer<typeof setEncounterInitiativeInputDtoSchema>
export type SetEncounterRoundInputDto = z.infer<typeof setEncounterRoundInputDtoSchema>
export type ReorderEncounterInputDto = z.infer<typeof reorderEncounterInputDtoSchema>
export type UpgradeEncounterRulePackInputDto = z.infer<
  typeof upgradeEncounterRulePackInputDtoSchema
>
export type ResolveEncounterActionInputDto = z.infer<typeof resolveEncounterActionInputDtoSchema>
export type ResolveRuleOccurrenceInputDto = z.infer<typeof resolveRuleOccurrenceInputDtoSchema>
export type EncounterCommandInputDto = z.infer<typeof encounterCommandInputDtoSchema>
