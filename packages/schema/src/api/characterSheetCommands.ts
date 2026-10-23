import { z, lazySchema } from '../zod.js'

import {
  characterRestHealingModeDtoSchema,
  characterRestHitDiceRollEvidenceDtoSchema,
  characterRestHitDieSelectionsDtoSchema,
  characterRestKindDtoSchema,
  characterSheetCommandResultDtoSchema,
  characterSheetReadInputSchema
} from './characterSheet.js'
import { characterSheetResponseDtoSchema } from './characterSheetData.js'
import { characterHistoryEntryDtoSchema } from './characterHistory.js'

export {
  characterHistoryEntryDtoSchema,
  characterHistoryResponseDtoSchema,
  type CharacterHistoryEntryDto,
  type CharacterHistoryResponseDto
} from './characterHistory.js'

export {
  characterSheetCommandInputDtoSchema,
  characterSheetExecuteInputSchema
} from './characterSheetCommandInputs.js'
export type {
  CharacterSheetCommandInputDto,
  CharacterSheetExecuteInput
} from './characterSheetCommandInputs.js'

const stringSchema = lazySchema(() => z.string())
const integerSchema = lazySchema(() => z.number().check(z.int()))
const booleanSchema = lazySchema(() => z.boolean())

export const characterRestPreviewRequestDtoSchema = lazySchema(() =>
  z
    .strictObject({
      restKind: characterRestKindDtoSchema,
      expectedVersion: integerSchema.check(z.nonnegative()),
      selectedHitDice: characterRestHitDieSelectionsDtoSchema,
      resetMaximumHitPointModifier: booleanSchema,
      healingMode: characterRestHealingModeDtoSchema,
      manualHealingAccepted: booleanSchema,
      selectedCompanionInstanceIds: z.array(z.guid()),
      rollId: z.optional(stringSchema.check(z.uuid())),
      rollEvidence: z.optional(characterRestHitDiceRollEvidenceDtoSchema),
      requestRoll: z.literal(false)
    })
    .check(
      z.superRefine((request, context) => {
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
    )
)

const characterRestRecoveryPreviewDtoSchema = lazySchema(() =>
  z.strictObject({
    id: stringSchema.check(z.trim()).check(z.minLength(1)),
    label: stringSchema.check(z.trim()).check(z.minLength(1)),
    recovered: integerSchema.check(z.nonnegative())
  })
)

export const characterRestPreviewResponseDtoSchema = lazySchema(() =>
  z.strictObject({
    restKind: characterRestKindDtoSchema,
    streamVersion: integerSchema.check(z.nonnegative()),
    previewFingerprint: stringSchema.check(z.trim()).check(z.minLength(1)),
    hitPoints: z.strictObject({
      current: integerSchema.check(z.nonnegative()),
      maximum: integerSchema.check(z.nonnegative()),
      temporary: integerSchema.check(z.nonnegative()),
      missing: integerSchema.check(z.nonnegative()),
      maximumHitPointModifier: integerSchema,
      canResetMaximumHitPointModifier: booleanSchema
    }),
    hitDice: z.array(
      z.strictObject({
        die: integerSchema.check(z.gte(2)),
        classLabels: z
          .array(stringSchema.check(z.trim()).check(z.minLength(1)))
          .check(z.minLength(1)),
        total: integerSchema.check(z.nonnegative()),
        used: integerSchema.check(z.nonnegative()),
        remaining: integerSchema.check(z.nonnegative()),
        selected: integerSchema.check(z.nonnegative()),
        constitutionModifier: integerSchema
      })
    ),
    healingMode: characterRestHealingModeDtoSchema,
    manualHealingAccepted: booleanSchema,
    canonicalExpression: z.optional(stringSchema.check(z.trim()).check(z.minLength(1))),
    rollEvidence: z.optional(characterRestHitDiceRollEvidenceDtoSchema),
    stagedHealing: integerSchema.check(z.nonnegative()),
    automaticRecoveries: z.strictObject({
      resources: z.array(characterRestRecoveryPreviewDtoSchema),
      spellSlots: z.array(characterRestRecoveryPreviewDtoSchema)
    }),
    /** Held effects this rest weakens by a step (Raise Dead's penalty), listed so the rest is no surprise. */
    steppedDownEffects: z.array(
      z.strictObject({
        id: z.guid(),
        label: stringSchema.check(z.trim()).check(z.minLength(1))
      })
    ),
    eligibleCompanions: z.array(
      z.strictObject({
        companionInstanceId: z.guid(),
        label: stringSchema.check(z.trim()).check(z.minLength(1)),
        selected: booleanSchema,
        hitDice: z.array(
          z.strictObject({
            die: integerSchema.check(z.gte(2)),
            total: integerSchema.check(z.nonnegative()),
            used: integerSchema.check(z.nonnegative()),
            remaining: integerSchema.check(z.nonnegative()),
            recovered: integerSchema.check(z.nonnegative())
          })
        ),
        resources: z.array(characterRestRecoveryPreviewDtoSchema)
      })
    ),
    canApply: booleanSchema
  })
)

export const characterSheetCommandResponseDtoSchema = lazySchema(() =>
  z.strictObject({
    characterId: stringSchema,
    streamVersion: integerSchema,
    historyEntry: z.optional(characterHistoryEntryDtoSchema),
    result: z.optional(characterSheetCommandResultDtoSchema)
  })
)

/** Transitional transaction-local result for Encounter orchestration; never a public response. */
export const characterSheetCommandExecutionDtoSchema = lazySchema(() =>
  z.extend(characterSheetCommandResponseDtoSchema, {
    sheet: characterSheetResponseDtoSchema
  })
)

export const characterRestPreviewInputSchema = lazySchema(() =>
  z.extend(characterSheetReadInputSchema, {
    input: characterRestPreviewRequestDtoSchema
  })
)

export type CharacterRestPreviewRequestDto = z.infer<typeof characterRestPreviewRequestDtoSchema>
export type CharacterRestPreviewInput = z.infer<typeof characterRestPreviewInputSchema>
export type CharacterRestPreviewResponseDto = z.infer<typeof characterRestPreviewResponseDtoSchema>
export type CharacterSheetCommandResponseDto = z.infer<
  typeof characterSheetCommandResponseDtoSchema
>
export type CharacterSheetCommandExecutionDto = z.infer<
  typeof characterSheetCommandExecutionDtoSchema
>
