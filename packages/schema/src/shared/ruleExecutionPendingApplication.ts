import { z, lazySchema } from '../zod.js'
import { encounterActionPendingContextDtoSchema } from './encounterActionPending.js'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'

import {
  encounterActorRuleActionPendingContextDtoSchema,
  encounterActorSpellCastPendingContextDtoSchema,
  encounterBasicActionCheckPendingContextDtoSchema,
  encounterCharacterRuleActionPendingContextDtoSchema,
  encounterConcealmentCheckPendingContextDtoSchema,
  encounterDamageSaveCheckPendingContextDtoSchema,
  encounterCreatureRuleActionPendingContextDtoSchema,
  encounterEscapeCheckPendingContextDtoSchema
} from './ruleExecutionDirectActionPendingContexts.js'
import { encounterCheckActionPendingContextDtoSchema } from './ruleExecutionCheckAction.js'
import { encounterD20WindowPendingContextDtoSchema } from './ruleExecutionD20Window.js'
import {
  movementReactionPendingContextDtoSchema,
  spatialPendingContextDtoSchema
} from './ruleExecutionSpatialPendingContexts.js'
import { encounterInitiativePendingContextDtoSchema } from './ruleExecutionInitiativePending.js'
import { serverContestCheckPendingContextDtoSchema } from './ruleExecutionOptionalCombatPending.js'
import {
  legendaryActionEvidencePendingContextDtoSchema,
  turnDeathSavePendingContextDtoSchema,
  turnEffectPendingContextDtoSchema,
  turnRechargePendingContextDtoSchema,
  turnZoneEffectsPendingContextDtoSchema
} from './ruleExecutionTurnPending.js'

const noPendingApplicationContextDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('NONE')
  })
)

export type ServerRuleExecutionPendingApplicationContextDto =
  | z.infer<typeof noPendingApplicationContextDtoSchema>
  | z.infer<typeof encounterActionPendingContextDtoSchema>
  | z.infer<typeof turnEffectPendingContextDtoSchema>
  | z.infer<typeof turnZoneEffectsPendingContextDtoSchema>
  | z.infer<typeof turnRechargePendingContextDtoSchema>
  | z.infer<typeof turnDeathSavePendingContextDtoSchema>
  | z.infer<typeof spatialPendingContextDtoSchema>
  | z.infer<typeof movementReactionPendingContextDtoSchema>
  | z.infer<typeof legendaryActionEvidencePendingContextDtoSchema>
  | z.infer<typeof encounterInitiativePendingContextDtoSchema>
  | z.infer<typeof serverContestCheckPendingContextDtoSchema>
  | z.infer<typeof encounterCharacterRuleActionPendingContextDtoSchema>
  | z.infer<typeof encounterActorRuleActionPendingContextDtoSchema>
  | z.infer<typeof encounterActorSpellCastPendingContextDtoSchema>
  | z.infer<typeof encounterCreatureRuleActionPendingContextDtoSchema>
  | z.infer<typeof encounterDamageSaveCheckPendingContextDtoSchema>
  | z.infer<typeof encounterBasicActionCheckPendingContextDtoSchema>
  | z.infer<typeof encounterEscapeCheckPendingContextDtoSchema>
  | z.infer<typeof encounterConcealmentCheckPendingContextDtoSchema>
  | z.infer<typeof encounterD20WindowPendingContextDtoSchema>
  | z.infer<typeof encounterCheckActionPendingContextDtoSchema>

