import { z, lazySchema, lazySchemaParts } from '../zod.js'

import { authoredLengthAmountSchema } from './authoredLimits.js'
import { combatPerceptionContributionsDtoSchema } from './combatPerception.js'
import { lengthUnitCodeSchema } from './enums.js'
import { postgresUuidSchema } from './postgresUuid.js'
import { systemCoreCodeSchema } from './systemCoreCode.js'

const uuidSchema = lazySchema(() =>
  z.pipe(
    postgresUuidSchema,
    z.transform((value) => value.toLowerCase())
  )
)
const checksumSchema = lazySchema(() => z.string().check(z.regex(/^[a-f0-9]{64}$/)))

/**
 * When a capability's usage comes back: `START_OF_TURN` is refreshed at its holder's turn start;
 * `EACH_TURN` lapses by itself when any turn starts, since its usage is kept with the turn it was
 * spent on (`resources.turnUsage`).
 */
export const ruleCapabilityRefreshBoundaryDtoSchema = lazySchema(() =>
  z.enum(['START_OF_TURN', 'EACH_TURN'])
)

/** A System-owned capability with optional bounded aggregate usage. */
export const ruleCapabilityReusableDefinitionDocumentDtoSchema = lazySchema(() =>
  z.strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal('RULE_CAPABILITY'),
    id: uuidSchema,
    gameSystemId: uuidSchema,
    usage: z.nullable(
      z.strictObject({
        maximum: z.number().check(z.int()).check(z.positive()).check(z.lte(10_000)),
        refreshBoundary: ruleCapabilityRefreshBoundaryDtoSchema
      })
    )
  })
)

export const ruleCapabilitySuppressionDtoSchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    order: z.number().check(z.int()).check(z.gte(0)).check(z.lte(9_999)),
    kind: z.literal('CAPABILITY_SUPPRESS'),
    capabilityDefinitionIds: z
      .array(uuidSchema)
      .check(z.minLength(1))
      .check(z.maxLength(32))
      .check(
        z.superRefine((ids, context) => {
          if (new Set(ids).size !== ids.length)
            context.addIssue({
              code: 'custom',
              message: 'Suppressed capability definition identities must be unique.'
            })
          if (ids.some((id, index) => index > 0 && ids[index - 1]! >= id))
            context.addIssue({
              code: 'custom',
              message: 'Suppressed capability definition identities must be sorted.'
            })
        })
      )
  })
)

const sortedUniqueUuidsSchema = lazySchema(() =>
  z
    .array(uuidSchema)
    .check(z.maxLength(32))
    .check(
      z.superRefine((ids, context) => {
        if (ids.some((id, index) => index > 0 && ids[index - 1]! >= id))
          context.addIssue({
            code: 'custom',
            message: 'Condition mechanic identities must be unique and sorted.'
          })
      })
    )
)

/**
 * Where an attacker stands for a condition mechanic, measured between token footprints. Without a
 * Scene to measure on, a melee attack counts as within and a ranged attack as beyond (D94).
 */
export const conditionMechanicAttackRangeDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('ANY') }),
    z.strictObject({
      kind: z.enum(['WITHIN', 'BEYOND']),
      distance: z.strictObject({
        amount: authoredLengthAmountSchema,
        unit: lengthUnitCodeSchema
      })
    })
  ])
)

/** The d20 rolls a condition's advantage or disadvantage applies to. */
export const conditionMechanicRollScopeDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('ATTACKS_BY') }),
    z.strictObject({
      kind: z.literal('ATTACKS_AGAINST'),
      range: conditionMechanicAttackRangeDtoSchema
    }),
    z.strictObject({ kind: z.literal('ABILITY_CHECKS') }),
    /** Every saving throw when `abilityDefinitionIds` is null. */
    z.strictObject({
      kind: z.literal('SAVES'),
      abilityDefinitionIds: z.nullable(sortedUniqueUuidsSchema)
    })
  ])
)

const conditionMechanicFields = lazySchemaParts(() => ({
  id: uuidSchema,
  order: z.number().check(z.int()).check(z.gte(0)).check(z.lte(9_999)),
  /**
   * The level a leveled condition (Exhaustion) needs for this mechanic, which every higher level
   * keeps; null applies at any level.
   */
  minimumLevel: z.nullable(z.number().check(z.int()).check(z.gte(1)).check(z.lte(20)))
}))

/**
 * One typed rule a condition applies while an actor has it (D94). Rules the Encounter room
 * evaluates: d20 roll modes, saves that fail without a roll, a speed of 0 or a fraction, hits that
 * become critical and damage defenses.
 */
