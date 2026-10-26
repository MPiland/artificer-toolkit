import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import {
  encounterActorControllerUserIdsDtoSchema,
  encounterActorDispositionDtoSchema,
  encounterActorRevealDtoSchema,
  encounterBlueprintEnemyInputDtoSchema
} from './encounterData.js'

import { characterSheetCommandInputDtoSchema } from './characterSheetCommandInputs.js'
import { healthDisplayLevelDtoSchema } from './healthDisplay.js'
import { rollVisibilityDtoSchema } from './rolls.js'
import {
  commandBaseDtoSchema,
  confirmMoraleInputDtoSchema,
  endHeldGrantInputDtoSchema,
  moraleSaveInputDtoSchema,
  escapeRelationshipInputDtoSchema,
  moveHeldEffectInputDtoSchema,
  changeFacingInputDtoSchema,
  releaseRelationshipInputDtoSchema,
  removeAreaTargetInputDtoSchema,
  resolveConsequenceRollOfferInputDtoSchema,
  resolveEncounterActionInputDtoSchema,
  resolveRuleOccurrenceInputDtoSchema,
  revertLastEncounterActionInputDtoSchema,
  rollRuleEvidenceInputDtoSchema,
  placeZoneInputDtoSchema,
  setZoneDcsInputDtoSchema,
  setConcealmentObserversInputDtoSchema,
  voidRuleOccurrenceInputDtoSchema
} from './encounterRuleCommands.js'

export {
  confirmMoraleInputDtoSchema,
  encounterD20RollModeDtoSchema,
  endHeldGrantInputDtoSchema,
  moraleSaveInputDtoSchema,
  escapeRelationshipInputDtoSchema,
  moveHeldEffectInputDtoSchema,
  changeFacingInputDtoSchema,
  rollRuleEvidenceInputDtoSchema,
  initiativeDeclarationSelectionDtoSchema,
  optionalCombatActionIntentDtoSchema,
  releaseRelationshipInputDtoSchema,
  removeAreaTargetInputDtoSchema,
  resolveConsequenceRollOfferInputDtoSchema,
  resolveEncounterActionInputDtoSchema,
  resolveRuleOccurrenceInputDtoSchema,
  revertLastEncounterActionInputDtoSchema,
  placeZoneInputDtoSchema,
  setZoneDcsInputDtoSchema,
  setConcealmentObserversInputDtoSchema,
  voidRuleOccurrenceInputDtoSchema
} from './encounterRuleCommands.js'
export type {
  ConfirmMoraleInputDto,
  EncounterD20RollModeDto,
  EndHeldGrantInputDto,
  MoraleSaveInputDto,
  EscapeRelationshipInputDto,
  MoveHeldEffectInputDto,
  ChangeFacingInputDto,
  RemoveAreaTargetInputDto,
  RollRuleEvidenceInputDto,
  InitiativeDeclarationSelectionDto,
  OptionalCombatActionIntentDto,
  ReleaseRelationshipInputDto,
  ResolveConsequenceRollOfferInputDto,
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto,
  RevertLastEncounterActionInputDto,
  PlaceZoneInputDto,
  SetZoneDcsInputDto,
  SetConcealmentObserversInputDto,
  VoidRuleOccurrenceInputDto
} from './encounterRuleCommands.js'

export {
  encounterAutomationModeDtoSchema,
  encounterStatusDtoSchema,
  encounterActorKindDtoSchema,
  encounterActorDispositionDtoSchema,
  encounterActorRevealDtoSchema,
  encounterActorControllerUserIdsDtoSchema,
  MAX_ENCOUNTER_ACTOR_CONTROLLERS,
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
  encounterEvidenceRollDtoSchema,
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
  encounterProjectionListDtoSchema,
  encounterSummaryDtoSchema,
  encounterSummaryListDtoSchema
} from './encounterData.js'
export type {
  EncounterActorDispositionDto,
  EncounterPlayerProjectionDto,
  EncounterGmProjectionDto,
  EncounterGmActorDto,
  EncounterSummaryDto,
  EncounterCommandResultDto,
  EncounterEvidenceRollDto,
  EncounterRuleOccurrenceSummaryDto,
  PendingEncounterRuleOccurrenceSummaryDto,
  EncounterTimelineDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  CreateEncounterBlueprintInputDto,
  UpdateEncounterBlueprintInputDto
} from './encounterData.js'

