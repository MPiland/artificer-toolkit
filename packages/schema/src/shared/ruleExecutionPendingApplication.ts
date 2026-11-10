import { z, lazySchema } from '../zod.js'
import { encounterActionPendingContextDtoSchema } from './encounterActionPending.js'

import {
  encounterConcealmentCheckPendingContextDtoSchema,
  encounterDamageSaveCheckPendingContextDtoSchema,
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
  | z.infer<typeof encounterDamageSaveCheckPendingContextDtoSchema>
  | z.infer<typeof encounterEscapeCheckPendingContextDtoSchema>
  | z.infer<typeof encounterConcealmentCheckPendingContextDtoSchema>
  | z.infer<typeof encounterD20WindowPendingContextDtoSchema>
  | z.infer<typeof encounterCheckActionPendingContextDtoSchema>

const serverRuleExecutionPendingApplicationContextDtoSchemaImpl: z.ZodMiniType<ServerRuleExecutionPendingApplicationContextDto> =
  lazySchema(() =>
    z.discriminatedUnion('kind', [
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
      encounterDamageSaveCheckPendingContextDtoSchema,
      encounterEscapeCheckPendingContextDtoSchema,
      encounterConcealmentCheckPendingContextDtoSchema,
      encounterD20WindowPendingContextDtoSchema,
      encounterCheckActionPendingContextDtoSchema
    ])
  )

export const serverRuleExecutionPendingApplicationContextDtoSchema: z.ZodMiniType<
  z.infer<typeof serverRuleExecutionPendingApplicationContextDtoSchemaImpl>
> = serverRuleExecutionPendingApplicationContextDtoSchemaImpl

export type ServerContestCheckPendingApplicationContextDto = Extract<
  ServerRuleExecutionPendingApplicationContextDto,
  { kind: 'ENCOUNTER_CONTEST_CHECK' }
>
