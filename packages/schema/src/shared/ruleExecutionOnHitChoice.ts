import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { z, lazySchema } from '../zod.js'
import { characterResourcePoolIdentitySchema } from './characterResourceIdentity.js'
import {
  serverRuleExecutionD20EvidenceDtoSchema,
  serverRuleExecutionD20PolicyDtoSchema,
  type ServerRuleExecutionD20EvidenceDto,
  type ServerRuleExecutionD20PolicyDto
} from './ruleExecutionEvidence.js'
import {
  serverCompletedRuleExecutionDtoSchema,
  type ServerCompletedRuleExecutionDto
} from './ruleExecutionProtocol.js'
import {
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import {
  encounterReactionOutcomeAuditDtoSchema,
  type EncounterReactionOutcomeAuditDto
} from './ruleExecutionReactionChoice.js'

/**
 * One way the attacker may pay for an optional on-hit rider: the rider (its authored effect) and its
 * cost, either the spell-slot level paid or the resource pool charged. The use option identity is
 * derived from the hit it was offered for.
 */
export const encounterOnHitOptionDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('SPELL_SLOT'),
      riderId: uuidSchema,
      /** The name of the Feature, option or feat that grants the rider. */
      riderLabel: z.string().check(z.minLength(1)),
      /** The slot level paid. */
      slotLevel: positiveIntegerSchema,
      useOptionId: checksumSchema
    }),
    z.strictObject({
      kind: z.literal('RESOURCE_POOL'),
      riderId: uuidSchema,
      riderLabel: z.string().check(z.minLength(1)),
      /** The resource pool charged. */
      poolId: characterResourcePoolIdentitySchema,
      /** The charges paid. */
      cost: positiveIntegerSchema,
      useOptionId: checksumSchema
    })
  ])
)
export type EncounterOnHitOptionDto = z.infer<typeof encounterOnHitOptionDtoSchema>

/** The way of paying an option names: the option without the identity derived from it. */
export type EncounterOnHitCost = DistributiveOmit<EncounterOnHitOptionDto, 'useOptionId'>

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

export function encounterOnHitUseOptionId({
  testExecutionChecksum,
  cost
}: {
  testExecutionChecksum: string
  cost: EncounterOnHitCost
}): string {
  return checksumRuleDocument({ kind: 'ON_HIT_USE', testExecutionChecksum, cost })
}

/** An option's use option identity is derived from the hit and the way of paying it is offered for, never free-standing. */
export function validateEncounterOnHitOption(
  option: EncounterOnHitOptionDto,
  testExecutionChecksum: string,
  context: z.core.$RefinementCtx,
  path: readonly (string | number)[]
) {
  const { useOptionId, ...cost } = option
  if (encounterOnHitUseOptionId({ testExecutionChecksum, cost }) !== useOptionId)
    context.addIssue({
      code: 'custom',
      path: [...path, 'useOptionId'],
      message: 'On-hit use option identity is invalid.'
    })
}

/**
 * A hit held for its attacker's choice to add an optional on-hit rider: the TEST execution that hit (as
 * it stands after any reaction), the reaction that preceded it, and every way the attacker may pay.
 * Declining declines them all.
 */
export type EncounterOnHitOfferDto = {
  testExecution: ServerCompletedRuleExecutionDto
  testD20: ServerRuleExecutionD20EvidenceDto
  d20: ServerRuleExecutionD20PolicyDto
  testExecutionChecksum: string
  /** The target's reaction decision this hit already passed through, when it had one. */
  reaction: EncounterReactionOutcomeAuditDto | null
  options: EncounterOnHitOptionDto[]
}

// Explicitly typed so the pending-context declarations stay within the compiler's size limit (TS7056).
export const encounterOnHitOfferDtoSchema: z.ZodMiniType<EncounterOnHitOfferDto> = lazySchema(() =>
  z.strictObject({
    testExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
    testD20: z.lazy(() => serverRuleExecutionD20EvidenceDtoSchema),
    d20: z.lazy(() => serverRuleExecutionD20PolicyDtoSchema),
    testExecutionChecksum: checksumSchema,
    reaction: z.nullable(z.lazy(() => encounterReactionOutcomeAuditDtoSchema)),
    options: z.array(encounterOnHitOptionDtoSchema).check(z.minLength(1)).check(z.maxLength(64))
  })
)

export type EncounterOnHitAuditDto = {
  selection: 'DECLINE' | 'USE'
  testExecutionChecksum: string
  /** The option used; present exactly when the rider was used. */
  option: EncounterOnHitOptionDto | null
}

/** What the attacker decided about an offered on-hit rider, sealed into the OUTCOME that follows it. */
export const encounterOnHitAuditDtoSchema: z.ZodMiniType<EncounterOnHitAuditDto> = lazySchema(() =>
  z
    .strictObject({
      selection: z.enum(['DECLINE', 'USE']),
      testExecutionChecksum: checksumSchema,
      option: z.nullable(encounterOnHitOptionDtoSchema)
    })
    .check(
      z.superRefine((value, context) => {
        if ((value.selection === 'USE') !== (value.option !== null))
          context.addIssue({
            code: 'custom',
            message: 'On-hit audit does not match its selection.'
          })
        if (value.option)
          validateEncounterOnHitOption(value.option, value.testExecutionChecksum, context, [
            'option'
          ])
      })
    )
)
