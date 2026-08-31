import { z } from 'zod'

import {
  characterResourceOwnerRefDtoSchema,
  characterRestHealingModeDtoSchema,
  characterRestHitDiceRollEvidenceDtoSchema,
  characterRestHitDieSelectionsDtoSchema,
  characterRestKindDtoSchema,
  characterSheetCommandResultDtoSchema,
  characterSheetCompanionAdjustmentCommandDtoSchema,
  characterSheetCoreAdjustmentCommandDtoSchema,
  characterSheetItemAdjustmentCommandDtoSchema,
  characterMovementDisplayPreferenceDtoSchema,
  characterSheetSourceNoteDtoSchema,
  characterSpellSourceRefDtoSchema
} from './characterSheet.js'
import { characterSheetResponseDtoSchema } from './characterSheetData.js'
import {
  characterSheetPanelDtoSchema,
  characterSheetPanelTargetDtoSchema
} from './characterSheetPanel.js'

const characterSheetExtraHitDiceUpdateDtoSchema = z
  .array(
    z
      .object({
        die: z.number().int().positive(),
        total: z.number().int().nonnegative(),
        used: z.number().int().nonnegative()
      })
      .refine(({ total, used }) => used <= total, {
        message: 'Used hit dice cannot exceed the total.'
      })
  )
  .superRefine((hitDice, context) => {
    const seen = new Set<number>()

    hitDice.forEach(({ die }, index) => {
      if (seen.has(die)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'die'],
          message: 'Hit dice denominations must be unique.'
        })
      }
      seen.add(die)
    })
  })

const characterSheetCommandBaseDtoSchema = z.object({
  commandId: z.string().uuid(),
  expectedVersion: z.number().int()
})

export const characterRuleRevisionIdentityDtoSchema = z.strictObject({
  revisionId: z.string().uuid(),
  checksum: z.string().trim().min(1),
  evaluatorKind: z.literal('ZEN'),
  evaluatorVersion: z.string().trim().min(1),
  modelContractVersion: z.number().int().positive()
})

export const characterRuleUpgradePreviewRequestDtoSchema = z.strictObject({
  expectedVersion: z.number().int().nonnegative()
})

export const characterRuleUpgradePreviewResponseDtoSchema = z.strictObject({
  characterId: z.string().uuid(),
  streamVersion: z.number().int().nonnegative(),
  currentRevision: characterRuleRevisionIdentityDtoSchema,
  targetRevision: characterRuleRevisionIdentityDtoSchema,
  upgradeAvailable: z.boolean(),
  sheet: characterSheetResponseDtoSchema
})

export const characterRestPreviewRequestDtoSchema = z
  .strictObject({
    restKind: characterRestKindDtoSchema,
    expectedVersion: z.number().int().nonnegative(),
    selectedHitDice: characterRestHitDieSelectionsDtoSchema,
    resetMaximumHitPointModifier: z.boolean(),
    healingMode: characterRestHealingModeDtoSchema,
    manualHealingAccepted: z.boolean(),
    selectedCompanionInstanceIds: z.array(z.guid()),
    rollId: z.string().uuid().optional(),
    rollEvidence: characterRestHitDiceRollEvidenceDtoSchema.optional(),
    requestRoll: z.literal(false)
  })
  .superRefine((request, context) => {
    if (
      new Set(request.selectedCompanionInstanceIds).size !==
      request.selectedCompanionInstanceIds.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['selectedCompanionInstanceIds'],
        message: 'A companion may be selected only once.'
      })
    }
    if (Boolean(request.rollId) !== Boolean(request.rollEvidence)) {
      context.addIssue({
        code: 'custom',
        path: ['rollId'],
        message: 'Hit-die evidence must reference its authoritative roll.'
      })
    }
  })

const characterRestRecoveryPreviewDtoSchema = z.strictObject({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  recovered: z.number().int().nonnegative()
})

