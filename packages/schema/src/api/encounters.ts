import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { encounterBlueprintEnemyInputDtoSchema } from './encounterData.js'

import { characterSheetCommandInputDtoSchema } from './characterSheetCommandInputs.js'
import {
  commandBaseDtoSchema,
  resolveEncounterActionInputDtoSchema,
  resolveRuleOccurrenceInputDtoSchema,
  revertLastEncounterActionInputDtoSchema,
  voidRuleOccurrenceInputDtoSchema
} from './encounterRuleCommands.js'

export {
  initiativeDeclarationSelectionDtoSchema,
  optionalCombatActionIntentDtoSchema,
  resolveEncounterActionInputDtoSchema,
  resolveRuleOccurrenceInputDtoSchema,
  revertLastEncounterActionInputDtoSchema,
  voidRuleOccurrenceInputDtoSchema
} from './encounterRuleCommands.js'
export type {
  InitiativeDeclarationSelectionDto,
  OptionalCombatActionIntentDto,
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto,
  RevertLastEncounterActionInputDto,
  VoidRuleOccurrenceInputDto
} from './encounterRuleCommands.js'

export {
  encounterAutomationModeDtoSchema,
  encounterManualReminderModeDtoSchema,
  encounterStatusDtoSchema,
  encounterActorKindDtoSchema,
  MAX_ENCOUNTER_ACTORS,
  encounterHealthBandDtoSchema,
  encounterPlayerActorDtoSchema,
  encounterFeatureReferenceDtoSchema,
  encounterGmActorDtoSchema,
  encounterPlayerProjectionDtoSchema,
  encounterGmProjectionDtoSchema,
  encounterRuleOccurrenceSummaryDtoSchema,
  pendingEncounterRuleOccurrenceSummaryDtoSchema,
  encounterCommandResultDtoSchema,
  encounterTimelineResolutionSummaryDtoSchema,
  encounterTimelineEntryDtoSchema,
  encounterTimelineDtoSchema,
  encounterBlueprintDtoSchema,
  encounterBlueprintListDtoSchema,
  createEncounterBlueprintInputDtoSchema,
  updateEncounterBlueprintInputDtoSchema,
  getEncounterInputDtoSchema,
  getPendingEncounterRuleOccurrenceInputDtoSchema,
  getCampaignEncounterInputDtoSchema,
  createEncounterInputDtoSchema,
  getEncounterBlueprintsInputDtoSchema,
  getEncounterTimelineInputDtoSchema,
  encounterProjectionDtoSchema,
  encounterProjectionListDtoSchema
} from './encounterData.js'
export type {
  EncounterPlayerProjectionDto,
  EncounterGmProjectionDto,
  EncounterGmActorDto,
  EncounterCommandResultDto,
  EncounterRuleOccurrenceSummaryDto,
  PendingEncounterRuleOccurrenceSummaryDto,
  EncounterTimelineDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  CreateEncounterBlueprintInputDto,
  UpdateEncounterBlueprintInputDto
} from './encounterData.js'

const uuidSchema = z.string().check(z.uuid())
const jsonSchema = z.json()
export const updateEncounterActorInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('UPDATE_ACTOR'),
  actorId: uuidSchema,
  /** GM-only prospective side correction; existing initiative snapshots remain immutable. */
  sideId: z.optional(uuidSchema),
  currentHitPoints: z.optional(z.number().check(z.int()).check(z.nonnegative())),
  tempHitPoints: z.optional(z.number().check(z.int()).check(z.nonnegative())),
  conditions: z.optional(jsonSchema),
  gmNotes: z.optional(z.nullable(z.string().check(z.maxLength(4000)))),
  public: z.optional(z.boolean()),
  characterCommand: z.optional(characterSheetCommandInputDtoSchema)
})

export const removeEncounterActorInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('REMOVE_ACTOR'),
  actorId: uuidSchema
})

export const reinforceEncounterInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('REINFORCE'),
  enemy: encounterBlueprintEnemyInputDtoSchema,
  sideId: z.optional(uuidSchema),
  initiative: z.optional(z.nullable(z.number().check(z.int()))),
  public: z._default(z.boolean(), true)
})
export const replaceCreatureEquipmentInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('REPLACE_CREATURE_EQUIPMENT'),
  actorId: uuidSchema,
  loadoutEntryId: postgresUuidSchema,
  equipmentId: postgresUuidSchema
})

export const setEncounterInitiativeInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('SET_INITIATIVE'),
  actorId: uuidSchema,
  initiative: z.number().check(z.int()),
  manualOrder: z.optional(z.nullable(z.number().check(z.int()).check(z.nonnegative())))
})

export const rollEncounterActorInitiativeInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('ROLL_ACTOR_INITIATIVE'),
  actorId: uuidSchema
})

export const reorderEncounterInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('REORDER'),
  actorIds: z.array(uuidSchema).check(z.minLength(1))
})

export const startEncounterInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('START'),
  systemId: z.optional(postgresUuidSchema)
})
export const advanceEncounterTurnInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('ADVANCE_TURN')
})
export const previousEncounterTurnInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('PREVIOUS_TURN')
})
export const setEncounterCurrentActorInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('SET_CURRENT_ACTOR'),
  actorId: z.nullable(uuidSchema)
})
export const setEncounterRoundInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('SET_ROUND'),
  round: z.number().check(z.int()).check(z.positive())
})
export const replaceEncounterOptionalCombatRulesInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('REPLACE_OPTIONAL_COMBAT_RULES'),
  definitionIds: z.array(uuidSchema).check(z.maxLength(14))
})
export const adjustEncounterFeatureResourceInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('ADJUST_FEATURE_RESOURCE'),
  actorId: uuidSchema,
  featureId: z.string().check(z.trim()).check(z.minLength(1)),
  direction: z.enum(['USE', 'RESTORE']),
  amount: z._default(z.number().check(z.int()).check(z.positive()), 1)
})
export const upsertEncounterReminderInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('UPSERT_REMINDER'),
  reminder: z
    .strictObject({
      id: z.optional(uuidSchema),
      label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
      timing: z.enum(['ROUND_START', 'ROUND_END', 'ROUND_NUMBER', 'TURN_START', 'TURN_END']),
      round: z._default(z.nullable(z.number().check(z.int()).check(z.positive())), null),
      actorId: z._default(z.nullable(uuidSchema), null),
      public: z._default(z.boolean(), false),
      notes: z._default(z.nullable(z.string().check(z.maxLength(4000))), null),
      order: z._default(z.number().check(z.int()).check(z.nonnegative()), 0)
    })
    .check(
      z.superRefine((value, context) => {
        if (value.timing === 'ROUND_NUMBER' && value.round === null)
          context.addIssue({
            code: 'custom',
            path: ['round'],
            message: 'Round number reminders require a round.'
          })
        if (
          (value.timing === 'TURN_START' || value.timing === 'TURN_END') &&
          value.actorId === null
        )
          context.addIssue({
            code: 'custom',
            path: ['actorId'],
            message: 'Turn reminders require an actor.'
          })
      })
    )
})
export const removeEncounterReminderInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('REMOVE_REMINDER'),
  reminderId: uuidSchema
})
export const rollEncounterEnemyActionInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('ROLL_ENEMY_ACTION'),
  actorId: uuidSchema,
  featureId: z.string().check(z.trim()).check(z.minLength(1)),
  rollDefinitionId: z.string().check(z.trim()).check(z.minLength(1)),
  visibility: z.enum(['PRIVATE', 'TABLE'])
})
export const completeEncounterInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('COMPLETE')
})
export const upgradeEncounterRulePackInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('UPGRADE_RULE_PACK'),
  revisionId: uuidSchema
})

export const encounterCommandInputDtoSchema = z.discriminatedUnion('type', [
  updateEncounterActorInputDtoSchema,
  removeEncounterActorInputDtoSchema,
  reinforceEncounterInputDtoSchema,
  replaceCreatureEquipmentInputDtoSchema,
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
  resolveRuleOccurrenceInputDtoSchema,
  voidRuleOccurrenceInputDtoSchema,
  revertLastEncounterActionInputDtoSchema
])

export const encounterExecuteInputSchema = z.strictObject({
  command: encounterCommandInputDtoSchema
})
export type EncounterExecuteInput = z.infer<typeof encounterExecuteInputSchema>

export type UpdateEncounterActorInputDto = z.infer<typeof updateEncounterActorInputDtoSchema>
export type RemoveEncounterActorInputDto = z.infer<typeof removeEncounterActorInputDtoSchema>
export type ReplaceCreatureEquipmentInputDto = z.infer<
  typeof replaceCreatureEquipmentInputDtoSchema
>
export type SetEncounterInitiativeInputDto = z.infer<typeof setEncounterInitiativeInputDtoSchema>
export type SetEncounterRoundInputDto = z.infer<typeof setEncounterRoundInputDtoSchema>
export type ReorderEncounterInputDto = z.infer<typeof reorderEncounterInputDtoSchema>
export type UpgradeEncounterRulePackInputDto = z.infer<
  typeof upgradeEncounterRulePackInputDtoSchema
>
export type EncounterCommandInputDto = z.infer<typeof encounterCommandInputDtoSchema>
