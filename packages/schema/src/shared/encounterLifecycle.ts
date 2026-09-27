import { z, lazySchema } from '../zod.js'

import { ruleGraphPortNameDtoSchema } from '../api/rulesRuntime.js'
import { postgresUuidSchema as serverUuidIdentityDtoSchema } from './postgresUuid.js'

const checksumSchema = lazySchema(() => z.string().check(z.regex(/^[a-f0-9]{64}$/)))
const positiveVersionSchema = lazySchema(() =>
  z.number().check(z.int()).check(z.positive()).check(z.lte(10_000))
)

/** Canonical D&D 5e lifecycle definition identities used by authored source data. */
export const DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000e2'
export const DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID =
  '00000000-0000-4000-8000-0000000000e4'
export const DND5E_RECHARGE_4_LIFECYCLE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000e6'
export const DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000e8'
export const DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000ea'

export const dnd5eEncounterLifecycleExactGraphPinDtoSchema = lazySchema(() =>
  z.strictObject({
    definitionId: serverUuidIdentityDtoSchema,
    definitionVersion: positiveVersionSchema,
    definitionChecksum: checksumSchema
  })
)

const legendaryActionDocumentDtoSchema = lazySchema(() =>
  z.strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal('LEGENDARY_ACTION'),
    id: serverUuidIdentityDtoSchema,
    gameSystemId: serverUuidIdentityDtoSchema,
    eligibilityGraph: z.extend(dnd5eEncounterLifecycleExactGraphPinDtoSchema, {
      eligibleOutput: ruleGraphPortNameDtoSchema
    }),
    windowStage: z.literal('END_OF_OTHER_ACTOR_TURN'),
    refreshStage: z.literal('START_OF_TURN'),
    resourceRecovery: z.literal('FULL'),
    maximumActionsPerWindow: z.literal(1)
  })
)

const legendaryResistanceDocumentDtoSchema = lazySchema(() =>
  z.strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal('LEGENDARY_RESISTANCE'),
    id: serverUuidIdentityDtoSchema,
    gameSystemId: serverUuidIdentityDtoSchema,
    choiceGraph: z.extend(dnd5eEncounterLifecycleExactGraphPinDtoSchema, {
      useOutput: ruleGraphPortNameDtoSchema
    }),
    interruptedStage: z.literal('AFTER_FAILED_SAVE_BEFORE_OUTCOME'),
    replacement: z.literal('SAVE_SUCCESS')
  })
)

const rechargeDocumentDtoSchema = lazySchema(() =>
  z.strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal('RECHARGE'),
    id: serverUuidIdentityDtoSchema,
    gameSystemId: serverUuidIdentityDtoSchema,
    rechargeGraph: z.extend(dnd5eEncounterLifecycleExactGraphPinDtoSchema, {
      rechargedOutput: ruleGraphPortNameDtoSchema
    }),
    boundary: z.literal('START_OF_TURN'),
    recovery: z.literal('FULL')
  })
)

export const dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    legendaryActionDocumentDtoSchema,
    legendaryResistanceDocumentDtoSchema,
    rechargeDocumentDtoSchema
  ])
)

/** Internal System-policy result for one frozen Legendary Action window. */
export const legendaryActionEligibilityOutputDtoSchema = lazySchema(() =>
  z.strictObject({
    eligible: z.boolean()
  })
)

export type Dnd5eEncounterLifecycleReusableDefinitionDocumentDto = z.infer<
  typeof dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema
>
export type LegendaryActionEligibilityOutputDto = z.infer<
  typeof legendaryActionEligibilityOutputDtoSchema
>
