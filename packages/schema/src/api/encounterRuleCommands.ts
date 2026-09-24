import { z } from '../zod.js'

import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { movementReactionChoiceSelectionDtoSchema } from '../shared/reaction.js'
import { serverRuleExecutionCorrelationIdDtoSchema } from '../shared/ruleExecutionProtocol.js'
import { sizeCodeSchema } from '../shared/enums.js'
import { spatialPointDtoSchema } from '../shared/spatialFacts.js'

const uuidSchema = z.string().check(z.uuid())
const versionSchema = z.number().check(z.int()).check(z.nonnegative())
const checksumSchema = z.string().check(z.regex(/^[a-f0-9]{64}$/))
const speedFactorActionFactorDtoSchema = z.enum([
  'MELEE_HEAVY',
  'MELEE_LIGHT_OR_FINESSE',
  'MELEE_TWO_HANDED',
  'RANGED_LOADING'
])
export const initiativeDeclarationSelectionDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.enum(['CHARACTER_ACTION', 'CHARACTER_SPELL_CAST', 'CREATURE_FEATURE_ACTION']),
    optionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000))
  }),
  z
    .strictObject({
      kind: z.literal('GM_ADJUDICATED'),
      optionId: z.literal('GM_ADJUDICATED'),
      actorSize: sizeCodeSchema,
      actionFactors: z.array(speedFactorActionFactorDtoSchema).check(z.maxLength(4)),
      spellLevel: z.nullable(z.number().check(z.int()).check(z.gte(0)).check(z.lte(99)))
    })
    .check(
      z.superRefine((value, context) => {
        if (new Set(value.actionFactors).size !== value.actionFactors.length) {
          context.addIssue({
            code: 'custom',
            path: ['actionFactors'],
            message: 'GM-adjudicated action factors must be unique.'
          })
        }
      })
    )
])
export type InitiativeDeclarationSelectionDto = z.infer<
  typeof initiativeDeclarationSelectionDtoSchema
>

export const commandBaseDtoSchema = z.strictObject({
  encounterId: uuidSchema,
  commandId: uuidSchema,
  expectedVersion: versionSchema
})

const optionalCombatActionIntentSelectionValueDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('ENTITY'),
    entityId: postgresUuidSchema
  }),
  z.strictObject({
    kind: z.literal('POSITION'),
    position: spatialPointDtoSchema
  })
])
const optionalCombatActionIntentSelectionDtoSchema = z.strictObject({
  fieldId: checksumSchema,
  value: optionalCombatActionIntentSelectionValueDtoSchema
})

export const optionalCombatActionIntentDtoSchema = z
  .strictObject({
    optionId: checksumSchema,
    definitionId: postgresUuidSchema,
    selectionContract: checksumSchema,
    selections: z.array(optionalCombatActionIntentSelectionDtoSchema).check(z.maxLength(4))
  })
  .check(
    z.superRefine((intent, context) => {
      for (let index = 1; index < intent.selections.length; index += 1) {
        if (intent.selections[index - 1]!.fieldId >= intent.selections[index]!.fieldId) {
          context.addIssue({
            code: 'custom',
            path: ['selections', index, 'fieldId'],
            message: 'Optional combat intent selection field IDs must be unique and ascending.'
          })
        }
      }
    })
  )
export type OptionalCombatActionIntentDto = z.infer<typeof optionalCombatActionIntentDtoSchema>

export const resolveEncounterActionInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('RESOLVE_ACTION'),
  actorId: uuidSchema,
  actionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
  targetActorId: uuidSchema,
  optionalCombatIntent: z.optional(z.nullable(optionalCombatActionIntentDtoSchema)),
  /**
   * Required only by action policies that consume exact Scene position. The
   * server locks and validates this dependency before it constructs facts.
   */
  sceneContext: z._default(
    z.optional(
      z.nullable(
        z.strictObject({
          sceneId: uuidSchema,
          expectedSceneVersion: versionSchema,
          sourceTokenId: uuidSchema,
          targetTokenId: uuidSchema
        })
      )
    ),
    null
  )
})

export const resolveRuleOccurrenceInputDtoSchema = z.extend(commandBaseDtoSchema, {
  type: z.literal('RESOLVE_RULE_OCCURRENCE'),
  correlationId: z._default(z.optional(serverRuleExecutionCorrelationIdDtoSchema), null),
  occurrenceId: uuidSchema,
  expectedOccurrenceVersion: versionSchema,
  resolution: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('ENTER_DICE'),
      requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
      rawFaces: z
        .array(z.number().check(z.int()).check(z.gte(1)).check(z.lte(20)))
        .check(z.minLength(1))
        .check(z.maxLength(2))
    }),
    z.strictObject({
      kind: z.literal('SYSTEM_ROLL'),
      requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256))
    }),
    z.strictObject({
      kind: z.literal('ENTER_INTEGER'),
      requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
      value: z.number().check(z.int())
    }),
    z.strictObject({
      kind: z.literal('INITIATIVE_ENTITY'),
      requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
      entityId: uuidSchema
    }),
    z.strictObject({
      kind: z.literal('INITIATIVE_DECLARATION'),
      requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
      primary: initiativeDeclarationSelectionDtoSchema,
      bonus: z.nullable(initiativeDeclarationSelectionDtoSchema)
    }),
    ...movementReactionChoiceSelectionDtoSchema._zod.def.options,
    z.strictObject({ kind: z.literal('PASSAGE_DECLINE') }),
    z.strictObject({ kind: z.literal('PASSAGE_OPTION'), optionId: checksumSchema })
  ])
})
export type ResolveEncounterActionInputDto = z.infer<typeof resolveEncounterActionInputDtoSchema>
export type ResolveRuleOccurrenceInputDto = z.infer<typeof resolveRuleOccurrenceInputDtoSchema>