export const conditionMechanicDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      ...conditionMechanicFields(),
      kind: z.literal('D20_ROLL_MODE'),
      influence: systemCoreCodeSchema,
      roll: conditionMechanicRollScopeDtoSchema,
      /**
       * Applies only while the holder can see a recorded source of the condition; a holding with no
       * recorded source applies it always. Not on SAVES, which fold into the actor at load.
       */
      requiresHolderSeesSource: z.optional(z.literal(true))
    }),
    z.strictObject({
      ...conditionMechanicFields(),
      kind: z.literal('SAVE_AUTO_FAIL'),
      abilityDefinitionIds: sortedUniqueUuidsSchema.check(z.minLength(1))
    }),
    z.strictObject({
      ...conditionMechanicFields(),
      kind: z.literal('SPEED'),
      /** A speed multiplied by `numerator / denominator`, rounded down; 0 sets it to 0. */
      numerator: z.number().check(z.int()).check(z.gte(0)).check(z.lte(100)),
      denominator: z.number().check(z.int()).check(z.positive()).check(z.lte(100))
    }),
    z.strictObject({
      ...conditionMechanicFields(),
      kind: z.literal('HITS_AGAINST_CRITICAL'),
      range: conditionMechanicAttackRangeDtoSchema
    }),
    /** A voluntary move that ends closer to a recorded source is a rule warning (ADR 0034). */
    z.strictObject({
      ...conditionMechanicFields(),
      kind: z.literal('APPROACH_SOURCE_FORBIDDEN')
    }),
    /** A damage defense the holder has against each listed damage type (SPELLS-10). */
    z.strictObject({
      ...conditionMechanicFields(),
      kind: z.literal('DAMAGE_DEFENSE'),
      defense: z.enum(['RESISTANCE', 'IMMUNITY', 'VULNERABILITY']),
      damageTypeIds: sortedUniqueUuidsSchema.check(z.minLength(1))
    })
  ])
)

/**
 * UUID-backed condition policy: the capabilities a condition suppresses, its perception
 * contributions and its typed mechanics (D94), never parsed from prose.
 */
export const conditionRuleStateReusableDefinitionDocumentDtoSchema = lazySchema(() =>
  z
    .strictObject({
      schemaVersion: z.literal(1),
      kind: z.literal('CONDITION_RULE_STATE'),
      id: uuidSchema,
      gameSystemId: uuidSchema,
      capabilitySuppressions: z.array(ruleCapabilitySuppressionDtoSchema).check(z.maxLength(32)),
      perceptionContributions: combatPerceptionContributionsDtoSchema,
      mechanics: z.array(conditionMechanicDtoSchema).check(z.maxLength(32))
    })
    .check(
      z.superRefine((document, context) => {
        const contributionIds = new Set<string>()
        for (const field of ['capabilitySuppressions', 'mechanics'] as const) {
          const contributions: readonly { id: string; order: number }[] = document[field]
          for (const [index, contribution] of contributions.entries()) {
            if (contributionIds.has(contribution.id))
              context.addIssue({
                code: 'custom',
                path: [field, index, 'id'],
                message: 'Condition rule-state contribution identities must be unique.'
              })
            contributionIds.add(contribution.id)
            const prior = contributions[index - 1]
            if (
              prior &&
              (prior.order > contribution.order ||
                (prior.order === contribution.order && prior.id >= contribution.id))
            )
              context.addIssue({
                code: 'custom',
                path: [field, index],
                message:
                  'Condition rule-state contributions must be ordered by order then identity.'
              })
          }
        }
        for (const [index, mechanic] of document.mechanics.entries())
          if (
            mechanic.kind === 'D20_ROLL_MODE' &&
            mechanic.requiresHolderSeesSource &&
            mechanic.roll.kind === 'SAVES'
          )
            context.addIssue({
              code: 'custom',
              path: ['mechanics', index, 'requiresHolderSeesSource'],
              message: 'A save mode folds into the actor at load and cannot depend on sight.'
            })
      })
    )
)

export const pinnedConditionRuleStateDefinitionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      conditionDefinitionId: uuidSchema,
      definitionVersion: z.number().check(z.int()).check(z.positive()),
      definitionContractVersion: z.number().check(z.int()).check(z.positive()).check(z.lte(10_000)),
      definitionChecksum: checksumSchema,
      document: conditionRuleStateReusableDefinitionDocumentDtoSchema
    })
    .check(
      z.superRefine((definition, context) => {
        if (definition.conditionDefinitionId !== definition.document.id)
          context.addIssue({
            code: 'custom',
            path: ['document', 'id'],
            message: 'Pinned condition rule-state identity must match its document.'
          })
      })
    )
)

export const pinnedRuleCapabilityDefinitionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      capabilityDefinitionId: uuidSchema,
      definitionVersion: z.number().check(z.int()).check(z.positive()),
      definitionContractVersion: z.number().check(z.int()).check(z.positive()).check(z.lte(10_000)),
      definitionChecksum: checksumSchema,
      document: ruleCapabilityReusableDefinitionDocumentDtoSchema
    })
    .check(
      z.superRefine((definition, context) => {
        if (definition.capabilityDefinitionId !== definition.document.id)
          context.addIssue({
            code: 'custom',
            path: ['document', 'id'],
            message: 'Pinned rule-capability identity must match its document.'
          })
      })
    )
)

export const resolvedRuleCapabilityAvailabilityDtoSchema = lazySchema(() =>
  z.strictObject({
    capability: pinnedRuleCapabilityDefinitionDtoSchema,
    available: z.boolean(),
    suppressingConditionDefinitionIds: z.array(uuidSchema).check(z.maxLength(32)),
    suppressingActiveEffectIds: z.array(uuidSchema).check(z.maxLength(32)),
    activeEffectSuppressions: z
      .array(
        z.strictObject({
          activeEffectId: uuidSchema,
          contributionId: uuidSchema
        })
      )
      .check(z.maxLength(32)),
    contributionIds: z.array(uuidSchema).check(z.maxLength(32))
  })
)

export const resolvedRuleCapabilityStateDtoSchema = lazySchema(() =>
  z
    .strictObject({
      schemaVersion: z.literal(1),
      gameSystemId: uuidSchema,
      conditionDefinitions: z
        .array(pinnedConditionRuleStateDefinitionDtoSchema)
        .check(z.maxLength(100)),
      capabilities: z.array(resolvedRuleCapabilityAvailabilityDtoSchema).check(z.maxLength(32)),
      checksum: checksumSchema
    })
    .check(
      z.superRefine((state, context) => {
        for (const [index, definition] of state.conditionDefinitions.entries())
          if (definition.document.gameSystemId !== state.gameSystemId)
            context.addIssue({
              code: 'custom',
              path: ['conditionDefinitions', index, 'document', 'gameSystemId'],
              message: 'Condition rule-state definition must belong to the resolved Game System.'
            })
        for (const [index, availability] of state.capabilities.entries())
          if (availability.capability.document.gameSystemId !== state.gameSystemId)
            context.addIssue({
              code: 'custom',
              path: ['capabilities', index, 'capability', 'document', 'gameSystemId'],
              message: 'Rule capability definition must belong to the resolved Game System.'
            })
        if (
          state.conditionDefinitions.some(
            (definition, index) =>
              index > 0 &&
              state.conditionDefinitions[index - 1]!.conditionDefinitionId >=
                definition.conditionDefinitionId
          )
        )
          context.addIssue({
            code: 'custom',
            path: ['conditionDefinitions'],
            message: 'Pinned condition rule-state definitions must be unique and sorted.'
          })
        if (
          state.capabilities.some(
            (availability, index) =>
              index > 0 &&
              state.capabilities[index - 1]!.capability.capabilityDefinitionId >=
                availability.capability.capabilityDefinitionId
          )
        )
          context.addIssue({
            code: 'custom',
            path: ['capabilities'],
            message: 'Resolved rule capabilities must be unique and sorted.'
          })
      })
    )
)

export type RuleCapabilityRefreshBoundaryDto = z.infer<
  typeof ruleCapabilityRefreshBoundaryDtoSchema
>
export type RuleCapabilityReusableDefinitionDocumentDto = z.infer<
  typeof ruleCapabilityReusableDefinitionDocumentDtoSchema
>
export type RuleCapabilitySuppressionDto = z.infer<typeof ruleCapabilitySuppressionDtoSchema>
export type ConditionRuleStateReusableDefinitionDocumentDto = z.infer<
  typeof conditionRuleStateReusableDefinitionDocumentDtoSchema
>
export type ConditionMechanicDto = z.infer<typeof conditionMechanicDtoSchema>
export type ConditionMechanicAttackRangeDto = z.infer<typeof conditionMechanicAttackRangeDtoSchema>
export type PinnedConditionRuleStateDefinitionDto = z.infer<
  typeof pinnedConditionRuleStateDefinitionDtoSchema
>
export type PinnedRuleCapabilityDefinitionDto = z.infer<
  typeof pinnedRuleCapabilityDefinitionDtoSchema
>
export type ResolvedRuleCapabilityAvailabilityDto = z.infer<
  typeof resolvedRuleCapabilityAvailabilityDtoSchema
>
export type ResolvedRuleCapabilityStateDto = z.infer<typeof resolvedRuleCapabilityStateDtoSchema>