export const characterRestPreviewResponseDtoSchema = z.strictObject({
  restKind: characterRestKindDtoSchema,
  streamVersion: z.number().int().nonnegative(),
  previewFingerprint: z.string().trim().min(1),
  hitPoints: z.strictObject({
    current: z.number().int().nonnegative(),
    maximum: z.number().int().nonnegative(),
    temporary: z.number().int().nonnegative(),
    missing: z.number().int().nonnegative(),
    maximumHitPointModifier: z.number().int(),
    canResetMaximumHitPointModifier: z.boolean()
  }),
  hitDice: z.array(
    z.strictObject({
      die: z.number().int().min(2),
      classLabels: z.array(z.string().trim().min(1)).min(1),
      total: z.number().int().nonnegative(),
      used: z.number().int().nonnegative(),
      remaining: z.number().int().nonnegative(),
      selected: z.number().int().nonnegative(),
      constitutionModifier: z.number().int()
    })
  ),
  healingMode: characterRestHealingModeDtoSchema,
  manualHealingAccepted: z.boolean(),
  canonicalExpression: z.string().trim().min(1).optional(),
  rollEvidence: characterRestHitDiceRollEvidenceDtoSchema.optional(),
  stagedHealing: z.number().int().nonnegative(),
  automaticRecoveries: z.strictObject({
    resources: z.array(characterRestRecoveryPreviewDtoSchema),
    spellSlots: z.array(characterRestRecoveryPreviewDtoSchema)
  }),
  eligibleCompanions: z.array(
    z.strictObject({
      companionInstanceId: z.guid(),
      label: z.string().trim().min(1),
      selected: z.boolean(),
      hitDice: z.array(
        z.strictObject({
          die: z.number().int().min(2),
          total: z.number().int().nonnegative(),
          used: z.number().int().nonnegative(),
          remaining: z.number().int().nonnegative(),
          recovered: z.number().int().nonnegative()
        })
      ),
      resources: z.array(characterRestRecoveryPreviewDtoSchema)
    })
  ),
  canApply: z.boolean()
})

