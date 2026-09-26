import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { characterSheetActionDtoSchema } from './characterSheetData.js'
import { resolveEncounterActionInputDtoSchema } from './encounters.js'
import { encounterAcceptedWieldConflictDtoSchema } from './encounterRuleCommands.js'
import { equipmentGripSchema } from '../shared/enums.js'
import { encounterRuleWarningsDtoSchema } from '../shared/encounterRuleWarnings.js'
import {
  basicActionCostDtoSchema,
  basicActionReusableDefinitionDocumentDtoSchema
} from '../shared/basicActions.js'

const versionSchema = z.number().check(z.int()).check(z.nonnegative())
const labelSchema = z.string().check(z.trim()).check(z.minLength(1))
const checksumSchema = z.string().check(z.regex(/^[a-f0-9]{64}$/))

export const getEncounterActionChoicesInputDtoSchema = z.strictObject({
  encounterId: postgresUuidSchema,
  expectedVersion: versionSchema,
  actorId: postgresUuidSchema
})

export const encounterActionChoiceDtoSchema = z.strictObject({
  id: characterSheetActionDtoSchema.shape.id,
  label: characterSheetActionDtoSchema.shape.label,
  sourceLabel: characterSheetActionDtoSchema.shape.sourceLabel,
  rangeLabel: z.optional(labelSchema),
  attackBonus: z.optional(z.number().check(z.int())),
  damageLabel: z.optional(labelSchema),
  /**
   * The grip of an item's weapon attack; actions sharing `attackKey` are the same attack offered
   * one- and two-handed. Null for every other action.
   */
  grip: z.nullable(z.strictObject({ value: equipmentGripSchema, attackKey: labelSchema })),
  /** Present when attacking with this action stows the active shield; the client must confirm. */
  wieldConflict: z.nullable(
    z.extend(encounterAcceptedWieldConflictDtoSchema, {
      armorClassDelta: z.number().check(z.int()).check(z.lte(0))
    })
  ),
  /**
   * Soft-rule warnings that already apply before a target is chosen (no allowance left, item not
   * equipped, not enough uses). The drawer shows the action dimmed with these reasons; resolving it
   * still asks "Do it anyway".
   */
  warnings: encounterRuleWarningsDtoSchema
})

export const MAX_BASIC_ACTION_CHOICES = 64

/** One of the Run System's basic actions (Q11), offered to every actor apart from its features. */
export const encounterBasicActionChoiceDtoSchema = z.strictObject({
  definitionId: postgresUuidSchema,
  label: labelSchema,
  rulesText: basicActionReusableDefinitionDocumentDtoSchema.shape.rulesText,
  actionCost: basicActionCostDtoSchema,
  /** The action helps an ally, who must be chosen. */
  needsAlly: z.boolean(),
  /** Soft-rule warnings that already apply, as for `actions`. */
  warnings: encounterRuleWarningsDtoSchema
})

export const encounterActionChoicesDtoSchema = z.strictObject({
  encounterId: postgresUuidSchema,
  encounterVersion: versionSchema,
  actorId: postgresUuidSchema,
  actions: z.array(encounterActionChoiceDtoSchema),
  basicActions: z
    .array(encounterBasicActionChoiceDtoSchema)
    .check(z.maxLength(MAX_BASIC_ACTION_CHOICES)),
  optionalRules: z.array(z.strictObject({ definitionId: postgresUuidSchema, label: labelSchema }))
})

/** A superseded reactive scope has no available choices; authority failures still reject. */
export const encounterActionChoicesResponseDtoSchema = z.nullable(encounterActionChoicesDtoSchema)

export const getEncounterOptionalActionChoicesInputDtoSchema = z.extend(
  z.pick(resolveEncounterActionInputDtoSchema, {
    encounterId: true,
    expectedVersion: true,
    actorId: true,
    actionId: true,
    targetActorId: true,
    sceneContext: true
  }),
  {
    encounterId: postgresUuidSchema,
    actorId: postgresUuidSchema,
    targetActorId: postgresUuidSchema,
    definitionId: postgresUuidSchema
  }
)

/** Display labels accompany the exact server-issued fields; clients submit only the selected IDs. */
export const encounterOptionalActionChoicesDtoSchema = z.strictObject({
  definitionId: postgresUuidSchema,
  optionId: checksumSchema,
  selectionContract: checksumSchema,
  label: labelSchema,
  fields: z
    .array(
      z.strictObject({
        fieldId: checksumSchema,
        kind: z.literal('ENTITY'),
        label: labelSchema,
        options: z
          .array(z.strictObject({ id: postgresUuidSchema, label: labelSchema }))
          .check(z.minLength(1))
      })
    )
    .check(z.minLength(1))
    .check(z.maxLength(4))
})

export type GetEncounterActionChoicesInputDto = z.infer<
  typeof getEncounterActionChoicesInputDtoSchema
>
export type EncounterActionChoiceDto = z.infer<typeof encounterActionChoiceDtoSchema>
export type EncounterBasicActionChoiceDto = z.infer<typeof encounterBasicActionChoiceDtoSchema>
export type EncounterActionChoicesDto = z.infer<typeof encounterActionChoicesDtoSchema>
export type EncounterActionChoicesResponseDto = z.infer<
  typeof encounterActionChoicesResponseDtoSchema
>
export type GetEncounterOptionalActionChoicesInputDto = z.infer<
  typeof getEncounterOptionalActionChoicesInputDtoSchema
>
export type EncounterOptionalActionChoicesDto = z.infer<
  typeof encounterOptionalActionChoicesDtoSchema
>
