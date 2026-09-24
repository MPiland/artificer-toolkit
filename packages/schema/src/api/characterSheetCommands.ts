import { z } from '../zod.js'

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
import { characterSheetPanelDtoSchema } from './characterSheetPanel.js'

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

const stringSchema = z.string()
const integerSchema = z.number().check(z.int())
const booleanSchema = z.boolean()

export const characterRuleRevisionIdentityDtoSchema = z.strictObject({
  revisionId: stringSchema.check(z.uuid()),
  checksum: stringSchema.check(z.trim()).check(z.minLength(1)),
  evaluatorKind: z.literal('ZEN'),
  evaluatorVersion: stringSchema.check(z.trim()).check(z.minLength(1)),
  modelContractVersion: integerSchema.check(z.positive())
})

export const characterRuleUpgradePreviewRequestDtoSchema = z.strictObject({
  expectedVersion: integerSchema.check(z.nonnegative())
})

export const characterRuleUpgradePreviewResponseDtoSchema = z.strictObject({
  characterId: stringSchema.check(z.uuid()),
  streamVersion: integerSchema.check(z.nonnegative()),
  currentRevision: characterRuleRevisionIdentityDtoSchema,
  targetRevision: characterRuleRevisionIdentityDtoSchema,
  upgradeAvailable: booleanSchema,
  sheet: characterSheetResponseDtoSchema
})

export const characterRestPreviewRequestDtoSchema = z
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

const characterRestRecoveryPreviewDtoSchema = z.strictObject({
  id: stringSchema.check(z.trim()).check(z.minLength(1)),
  label: stringSchema.check(z.trim()).check(z.minLength(1)),
  recovered: integerSchema.check(z.nonnegative())
})

export const characterRestPreviewResponseDtoSchema = z.strictObject({
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

export const characterSheetCommandResponseDtoSchema = z.object({
  characterId: stringSchema,
  streamVersion: integerSchema,
  sheet: characterSheetResponseDtoSchema,
  panels: z.optional(z.array(characterSheetPanelDtoSchema)),
  historyEntry: z.optional(characterHistoryEntryDtoSchema),
  result: z.optional(characterSheetCommandResultDtoSchema)
})

export const characterRestPreviewInputSchema = z.extend(characterSheetReadInputSchema, {
  input: characterRestPreviewRequestDtoSchema
})

export type CharacterRestPreviewRequestDto = z.infer<typeof characterRestPreviewRequestDtoSchema>
export type CharacterRestPreviewInput = z.infer<typeof characterRestPreviewInputSchema>
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
export type CharacterSheetCommandResponseDto = z.infer<
  typeof characterSheetCommandResponseDtoSchema
>
