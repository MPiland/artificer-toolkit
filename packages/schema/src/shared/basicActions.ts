import { featureEffectDtoSchema } from '../effects/effect.js'
import { z, lazySchema } from '../zod.js'

import { authoredNestedCollectionSchema } from './authoredLimits.js'
import { facetDtoSchema } from './facet.js'
import { postgresUuidSchema } from './postgresUuid.js'

/** The allowance a basic action spends; a free one spends none. */
export const basicActionCostDtoSchema = lazySchema(() => z.enum(['ACTION', 'BONUS_ACTION', 'FREE']))

/**
 * One System-authored basic combat action (Q11): the System names it and writes its rules text.
 * Its `effects` are authored actions, compiled and resolved through RESOLVE_ACTION like a
 * Feature's; the activation is the cost. `restrictions` limit which actors the entry applies to
 * (null = every actor) and are carried until the offering rules read them.
 */
export const basicActionReusableDefinitionDocumentDtoSchema = lazySchema(() =>
  z.strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal('BASIC_ACTION'),
    id: postgresUuidSchema,
    gameSystemId: postgresUuidSchema,
    rulesText: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(4_000)),
    actionCost: basicActionCostDtoSchema,
    restrictions: z.nullable(facetDtoSchema),
    effects: authoredNestedCollectionSchema(featureEffectDtoSchema)
  })
)
export type BasicActionReusableDefinitionDocumentDto = z.infer<
  typeof basicActionReusableDefinitionDocumentDtoSchema
>