export const characterSheetCommandInputDtoSchema = z
  .discriminatedUnion('type', [
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('UPGRADE_RULE_PACK'),
      revisionId: z.string().uuid()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('UPSERT_SHEET_ADJUSTMENT'),
      adjustment: z.union([
        characterSheetCoreAdjustmentCommandDtoSchema,
        characterSheetItemAdjustmentCommandDtoSchema,
        characterSheetCompanionAdjustmentCommandDtoSchema
      ])
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('REMOVE_SHEET_ADJUSTMENT'),
      adjustmentId: z.string().uuid(),
      target: characterSheetPanelTargetDtoSchema,
      family: z.enum([
        'ABILITY',
        'SAVING_THROW',
        'SKILL',
        'PASSIVE',
        'SENSE',
        'MOVEMENT',
        'HIT_POINTS',
        'COMPANION',
        'SPELL',
        'ITEM',
        'DEFENSE',
        'PROFICIENCY'
      ])
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('RESET_SHEET_PANEL_ADJUSTMENTS'),
      target: characterSheetPanelTargetDtoSchema
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('SET_MOVEMENT_DISPLAY_PREFERENCE'),
      preference: characterMovementDisplayPreferenceDtoSchema
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('UPDATE_SPELL_SOURCE_CUSTOMIZATION'),
      source: characterSpellSourceRefDtoSchema,
      customName: z.string().trim().max(120).nullable().optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
      displayAsAttack: z.boolean().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('ADD_SHEET_EXTRA'),
      extra: z.discriminatedUnion('kind', [
        z.object({
          kind: z.enum(['COMPANION', 'MOUNT', 'OWNED']),
          creatureId: z.guid(),
          originKind: z.enum(['WORLD', 'SUMMONED'])
        }),
        z.object({ kind: z.literal('VEHICLE'), vehicleId: z.guid() })
      ])
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('UPDATE_SHEET_EXTRA'),
      extra: z.discriminatedUnion('kind', [
        z.object({
          kind: z.enum(['COMPANION', 'MOUNT', 'OWNED']),
          extraId: z.guid(),
          customName: z.string().trim().max(120).nullable().optional(),
          notes: z.string().trim().max(2000).nullable().optional(),
          isActive: z.boolean().optional(),
          currentHitPoints: z.number().int().nonnegative().optional(),
          tempHitPoints: z.number().int().nonnegative().optional(),
          hitDice: characterSheetExtraHitDiceUpdateDtoSchema.optional(),
          equipmentItemIds: z.array(z.guid()).optional()
        }),
        z.object({
          kind: z.literal('VEHICLE'),
          extraId: z.guid(),
          customName: z.string().trim().max(120).nullable().optional(),
          notes: z.string().trim().max(2000).nullable().optional(),
          isActive: z.boolean().optional(),
          currentHitPoints: z.number().int().nonnegative().optional(),
          equipmentItemIds: z.array(z.guid()).optional()
        })
      ])
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('REMOVE_SHEET_EXTRA'),
      extra: z.object({
        kind: z.enum(['COMPANION', 'MOUNT', 'OWNED', 'VEHICLE']),
        extraId: z.guid()
      })
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('SET_SPELL_MECHANIC_CUSTOMIZATION'),
      source: characterSpellSourceRefDtoSchema,
      category: z.enum(['TO_HIT', 'SAVE_DC', 'DAMAGE']),
      mode: z.enum(['BONUS', 'OVERRIDE']),
      value: z.number().int(),
      sourceNote: characterSheetSourceNoteDtoSchema.optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('REMOVE_SPELL_MECHANIC_CUSTOMIZATION'),
      source: characterSpellSourceRefDtoSchema,
      category: z.enum(['TO_HIT', 'SAVE_DC', 'DAMAGE'])
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('USE_SHEET_RESOURCE'),
      owner: characterResourceOwnerRefDtoSchema,
      actionId: z.string().min(1).optional(),
      amount: z.number().int().positive().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('RECOVER_SHEET_RESOURCE'),
      owner: characterResourceOwnerRefDtoSchema,
      trigger: z.enum(['SHORT_REST', 'LONG_REST', 'DAWN', 'DUSK', 'DAILY', 'MANUAL'])
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('SET_INSPIRATION'),
      inspired: z.boolean()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('SET_HIT_POINTS'),
      current: z.number().int().min(0).optional(),
      temp: z.number().int().min(0).optional(),
      maxOverride: z.number().int().min(0).nullable().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('ADJUST_HIT_POINTS'),
      mode: z.enum(['DAMAGE', 'HEAL']),
      amount: z.number().int().min(0)
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('USE_HIT_DIE'),
      die: z.number().int()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('COMPLETE_REST'),
      restKind: characterRestKindDtoSchema,
      previewFingerprint: z.string().trim().min(1),
      selectedHitDice: characterRestHitDieSelectionsDtoSchema,
      resetMaximumHitPointModifier: z.boolean(),
      healingMode: characterRestHealingModeDtoSchema,
      manualHealingAccepted: z.boolean(),
      selectedCompanionInstanceIds: z.array(z.guid()),
      rollId: z.string().uuid().optional(),
      rollEvidence: characterRestHitDiceRollEvidenceDtoSchema.optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('SET_EXHAUSTION'),
      level: z.number().int().min(0),
      notes: z.string().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('ADD_CONDITION'),
      conditionTypeId: z
        .string()
        .regex(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
          'Condition definition identity must be a canonical lowercase PostgreSQL UUID.'
        ),
      notes: z.string().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('REMOVE_CONDITION'),
      conditionTypeId: z
        .string()
        .regex(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
          'Condition definition identity must be a canonical lowercase PostgreSQL UUID.'
        )
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('USE_RESOURCE'),
      resourceGrantId: z.string(),
      actionId: z.string().min(1).optional(),
      amount: z.number().int().min(1).optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('RESTORE_RESOURCE'),
      resourceGrantId: z.string(),
      amount: z.number().int().min(1).optional(),
      all: z.boolean().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('USE_SPELL_SLOT'),
      slotKey: z.string()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('RESTORE_SPELL_SLOT'),
      slotKey: z.string(),
      all: z.boolean().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('CAST_SPELL'),
      spellId: z.string(),
      sourceId: z.string().optional(),
      slotKey: z.string().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('SET_PREPARED_SPELLS'),
      classId: z.string(),
      spellIds: z.array(z.string())
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('SET_KNOWN_SPELLS'),
      classId: z.string(),
      spellIds: z.array(z.string())
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('ADD_INVENTORY_ITEM'),
      equipmentId: z.string(),
      quantity: z.number().int().min(1),
      containerId: z.string().optional(),
      customName: z.string().optional(),
      notes: z.string().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('REMOVE_INVENTORY_ITEM'),
      itemId: z.string(),
      quantity: z.number().int().min(1).optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('UPDATE_INVENTORY_ITEM'),
      itemId: z.string(),
      quantity: z.number().int().min(0).optional(),
      containerId: z.string().nullable().optional(),
      customName: z.string().nullable().optional(),
      notes: z.string().nullable().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('EQUIP_ITEM'),
      itemId: z.string()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('UNEQUIP_ITEM'),
      itemId: z.string()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('ATTUNE_ITEM'),
      itemId: z.string()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('UNATTUNE_ITEM'),
      itemId: z.string()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('ADJUST_CURRENCY'),
      currencyId: z.string(),
      amount: z.number().int(),
      containerId: z.string().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('MOVE_CURRENCY'),
      currencyId: z.string(),
      amount: z.number().int().positive(),
      fromContainerId: z.string().optional(),
      toContainerId: z.string().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('CREATE_NOTE'),
      title: z.string().trim().min(1),
      body: z.string().optional(),
      groupId: z.string(),
      pinned: z.boolean().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('UPDATE_NOTE'),
      noteId: z.string(),
      title: z.string().trim().min(1).optional(),
      body: z.string().nullable().optional(),
      groupId: z.string().optional(),
      pinned: z.boolean().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('DELETE_NOTE'),
      noteId: z.string()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('CREATE_NOTE_GROUP'),
      label: z.string().trim().min(1)
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('UPDATE_NOTE_GROUP'),
      groupId: z.string(),
      label: z.string().trim().min(1).optional(),
      sortOrder: z.number().int().min(0).optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('DELETE_NOTE_GROUP'),
      groupId: z.string()
    })
  ])
  .superRefine((command, context) => {
    if (
      command.type === 'SET_SPELL_MECHANIC_CUSTOMIZATION' &&
      command.category === 'DAMAGE' &&
      command.mode !== 'BONUS'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Damage customizations only support bonus mode.',
        path: ['mode']
      })
    }
  })

