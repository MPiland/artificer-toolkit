import { z, lazySchemaParts } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { MAX_GROUP_COUNT } from '../shared/authoredLimits.js'

const summonPickOptionsSchema = () =>
  z.optional(
    z
      .array(
        z.strictObject({
          id: postgresUuidSchema,
          label: z.string().check(z.minLength(1)).check(z.maxLength(160)),
          /** A form that may be conjured as a group: the most creatures the cast may pick. */
          maxCount: z.optional(
            z.number().check(z.int()).check(z.gte(2)).check(z.lte(MAX_GROUP_COUNT))
          )
        })
      )
      .check(z.minLength(1))
  )

/**
 * What a cast of a summon of a chosen form asks its caster to pick, in the room and on the Sheet
 * (SPELLS-34.T3): the System Creatures it may be (Find Familiar), and the Creature Types it may take
 * instead of its own. Each is absent for a summon that offers none. A form that may be a group
 * carries the most creatures a cast may pick (`maxCount`).
 */
export const summonPickOptionsShape = lazySchemaParts(() => ({
  summonForms: summonPickOptionsSchema(),
  creatureTypes: summonPickOptionsSchema()
}))

export interface SummonPickOptionsDto {
  summonForms?: { id: string; label: string; maxCount?: number }[]
  creatureTypes?: { id: string; label: string }[]
}

/**
 * The form and Creature Type a summon cast picked, and how many creatures a group form conjures
 * (absent means one); absent for a cast that picks none of them.
 */
export const summonPicksShape = lazySchemaParts(() => ({
  formId: z.optional(postgresUuidSchema),
  creatureTypeId: z.optional(postgresUuidSchema),
  count: z.optional(z.number().check(z.int()).check(z.gte(1)).check(z.lte(MAX_GROUP_COUNT)))
}))