const serverRuleExecutionPendingApplicationContextDtoSchemaImpl: z.ZodMiniType<ServerRuleExecutionPendingApplicationContextDto> =
  lazySchema(() =>
    z
      .discriminatedUnion('kind', [
        noPendingApplicationContextDtoSchema,
        encounterActionPendingContextDtoSchema,
        turnEffectPendingContextDtoSchema,
        turnZoneEffectsPendingContextDtoSchema,
        turnRechargePendingContextDtoSchema,
        turnDeathSavePendingContextDtoSchema,
        spatialPendingContextDtoSchema,
        movementReactionPendingContextDtoSchema,
        legendaryActionEvidencePendingContextDtoSchema,
        encounterInitiativePendingContextDtoSchema,
        serverContestCheckPendingContextDtoSchema,
        encounterCharacterRuleActionPendingContextDtoSchema,
        encounterActorRuleActionPendingContextDtoSchema,
        encounterActorSpellCastPendingContextDtoSchema,
        encounterCreatureRuleActionPendingContextDtoSchema,
        encounterDamageSaveCheckPendingContextDtoSchema,
        encounterBasicActionCheckPendingContextDtoSchema,
        encounterEscapeCheckPendingContextDtoSchema,
        encounterConcealmentCheckPendingContextDtoSchema,
        encounterD20WindowPendingContextDtoSchema,
        encounterCheckActionPendingContextDtoSchema
      ])
      .check(
        z.superRefine((value, context) => {
          if (
            (value.kind !== 'ENCOUNTER_ACTOR_RULE_ACTION' &&
              value.kind !== 'ENCOUNTER_ACTOR_SPELL_CAST' &&
              value.kind !== 'ENCOUNTER_CREATURE_RULE_ACTION') ||
            value.phase.kind !== 'LEGENDARY_RESISTANCE_CHOICE'
          )
            return
          const { originalExecution, originalD20, originalExecutionChecksum } = value.phase
          const d20RequestTraces = originalExecution.evidence.trace.filter(
            (trace) =>
              trace.operation.key === 'evidence.integer-range' &&
              trace.operation.contractVersion === 1 &&
              trace.inputs.min === 1 &&
              trace.inputs.max === 20 &&
              trace.evidence?.kind === 'INTEGER_RANGE'
          )
          const d20ResultTraces = originalExecution.evidence.trace.filter(
            (trace) =>
              typeof trace.inputs.naturalD20 === 'number' &&
              typeof trace.inputs.modifier === 'number' &&
              typeof trace.inputs.threshold === 'number' &&
              typeof trace.inputs.contributorChecksum === 'string' &&
              typeof trace.outputs.contributorChecksum === 'string' &&
              typeof trace.outputs.total === 'number' &&
              typeof trace.outputs.resultPath === 'string'
          )
          const hasExactD20Evidence =
            d20RequestTraces.length === 1 &&
            d20ResultTraces.length === 1 &&
            d20RequestTraces.filter(
              (trace) =>
                trace.evidence?.requestId === originalD20.requestId &&
                trace.evidence.value === originalD20.selectedNatural
            ).length === 1 &&
            d20ResultTraces.filter(
              (trace) =>
                trace.inputs.naturalD20 === originalD20.selectedNatural &&
                trace.inputs.modifier === originalD20.modifier &&
                trace.inputs.threshold === originalD20.defenseOrDc &&
                trace.inputs.contributorChecksum === originalD20.contributorChecksum &&
                trace.outputs.contributorChecksum === originalD20.contributorChecksum &&
                trace.outputs.total === originalD20.total &&
                trace.outputs.resultPath === originalD20.resultPath
            ).length === 1
          if (
            checksumRuleDocument(originalExecution) !== originalExecutionChecksum ||
            originalExecution.outputs.resultPath !== 'ON_SAVE_FAIL' ||
            originalExecution.evidence.outputs.resultPath !== 'ON_SAVE_FAIL' ||
            originalD20.resultPath !== 'ON_SAVE_FAIL' ||
            !hasExactD20Evidence
          )
            context.addIssue({
              code: 'custom',
              path: ['phase'],
              message: 'Legendary Resistance pending action evidence is invalid.'
            })
        })
      )
  )

export const serverRuleExecutionPendingApplicationContextDtoSchema: z.ZodMiniType<
  z.infer<typeof serverRuleExecutionPendingApplicationContextDtoSchemaImpl>
> = serverRuleExecutionPendingApplicationContextDtoSchemaImpl

export type ServerContestCheckPendingApplicationContextDto = Extract<
  ServerRuleExecutionPendingApplicationContextDto,
  { kind: 'ENCOUNTER_CONTEST_CHECK' }
>
