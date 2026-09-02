import { z } from 'zod'
import { activationDtoSchema } from './activation.js'
import { damageDtoSchema } from './damage.js'
import { conditionDtoSchema } from './condition.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema
} from '../shared/authoredLimits.js'
import { measurementUnitCodeSchema } from '../shared/enums.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

const moduleBase = { id: postgresUuidSchema, order: z.number().int().min(0) }
const uuidList = authoredNestedCollectionSchema(postgresUuidSchema).min(1)

export const actorRelationshipModuleDtoSchema = z.discriminatedUnion('kind', [
  z.object({
    ...moduleBase,
    kind: z.literal('TARGET_SIZE_MAXIMUM'),
    sizeCode: z.string().trim().min(1).max(80)
  }),
  z.object({ ...moduleBase, kind: z.literal('SOURCE_EXCLUSIVE_TARGET'), maximum: z.literal(1) }),
  z.object({
    ...moduleBase,
    kind: z.literal('SOURCE_ACTION_TARGET_RESTRICTION'),
    actionEffectIds: uuidList
  }),
  z.object({
    ...moduleBase,
    kind: z.literal('SOURCE_ATTACK_ROLL_INFLUENCE'),
    actionEffectIds: uuidList,
    influence: z.literal('ADVANTAGE')
  }),
  z.object({ ...moduleBase, kind: z.literal('SOURCE_FOLLOWS_TARGET') }),
  z.object({
    ...moduleBase,
    kind: z.literal('SOURCE_RELEASE_MOVEMENT_COST'),
    amount: z.number().positive(),
    unit: measurementUnitCodeSchema
  }),
  z.object({
    ...moduleBase,
    kind: z.literal('ESCAPE_CHECK'),
    activation: activationDtoSchema,
    abilityDefinitionId: postgresUuidSchema,
    fixedDc: z.number().int().positive(),
    actorKinds: authoredNestedCollectionSchema(z.enum(['TARGET', 'CREATURE_WITHIN_REACH'])).min(1)
  }),
  z.object({
    ...moduleBase,
    kind: z.literal('TARGET_CAPABILITY_SUPPRESSION'),
    capabilityDefinitionIds: uuidList
  }),
  z.object({
    ...moduleBase,
    kind: z.literal('CONDITIONAL_TARGET_STATE'),
    whenResolvedAttackD20Mode: z.literal('ADVANTAGE'),
    conditionIds: uuidList,
    capabilityDefinitionIds: uuidList
  })
])

export const actorRelationshipDtoSchema = z
  .object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('ACTOR_RELATIONSHIP'),
    modules: authoredNestedCollectionSchema(actorRelationshipModuleDtoSchema).min(1).max(32),
    conditions: authoredNestedCollectionSchema(conditionDtoSchema).optional(),
    recurrence: z.object({ stage: z.literal('START_OF_TURN'), damage: damageDtoSchema }).optional()
  })
  .superRefine((value, ctx) => {
    const ids = new Set<string>()
    for (const [index, module] of value.modules.entries()) {
      if (ids.has(module.id))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['modules', index, 'id'],
          message: 'Relationship module identities must be unique.'
        })
      ids.add(module.id)
      const prior = value.modules[index - 1]
      if (
        prior &&
        (prior.order > module.order || (prior.order === module.order && prior.id >= module.id))
      )
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['modules', index],
          message: 'Relationship modules must be ordered by order then identity.'
        })
    }
  })

export type ActorRelationshipDto = z.infer<typeof actorRelationshipDtoSchema>