const uuidSchema = lazySchema(() => z.string().check(z.uuid()))
const jsonSchema = z.json()
export const updateEncounterActorInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('UPDATE_ACTOR'),
    actorId: uuidSchema,
    /** GM-only prospective side correction; existing initiative snapshots remain immutable. */
    sideId: z.optional(uuidSchema),
    currentHitPoints: z.optional(z.number().check(z.int()).check(z.nonnegative())),
    tempHitPoints: z.optional(z.number().check(z.int()).check(z.nonnegative())),
    conditions: z.optional(jsonSchema),
    gmNotes: z.optional(z.nullable(z.string().check(z.maxLength(4000)))),
    public: z.optional(z.boolean()),
    /** GM-only: the players who may act for this actor besides the assigned Character's player. */
    controllerUserIds: z.optional(encounterActorControllerUserIdsDtoSchema),
    disposition: z.optional(encounterActorDispositionDtoSchema),
    /** GM-only override of the Encounter health display default for an enemy or NPC; null clears it. */
    healthDisplay: z.optional(z.nullable(healthDisplayLevelDtoSchema)),
    /** GM-only: lists a public actor the players cannot see as an Unseen creature or by name (ATTACK-17.3); null hides it again. */
    reveal: z.optional(z.nullable(encounterActorRevealDtoSchema)),
    /** GM-only: returns an absent actor (D82, D128) to its place in the round and its Scene token. */
    returnToInitiative: z.optional(z.literal(true)),
    /** GM-only: ends a grant (D99) this Creature or custom actor holds; a Character's ends on its Sheet. */
    endActiveEffectId: z.optional(uuidSchema),
    /** GM-only: ends the Concentration this Creature or custom actor maintains; a Character's ends on its Sheet. */
    endConcentration: z.optional(z.literal(true)),
    characterCommand: z.optional(characterSheetCommandInputDtoSchema)
  })
)

export const removeEncounterActorInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('REMOVE_ACTOR'),
    actorId: uuidSchema
  })
)

export const reinforceEncounterInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('REINFORCE'),
    enemy: encounterBlueprintEnemyInputDtoSchema,
    sideId: z.optional(uuidSchema),
    initiative: z.optional(z.nullable(z.number().check(z.int()))),
    public: z._default(z.boolean(), true)
  })
)
export const replaceCreatureEquipmentInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('REPLACE_CREATURE_EQUIPMENT'),
    actorId: uuidSchema,
    loadoutEntryId: postgresUuidSchema,
    equipmentId: postgresUuidSchema
  })
)

export const setEncounterInitiativeInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('SET_INITIATIVE'),
    actorId: uuidSchema,
    initiative: z.number().check(z.int()),
    manualOrder: z.optional(z.nullable(z.number().check(z.int()).check(z.nonnegative())))
  })
)

export const rollEncounterActorInitiativeInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('ROLL_ACTOR_INITIATIVE'),
    actorId: uuidSchema
  })
)

export const reorderEncounterInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('REORDER'),
    actorIds: z.array(uuidSchema).check(z.minLength(1))
  })
)

export const startEncounterInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('START'),
    systemId: z.optional(postgresUuidSchema)
  })
)
export const advanceEncounterTurnInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('ADVANCE_TURN')
  })
)
export const previousEncounterTurnInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('PREVIOUS_TURN')
  })
)
export const setEncounterCurrentActorInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('SET_CURRENT_ACTOR'),
    actorId: z.nullable(uuidSchema)
  })
)
export const setEncounterRoundInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('SET_ROUND'),
    round: z.number().check(z.int()).check(z.positive())
  })
)
export const replaceEncounterOptionalCombatRulesInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('REPLACE_OPTIONAL_COMBAT_RULES'),
    definitionIds: z.array(uuidSchema).check(z.maxLength(14))
  })
)
export const adjustEncounterFeatureResourceInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('ADJUST_FEATURE_RESOURCE'),
    actorId: uuidSchema,
    featureId: z.string().check(z.trim()).check(z.minLength(1)),
    direction: z.enum(['USE', 'RESTORE']),
    amount: z._default(z.number().check(z.int()).check(z.positive()), 1)
  })
)
/**
 * GM-only: a short or long rest for creature actors. Each one's spent feature charges and spell
 * slot rows that reset on that rest come back; a Character rests through its Sheet.
 */
