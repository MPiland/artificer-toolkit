import { z, lazySchema } from '../zod.js'
import { characterResourcePoolIdentitySchema } from './characterResourceIdentity.js'
import { postgresUuidSchema } from './postgresUuid.js'
import type { D20WindowPausePayloadDto } from './ruleExecutionD20WindowOffer.js'
import { ruleExecutionChecksumSchema as checksumSchema } from './ruleExecutionPrimitives.js'
import { serverCompletedRuleExecutionDtoSchema } from './ruleExecutionProtocol.js'

import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'

const countSchema = () => z.number().check(z.int()).check(z.gte(1)).check(z.lte(2_147_483_647))

const damageRerollCostShape = () => ({
  modifierId: postgresUuidSchema,
  label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500)),
  chargeId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
  cost: countSchema(),
  poolId: characterResourcePoolIdentitySchema,
  maxDice: countSchema()
})

/**
 * A cost a caster may pay once its cast rolls damage against one target, to reroll up to `maxDice`
 * of the damage dice; the new rolls stand (D208).
 */
export const damageRerollCostDtoSchema = lazySchema(() => z.strictObject(damageRerollCostShape()))
export type DamageRerollCostDto = z.infer<typeof damageRerollCostDtoSchema>

/** One damage die a phase rolled: the request that rolled it, its size and the face it rolled. */
export const rolledDamageDieDtoSchema = lazySchema(() =>
  z.strictObject({
    requestId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
    faces: z.number().check(z.int()).check(z.gte(2)).check(z.lte(1_000)),
    value: z.number().check(z.int()).check(z.gte(1)).check(z.lte(1_000))
  })
)
export type RolledDamageDieDto = z.infer<typeof rolledDamageDieDtoSchema>

/** The id of the option that pays one damage reroll cost, sealed to the damage roll it was offered for. */
export function damageRerollOptionId(input: { executionChecksum: string; modifierId: string }) {
  return checksumRuleDocument({ kind: 'ROLL_WINDOW_DAMAGE_REROLL', ...input })
}

/**
 * A d20 window extended to a damage roll (D208): the completed phase that rolled the damage, the
 * dice it rolled, and the costs its caster may pay to reroll some of them. The window's answer
 * replays the phase with the chosen dice rolled again.
 */
export const damageRollWindowPayloadDtoSchema = lazySchema(() =>
  z
    .strictObject({
      damage: z.strictObject({
        execution: serverCompletedRuleExecutionDtoSchema,
        dice: z
          .array(rolledDamageDieDtoSchema)
          .check(z.minLength(1))
          .check(z.maxLength(RULE_GRAPH_LIMITS.NODES))
      }),
      offer: z.strictObject({
        /** Seals the options to the damage roll they follow. */
        executionChecksum: checksumSchema,
        options: z
          .array(z.strictObject({ optionId: checksumSchema, ...damageRerollCostShape() }))
          .check(z.minLength(1))
          .check(z.maxLength(50))
      })
    })
    .check(
      z.refine(
        ({ damage, offer }) =>
          offer.executionChecksum === checksumRuleDocument(damage.execution) &&
          new Set(damage.dice.map(({ requestId }) => requestId)).size === damage.dice.length,
        'A damage window offers each rolled die once, sealed to the roll.'
      )
    )
)
export type DamageRollWindowPayloadDto = z.infer<typeof damageRollWindowPayloadDtoSchema>

/** Whether a roll window follows a damage roll rather than a d20. */
export const isDamageRollWindow = (
  payload: D20WindowPausePayloadDto | DamageRollWindowPayloadDto
): payload is DamageRollWindowPayloadDto => 'damage' in payload