export const characterHistoryEntryDtoSchema = z.object({
  eventId: z.string(),
  occurredAt: z.string(),
  actorId: z.string(),
  eventType: z.string(),
  summary: z.string(),
  result: characterSheetCommandResultDtoSchema.optional()
})

export const characterHistoryResponseDtoSchema = z.object({
  characterId: z.string(),
  entries: z.array(characterHistoryEntryDtoSchema)
})

export const characterSheetCommandResponseDtoSchema = z.object({
  characterId: z.string(),
  streamVersion: z.number().int(),
  sheet: characterSheetResponseDtoSchema,
  panels: z.array(characterSheetPanelDtoSchema).optional(),
  historyEntry: characterHistoryEntryDtoSchema.optional(),
  result: characterSheetCommandResultDtoSchema.optional()
})

export type CharacterRestPreviewRequestDto = z.infer<typeof characterRestPreviewRequestDtoSchema>
export type CharacterRestPreviewResponseDto = z.infer<typeof characterRestPreviewResponseDtoSchema>
export type CharacterRuleRevisionIdentityDto = z.infer<
  typeof characterRuleRevisionIdentityDtoSchema
>
export type CharacterRuleUpgradePreviewRequestDto = z.infer<
  typeof characterRuleUpgradePreviewRequestDtoSchema
>
export type CharacterRuleUpgradePreviewResponseDto = z.infer<
  typeof characterRuleUpgradePreviewResponseDtoSchema
>
export type CharacterHistoryEntryDto = z.infer<typeof characterHistoryEntryDtoSchema>
export type CharacterHistoryResponseDto = z.infer<typeof characterHistoryResponseDtoSchema>
export type CharacterSheetCommandInputDto = z.infer<typeof characterSheetCommandInputDtoSchema>
export type CharacterSheetCommandResponseDto = z.infer<
  typeof characterSheetCommandResponseDtoSchema
>
