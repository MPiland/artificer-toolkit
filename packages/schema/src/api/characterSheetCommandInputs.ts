import { z, lazySchema } from '../zod.js'
import { characterCurrencyIdentityDtoSchema } from '../shared/characterCurrency.js'

import {
  characterResourceOwnerRefDtoSchema,
  characterRestHealingModeDtoSchema,
  characterRestHitDiceRollEvidenceDtoSchema,
  characterRestHitDieSelectionsDtoSchema,
  characterRestKindDtoSchema,
  characterSheetCompanionAdjustmentCommandDtoSchema,
  characterSheetCoreAdjustmentCommandDtoSchema,
  characterSheetItemAdjustmentCommandDtoSchema,
  characterSheetReadInputSchema,
  characterMovementDisplayPreferenceDtoSchema,
  characterSheetSourceNoteDtoSchema,
  characterSpellSourceRefDtoSchema
} from './characterSheet.js'
import { characterSheetPanelTargetDtoSchema } from './characterSheetPanel.js'
import { characterPartyVisibilityDtoSchema } from './healthDisplay.js'

const stringSchema = lazySchema(() => z.string())
const integerSchema = lazySchema(() => z.number().check(z.int()))
const booleanSchema = lazySchema(() => z.boolean())

const characterSheetExtraHitDiceUpdateDtoSchema = lazySchema(() =>
  z
    .array(
      z
        .object({
          die: integerSchema.check(z.positive()),
          total: integerSchema.check(z.nonnegative()),
          used: integerSchema.check(z.nonnegative())
        })
        .check(
          z.refine(({ total, used }) => used <= total, {
            message: 'Used hit dice cannot exceed the total.'
          })
        )
    )
    .check(
      z.superRefine((hitDice, context) => {
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
    )
)

const characterSheetCommandBaseDtoSchema = lazySchema(() =>
  z.object({
    commandId: stringSchema.check(z.uuid()),
    expectedVersion: integerSchema
  })
)

export const characterSheetCommandInputDtoSchema = lazySchema(() =>
  z
    .discriminatedUnion('type', [
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('UPSERT_SHEET_ADJUSTMENT'),
        adjustment: z.union([
          characterSheetCoreAdjustmentCommandDtoSchema,
          characterSheetItemAdjustmentCommandDtoSchema,
          characterSheetCompanionAdjustmentCommandDtoSchema
        ])
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('REMOVE_SHEET_ADJUSTMENT'),
        adjustmentId: z.pipe(
          z.string().check(z.uuid()),
          z.transform((value) => value.toLowerCase())
        ),
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
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('RESET_SHEET_PANEL_ADJUSTMENTS'),
        target: characterSheetPanelTargetDtoSchema
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('SET_MOVEMENT_DISPLAY_PREFERENCE'),
        preference: characterMovementDisplayPreferenceDtoSchema
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('SET_PARTY_VISIBILITY'),
        visibility: characterPartyVisibilityDtoSchema
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('UPDATE_SPELL_SOURCE_CUSTOMIZATION'),
        source: characterSpellSourceRefDtoSchema,
        customName: z.optional(z.nullable(stringSchema.check(z.trim()).check(z.maxLength(120)))),
        notes: z.optional(z.nullable(stringSchema.check(z.trim()).check(z.maxLength(2000)))),
        displayAsAttack: z.optional(booleanSchema)
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
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
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('UPDATE_SHEET_EXTRA'),
        extra: z.discriminatedUnion('kind', [
          z.object({
            kind: z.enum(['COMPANION', 'MOUNT', 'OWNED']),
            extraId: z.guid(),
            customName: z.optional(
              z.nullable(stringSchema.check(z.trim()).check(z.maxLength(120)))
            ),
            notes: z.optional(z.nullable(stringSchema.check(z.trim()).check(z.maxLength(2000)))),
            isActive: z.optional(booleanSchema),
            currentHitPoints: z.optional(integerSchema.check(z.nonnegative())),
            tempHitPoints: z.optional(integerSchema.check(z.nonnegative())),
            hitDice: z.optional(characterSheetExtraHitDiceUpdateDtoSchema),
            equipmentItemIds: z.optional(z.array(z.guid()))
          }),
          z.object({
            kind: z.literal('VEHICLE'),
            extraId: z.guid(),
            customName: z.optional(
              z.nullable(stringSchema.check(z.trim()).check(z.maxLength(120)))
            ),
            notes: z.optional(z.nullable(stringSchema.check(z.trim()).check(z.maxLength(2000)))),
            isActive: z.optional(booleanSchema),
            currentHitPoints: z.optional(integerSchema.check(z.nonnegative())),
            equipmentItemIds: z.optional(z.array(z.guid()))
          }),
          z.object({
            kind: z.literal('SPELL_SUMMON'),
            extraId: z.guid(),
            customName: z.optional(
              z.nullable(stringSchema.check(z.trim()).check(z.maxLength(120)))
            ),
            notes: z.optional(z.nullable(stringSchema.check(z.trim()).check(z.maxLength(2000)))),
            /** 0 ends the summon (D190). */
            currentHitPoints: z.optional(integerSchema.check(z.nonnegative())),
            tempHitPoints: z.optional(integerSchema.check(z.nonnegative()))
          })
        ])
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('REMOVE_SHEET_EXTRA'),
        extra: z.object({
          kind: z.enum(['COMPANION', 'MOUNT', 'OWNED', 'VEHICLE', 'SPELL_SUMMON']),
          extraId: z.guid()
        })
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('SET_SPELL_MECHANIC_CUSTOMIZATION'),
        source: characterSpellSourceRefDtoSchema,
        category: z.enum(['TO_HIT', 'SAVE_DC', 'DAMAGE']),
        mode: z.enum(['BONUS', 'OVERRIDE']),
        value: integerSchema,
        sourceNote: z.optional(characterSheetSourceNoteDtoSchema)
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('REMOVE_SPELL_MECHANIC_CUSTOMIZATION'),
        source: characterSpellSourceRefDtoSchema,
        category: z.enum(['TO_HIT', 'SAVE_DC', 'DAMAGE'])
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('USE_SHEET_RESOURCE'),
        owner: characterResourceOwnerRefDtoSchema,
        actionId: z.optional(stringSchema.check(z.minLength(1))),
        amount: z.optional(integerSchema.check(z.positive()))
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('RECOVER_SHEET_RESOURCE'),
        owner: characterResourceOwnerRefDtoSchema,
        trigger: z.enum(['SHORT_REST', 'LONG_REST', 'DAWN', 'DUSK', 'DAILY', 'MANUAL'])
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('END_ACTIVE_EFFECT'),
        effectId: stringSchema.check(z.uuid())
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('END_CONCENTRATION')
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('SET_INSPIRATION'),
        inspired: booleanSchema
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('SET_HIT_POINTS'),
        current: z.optional(integerSchema.check(z.gte(0))),
        temp: z.optional(integerSchema.check(z.gte(0))),
        maxOverride: z.optional(z.nullable(integerSchema.check(z.gte(0))))
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('ADJUST_HIT_POINTS'),
        mode: z.enum(['DAMAGE', 'HEAL']),
        amount: integerSchema.check(z.gte(0))
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('USE_HIT_DIE'),
        die: integerSchema
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('SET_DEATH_SAVES'),
        successes: integerSchema.check(z.gte(0)).check(z.lte(3)),
        failures: integerSchema.check(z.gte(0)).check(z.lte(3))
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('ROLL_DEATH_SAVE')
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('COMPLETE_REST'),
        restKind: characterRestKindDtoSchema,
        previewFingerprint: stringSchema.check(z.trim()).check(z.minLength(1)),
        selectedHitDice: characterRestHitDieSelectionsDtoSchema,
        resetMaximumHitPointModifier: booleanSchema,
        healingMode: characterRestHealingModeDtoSchema,
        manualHealingAccepted: booleanSchema,
        selectedCompanionInstanceIds: z.array(z.guid()),
        rollId: z.optional(stringSchema.check(z.uuid())),
        rollEvidence: z.optional(characterRestHitDiceRollEvidenceDtoSchema)
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('SET_EXHAUSTION'),
        level: integerSchema.check(z.gte(0)),
        notes: z.optional(stringSchema)
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('ADD_CONDITION'),
        conditionTypeId: z
          .string()
          .check(
            z.regex(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
              'Condition definition identity must be a canonical lowercase PostgreSQL UUID.'
            )
          ),
        notes: z.optional(stringSchema)
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('REMOVE_CONDITION'),
        conditionTypeId: z
          .string()
          .check(
            z.regex(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
              'Condition definition identity must be a canonical lowercase PostgreSQL UUID.'
            )
          )
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('REMOVE_CONSEQUENCE'),
        consequenceId: stringSchema.check(z.uuid())
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('USE_RESOURCE'),
        resourceGrantId: stringSchema,
        actionId: z.optional(stringSchema.check(z.minLength(1))),
        amount: z.optional(integerSchema.check(z.gte(1)))
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('RESTORE_RESOURCE'),
        resourceGrantId: stringSchema,
        amount: z.optional(integerSchema.check(z.gte(1))),
        all: z.optional(booleanSchema)
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('USE_SPELL_SLOT'),
        slotKey: stringSchema
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('RESTORE_SPELL_SLOT'),
        slotKey: stringSchema,
        all: z.optional(booleanSchema)
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        /** Runs an action's SPELL_SLOT_EXCHANGE outcome with the slots or slot level chosen. */
        type: z.literal('EXCHANGE_SPELL_SLOTS'),
        actionId: stringSchema.check(z.minLength(1)),
        selection: z.discriminatedUnion('kind', [
          z.object({
            kind: z.literal('SLOTS'),
            slotKeys: z.array(stringSchema).check(z.minLength(1)).check(z.maxLength(20))
          }),
          z.object({
            kind: z.literal('SLOT_LEVEL'),
            slotLevel: integerSchema.check(z.gte(1)).check(z.lte(9))
          })
        ])
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('CAST_SPELL'),
        spellId: stringSchema,
        sourceId: z.optional(stringSchema),
        slotKey: z.optional(stringSchema)
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('SET_PREPARED_SPELLS'),
        classId: stringSchema,
        spellIds: z.array(stringSchema)
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('SET_KNOWN_SPELLS'),
        classId: stringSchema,
        spellIds: z.array(stringSchema)
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('ADD_INVENTORY_ITEM'),
        equipmentId: stringSchema,
        quantity: integerSchema.check(z.gte(1)),
        containerId: z.optional(stringSchema),
        customName: z.optional(stringSchema),
        notes: z.optional(stringSchema)
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('REMOVE_INVENTORY_ITEM'),
        itemId: stringSchema,
        quantity: z.optional(integerSchema.check(z.gte(1)))
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('UPDATE_INVENTORY_ITEM'),
        itemId: stringSchema,
        quantity: z.optional(integerSchema.check(z.gte(0))),
        containerId: z.optional(z.nullable(stringSchema)),
        customName: z.optional(z.nullable(stringSchema)),
        notes: z.optional(z.nullable(stringSchema))
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('EQUIP_ITEM'),
        itemId: stringSchema
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('UNEQUIP_ITEM'),
        itemId: stringSchema
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('SWAP_HELD_ITEMS')
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('ATTUNE_ITEM'),
        itemId: stringSchema
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('UNATTUNE_ITEM'),
        itemId: stringSchema
      }),
      z.extend(characterCurrencyIdentityDtoSchema, {
        ...characterSheetCommandBaseDtoSchema.shape,
        type: z.literal('ADJUST_CURRENCY'),
        amount: integerSchema,
        containerId: z.optional(stringSchema)
      }),
      z.extend(characterCurrencyIdentityDtoSchema, {
        ...characterSheetCommandBaseDtoSchema.shape,
        type: z.literal('MOVE_CURRENCY'),
        amount: integerSchema.check(z.positive()),
        fromContainerId: z.optional(stringSchema),
        toContainerId: z.optional(stringSchema)
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('CREATE_NOTE'),
        title: stringSchema.check(z.trim()).check(z.minLength(1)),
        body: z.optional(stringSchema),
        groupId: stringSchema,
        pinned: z.optional(booleanSchema)
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('UPDATE_NOTE'),
        noteId: stringSchema,
        title: z.optional(stringSchema.check(z.trim()).check(z.minLength(1))),
        body: z.optional(z.nullable(stringSchema)),
        groupId: z.optional(stringSchema),
        pinned: z.optional(booleanSchema)
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('DELETE_NOTE'),
        noteId: stringSchema
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('CREATE_NOTE_GROUP'),
        label: stringSchema.check(z.trim()).check(z.minLength(1))
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('UPDATE_NOTE_GROUP'),
        groupId: stringSchema,
        label: z.optional(stringSchema.check(z.trim()).check(z.minLength(1))),
        sortOrder: z.optional(integerSchema.check(z.gte(0)))
      }),
      z.extend(characterSheetCommandBaseDtoSchema, {
        type: z.literal('DELETE_NOTE_GROUP'),
        groupId: stringSchema
      })
    ])
    .check(
      z.superRefine((command, context) => {
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
    )
)

export const characterSheetExecuteInputSchema = lazySchema(() =>
  z.extend(characterSheetReadInputSchema, {
    command: characterSheetCommandInputDtoSchema
  })
)

export type CharacterSheetCommandInputDto = z.infer<typeof characterSheetCommandInputDtoSchema>
export type CharacterSheetNoteCommandInputDto = Extract<
  CharacterSheetCommandInputDto,
  {
    type:
      | 'CREATE_NOTE'
      | 'UPDATE_NOTE'
      | 'DELETE_NOTE'
      | 'CREATE_NOTE_GROUP'
      | 'UPDATE_NOTE_GROUP'
      | 'DELETE_NOTE_GROUP'
  }
>
export type CharacterSheetExecuteInput = z.infer<typeof characterSheetExecuteInputSchema>