export const restEncounterCreaturesInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('CREATURE_REST'),
    restKind: z.enum(['SHORT', 'LONG']),
    actorIds: z.array(uuidSchema).check(z.minLength(1)).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
  })
)
export const upsertEncounterReminderInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
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
)
export const removeEncounterReminderInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('REMOVE_REMINDER'),
    reminderId: uuidSchema
  })
)
export const rollEncounterEnemyActionInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('ROLL_ENEMY_ACTION'),
    actorId: uuidSchema,
    featureId: z.string().check(z.trim()).check(z.minLength(1)),
    rollDefinitionId: z.string().check(z.trim()).check(z.minLength(1)),
    visibility: rollVisibilityDtoSchema
  })
)
/** GM-only: what players see of enemies' and NPCs' health unless an actor overrides it. */
export const setEncounterHealthDisplayDefaultInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('SET_HEALTH_DISPLAY_DEFAULT'),
    level: healthDisplayLevelDtoSchema
  })
)
export const completeEncounterInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('COMPLETE')
  })
)

export const encounterCommandInputDtoSchema = lazySchema(() =>
  z.discriminatedUnion('type', [
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
    restEncounterCreaturesInputDtoSchema,
    upsertEncounterReminderInputDtoSchema,
    removeEncounterReminderInputDtoSchema,
    rollEncounterEnemyActionInputDtoSchema,
    setEncounterHealthDisplayDefaultInputDtoSchema,
    completeEncounterInputDtoSchema,
    resolveEncounterActionInputDtoSchema,
    escapeRelationshipInputDtoSchema,
    endHeldGrantInputDtoSchema,
    moveHeldEffectInputDtoSchema,
    changeFacingInputDtoSchema,
    releaseRelationshipInputDtoSchema,
    resolveRuleOccurrenceInputDtoSchema,
    voidRuleOccurrenceInputDtoSchema,
    removeAreaTargetInputDtoSchema,
    setConcealmentObserversInputDtoSchema,
    placeZoneInputDtoSchema,
    setZoneDcsInputDtoSchema,
    revertLastEncounterActionInputDtoSchema,
    rollRuleEvidenceInputDtoSchema,
    moraleSaveInputDtoSchema,
    confirmMoraleInputDtoSchema,
    resolveConsequenceRollOfferInputDtoSchema
  ])
)

export const encounterExecuteInputSchema = lazySchema(() =>
  z.strictObject({
    command: encounterCommandInputDtoSchema
  })
)
export type EncounterExecuteInput = z.infer<typeof encounterExecuteInputSchema>

export type UpdateEncounterActorInputDto = z.infer<typeof updateEncounterActorInputDtoSchema>
export type RemoveEncounterActorInputDto = z.infer<typeof removeEncounterActorInputDtoSchema>
export type ReplaceCreatureEquipmentInputDto = z.infer<
  typeof replaceCreatureEquipmentInputDtoSchema
>
export type SetEncounterInitiativeInputDto = z.infer<typeof setEncounterInitiativeInputDtoSchema>
export type SetEncounterRoundInputDto = z.infer<typeof setEncounterRoundInputDtoSchema>
export type ReorderEncounterInputDto = z.infer<typeof reorderEncounterInputDtoSchema>
export type RestEncounterCreaturesInputDto = z.infer<typeof restEncounterCreaturesInputDtoSchema>
export type EncounterCommandInputDto = z.infer<typeof encounterCommandInputDtoSchema>

/** GM-only: posts one actor's current descriptive health to the table log once (ADR 0034). */
export const shareEncounterActorHealthInputDtoSchema = lazySchema(() =>
  z.strictObject({
    encounterId: uuidSchema,
    actorId: uuidSchema,
    commandId: uuidSchema
  })
)
export type ShareEncounterActorHealthInputDto = z.infer<
  typeof shareEncounterActorHealthInputDtoSchema
>
