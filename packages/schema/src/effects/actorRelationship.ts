import { z, lazySchema, lazySchemaParts } from '../zod.js'
import { attackSlotConditionDtoSchema } from '../features/attackSlots.js'
import { activationDtoSchema } from './activation.js'
import { checkChoiceDtoSchema, escapeDcDtoSchema } from './check.js'
import { damageDtoSchema } from './damage.js'
import { forcedMovementDtoSchema } from './forcedMovement.js'
import { conditionDtoSchema } from './condition.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredPositiveLengthAmountSchema
} from '../shared/authoredLimits.js'
import { lengthUnitCodeSchema, pathLifecycleTurnAnchorDtoSchema } from '../shared/enums.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { savingThrowDtoSchema } from '../shared/savingThrow.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'

const moduleBase = lazySchemaParts(() => ({
  id: postgresUuidSchema,
  order: z.number().check(z.int()).check(z.gte(0))
}))
const uuidList = lazySchema(() =>
  authoredNestedCollectionSchema(postgresUuidSchema).check(z.minLength(1))
)

export const actorRelationshipModuleDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.object({
      ...moduleBase(),
      kind: z.literal('TARGET_SIZE_MAXIMUM'),
      sizeCode: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80))
    }),
    z.object({
      ...moduleBase(),
      kind: z.literal('SOURCE_ACTION_TARGET_RESTRICTION'),
      actionEffectIds: uuidList
    }),
    z.object({
      ...moduleBase(),
      kind: z.literal('SOURCE_ATTACK_ROLL_INFLUENCE'),
      /** The attack action effects it influences; an empty list influences every attack against the target. */
      actionEffectIds: authoredNestedCollectionSchema(postgresUuidSchema),
      influence: systemCoreCodeSchema
    }),
    z.object({ ...moduleBase(), kind: z.literal('SOURCE_FOLLOWS_TARGET') }),
    /**
     * The hold stands whatever its source does or wherever it stands: it does not end when the
     * source can no longer act or the held creature is beyond the reach it sealed. Only an escape
     * or a rescue ends it (a net).
     */
    z.object({ ...moduleBase(), kind: z.literal('SOURCE_INDEPENDENT_HOLD') }),
    /** Each creature held this way fills one of the source's free hands (D152). */
    z.object({ ...moduleBase(), kind: z.literal('SOURCE_OCCUPIES_HAND') }),
    /**
     * The source's voluntary moves drag each creature held this way along the same displacement,
     * at double cost unless it is two or more sizes smaller (D105).
     */
    z.object({ ...moduleBase(), kind: z.literal('TARGET_DRAGGED') }),
    z.object({
      ...moduleBase(),
      kind: z.literal('SOURCE_RELEASE_MOVEMENT_COST'),
      amount: authoredPositiveLengthAmountSchema,
      unit: lengthUnitCodeSchema
    }),
    z.object({
      ...moduleBase(),
      kind: z.literal('ESCAPE_CHECK'),
      activation: activationDtoSchema,
      checks: checkChoiceDtoSchema,
      dc: escapeDcDtoSchema,
      actorKinds: authoredNestedCollectionSchema(z.enum(['TARGET', 'CREATURE_WITHIN_REACH'])).check(
        z.minLength(1)
      ),
      /**
       * Where a won contested escape moves the hold's source, pushed by the escaper: a dislodged
       * climber lands beside the creature it clung to. Absent, the source stays where it is.
       */
      holderForcedMovement: z.optional(forcedMovementDtoSchema)
    }),
    z.object({
      ...moduleBase(),
      kind: z.literal('TARGET_CAPABILITY_SUPPRESSION'),
      capabilityDefinitionIds: uuidList
    }),
    z.object({
      ...moduleBase(),
      kind: z.literal('CONDITIONAL_TARGET_STATE'),
      whenResolvedAttackD20Mode: systemCoreCodeSchema,
      conditionIds: uuidList,
      capabilityDefinitionIds: uuidList
    })
  ])
)

export const actorRelationshipDtoSchema = lazySchema(() =>
  z
    .object({
      id: authoredIdentifierSchema,
      effectKind: z.literal('ACTOR_RELATIONSHIP'),
      /** The most creatures this outcome holds at once, counted per outcome (D105). */
      heldAtOnce: z.number().check(z.int()).check(z.gte(1)),
      /**
       * The hold applies only while this predicate holds over the open Attack action (D93):
       * absent, it always applies; outside an open Attack action a gated outcome never applies.
       */
      appliesWhen: z.optional(attackSlotConditionDtoSchema),
      modules: authoredNestedCollectionSchema(actorRelationshipModuleDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(32)),
      conditions: z.optional(authoredNestedCollectionSchema(conditionDtoSchema)),
      /**
       * The outcome the held creature suffers at each counted turn boundary while the hold stands:
       * damage, or hit points lost directly (no damage type, so resistance and vulnerability never
       * apply). With a saving throw, only when it fails that save. The hold stands either way.
       */
      recurrence: z.optional(
        z.object({
          turnAnchor: pathLifecycleTurnAnchorDtoSchema,
          savingThrow: z.optional(savingThrowDtoSchema),
          outcome: z.union([
            damageDtoSchema,
            z.object({
              id: authoredIdentifierSchema,
              effectKind: z.literal('HIT_POINT_LOSS'),
              diceConfig: authoredIdentifierSchema
            })
          ])
        })
      )
    })
    .check(
      z.superRefine((value, ctx) => {
        const ids = new Set<string>()
        for (const [index, module] of value.modules.entries()) {
          if (ids.has(module.id))
            ctx.addIssue({
              code: 'custom',
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
              code: 'custom',
              path: ['modules', index],
              message: 'Relationship modules must be ordered by order then identity.'
            })
          if (
            module.kind === 'ESCAPE_CHECK' &&
            module.holderForcedMovement &&
            (module.dc.kind !== 'CONTEST' || !module.actorKinds.includes('TARGET'))
          )
            ctx.addIssue({
              code: 'custom',
              path: ['modules', index, 'holderForcedMovement'],
              message: 'Only an escape the held creature contests moves the hold source.'
            })
        }
      })
    )
)

export type ActorRelationshipDto = z.infer<typeof actorRelationshipDtoSchema>
